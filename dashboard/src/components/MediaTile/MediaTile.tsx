import { useState } from "preact/compat";

// Components
import Spinner from "../Spinner";

// Helpers
import { formatBytes } from "../../helpers";

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
  size: number;
  height?: number;
  hasThumbnail?: boolean;
  onClick?: () => void;
}

export default function MediaTile({
  className,
  style,
  name,
  size,
  height,
  hasThumbnail,
  onClick,
}: Props) {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const classList = useClassList({
    defaultClass: "media-tile",
    className,
    maps,
    string: true,
  });

  /**
   * Initiate download of media file
   */
  const handleDownload = () => {
    setIsDownloading(true);

    const link = document.createElement("a");
    link.href = `/api/media/${name}`;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsDownloading(false);
    }, 500);
  };

  return (
    <div
      className={classList}
      style={{ ...style, height: height ? `${height}px` : undefined }}
    >
      <button className={mc("media-tile__button")} onClick={onClick}>
        {hasThumbnail && (
          <img
            className={mc("media-tile__thumbnail")}
            src={`/api/media/${name}/thumbnail`}
          />
        )}

        <p className={mc("media-tile__name")}>{name}</p>
        <p className={mc("media-tile__size")}>{formatBytes(size)}</p>
      </button>
      <button className={mc("media-tile__download")} onClick={handleDownload}>
        {isDownloading ? (
          <Spinner />
        ) : (
          <svg viewBox="0 -960 960 960">
            <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58zM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160z" />
          </svg>
        )}
      </button>
    </div>
  );
}
