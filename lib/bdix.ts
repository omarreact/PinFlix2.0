"use client";

/**
 * BDIX (Bangladesh Internet Exchange) Network Diagnostics & Routing Helpers
 *
 * In Bangladesh, domestic traffic peered through BDIX operates over ultra-low
 * latency (1-20ms) and unmetered gigabit speeds (up to 1 Gbps), decoupled
 * from capped international submarine transit.
 *
 * Media servers such as http://vod.cineplexbd.net:8081 reside inside this domestic
 * peering fabric and must be accessed directly by subscriber browsers.
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

/**
 * Tests direct browser reachability to a BDIX endpoint.
 * This runs client-side inside the user's browser, allowing verification of
 * whether the current connection is peered into the domestic BDIX fabric.
 */
export async function probeBdixEndpoint(
  endpoint = BDIX_PRIMARY_CDN,
  timeoutMs = 3000,
): Promise<BdixProbeResult> {
  if (typeof window === "undefined") {
    return { reachable: false, latencyMs: null, endpoint, timestamp: Date.now() };
  }

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Attempt fetch with mode 'no-cors' so cross-origin BDIX endpoints respond
    // without requiring CORS headers on the static web root.
    await fetch(`${endpoint}/favicon.ico?probe=${Date.now()}`, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);
    return {
      reachable: true,
      latencyMs,
      endpoint,
      timestamp: Date.now(),
    };
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
