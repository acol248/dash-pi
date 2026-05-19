import { useState } from "preact/compat";

// Components
import Popover, { PopoverClose } from "../Popover";
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
  onDelete: () => void;
  onClick: () => void;
}

export default function MediaTile({
  className,
  style,
  name,
  size,
  height,
  hasThumbnail,
  onDelete,
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
      <button
        className={mc("media-tile__button")}
        onClick={onClick}
        aria-label={`Preview ${name}`}
      >
        {hasThumbnail && (
          <img
            className={mc("media-tile__thumbnail")}
            src={`/api/media/${name}/thumbnail`}
          />
        )}

        <p className={mc("media-tile__name")}>{name}</p>
        <p className={mc("media-tile__size")}>{formatBytes(size)}</p>
      </button>

      <Popover
        className={mc("media-more")}
        align="center"
        side="left"
        sideOffset={4}
        trigger={
          <button
            className={mc("media-tile__more")}
            aria-label="More options for this media"
          >
            <svg viewBox="0 -960 960 960">
              <path d="M480-160q-33 0-56.5-23.5T400-240t23.5-56.5T480-320t56.5 23.5T560-240t-23.5 56.5T480-160m0-240q-33 0-56.5-23.5T400-480t23.5-56.5T480-560t56.5 23.5T560-480t-23.5 56.5T480-400m0-240q-33 0-56.5-23.5T400-720t23.5-56.5T480-800t56.5 23.5T560-720t-23.5 56.5T480-640" />
            </svg>
          </button>
        }
      >
        <button className={mc("media-more__option")} onClick={handleDownload}>
          {isDownloading ? (
            <Spinner />
          ) : (
            <svg viewBox="0 -960 960 960">
              <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58zM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160z" />
            </svg>
          )}
          <span>Download</span>
        </button>
        <PopoverClose>
          <button className={mc("media-more__option")} onClick={onDelete}>
            <svg viewBox="0 -960 960 960">
              <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120zm80-160h80v-360h-80zm160 0h80v-360h-80z" />
            </svg>
            <span>Delete</span>
          </button>
        </PopoverClose>
      </Popover>
    </div>
  );
}
