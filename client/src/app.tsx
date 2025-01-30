import { useEffect, useState } from "preact/hooks";

// components
import MediaItem from "./components/MediaItem";
import Player from "./components/Player";

// styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./app.module.scss";

// types
import type { GetMediaItemsRes } from "./app.d";

const mc = mapClassesCurried(maps, true);

export function App() {
  const [data, setData] = useState<GetMediaItemsRes["data"] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const classList = useClassList({ defaultClass: "app", maps, string: true });

  const selectedMedia = data?.find(
    ({ name, size }) => name + size === selected,
    [selected, data]
  );

  // get data
  useEffect(() => {
    if (data) return;

    fetch("/api/media", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }).then(async (res) => {
      const json: GetMediaItemsRes = await res.json();
      setData(json.data);
    });
  }, [data]);

  return (
    <div className={classList}>
      <Player
        className={mc("app__player")}
        src={selectedMedia ? `/api/video/${selectedMedia?.name}` : undefined}
        name={selectedMedia?.name}
      />

      <div className={mc("app__media-grid")}>
        {data &&
          data.map(({ name, size, modified }) => (
            <MediaItem
              className={mc(
                `app__media${name === selectedMedia?.name ? " app__media--selected" : ""}`
              )}
              key={name + size + modified}
              name={name}
              size={size}
              modified={modified}
              onClick={() => setSelected(name + size)}
            />
          ))}
      </div>
    </div>
  );
}
