"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe2 } from "lucide-react";
import { tmdb } from "@/lib/tmdb";

type Provider = { provider_id: number; provider_name: string; logo_path: string | null };
type Region = {
  link?: string;
  flatrate?: Provider[];
  free?: Provider[];
  ads?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
};
type Result = { results?: Record<string, Region> };
const REGIONS = [
  ["BD", "Bangladesh"], ["IN", "India"], ["US", "United States"],
  ["GB", "United Kingdom"],
] as const;

export default function WatchProviders({ type, id }: {
  type: "movie" | "tv"; id: number;
}) {
  const [region, setRegion] = useState("BD");
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    tmdb<Result>(`/${type}/${id}/watch/providers`, {}, ac.signal)
      .then((result) => { setData(result); setError(false); })
      .catch((e: Error) => {
        if (e.name !== "AbortError") { setData({}); setError(true); }
      });
    return () => ac.abort();
  }, [type, id]);

  const offered = data?.results?.[region];
  const groups: { name: string; entries: Provider[] }[] = [
    { name: "Subscription", entries: offered?.flatrate ?? [] },
    { name: "Free", entries: [...(offered?.free ?? []), ...(offered?.ads ?? [])] },
    { name: "Rent", entries: offered?.rent ?? [] },
    { name: "Buy", entries: offered?.buy ?? [] },
  ].filter((group) => group.entries.length > 0);
  const link = (() => {
    try {
      const u = new URL(offered?.link ?? "");
      return u.protocol === "https:" && (u.hostname === "www.themoviedb.org" ||
        u.hostname === "themoviedb.org") ? u.href : null;
    } catch { return null; }
  })();

  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Globe2 size={16} className="text-accent" /> Where to watch legally
        </h2>
        <label className="text-xs text-zinc-400">
          Region{" "}
          <select aria-label="Streaming availability region" value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-white">
            {REGIONS.map(([code, label]) =>
              <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
      </div>
      {!data && !error && <p className="mt-3 text-xs text-zinc-500">Looking up providers…</p>}
      {error && <p className="mt-3 text-xs text-amber-400">Provider availability is temporarily unavailable.</p>}
      {data && !error && groups.length === 0 &&
        <p className="mt-3 text-xs text-zinc-400">
          No official provider listings are currently available for this region.
        </p>}
      {groups.length > 0 && (
        <div className="mt-4 space-y-3">
          {groups.map((group) => (
            <div key={group.name} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-[11px] font-semibold text-zinc-400">{group.name}</span>
              {group.entries.map((provider) =>
                <span key={provider.provider_id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  title={provider.provider_name}>{provider.provider_name}</span>)}
            </div>
          ))}
        </div>
      )}
      {link && groups.length > 0 &&
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline">
          View official availability details <ExternalLink size={13} />
        </a>}
      <p className="mt-3 text-[11px] text-zinc-500">
        Availability information supplied by TMDB/JustWatch; it may change and does not mean
        PinFlix has streaming rights for this title.
      </p>
    </section>
  );
}
