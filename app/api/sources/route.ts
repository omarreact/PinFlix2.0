import { NextRequest, NextResponse } from "next/server";
import own from "@/data/own-sources.json";

export interface Source {
  label: string;
  url: string;
  kind: "hls" | "mp4";
}

const registry = own as unknown as Record<string, { label: string; url: string }[]>;
const kindOf = (url: string): Source["kind"] =>
  /\.m3u8(\?|$)/i.test(url) ? "hls" : "mp4";
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Public-domain feature films from the Internet Archive (exact-title match only). */
async function archiveSource(title: string, year: string): Promise<Source[]> {
  try {
    const q = `title:("${title.replace(/"/g, "")}") AND mediatype:movies AND collection:feature_films`;
    const search = new URL("https://archive.org/advancedsearch.php");
    search.searchParams.set("q", q);
    search.searchParams.append("fl[]", "identifier");
    search.searchParams.append("fl[]", "title");
    search.searchParams.append("fl[]", "year");
    search.searchParams.set("rows", "10");
    search.searchParams.set("output", "json");
    const r = await fetch(search, { next: { revalidate: 86400 } });
    const docs: { identifier: string; title: string; year?: string }[] =
      (await r.json()).response?.docs ?? [];
    const match = docs.find(
      (d) =>
        norm(d.title) === norm(title) &&
        (!year || !d.year || Math.abs(Number(d.year) - Number(year)) <= 1),
    );
    if (!match) return [];

    const m = await fetch(`https://archive.org/metadata/${match.identifier}`, {
      next: { revalidate: 86400 },
    });
    const files: { name: string; format: string; size?: string }[] =
      (await m.json()).files ?? [];
    const mp4s = files
      .filter((f) => /\.mp4$/i.test(f.name))
      .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0));
    const best =
      mp4s.find((f) => /h\.?264/i.test(f.format)) ?? mp4s[mp4s.length - 1];
    if (!best) return [];
    return [
      {
        label: "Internet Archive (public domain)",
        url: `https://archive.org/download/${match.identifier}/${encodeURIComponent(best.name)}`,
        kind: "mp4",
      },
    ];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const type = p.get("type");
  const id = p.get("id") ?? "";
  const title = p.get("title") ?? "";
  const year = p.get("year") ?? "";
  const season = p.get("season");
  const episode = p.get("episode");
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const keys =
    type === "tv"
      ? [`tv:${id}:s${season}e${episode}`, `tv:${id}`]
      : [`movie:${id}`];
  const ownList = keys.flatMap((k) => registry[k] ?? []);
  const sources: Source[] = ownList.map((s) => ({ ...s, kind: kindOf(s.url) }));

  if (type === "movie" && title) {
    sources.push(...(await archiveSource(title, year)));
  }
  return NextResponse.json({ sources });
}
