import { useEffect, useRef, useState } from "preact/hooks";
import { useVirtualizer } from "@tanstack/react-virtual";

// Components
import MediaTile from "./components/MediaTile";

// Styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./app.module.scss";
import Modal from "./components/Modal";

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
