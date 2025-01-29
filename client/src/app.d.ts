type MediaItem = {
  name: string;
  size: number;
  modified: string;
}

type GetMediaItemsRes = {
  data: MediaItem[];
  error: string | null;
}

export { MediaItem, GetMediaItemsRes };