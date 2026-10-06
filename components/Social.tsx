"use client";

import { useState } from "react";
import { Heart, Plus, Share2, Check, Star } from "lucide-react";

const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};

/** Like / Watchlist / Share, persisted in localStorage. */
export function ActionBar({ storageId }: { storageId: string }) {
  const [liked, setLiked] = useState(() => read(`like:${storageId}`, false));
  const [saved, setSaved] = useState(() => read(`list:${storageId}`, false));
  const [copied, setCopied] = useState(false);

  const toggle = (k: string, v: boolean, set: (b: boolean) => void) => {
    set(!v);
    localStorage.setItem(k, JSON.stringify(!v));
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  const btn =
    "flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-4 py-2 text-xs font-semibold transition hover:bg-zinc-800";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => toggle(`like:${storageId}`, liked, setLiked)}
        className={btn}
      >
        <Heart size={14} className={liked ? "fill-accent text-accent" : ""} />
        {liked ? "Liked" : "Like"}
      </button>
      <button
        onClick={() => toggle(`list:${storageId}`, saved, setSaved)}
        className={btn}
      >
        {saved ? <Check size={14} className="text-accent" /> : <Plus size={14} />}
        Watchlist
      </button>
      <button onClick={share} className={btn}>
        <Share2 size={14} /> {copied ? "Link copied" : "Share"}
      </button>
    </div>
  );
}

interface Review {
  name: string;
  rating: number;
  text: string;
  at: number;
}

/** Review form; reviews are stored locally in this browser. */
export function Reviews({ storageId, title }: { storageId: string; title: string }) {
  const key = `reviews:${storageId}`;
  const [reviews, setReviews] = useState<Review[]>(() => read(key, []));
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !name.trim()) return;
    const next = [{ name, rating, text, at: Date.now() }, ...reviews];
    setReviews(next);
    localStorage.setItem(key, JSON.stringify(next));
    setText("");
    setRating(0);
  };
  const field =
    "w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <section>
      <h3 className="mb-1 text-sm font-bold">
        Be The First To Review “{title}”
      </h3>
      <p className="mb-4 text-[11px] text-zinc-500">
        Your email address will not be published. Required fields are marked *
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="mb-1 text-[11px] text-zinc-400">Your rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                aria-label={`${n} stars`}
                onClick={() => setRating(n)}
              >
                <Star
                  size={16}
                  className={n <= rating ? "fill-accent text-accent" : "text-zinc-500"}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">
            Your review *
          </label>
          <textarea
            required
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={field}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">Email *</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-6 py-2 text-xs font-bold text-black transition hover:brightness-110"
        >
          Submit
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {reviews.length === 0 ? (
          <p className="text-[11px] text-zinc-500">There are no reviews yet.</p>
        ) : (
          reviews.map((r) => (
            <article key={r.at} className="rounded-lg bg-zinc-900 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">{r.name}</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} size={12} className="fill-accent text-accent" />
                  ))}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{r.text}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
