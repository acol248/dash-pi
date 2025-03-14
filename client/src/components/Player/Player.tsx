import { useEffect, useMemo, useRef, useState } from "preact/hooks";

// helpers
import { downloadMedia, formatTime, hasAudio } from "../../helpers";

// styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./Player.module.scss";

// types
interface Props {
  className?: Element["className"];
  src: string | undefined;
  name: string | undefined;
}

const mc = mapClassesCurried(maps, true);

export default function Player({ className, src, name }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  const mediaHasAudio = useMemo(() => {
    return hasAudio(videoRef.current as any);
  }, [src]);

  const classList = useClassList({
    defaultClass: "player",
    className,
    maps,
    string: true,
  });

  /**
   * Handle video ended event
   */
  const onEnded = () => {
    setIsPlaying(false);
    setIsEnded(true);
  };

  /**
   * Toggle play/pause state of video
   */
  const onPlayPause = () => {
    setIsPlaying((p) => {
      if (!videoRef.current) return p;

      if (!p && isEnded) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsEnded(false);

        return !p;
      }

      if (!p) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }

      return !p;
    });
  };

  /**
   * Seek 10 seconds forwards and backwards
   *
   * @param dir seek direction
   */
  const onSeek10 = (dir = "forward") => {
    if (!videoRef.current) return;

    if (dir === "backward" && isEnded) setIsEnded(false);

    const seekBy = 10;
    const seekTo =
      dir === "forward"
        ? videoRef.current.currentTime + seekBy
        : videoRef.current.currentTime - seekBy;
    videoRef.current.currentTime = seekTo;
  };

  /**
   * Toggle mute/unmute state of video
   */
  const onToggleMuted = () => {
    setIsMuted((m) => {
      if (!videoRef.current) return m;

      videoRef.current.muted = !m;

      return !m;
    });
  };

  // reset video when src changes
  useEffect(() => {
    if (!src) {
      setIsPlaying(false);

      return;
    }

    setIsEnded(false);
    setIsPlaying(true);
  }, [src]);

  return (
    <div className={classList}>
      <video
        className={mc("player__video")}
        src={src}
        onEnded={onEnded}
        onTimeUpdate={(e) =>
          setCurrentTime((e.target as HTMLVideoElement)?.currentTime)
        }
        onLoadedData={(e) => {
          setDuration((e.target as HTMLVideoElement)?.duration);
        }}
        autoplay
        muted
        playsInline
        ref={videoRef}
      />

      <div className={mc("player__timings")}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className={mc("player__controls")}>
        <button
          className={mc("player__button player__button--small")}
          aria-label="Mute"
          title="Mute"
          onClick={onToggleMuted}
          disabled={!src || !mediaHasAudio}
        >
          {isMuted ? (
            <svg viewBox="0 -960 960 960">
              <path d="M672.91-170.3q-9.56 6.04-19.25 11.32-9.68 5.28-20.01 9.57-15.72 7.24-31.69-.12-15.98-7.36-21.98-24.32-5.76-14.76 1.02-28.9 6.78-14.14 20.35-22.1 3.04-1.52 5.7-3.04 2.67-1.52 5.71-3.04l-126.78-127.5v107.65q0 30.58-27.97 42.4t-49.6-9.82L274.74-351.87H155.46q-19.16 0-32.33-13.17-13.17-13.18-13.17-32.33v-165.26q0-19.15 13.17-32.33 13.17-13.17 32.33-13.17h82.97l-161.6-162.8q-11.72-11.72-11.6-29.2.12-17.48 11.84-29.2 11.71-11.71 29.19-11.59 17.48.12 29.2 11.83l688.37 692.92q11.71 11.71 11.71 29.19t-11.71 29.2q-11.72 11.71-29.32 11.71T765.2-77.78l-92.29-92.52ZM766.22-481q0-82.52-43.88-150.9-43.88-68.38-117.41-102.62-15.47-7.24-22.47-22.46-7-15.22-1.53-30.93 6.24-16.72 22.34-23.96 16.1-7.24 32.58 0 97.24 43.72 155.6 132.44Q849.8-590.72 849.8-481q0 33-5.88 65.14t-16.88 61.9q-8.24 22.96-25.33 28.82-17.1 5.86-31.82.62-14.72-5.24-23.57-18.96-8.86-13.72-.86-31.43 10.52-25.29 15.52-51.55 5-26.26 5.24-54.54ZM598.65-624.91q33.48 22.43 52.32 63.83Q669.8-519.67 669.8-480v8.8q0 4.53-.76 8.81-1.76 14.43-15.55 18.91-13.79 4.48-24.99-6.95l-49.09-49.33q-6.71-6.72-10.07-15.17-3.36-8.46-3.36-17.42v-74.37q0-12.71 10.98-18.69 10.97-5.98 21.69.5Zm-209.13-66.42q-6.72-6.71-6.6-15.91.12-9.2 6.84-15.91l18.65-18.65q21.63-21.64 49.6-9.82 27.97 11.82 27.97 42.4v60.13q0 15.68-13.8 21.39-13.79 5.72-24.98-5.47l-57.68-58.16Zm5.46 330.4v-89.46l-66.26-66.74H200.96v74.26h112.08l81.94 81.94Zm-33.13-122.83Z" />
            </svg>
          ) : (
            <svg viewBox="0 -960 960 960">
              <path d="M766.22-481q0-82.52-43.88-150.9-43.88-68.38-117.41-102.62-15.47-7.24-22.47-22.46-7-15.22-1.53-30.93 6.24-16.72 22.34-23.96 16.1-7.24 32.58 0 97.48 43.96 155.72 133.05Q849.8-589.72 849.8-481t-58.23 197.82q-58.24 89.09-155.72 133.05-16.48 7.24-32.58 0-16.1-7.24-22.34-23.96-5.47-15.71 1.53-30.93 7-15.22 22.47-22.46 73.53-34.24 117.41-102.62 43.88-68.38 43.88-150.9ZM274.98-351.87H155.7q-19.16 0-32.33-13.17-13.17-13.18-13.17-32.33v-165.26q0-19.15 13.17-32.33 13.17-13.17 32.33-13.17h119.28L408.65-741.8q21.63-21.64 49.6-9.82 27.97 11.82 27.97 42.4v458.44q0 30.58-27.97 42.4t-49.6-9.82L274.98-351.87ZM669.8-480q0 42.48-19.47 80.34-19.48 37.86-51.44 62.57-10.72 6.48-21.69.5-10.98-5.98-10.98-18.69v-251.44q0-12.71 10.98-18.57 10.97-5.86 21.69.62 31.96 25.71 51.44 63.95Q669.8-522.48 669.8-480ZM395.22-599.07l-81.94 81.94H201.2v74.26h112.08l81.94 81.94v-238.14ZM298.09-480Z" />
            </svg>
          )}
        </button>

        <button
          className={mc("player__button player__button--small")}
          aria-label="Rewind 10 seconds"
          title="Rewind 10 seconds"
          onClick={() => onSeek10("backward")}
          disabled={!src}
        >
          <svg viewBox="0 -960 960 960">
            <path d="M355.93-497.13h-27.84q-13.31 0-22.02-8.86-8.7-8.86-8.7-22.15t8.86-21.98q8.86-8.68 22.1-8.68h59.76q13.31 0 22.01 8.7 8.7 8.7 8.7 22.01v180.24q0 13.48-8.97 22.46-8.98 8.98-22.46 8.98t-22.46-8.98q-8.98-8.98-8.98-22.46v-149.28ZM498.8-316.41q-17 0-28.5-11.5t-11.5-28.5V-518.8q0-17 11.5-28.5t28.5-11.5h85.98q17 0 28.5 11.5t11.5 28.5v162.39q0 17-11.5 28.5t-28.5 11.5H498.8Zm23.11-61.68h40v-119.04h-40v119.04ZM480.05-70.43q-76.72 0-143.78-29.1-67.05-29.1-116.75-78.8-49.69-49.69-78.79-116.75-29.1-67.05-29.1-143.49 0-19.15 13.17-32.32 13.18-13.18 32.33-13.18t32.33 13.18q13.17 13.17 13.17 32.32 0 115.81 80.73 196.47Q364.1-161.43 480-161.43q115.9 0 196.64-80.74 80.73-80.73 80.73-196.63 0-115.81-80.9-196.47t-196.71-80.66h-6.24l30.89 30.89q12.48 12.47 12.1 29.31-.38 16.84-12.1 29.32-12.48 12.48-29.93 12.86-17.46.38-29.94-12.1L340.83-729.37q-13.68-13.76-13.68-32.11t13.68-32.02l103.71-103.72q12.48-12.48 29.94-12.1 17.45.39 29.93 13.1 11.72 12.48 11.98 29.44.26 16.95-12.22 29.43l-30.41 30.42h6q76.74 0 143.76 29.09 67.02 29.1 116.84 78.8 49.81 49.69 78.91 116.64 29.1 66.95 29.1 143.61 0 76.66-29.1 143.71-29.1 67.06-78.79 116.75-49.7 49.7-116.7 78.8-67.01 29.1-143.73 29.1Z" />
          </svg>
        </button>

        <button
          className={mc("player__button ")}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
          onClick={onPlayPause}
          disabled={!src}
        >
          {isPlaying ? (
            <svg viewBox="0 -960 960 960">
              <path d="M610.76-185.41q-37.54 0-64.27-26.73-26.73-26.74-26.73-64.27v-407.18q0-37.53 26.73-64.27 26.73-26.73 64.27-26.73h72.83q37.53 0 64.27 26.73 26.73 26.74 26.73 64.27v407.18q0 37.53-26.73 64.27-26.74 26.73-64.27 26.73h-72.83Zm-334.35 0q-37.53 0-64.27-26.73-26.73-26.74-26.73-64.27v-407.18q0-37.53 26.73-64.27 26.74-26.73 64.27-26.73h72.83q37.54 0 64.27 26.73 26.73 26.74 26.73 64.27v407.18q0 37.53-26.73 64.27-26.73 26.73-64.27 26.73h-72.83Zm334.35-91h72.83v-407.18h-72.83v407.18Zm-334.35 0h72.83v-407.18h-72.83v407.18Zm0-407.18v407.18-407.18Zm334.35 0v407.18-407.18Z" />
            </svg>
          ) : isEnded ? (
            <svg viewBox="0 -960 960 960">
              <path d="M480-70.43q-76.67 0-143.73-29.1-67.05-29.1-116.75-78.8-49.69-49.69-78.79-116.75-29.1-67.05-29.1-143.49 0-19.15 13.17-32.32 13.18-13.18 32.33-13.18t32.33 13.18q13.17 13.17 13.17 32.32 0 115.81 80.78 196.47Q364.2-161.43 480-161.43t196.59-80.79Q757.37-323 757.37-438.8q0-115.81-80.9-196.47t-196.71-80.66h-6.24l30.89 30.89q12.48 12.47 12.1 29.31-.38 16.84-12.1 29.32-12.48 12.48-29.93 12.86-17.46.38-29.94-12.1L340.83-729.37q-13.68-13.67-13.68-32.06 0-18.4 13.68-32.07l103.71-103.72q12.48-12.48 29.94-12.1 17.45.39 29.93 13.1 11.72 12.48 11.98 29.44.26 16.95-12.22 29.43l-30.41 30.42h6q76.67 0 143.73 29.09 67.05 29.1 116.87 78.8 49.81 49.69 78.91 116.63 29.1 66.93 29.1 143.61 0 76.67-29.1 143.72-29.1 67.06-78.79 116.75-49.7 49.7-116.75 78.8-67.06 29.1-143.73 29.1Z" />
            </svg>
          ) : (
            <svg viewBox="0 -960 960 960">
              <path d="M311.87-268.46v-423.08q0-19.63 13.67-32.57 13.68-12.93 31.83-12.93 5.72 0 12.05 1.62 6.34 1.62 12.06 5.09l333.17 211.79q10.2 6.71 15.42 17.03 5.21 10.31 5.21 21.51 0 11.2-5.21 21.51-5.22 10.32-15.42 17.03L381.48-229.67q-5.72 3.47-12.06 5.09-6.33 1.62-12.05 1.62-18.15 0-31.83-12.93-13.67-12.94-13.67-32.57Zm91-211.54Zm0 128.5L604.5-480 402.87-608.5v257Z" />
            </svg>
          )}
        </button>

        <button
          className={mc("player__button player__button--small")}
          aria-label="Fast forward 10 seconds"
          title="Fast forward 10 seconds"
          onClick={() => onSeek10("forward")}
          disabled={!src}
        >
          <svg viewBox="0 -960 960 960">
            <path d="M480.05-70.43q-76.72 0-143.78-29.1-67.05-29.1-116.75-78.8-49.69-49.69-78.79-116.7-29.1-67-29.1-143.72 0-76.73 29.1-143.66 29.1-66.94 78.91-116.63 49.82-49.7 116.84-78.8 67.02-29.09 143.76-29.09h6l-30.41-30.42q-12.48-12.48-12.22-29.43.26-16.96 11.98-29.44 12.48-12.71 29.93-13.1 17.46-.38 29.94 12.1L619.17-793.5q13.68 13.76 13.68 32.11t-13.68 32.02L515.46-625.65q-12.48 12.48-29.94 12.1-17.45-.38-29.93-12.86-11.72-12.48-12.1-29.32-.38-16.84 12.1-29.31l30.89-30.89h-6.24q-115.81 0-196.71 80.66-80.9 80.67-80.9 196.47t80.73 196.58Q364.1-161.43 480-161.43q115.9 0 196.64-80.67 80.73-80.66 80.73-196.47 0-19.15 13.17-32.32 13.18-13.18 32.33-13.18t32.33 13.18q13.17 13.17 13.17 32.32 0 76.44-29.1 143.49-29.1 67.06-78.79 116.75-49.7 49.7-116.7 78.8-67.01 29.1-143.73 29.1Zm-124.12-426.7h-27.84q-13.31 0-22.02-8.86-8.7-8.86-8.7-22.15t8.86-21.98q8.86-8.68 22.1-8.68h59.76q13.31 0 22.01 8.7 8.7 8.7 8.7 22.01v180.24q0 13.48-8.97 22.46-8.98 8.98-22.46 8.98t-22.46-8.98q-8.98-8.98-8.98-22.46v-149.28ZM498.8-316.41q-17 0-28.5-11.5t-11.5-28.5V-518.8q0-17 11.5-28.5t28.5-11.5h85.98q17 0 28.5 11.5t11.5 28.5v162.39q0 17-11.5 28.5t-28.5 11.5H498.8Zm23.11-61.68h40v-119.04h-40v119.04Z" />
          </svg>
        </button>

        <button
          className={mc("player__button player__button--small")}
          aria-label="Download"
          title="Download"
          onClick={() => downloadMedia(src as string, name as string)}
          disabled={!src || !name}
        >
          <svg viewBox="0 -960 960 960">
            <path d="M480-342.02q-8.96 0-17.15-3.1-8.2-3.1-14.92-9.81L300.35-502.52q-13.44-13.44-13.06-31.83.38-18.39 13.06-31.82 13.67-13.68 32.32-14.06 18.66-.38 32.33 13.29l69.5 69.5v-265.19q0-19.15 13.17-32.33 13.18-13.17 32.33-13.17t32.33 13.17q13.17 13.18 13.17 32.33v265.19l69.5-69.5q13.43-13.67 32.09-13.41 18.65.26 32.32 13.94 12.92 13.67 13.3 31.94.38 18.27-13.3 31.95L512.07-354.93q-6.72 6.71-14.92 9.81-8.19 3.1-17.15 3.1ZM242.87-151.87q-37.78 0-64.39-26.61t-26.61-64.39v-74.5q0-19.15 13.17-32.33 13.18-13.17 32.33-13.17t32.33 13.17q13.17 13.18 13.17 32.33v74.5h474.26v-74.5q0-19.15 13.17-32.33 13.18-13.17 32.33-13.17t32.33 13.17q13.17 13.18 13.17 32.33v74.5q0 37.78-26.61 64.39t-64.39 26.61H242.87Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
