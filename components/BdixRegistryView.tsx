"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, RefreshCcw, Search, ShieldAlert } from "lucide-react";
import type { BdixRegistryEntry } from "@/lib/bdix-registry";
import { probeBdixBatch, type BdixProbeResult } from "@/lib/bdix";

type DirectoryResponse = {
  items: BdixRegistryEntry[];
  total: number;
  page: number;
  limit: number;
  directoryCount: number;
  hasNext: boolean;
  error?: string;
};

export default function BdixRegistryView() {
  const [q, setQ] = useState("");
  const [committed, setCommitted] = useState("");
  const [kind, setKind] = useState("all");
  const [scope, setScope] = useState("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DirectoryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [probe, setProbe] = useState<Record<string, BdixProbeResult>>({});
  const [probing, setProbing] = useState(false);

  const uri = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "24", type: kind, scope });
    if (committed) params.set("q", committed);
    return "/api/bdix/sources?" + params.toString();
  }, [page, kind, scope, committed]);

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(uri, { signal, cache: "no-store" });
      const data = await response.json() as DirectoryResponse;
      if (!response.ok) throw new Error(data.error || "Registry unavailable");
      if (!signal?.aborted) setResult(data);
    } catch (err) {
      if (!signal?.aborted) {
        setResult(null);
        setError(err instanceof Error ? err.message : "Could not retrieve directory");
      }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [uri]);

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  const check = async () => {
    // Unverified candidate references are NOT approved health checks.
    // Operator must configure explicit HTTPS CORS-enabled probe URLs.
    const configured = (process.env.NEXT_PUBLIC_BDIX_HEALTH_URLS || "")
      .split(",").map(s => s.trim()).filter(Boolean).slice(0, 12);
    setProbing(true);
    try {
      const checks = await probeBdixBatch(configured);
      setProbe(Object.fromEntries(checks.map(item => [item.endpoint, item])));
    } finally { setProbing(false); }
  };

  const resetFilter = (setter: (value: string) => void, value: string) => {
    setter(value); setPage(1);
  };

  return <section aria-label="BDIX directory results">
    <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-surface p-4 sm:grid-cols-[1fr_190px_185px_auto]">
      <form onSubmit={e => {e.preventDefault();setCommitted(q.trim());setPage(1);}}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-background px-3">
        <Search size={16} className="shrink-0 text-zinc-400" />
        <input value={q} onChange={e => setQ(e.target.value)}
          aria-label="Search BDIX directory" placeholder="Search provider, host or URL"
          className="min-h-11 w-full bg-transparent text-sm text-white outline-none" />
        <button type="submit" className="rounded bg-accent px-3 py-1 text-xs font-bold text-black">Go</button>
      </form>
      <select value={kind} aria-label="Server type" onChange={e => resetFilter(setKind,e.target.value)}
        className="rounded-lg border border-white/10 bg-background px-3 text-sm text-white">
        <option value="all">All server types</option>
        <option value="directory-candidate">Type A · Directory candidate</option>
        <option value="vod-candidate">Type B · VOD candidate</option>
        <option value="iptv-portal">Type C · IPTV portal</option>
        <option value="unclassified">Unclassified</option>
      </select>
      <select value={scope} aria-label="Network class" onChange={e => resetFilter(setScope,e.target.value)}
        className="rounded-lg border border-white/10 bg-background px-3 text-sm text-white">
        <option value="all">All network classes</option>
        <option value="hostname">DNS hostname</option>
        <option value="ip-literal">IP literal</option>
        <option value="private-ip">RFC1918 private</option>
        <option value="special-address">Other special addresses</option>
      </select>
      <button onClick={() => void reload()} disabled={loading} type="button"
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-xs font-semibold">
        <RefreshCcw size={15}/> Refresh
      </button>
    </div>

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
      <p>{loading ? "Loading directory…" : error ? "Feed unavailable" :
        result ? String(result.total.toLocaleString()) + " matching references · " + String(result.directoryCount.toLocaleString()) + " deduplicated candidate references" : "No data"}</p>
      <button type="button" disabled={probing} onClick={() => void check()}
        className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 font-semibold text-zinc-200">
        <Activity size={15} /> {probing ? "Checking…" : "Approved health checks"}
      </button>
    </div>
    <div role="status" className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200">
      <ShieldAlert size={15} className="mr-2 inline" /> Unverified inventory. Listing here does not mean a server is reachable, publicly licensed, CORS-enabled, or playable. No arbitrary ISP or local-network scanning occurs.
    </div>
    {Object.keys(probe).length > 0 && <p className="mb-4 text-xs text-zinc-400">
      Approved probes: {Object.values(probe).map(p => p.endpoint + ": " + p.status).join(" · ")}
    </p>}
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm">{error}</p>}
    {!loading && !error && result?.items.length === 0 && <p className="rounded-xl border border-white/10 p-6 text-zinc-400">No directory references match these filters.</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {result?.items.map(item => <article key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-surface p-5">
        <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
          <span className="rounded-md bg-white/10 px-2 py-1 text-white/80">{item.kind}</span>
          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-200">Unverified</span>
        </div>
        <h2 className="line-clamp-2 text-base font-bold">{item.organization}</h2>
        <p className="mt-2 break-all text-xs text-zinc-400">{item.url}</p>
        <div className="mt-4 space-y-1 text-[11px] text-zinc-400">
          <p>Network class: {item.scope}</p>
          <p>Evidence: {item.evidence}</p>
          <p>Content permissions: unknown · Playback: not approved</p>
        </div>
        <a href={item.url} target="_blank" rel="nofollow noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          Open listed site (external) <ExternalLink size={12}/>
        </a>
      </article>)}
    </div>
    {!loading && !error && result && <div className="mt-8 flex items-center justify-center gap-5 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
        className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-30">Previous</button>
      <span>Page {page} / {Math.max(1, Math.ceil(result.total / 24))}</span>
      <button type="button" disabled={!result.hasNext} onClick={() => setPage(page + 1)}
        className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-30">Next</button>
    </div>}
  </section>;
}
