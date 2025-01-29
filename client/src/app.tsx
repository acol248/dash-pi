import { useEffect, useState } from "preact/hooks";

// components
import MediaItem from "./components/MediaItem";

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
      <div className={mc('app__player')}>
        <video
          src={`/api/video/${selectedMedia?.name}`}
          autoplay
          muted
          controls
        />
      </div>

      <div className={mc("app__media-grid")}>
        {data &&
          data.map(({ name, size, modified }) => (
            <MediaItem
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
