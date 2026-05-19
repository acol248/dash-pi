declare global {
  namespace Dashboard {
    interface Media {
      name: string;
      size: number;
      recorded: number;
      modified: number;
      has_thumbnail: boolean;
    }
  }
}

export {};
