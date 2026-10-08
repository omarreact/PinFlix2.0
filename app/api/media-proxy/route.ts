export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 4;

function allowedHosts() {
  const configured = (process.env.MEDIA_PROXY_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  // No implicit third-party or ISP origins: each media host needs explicit
  // operator approval via MEDIA_PROXY_ALLOWED_HOSTS.
  return new Set(configured);
}

function parseAllowedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported media protocol");
  }
  if (url.username || url.password) {
    throw new Error("Credentials in media URLs are not allowed");
  }

  const host = url.hostname.toLowerCase();
  // Reject loopback/private IP literals and private hostnames even if mistakenly
  // configured. DNS-rebinding prevention also requires an egress policy upstream.
  if (host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) {
    throw new Error("Non-public media hostname");
  }
  if (!allowedHosts().has(host)) {
    throw new Error("Media host is not allowlisted");
  }

  return url;
}

function proxied(url: string) {
  return `/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function resolveUri(base: string, value: string) {
  return new URL(value, base).toString();
}

function rewriteManifest(manifest: string, manifestUrl: string) {
  return manifest
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line;

      if (line.startsWith("#")) {
        return line.replace(
          /(URI\s*=\s*)(["']?)([^"',\s]+)\2/gi,
          (_match, prefix: string, quote: string, target: string) => {
            const absolute = resolveUri(manifestUrl, target);
            return `${prefix}${quote}${proxied(absolute)}${quote}`;
          },
        );
      }

      return proxied(resolveUri(manifestUrl, line.trim()));
    })
    .join("\n");
}

async function fetchAllowed(initial: URL, init: RequestInit) {
  let current = initial;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      cache: "no-store",
    });

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: current };
    }

    const location = response.headers.get("location");
    if (!location) return { response, finalUrl: current };

    current = parseAllowedUrl(new URL(location, current).toString());
  }

  throw new Error("Too many upstream redirects");
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get("url");

  if (!raw) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let target: URL;
  try {
    target = parseAllowedUrl(raw);
  } catch {
    return new Response("Media URL is not allowed", { status: 403 });
  }

  const headers = new Headers({
    Accept:
      request.headers.get("accept") ||
      "application/vnd.apple.mpegurl,application/x-mpegURL,video/mp2t,video/mp4,*/*",
    "User-Agent": request.headers.get("user-agent") || "PinFlix/2.0",
  });

  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  try {
    const { response, finalUrl } = await fetchAllowed(target, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok || !response.body) {
      return new Response("Upstream media unavailable", {
        status: response.status || 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const contentType = response.headers.get("content-type") || "";
    const isManifest =
      /\.m3u8(?:$|[?#])/i.test(finalUrl.pathname) ||
      /mpegurl|m3u8/i.test(contentType);

    if (isManifest) {
      const text = await response.text();
      return new Response(rewriteManifest(text, finalUrl.toString()), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "private, no-store",
        },
      });
    }

    const outgoing = new Headers({
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });

    for (const name of ["content-range", "accept-ranges"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }

    return new Response(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return new Response("Media proxy unavailable", { status: 502 });
  }
}
