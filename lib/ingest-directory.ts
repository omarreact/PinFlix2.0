import * as cheerio from "cheerio";

export function cleanMediaName(filename: string) {
  const stem = filename.replace(/\.(mp4|mkv|webm|m3u8)$/i, "");
  const year = stem.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
  const episode = stem.match(/s(\d{1,2})e(\d{1,3})/i);
  const title = stem.split(/(?:\b(?:19\d{2}|20\d{2})\b|s\d{1,2}e\d{1,3}|\b(?:2160p|1080p|720p|480p|4k|bluray|webrip|web-dl|hdtv|x264|x265|hevc)\b)/i)[0]
    .replace(/[._]/g, " ").replace(/\s+/g, " ").replace(/[\s([\]-]+$/, "").trim();
  return { title: title || "Untitled", year: year ? Number(year) : undefined, season: episode ? Number(episode[1]) : undefined, episode: episode ? Number(episode[2]) : undefined };
}

export function parseDirectory(html: string, current: string, root: string) {
  const $ = cheerio.load(html);
  const boundary = new URL(root);
  const links = new Map<string, { url: string; filename: string; kind: "directory" | "video" | "subtitle" }>();
  $("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href");
    if (!href || href.startsWith("#")) return;
    let url: URL;
    try { url = new URL(href, current); } catch { return; }
    const base = boundary.pathname.endsWith("/") ? boundary.pathname : boundary.pathname.slice(0, boundary.pathname.lastIndexOf("/") + 1);
    if (url.origin !== boundary.origin || !url.pathname.startsWith(base) || url.username || url.password || !["http:", "https:"].includes(url.protocol)) return;
    if (url.href === current || href === "../" || $(anchor).text().toLowerCase().includes("parent directory")) return;
    let filename: string;
    try { filename = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? ""); } catch { return; }
    const kind = /\.(mp4|m3u8)$/i.test(url.pathname) ? "video" : /\.(srt|vtt)$/i.test(url.pathname) ? "subtitle" : url.pathname.endsWith("/") || /index\.php$/i.test(url.pathname) && url.search ? "directory" : null;
    if (kind) links.set(url.href, { url: url.href, filename, kind });
  });
  return [...links.values()];
}
