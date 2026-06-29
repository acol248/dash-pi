use axum::{
    Router,
    extract::{ Path, Request, State },
    http::{ header, StatusCode },
    response::{ IntoResponse, Json },
    routing::{ get },
};
use serde::Serialize;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{ AtomicBool, Ordering };
use std::sync::Arc;
use std::time::SystemTime;
use tokio::time::{ sleep, Duration };
use tower::util::ServiceExt;
use tower_http::services::{ ServeDir, ServeFile };
use crate::config::Config;

#[derive(Clone)]
struct AppState {
    output_dir: PathBuf,
    last_preview_request: Arc<std::sync::atomic::AtomicU64>,
}

#[derive(Serialize)]
struct MediaFile {
    name: String,
    size: u64,
    recorded: u64,
    modified: u64,
    has_thumbnail: bool,
}

fn system_time_to_unix_secs(time: SystemTime) -> Option<u64> {
    time.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
}

fn parse_recorded_order_from_name(file_name: &str) -> Option<u64> {
    let stem = std::path::Path::new(file_name).file_stem()?.to_str()?;
    let sequence = stem.strip_prefix("rec_").or_else(|| stem.strip_prefix("tmp_"))?;
    sequence.parse::<u64>().ok()
}

/// Serves the latest preview frame as a JPEG with no-cache headers.
async fn get_preview(State(state): State<AppState>) -> impl IntoResponse {
    let now = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    state.last_preview_request.store(now, Ordering::SeqCst);

    let preview_path = state.output_dir.join("preview.jpg");
    match tokio::fs::read(&preview_path).await {
        Ok(bytes) =>
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "image/jpeg"),
                    (header::CACHE_CONTROL, "no-store, no-cache, must-revalidate"),
                    (header::PRAGMA, "no-cache"),
                ],
                bytes,
            ).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "No preview available").into_response(),
    }
}

/// Returns a JSON list of media files in the output directory, sorted newest first.
async fn list_media(State(state): State<AppState>) -> impl IntoResponse {
    let mut files = Vec::new();

    match tokio::fs::read_dir(&state.output_dir).await {
        Ok(mut entries) => {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let ext = path
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                if !matches!(ext.as_str(), "mp4" | "mkv" | "avi" | "h264" | "ts") {
                    continue;
                }
                // Exclude files with 'tmp' in the filename
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.contains("tmp") {
                    continue;
                }
                if let Ok(metadata) = entry.metadata().await {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(system_time_to_unix_secs)
                        .unwrap_or(0);
                    let created = metadata
                        .created()
                        .ok()
                        .and_then(system_time_to_unix_secs);
                    let recorded = parse_recorded_order_from_name(&file_name)
                        .or(created)
                        .unwrap_or(modified);
                    let thumb_path = path.with_extension("jpg");
                    let has_thumbnail = tokio::fs::try_exists(&thumb_path).await.unwrap_or(false);
                    files.push(MediaFile {
                        name: file_name,
                        size: metadata.len(),
                        recorded,
                        modified,
                        has_thumbnail,
                    });
                }
            }
        }
        Err(e) => {
            println!("Failed to read media directory: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read media directory",
            ).into_response();
        }
    }

    files.sort_by(|a, b| {
        b.recorded
            .cmp(&a.recorded)
            .then_with(|| b.modified.cmp(&a.modified))
    });
    Json(files).into_response()
}

/// Serves the JPEG thumbnail for a media file.
async fn get_thumbnail(
    State(state): State<AppState>,
    Path(filename): Path<String>,
    request: Request
) -> impl IntoResponse {
    // Reject any path traversal attempts.
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return (StatusCode::BAD_REQUEST, "Invalid filename").into_response();
    }

    // Accept the video filename and derive the thumbnail name, or accept a .jpg name directly.
    let thumb_name = if filename.ends_with(".jpg") {
        filename.clone()
    } else {
        let stem = std::path::Path
            ::new(&filename)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| filename.clone());
        format!("{}.jpg", stem)
    };

    let thumb_path = state.output_dir.join(&thumb_name);

    let metadata = match tokio::fs::metadata(&thumb_path).await {
        Ok(m) => m,
        Err(_) => return (StatusCode::NOT_FOUND, "Thumbnail not found").into_response(),
    };

    if !metadata.is_file() {
        return (StatusCode::NOT_FOUND, "Thumbnail not found").into_response();
    }

    match ServeFile::new(thumb_path).oneshot(request).await {
        Ok(response) => response.map(axum::body::Body::new).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to serve thumbnail").into_response(),
    }
}

/// Deletes a media file and its associated thumbnail.
async fn delete_media(
    State(state): State<AppState>,
    Path(filename): Path<String>
) -> impl IntoResponse {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return (StatusCode::BAD_REQUEST, "Invalid filename").into_response();
    }

    let file_path = state.output_dir.join(&filename);

    let canonical_dir = match tokio::fs::canonicalize(&state.output_dir).await {
        Ok(p) => p,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Server error").into_response();
        }
    };
    let canonical_file = match tokio::fs::canonicalize(&file_path).await {
        Ok(p) => {
            if !p.starts_with(&canonical_dir) {
                return (StatusCode::BAD_REQUEST, "Invalid filename").into_response();
            }
            p
        }
        Err(_) => {
            return (StatusCode::NOT_FOUND, "File not found").into_response();
        }
    };

    let metadata = match tokio::fs::metadata(&canonical_file).await {
        Ok(m) => m,
        Err(_) => {
            return (StatusCode::NOT_FOUND, "File not found").into_response();
        }
    };
    if !metadata.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    if let Err(e) = tokio::fs::remove_file(&file_path).await {
        println!("Failed to delete file {:?}: {}", file_path, e);
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete file").into_response();
    }

    let stem = std::path::Path
        ::new(&filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.clone());
    let thumb_path = state.output_dir.join(format!("{}.jpg", stem));
    let _ = tokio::fs::remove_file(&thumb_path).await;

    (StatusCode::NO_CONTENT, "").into_response()
}

/// Streams an individual media file, supporting HTTP range requests for seeking.
async fn stream_media(
    State(state): State<AppState>,
    Path(filename): Path<String>,
    request: Request
) -> impl IntoResponse {
    // Reject any path traversal attempts.
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return (StatusCode::BAD_REQUEST, "Invalid filename").into_response();
    }

    let file_path = state.output_dir.join(&filename);

    let metadata = match tokio::fs::metadata(&file_path).await {
        Ok(m) => m,
        Err(_) => return (StatusCode::NOT_FOUND, "File not found").into_response(),
    };

    if !metadata.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    match ServeFile::new(file_path).oneshot(request).await {
        Ok(response) => response.map(axum::body::Body::new).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to serve file").into_response(),
    }
}

pub async fn run_server(
    config: Config,
    running: Arc<AtomicBool>,
    last_preview_request: Arc<std::sync::atomic::AtomicU64>,
) {
    let index_path = config.web_root.join("index.html");
    let serve_dir = ServeDir::new(&config.web_root).fallback(ServeFile::new(index_path));

    let state = AppState {
        output_dir: config.output_dir.clone(),
        last_preview_request,
    };

    let app = Router::new()
        .route("/api/preview", get(get_preview))
        .route("/api/media", get(list_media))
        .route("/api/media/:filename", get(stream_media).delete(delete_media))
        .route("/api/media/:filename/thumbnail", get(get_thumbnail))
        .with_state(state)
        .fallback_service(serve_dir);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.web_port));
    println!("Web server listening on {}", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            println!("Failed to bind web server port {}: {}", config.web_port, e);
            return;
        }
    };

    let server = axum::serve(listener, app);

    let shutdown_signal = async move {
        loop {
            if !running.load(Ordering::SeqCst) {
                break;
            }
            sleep(Duration::from_millis(500)).await;
        }
        println!("Web server shutting down...");
    };

    if let Err(e) = server.with_graceful_shutdown(shutdown_signal).await {
        println!("Server error: {}", e);
    }
}
