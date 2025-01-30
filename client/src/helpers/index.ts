import type { ExtendedVideo } from "./index.d";

/**
 * Format decimal number as time code
 *
 * @param dec decimal input number
 * @returns formatted time string (MM:SS.mmm)
 */
export const formatTime = (dec: number): string => {
  const minutes = Math.floor(dec / 60);
  const seconds = Math.floor(dec % 60);
  const milliseconds = Math.round((dec % 1) * 1000);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
};

/**
 * Format bytes as human readable string
 *
 * @param bytes input bytes value
 * @param decimals target decimal places
 * @returns Formatted bytes string
 */
export const formatBytes = (bytes: number, decimals: number = 2) => {
  if (!+bytes) return "0 Bytes";

  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(decimals < 0 ? 0 : decimals))} ${sizes[i]}`;
};

/**
 * Check if video has audio
 *
 * @param video video element
 * @returns whether the video has audio or not
 */
export const hasAudio = (video: ExtendedVideo) => {
  return (
    video?.mozHasAudio ||
    Boolean(video?.webkitAudioDecodedByteCount) ||
    Boolean(video?.audioTracks?.length)
  );
};

/**
 * 
 * @param url 
 * @param filename 
 */
export const downloadMedia = async (
  url: string,
  filename: string
): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const link = document.createElement("a");
    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(objectURL);
  } catch (error) {
    console.error("Error downloading media:", error);
    alert("An error occurred while downloading the file. Please try again.");
  }
};
