/**
 * Read-only BDIX source-directory import. A directory reference is NEVER proof
 * of a live service, rights to crawl, or permission to deliver media.
 * Primary directory: TelepathyVijay/bdix-ftp-server/FTP_List.md.
 * Google Sites authuser=0 is the same directory, not an independent feed.
 */
export const BDIX_DIRECTORY_URL =
  "https://raw.githubusercontent.com/TelepathyVijay/bdix-ftp-server/main/FTP_List.md";

export type BdixKind = "directory-candidate" | "vod-candidate" | "iptv-portal" | "unclassified";
export type BdixScope = "private-ip" | "ip-literal" | "hostname" | "special-address";
export type BdixRights = "unknown" | "granted" | "denied" | "revoked";

export interface BdixRegistryEntry {
  id: string;
  organization: string;
  sourceOrdinal: number;
  url: string;
  host: string;
  port: number;
  kind: BdixKind;
  scope: BdixScope;
  evidence: string;
  status: "unverified";
  rights: BdixRights;
  approvedForCrawler: false;
  approvedForPlayback: false;
  source: "github-ftp-list";
}

const WEB_REFERENCE = /(?:facebook\.com|pastebin\.com|blogspot\.com|wixsite\.com|sites\.google\.com|github\.io|yolasite\.com)/i;
const URL_LINE = /^\s*\*\s*(https?:\/\/[^\s<>]+)/i;
const GROUP_LINE = /^\s*(\d+)\.\s+(.+?)\s*$/;

export function canonicalBdixUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim().replace(/[),.;]+$/, ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.port === "80" && url.protocol === "http:") url.port = "";
    if (url.port === "443" && url.protocol === "https:") url.port = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch { return null; }
}

export function bdixScope(hostname: string): BdixScope {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return "hostname";
  const bytes = hostname.split(".").map(Number);
  if (bytes.some(n => n > 255)) return "special-address";
  const [a,b] = bytes;
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))
    return "private-ip";
  if (a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)))
    return "special-address";
  return "ip-literal";
}

export function inferBdixKind(url: URL, group: string): { kind: BdixKind; evidence: string } {
  const host = url.hostname.toLowerCase(), path = url.pathname.toLowerCase();
  if (/(?:8096|8920)$/.test(url.port) || /(?:^|\.)emby\.|(?:^|\.)jellyfin\.|(?:^|\.)plex\./.test(host))
    return { kind: "vod-candidate", evidence: "media-server hostname or port" };
  if (/\/(?:ftp(?:-\d+)?|nas\d*|data\d*|storage|ftpdata|d_drive|upload|mediafiles)(?:\/|$)/i.test(path))
    return { kind: "directory-candidate", evidence: "directory-like path (not verified auto-index)" };
  if (/\b(?:iptv|live\s*tv)\b/i.test(group) || /(?:iptv|livetv)/i.test(host))
    return { kind: "iptv-portal", evidence: "IPTV label or hostname (no HLS stream confirmed)" };
  if (/(?:movie|flix|vod|play|stream|media|ftp)/i.test(host))
    return { kind: "vod-candidate", evidence: "media-oriented hostname (software unverified)" };
  return { kind: "unclassified", evidence: "directory reference only" };
}

function keyOf(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "bdix-" + (h >>> 0).toString(16).padStart(8, "0");
}

export function parseBdixDirectory(markdown: string): BdixRegistryEntry[] {
  if (markdown.length > 300_000) throw new Error("Directory exceeds size limit");
  const entries = new Map<string, BdixRegistryEntry>();
  let org = "", ordinal = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(GROUP_LINE);
    if (heading) {
      ordinal = Number(heading[1]);
      org = heading[2].replace(/\s+FTP SERVER\s*$/i, "").trim().slice(0, 150);
      continue;
    }
    const match = line.match(URL_LINE);
    if (!match || !org) continue;
    const normalized = canonicalBdixUrl(match[1]);
    if (!normalized) continue;
    const url = new URL(normalized);
    if (WEB_REFERENCE.test(url.hostname)) continue;
    if (entries.has(normalized)) continue;
    const {kind,evidence} = inferBdixKind(url,org);
    entries.set(normalized, {
      id: keyOf(normalized), organization: org, sourceOrdinal: ordinal,
      url: normalized, host: url.hostname, port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
      kind, scope: bdixScope(url.hostname), evidence, status: "unverified",
      rights: "unknown", approvedForCrawler: false, approvedForPlayback: false,
      source: "github-ftp-list",
    });
    if (entries.size > 2500) throw new Error("Unexpectedly large directory");
  }
  return [...entries.values()];
}

export function filterBdixDirectory(
  entries: readonly BdixRegistryEntry[],
  filters: { q?: string; type?: string; scope?: string; page?: number; limit?: number },
) {
  const q = (filters.q || "").trim().toLowerCase().slice(0, 100);
  const matches = entries.filter(entry =>
    (!filters.type || filters.type === "all" || entry.kind === filters.type) &&
    (!filters.scope || filters.scope === "all" || entry.scope === filters.scope) &&
    (!q || [entry.organization, entry.host, entry.url].some(v => v.toLowerCase().includes(q)))
  );
  const page = Math.min(100, Math.max(1, Math.floor(filters.page || 1)));
  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit || 24)));
  return { items: matches.slice((page - 1) * limit, page * limit), total: matches.length,
    page, limit, hasNext: page * limit < matches.length };
}
