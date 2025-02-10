interface ExtendedVideo extends HTMLVideoElement {
  mozHasAudio: boolean;
  webkitAudioDecodedByteCount: number;
  audioTracks: any;
}

export { ExtendedVideo }