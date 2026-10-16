/**
 * Metadata-only filename normalization for operator-approved media indexes.
 * No third-party media file is downloaded or activated by this parser.
 */
export type FilenameMetadata = {
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  extension: "mp4" | "mkv" | "webm" | "m3u8" | "srt" | null;
  original: string;
};

const RELEASE_WORDS = /\b(?:480p|720p|1080p|2160p|4k|bluray|blu-ray|brrip|bdrip|web[- ]?dl|webrip|hdrip|dvdrip|x264|x265|h264|h265|hevc|hdr10|aac|ddp5?\.?1|yify|rarbg)\b/gi;

export function normalizeBdixFilename(input: string): FilenameMetadata {
  const original = input;
  const last = input.split(/[\\/]/).pop() || input;
  let filename = last;
  try { filename = decodeURIComponent(last); } catch { /* preserve malformed percent escapes */ }
  const ext = filename.match(/\.(mp4|mkv|webm|m3u8|srt)$/i);
  const extension = (ext?.[1]?.toLowerCase() || null) as FilenameMetadata["extension"];
  const basename = ext ? filename.slice(0, -ext[0].length) : filename;
  const ep = basename.match(/\bS(\d{1,2})[ ._-]*E(\d{1,3})\b/i) ||
    basename.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  const yearMatch = basename.match(/\b(19\d{2}|20\d{2})\b/);
  const title = basename
    .replace(/\[[^\]]{1,80}\]/g, " ")
    .replace(/[._]/g, " ")
    .replace(/\bS\d{1,2}[ ._-]*E\d{1,3}\b/gi, " ")
    .replace(/\b\d{1,2}x\d{1,3}\b/gi, " ")
    .replace(RELEASE_WORDS, " ")
    .replace(/\b(19\d{2}|20\d{2})\b/, " ")
    .replace(/\s+/g, " ").trim();
  return { title, year: yearMatch ? Number(yearMatch[1]) : null,
    season: ep ? Number(ep[1]) : null, episode: ep ? Number(ep[2]) : null,
    extension, original };
}
