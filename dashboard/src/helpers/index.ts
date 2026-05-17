const metricSizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
const binarySizes = [
  "Bytes",
  "KiB",
  "MiB",
  "GiB",
  "TiB",
  "PiB",
  "EiB",
  "ZiB",
  "YiB",
];

/**
 * Options for formatting the byte size.
 */
interface FormatBytesOptions {
  /** The number of decimal places to include. Default is 2. */
  decimals?: number;
  /** Use binary units (KiB, MiB, etc. based on 1024) instead of metric (KB, MB, etc. based on 1000). Default is false. */
  useBinaryUnits?: boolean;
}

/**
 * Converts a number of bytes into a human-readable string (e.g., KB, MB, GB).
 *
 * @param bytes - The number of bytes to convert.
 * @param options - Configuration options for the formatting.
 * @returns A formatted string representing the size.
 */
export function formatBytes(
  bytes: number,
  options: FormatBytesOptions = {},
): string {
  const { decimals = 2, useBinaryUnits = false } = options;

  if (bytes === 0 || bytes < 0) return "0 Bytes";

  const k = useBinaryUnits ? 1024 : 1000;
  const sizes = useBinaryUnits ? binarySizes : metricSizes;
  const boundedIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  const formattedValue = parseFloat(
    (bytes / Math.pow(k, boundedIndex)).toFixed(decimals < 0 ? 0 : decimals),
  );

  return `${formattedValue} ${sizes[boundedIndex]}`;
}
