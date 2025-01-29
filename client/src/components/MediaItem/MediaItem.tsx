import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./MediaItem.module.scss";

const mc = mapClassesCurried(maps, true);

interface Props {
  className?: string;
  name: string;
  size: number;
  modified: string;
  onClick: () => void;
}

export default function MediaItem({
  className,
  name,
  size,
  modified,
  onClick,
}: Props) {
  const classList = useClassList({
    defaultClass: "media-item",
    className,
    maps,
    string: true,
  });

  return (
    <button className={classList} onClick={onClick} aria-label={name}>
      <div className={mc("media-item__thumbnail")}></div>

      <div className={mc("media-item__name")}>{name}</div>
      <div className={mc("media-item__size")}>{size}</div>
      <div className={mc("media-item__modified")}>
        {new Date(modified).toISOString()}
      </div>
    </button>
  );
}
