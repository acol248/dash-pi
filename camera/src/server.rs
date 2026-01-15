use axum::Router;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tower_http::services::{ServeDir, ServeFile};
use crate::config::Config;

pub async fn run_server(config: Config, running: Arc<AtomicBool>) {
    let index_path = config.web_root.join("index.html");
    let serve_dir = ServeDir::new(&config.web_root)
        .fallback(ServeFile::new(index_path));

    let app = Router::new().fallback_service(serve_dir);

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
