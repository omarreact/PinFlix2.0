/**
 * PinFlix media edge. Serves only explicitly cataloged operator-owned files
 * from a private R2 bucket; never relays external hosts or guesses media paths.
 */
const MAX_AGE_SECONDS = 6 * 60 * 60;
const TEXT = new TextEncoder();
const MEDIA_KEY = /^media\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/;
const CATALOG_KEY = /^(movie:[1-9]\d{0,9}|tv:[1-9]\d{0,9}:s[1-9]\d{0,2}e[1-9]\d{0,2})$/;
const TYPES = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".mp4": "video/mp4",
  ".m4s": "video/iso.segment",
  ".ts": "video/mp2t",
  ".aac": "audio/aac",
  ".mp3": "audio/mpeg",
  ".vtt": "text/vtt; charset=utf-8",
  ".key": "application/octet-stream",
  ".init": "application/octet-stream",
};

function validAsset(key) {
  if (!MEDIA_KEY.test(key)) return false;
  if (key.split("/").some(part => part === "." || part === "..")) return false;
  return Object.keys(TYPES).some(ext => key.toLowerCase().endsWith(ext));
}
function mediaType(key) {
  const ext = Object.keys(TYPES).find(ext => key.toLowerCase().endsWith(ext));
  return ext ? TYPES[ext] : null;
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let result = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return result === 0;
}
function corsHeaders(request, env) {
  const origins = (env.CORS_ORIGINS || "").split(",").map(x => x.trim());
  const origin = request.headers.get("origin");
  const h = new Headers({ "Vary": "Origin", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer" });
  if (origin && origins.includes(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    h.set("Access-Control-Allow-Headers", "Range, If-None-Match");
    h.set("Access-Control-Expose-Headers", "Accept-Ranges, Content-Range, Content-Length, ETag");
  }
  return h;
}
function reply(request, env, data, status = 200) {
  const h = corsHeaders(request, env);
  h.set("Content-Type", "application/json; charset=utf-8");
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}
async function signingKey(env) {
  return crypto.subtle.importKey("raw", TEXT.encode(env.SIGNING_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
async function signature(env, pathname, exp) {
  const key = await signingKey(env);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, TEXT.encode(pathname + ":" + exp)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
async function signedUrl(env, origin, key, exp) {
  if (!validAsset(key)) throw new Error("Invalid catalog asset path");
  const path = "/m/" + key;
  const s = await signature(env, path, exp);
  return origin + path + "?exp=" + exp + "&sig=" + s;
}
function resolvePlaylistTarget(baseUrl, target) {
  const next = new URL(target, baseUrl);
  if (next.origin !== baseUrl.origin || next.username || next.password ||
    next.hash || next.search || !next.pathname.startsWith("/m/")) {
    throw new Error("Playlist may reference only relative local assets");
  }
  const key = decodeURIComponent(next.pathname.slice(3));
  if (!validAsset(key)) throw new Error("Invalid referenced asset");
  return key;
}
async function rewritePlaylist(body, url, env, exp) {
  const lines = body.split(/\r?\n/);
  const output = [];
  for (const line of lines) {
    const value = line.trim();
    if (!value) { output.push(line); continue; }
    if (value.startsWith("#")) {
      const matches = [...line.matchAll(/URI="([^"]+)"/g)];
      let changed = line;
      for (const m of matches) {
        const key = resolvePlaylistTarget(url, m[1]);
        changed = changed.replace(m[0], 'URI="' + await signedUrl(env, url.origin, key, exp) + '"');
      }
      output.push(changed);
    } else {
      const key = resolvePlaylistTarget(url, value);
      output.push(await signedUrl(env, url.origin, key, exp));
    }
  }
  return output.join("\n");
}
async function catalogResponse(request, env, url, isPublic = false) {
  if (!env.SIGNING_KEY || !env.MEDIA || (!isPublic && !env.CATALOG_TOKEN)) {
    return reply(request, env, { error: "Catalog not configured" }, 503);
  }
  if (!isPublic) {
    const supplied = request.headers.get("authorization") || "";
    if (!safeEqual(supplied, "Bearer " + env.CATALOG_TOKEN)) {
      return reply(request, env, { error: "Unauthorized" }, 401);
    }
  }
  const key = url.searchParams.get("key") || "";
  if (!CATALOG_KEY.test(key)) return reply(request, env, { error: "Invalid selection" }, 400);
  // Public and private catalogs are stored in isolated R2 prefixes.
  // A public manifest must additionally opt into publication.
  const file = await env.MEDIA.get((isPublic ? "catalog-public/" : "catalog/") + key + ".json");
  if (!file) return reply(request, env, { sources: [] });
  if (file.size > 65536) return reply(request, env, { error: "Catalog entry too large" }, 422);
  let document;
  try { document = await file.json(); } catch { return reply(request, env, { error: "Invalid catalog entry" }, 422); }
  if (!document || !Array.isArray(document.sources)) {
    return reply(request, env, { error: "Invalid catalog format" }, 422);
  }
  // Explicit public-use opt-in prevents a private catalog being published
  // by accidental key reuse or a copied manifest.
  if (isPublic && document.public !== true) {
    return reply(request, env, { sources: [] });
  }
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const sources = [];
  for (const item of document.sources.slice(0, 12)) {
    if (!item || typeof item.label !== "string" || typeof item.path !== "string") continue;
    if (!validAsset(item.path) || !/\.(m3u8|mp4)$/i.test(item.path)) continue;
    // Only return an asset after confirming it exists; no invented movie links.
    if (!await env.MEDIA.head(item.path)) continue;
    sources.push({ label: item.label.trim().slice(0, 80) || "PinFlix Media",
      url: await signedUrl(env, url.origin, item.path, exp) });
  }
  return reply(request, env, { sources });
}
async function mediaResponse(request, env, url) {
  if (!env.SIGNING_KEY || !env.MEDIA) return reply(request, env, { error: "Media not configured" }, 503);
  let key;
  try { key = decodeURIComponent(url.pathname.slice(3)); }
  catch { return reply(request, env, { error: "Invalid path" }, 400); }
  if (!validAsset(key)) return reply(request, env, { error: "Invalid path" }, 404);
  const expStr = url.searchParams.get("exp") || "";
  const provided = url.searchParams.get("sig") || "";
  if (!/^\d{10,11}$/.test(expStr) || !/^[0-9a-f]{64}$/.test(provided))
    return reply(request, env, { error: "Signature required" }, 403);
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(expStr);
  if (exp < now || exp > now + MAX_AGE_SECONDS + 60) return reply(request, env, { error: "Expired signature" }, 403);
  const expected = await signature(env, url.pathname, expStr);
  if (!safeEqual(provided, expected)) return reply(request, env, { error: "Invalid signature" }, 403);
  const options = request.headers.has("Range") ? { range: request.headers } : undefined;
  const obj = request.method === "HEAD" ? await env.MEDIA.head(key) : await env.MEDIA.get(key, options);
  if (!obj) return reply(request, env, { error: "Media not found" }, 404);
  const h = corsHeaders(request, env);
  h.set("Content-Type", mediaType(key));
  h.set("ETag", obj.httpEtag);
  h.set("Accept-Ranges", "bytes");
  h.set("Cache-Control", "public, max-age=" + Math.max(0, Math.min(3600, exp - now)));
  if (key.toLowerCase().endsWith(".m3u8")) {
    if (obj.size > 1024 * 1024) return reply(request, env, { error: "Playlist too large" }, 422);
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: h });
    const playlist = await rewritePlaylist(await obj.text(), url, env, expStr);
    h.set("Content-Length", String(TEXT.encode(playlist).byteLength));
    return new Response(playlist, { status: 200, headers: h });
  }
  if (request.method === "HEAD") {
    h.set("Content-Length", String(obj.size));
    return new Response(null, { status: 200, headers: h });
  }
  if (obj.range && request.headers.has("Range")) {
    h.set("Content-Range", "bytes " + obj.range.offset + "-" +
      (obj.range.offset + obj.range.length - 1) + "/" + obj.size);
    h.set("Content-Length", String(obj.range.length));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set("Content-Length", String(obj.size));
  return new Response(obj.body, { status: 200, headers: h });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      const h = corsHeaders(request, env);
      return new Response(null, { status: h.has("Access-Control-Allow-Origin") ? 204 : 403, headers: h });
    }
    if (!["GET", "HEAD"].includes(request.method)) return reply(request, env, { error: "Method not allowed" }, 405);
    if (url.pathname === "/health") return reply(request, env, { service: "pinflix-media-api", status: "ok", r2: !!env.MEDIA });
    if (url.pathname === "/diagnostic" && request.method === "GET") {
      // Original one-second blue test frame, never a commercial film.
      if (!env.SIGNING_KEY || !env.MEDIA) return reply(request, env, { error: "Not configured" }, 503);
      const key = "media/diagnostic/edge-health.mp4";
      const asset = await env.MEDIA.head(key);
      const hlsKey = "media/diagnostic/edge-index.m3u8";
      const hlsAsset = await env.MEDIA.head(hlsKey);
      if (!asset) return reply(request, env, { error: "Diagnostic asset unavailable" }, 503);
      const exp = Math.floor(Date.now() / 1000) + 300;
      return reply(request, env, {
        status: "ready", label: "PinFlix diagnostic test clip",
        durationHintSeconds: 1,
        kind: "mp4", bytes: asset.size,
        playbackUrl: await signedUrl(env, url.origin, key, exp),
        hlsPlaybackUrl: hlsAsset ? await signedUrl(env, url.origin, hlsKey, exp) : null,
      });
    }
    if (url.pathname === "/resolve" && request.method === "GET") return catalogResponse(request, env, url);
    if (url.pathname === "/public-resolve" && request.method === "GET") return catalogResponse(request, env, url, true);
    if (url.pathname.startsWith("/m/")) {
      try { return await mediaResponse(request, env, url); }
      catch { return reply(request, env, { error: "Media unavailable" }, 502); }
    }
    return reply(request, env, { error: "Not found" }, 404);
  },
};
