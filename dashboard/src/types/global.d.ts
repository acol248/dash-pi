declare global {
  namespace Dashboard {
    interface Media {
      name: string;
      size: number;
      modified: number;
      has_thumbnail: boolean;
    }
  }
}

export {};
