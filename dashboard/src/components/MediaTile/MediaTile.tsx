// Styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./MediaTile.module.scss";

const mc = mapClassesCurried(maps, true);

// Types
import type { CSSProperties } from "preact";

export interface Props {
  className?: string;
  style?: CSSProperties;
  name: string;
  height?: number;
}

export default function MediaTile({ className, style, name, height }: Props) {
  const classList = useClassList({
    defaultClass: "media-tile",
    className,
    maps,
    string: true,
  });

  return (
    <div
      className={classList}
      style={{ ...style, height: height ? `${height}px` : undefined }}
    >
      <a
        className={mc("media-tile__inner")}
        href={`/api/media/${name}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <p
          className={mc("media-tile__name")}
          style={{ lineHeight: height ? `${height - 8}px` : undefined }}
        >
          {name}
        </p>
      </a>
    </div>
  );
}
