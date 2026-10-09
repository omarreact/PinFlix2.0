export const dynamic = "force-dynamic";
export async function GET() {
  const target = new URL("http://cds3.cineplexbd.net/index.php");
  const allowed = (process.env.MEDIA_PROXY_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase());
  if (!allowed.includes(target.hostname)) return Response.json({ reachable: false, latencyMs: null, outcome: "not_configured" }, { headers: { "Cache-Control": "no-store" } });
  const start = Date.now();
  try {
    const response = await fetch(target, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    return Response.json({ reachable: response.ok, latencyMs: Date.now() - start, outcome: response.ok ? "reachable" : "http_error" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ reachable: false, latencyMs: null, outcome: "network_error" }, { headers: { "Cache-Control": "no-store" } }); }
}
