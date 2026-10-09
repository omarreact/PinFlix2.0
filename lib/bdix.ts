"use client";

/** Known media origins and optional server-to-origin diagnostics. */

export const BDIX_PRIMARY_CDN = "http://vod.cineplexbd.net:8081";

export interface BdixNode {
  id: string;
  name: string;
  baseUrl: string;
  type: "vod" | "emby" | "ftp-http";
  description: string;
}

export const KNOWN_BDIX_NODES: BdixNode[] = [
  {
    id: "cineplexbd",
    name: "CineplexBD VOD (Primary ISP CDN)",
    baseUrl: "http://vod.cineplexbd.net:8081",
    type: "vod",
    description: "Direct BDIX VOD cache endpoint on port 8081",
  },
  {
    id: "ftpbd",
    name: "FTPBD / Business Network",
    baseUrl: "http://media.ftpbd.net:8096",
    type: "emby",
    description: "Multi-node BDIX cluster with Emby streaming",
  },
  {
    id: "circleftp",
    name: "Circle Network",
    baseUrl: "http://circleftp.net",
    type: "vod",
    description: "Nationwide BDIX streaming and media cache",
  },
  {
    id: "sambd",
    name: "SAM Online",
    baseUrl: "http://movie.sambd.net:8096",
    type: "emby",
    description: "Legacy Dhaka BDIX provider on port 8096",
  },
  {
    id: "dflix",
    name: "Dot Internet (DFlix)",
    baseUrl: "http://dflix.live",
    type: "vod",
    description: "High-speed domestic media portal",
  },
];

export interface BdixProbeResult {
  reachable: boolean;
  latencyMs: number | null;
  endpoint: string;
  timestamp: number;
}

/** Tests application-server reachability, not subscriber network peering. */
export async function probeBdixEndpoint(
  endpoint = BDIX_PRIMARY_CDN,
  timeoutMs = 7000,
): Promise<BdixProbeResult> {
  if (typeof window === "undefined") {
    return { reachable: false, latencyMs: null, endpoint, timestamp: Date.now() };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Probe the application host's permitted origin connection. This does not
    // claim browser peering, local RTT, or unmetered traffic.
    const response = await fetch("/api/bdix/status", { cache: "no-store", signal: controller.signal });
    const result = await response.json();
    clearTimeout(timeoutId);
    return { reachable: response.ok && result.reachable === true, latencyMs: result.latencyMs ?? null, endpoint, timestamp: Date.now() };

  } catch {
    clearTimeout(timeoutId);
    return {
      reachable: false,
      latencyMs: null,
      endpoint,
      timestamp: Date.now(),
    };
  }
}
