"use client";

/**
 * Safe BDIX diagnostics: browser security policy is authoritative.
 * A no-cors/opaque response is not evidence of network reachability.
 * HTTP/private-IP targets are never automatically probed by an HTTPS page.
 */
export const BDIX_PRIMARY_CDN = "http://vod.cineplexbd.net:8081";
export interface BdixNode {
  id: string;
  name: string;
  baseUrl: string;
  type: "vod" | "emby" | "ftp-http";
  description: string;
}
export const KNOWN_BDIX_NODES: BdixNode[] = [
  { id: "cineplexbd", name: "CineplexBD VOD (unverified)", baseUrl: BDIX_PRIMARY_CDN,
    type: "vod", description: "Historical public directory reference; NOT an approved playback source" },
  { id: "ftpbd", name: "FTPBD / Business Network (unverified)", baseUrl: "http://media.ftpbd.net:8096",
    type: "emby", description: "Listed 8096 service; server software and rights unverified" },
  { id: "circleftp", name: "Circle Network (unverified)", baseUrl: "http://circleftp.net",
    type: "vod", description: "Listed BDIX portal, reachability and rights unverified" },
];
export type ProbeStatus = "reachable" | "unreachable" | "untestable";
export interface BdixProbeResult {
  status: ProbeStatus;
  reachable: boolean;
  latencyMs: number | null;
  endpoint: string;
  timestamp: number;
  reason?: string;
}
const CACHE_TTL = 5 * 60_000;
const CACHE_PREFIX = "pinflix:bdix:probe:v2:";
const allowed = (target: URL) => {
  if (target.protocol !== "https:" || target.username || target.password) return false;
  if (typeof location === "undefined" || target.origin === location.origin) return true;
  // Cross-origin checks are opt-in and must be CORS-readable, not opaque.
  const hosts = (process.env.NEXT_PUBLIC_BDIX_HEALTH_HOSTS || "").split(",").map(s => s.trim().toLowerCase());
  return hosts.includes(target.hostname);
};

export async function probeBdixEndpoint(
  endpoint = BDIX_PRIMARY_CDN, timeoutMs = 1000,
): Promise<BdixProbeResult> {
  const timestamp = Date.now();
  const result = (status: ProbeStatus, reason: string, latencyMs: number | null = null): BdixProbeResult => ({
    endpoint, timestamp, status, reachable: status === "reachable", latencyMs, reason,
  });
  if (typeof window === "undefined") return result("untestable", "Server rendering");
  let target: URL;
  try { target = new URL(endpoint); } catch { return result("untestable", "Invalid endpoint"); }
  if (!allowed(target)) return result("untestable", "HTTP, private or non-approved cross-origin probe");
  const cacheKey = CACHE_PREFIX + encodeURIComponent(target.href);
  try {
    const saved = window.sessionStorage.getItem(cacheKey);
    if (saved) {
      const item = JSON.parse(saved) as BdixProbeResult;
      if (timestamp - item.timestamp < CACHE_TTL) return item;
    }
  } catch { /* private browsing: no cache */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(5000, Math.max(200, timeoutMs)));
  const start = performance.now();
  try {
    const response = await fetch(target.href, {
      method: "GET", mode: "cors", credentials: "omit", redirect: "error",
      cache: "no-store", signal: controller.signal,
    });
    // Only successful CORS-readable health documents count as reachable.
    const valid = response.ok && response.type !== "opaque" &&
      (response.headers.get("content-type") || "").includes("application/json");
    const out = result(valid ? "reachable" : "unreachable",
      valid ? "Verified health JSON response" : "Response failed health contract",
      valid ? Math.round(performance.now() - start) : null);
    try { window.sessionStorage.setItem(cacheKey, JSON.stringify(out)); } catch {}
    return out;
  } catch (err) {
    return result("untestable", err instanceof Error && err.name === "AbortError"
      ? "Timed out" : "CORS, network or browser policy blocked the request");
  } finally { clearTimeout(timer); }
}

/** Concurrent approved probes with bounded fanout and no private-network enumeration. */
export async function probeBdixBatch(endpoints: string[], concurrency = 3): Promise<BdixProbeResult[]> {
  const list = [...new Set(endpoints)].slice(0, 24);
  const output: BdixProbeResult[] = new Array(list.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), 3, list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor++;
      output[index] = await probeBdixEndpoint(list[index], 1000);
    }
  }));
  return output;
}
