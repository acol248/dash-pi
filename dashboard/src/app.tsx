import { useEffect, useRef, useState } from "preact/hooks";
import { useVirtualizer } from "@tanstack/react-virtual";

// Components
import MediaTile from "./components/MediaTile";
import Modal from "./components/Modal";
import Spinner from "./components/Spinner";

// Styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./app.module.scss";

const mc = mapClassesCurried(maps, true);

export function App() {
  const [loading, setLoading] = useState<boolean>(false);
  const [list, setList] = useState<Dashboard.Media[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const activePreview = useRef<Dashboard.Media["name"] | null>(null);

  const classList = useClassList({ defaultClass: "app", maps, string: true });

  const virtualiser = useVirtualizer({
    count: list ? list.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
  });

  /**
   * Refresh media list from server
   */
  const handleRefresh = () => {
    setLoading(true);

    fetch("/api/media")
      .then((res) => res.json())
      .then(setList)
      .finally(() => setLoading(false));
  };

  // load media list
  useEffect(() => {
    if (list) return;

    fetch("/api/media")
      .then((res) => res.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, [list]);

  return (
    <>
      <div className={classList}>
        {loading ? (
          <p>Loading...</p>
        ) : list && list?.length > 0 ? (
          <div className={mc("app__list")} ref={parentRef}>
            <div
              className={mc("app__list-inner")}
              style={{ height: `${virtualiser.getTotalSize()}px` }}
            >
              {virtualiser.getVirtualItems().map((item) => {
                const media = list?.[item.index];

                return (
                  <MediaTile
                    key={item.key}
                    className={mc("app__list-item")}
                    name={media?.name || "Unknown"}
                    size={media?.size || 0}
                    height={item.size}
                    hasThumbnail={media?.hasThumbnail}
                    style={{ transform: `translateY(${item.start}px)` }}
                    onClick={() => {
                      activePreview.current = media?.name || null;
                      setPreviewOpen(true);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <p className={mc("app__no-media")}>No media found.</p>
        )}

        <div className={mc("action-bar")}>
          <button
            className={mc("action-bar__button")}
            onClick={handleRefresh}
            aria-label="Refresh media list"
          >
            {loading ? (
              <Spinner />
            ) : (
              <svg viewBox="0 -960 960 960">
                <path d="M480-160q-134 0-227-93t-93-227 93-227 227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170 70 170 170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <Modal open={previewOpen} onOpenChange={setPreviewOpen}>
        <div className={mc("video-preview")}>
          <video src={`/api/media/${activePreview.current}`} controls />

          <span className={mc("video-preview__help")}>Tap to Dismiss</span>
        </div>
      </Modal>
    </>
  );
}
