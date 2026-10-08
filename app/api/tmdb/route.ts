import { NextRequest, NextResponse } from "next/server";

// Server-side TMDB proxy: keeps the API key private and only allows known endpoints.
const ALLOWED = [
  /^\/trending\/(all|movie|tv)\/(day|week)$/,
  /^\/(movie|tv)\/(popular|top_rated|now_playing|on_the_air)$/,
  /^\/(movie|tv)\/\d+$/,
  /^\/(movie|tv)\/\d+\/recommendations$/,
  /^\/(movie|tv)\/\d+\/watch\/providers$/,
  /^\/(movie|tv)\/\d+\/external_ids$/,
  /^\/tv\/\d+\/season\/\d+$/,
  /^\/search\/multi$/,
  /^\/discover\/(movie|tv)$/,
];

export async function GET(req: NextRequest) {
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  const key = readToken || apiKey;

  if (!key) {
    return NextResponse.json(
      { error: "Missing TMDB credentials in .env.local" },
      { status: 500 },
    );
  }
  const params = req.nextUrl.searchParams;
  const path = params.get("path") ?? "";
  if (!ALLOWED.some((r) => r.test(path))) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 400 });
  }

  const url = new URL(`https://api.themoviedb.org/3${path}`);
  params.forEach((v, k) => k !== "path" && url.searchParams.set(k, v));
  url.searchParams.set("language", "en-US");

  const headers: Record<string, string> = {
    accept: "application/json",
  };

  if (readToken) {
    headers["Authorization"] = `Bearer ${readToken}`;
  } else if (apiKey?.startsWith("eyJ")) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  const res = await fetch(url, { headers, next: { revalidate: 3600 } });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
