"use client";

import { useEffect, useState } from "react";
import { Heart, Plus, Share2, Check, Star } from "lucide-react";
import { isSaved, setWatchlist, type LibraryTitle } from "@/lib/library";
import { syncWatchlistToCloud } from "@/lib/cloud-library";
import { useAuth } from "@/components/AuthProvider";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};

/** Like / Watchlist / Share, with optional Firebase cloud sync. */
export function ActionBar({
  storageId,
  item,
}: {
  storageId: string;
  item: LibraryTitle;
}) {
  const [liked, setLiked] = useState(() => read(`like:${storageId}`, false));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const legacyKey = `list:${storageId}`;
    const restore = () => {
      const legacy = read(legacyKey, false);
      if (legacy && !isSaved(item)) {
        setWatchlist(item, true);
        void syncWatchlistToCloud(item, true);
      }
      window.localStorage.removeItem(legacyKey);
      setSaved(isSaved(item));
    };
    const sync = () => setSaved(isSaved(item));
    const timer = window.setTimeout(restore, 0);
    window.addEventListener("pinflix:library-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pinflix:library-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [storageId, item]);

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
        type="button"
        onClick={() => toggle(`like:${storageId}`, liked, setLiked)}
        className={btn}
      >
        <Heart size={14} className={liked ? "fill-accent text-accent" : ""} />
        {liked ? "Liked" : "Like"}
      </button>
      <button
        type="button"
        onClick={() => {
          const nextSaved = !saved;
          setWatchlist(item, nextSaved);
          setSaved(nextSaved);
          void syncWatchlistToCloud(item, nextSaved);
        }}
        className={btn}
      >
        {saved ? <Check size={14} className="text-accent" /> : <Plus size={14} />}
        Watchlist
      </button>
      <button type="button" onClick={share} className={btn}>
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

/** Review form; reviews sync to Firebase Firestore and local browser storage. */
export function Reviews({
  storageId,
  title,
}: {
  storageId: string;
  title: string;
}) {
  const { user } = useAuth();
  const key = `reviews:${storageId}`;
  const [localReviews, setLocalReviews] = useState<Review[]>(() => read(key, []));
  const [cloudReviews, setCloudReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState(user?.displayName || "");

  // Real-time Firestore reviews listener
  useEffect(() => {
    try {
      const q = query(
        collection(db, "reviews"),
        where("storageId", "==", storageId),
        orderBy("createdAt", "desc"),
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const results: Review[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            results.push({
              name: data.authorName || "Viewer",
              rating: data.rating || 5,
              text: data.text || "",
              at: data.createdAt || Date.now(),
            });
          });
          setCloudReviews(results);
        },
        () => {
          // Fall back gracefully to local reviews on network restrictions
        },
      );
      return () => unsubscribe();
    } catch {
      // Ignored
    }
  }, [storageId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorName = (name.trim() || user?.displayName || "Viewer").slice(0, 50);
    const body = text.trim();
    if (!body || !authorName) return;

    const newReview: Review = {
      name: authorName,
      rating: rating || 5,
      text: body,
      at: Date.now(),
    };

    // Save to Firestore if authenticated
    if (user) {
      try {
        await addDoc(collection(db, "reviews"), {
          storageId,
          authorId: user.uid,
          authorName,
          rating: rating || 5,
          text: body,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.warn("Could not save review to Firestore:", err);
      }
    }

    // Always keep local copy
    const next = [newReview, ...localReviews];
    setLocalReviews(next);
    localStorage.setItem(key, JSON.stringify(next));
    setText("");
    setRating(0);
  };

  const field =
    "w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-accent";

  const allReviews = cloudReviews.length > 0 ? cloudReviews : localReviews;

  return (
    <section>
      <h3 className="mb-1 text-sm font-bold">
        Be The First To Review &ldquo;{title}&rdquo;
      </h3>
      <p className="mb-4 text-[11px] text-zinc-500">
        Reviews are shared with the PinFlix community. Required fields are marked *
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
        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">Name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={user?.displayName || "Your name"}
            className={field}
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-6 py-2 text-xs font-bold text-black transition hover:brightness-110"
        >
          Submit Review
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {allReviews.length === 0 ? (
          <p className="text-[11px] text-zinc-500">There are no reviews yet.</p>
        ) : (
          allReviews.map((r, idx) => (
            <article key={`${r.at}-${idx}`} className="rounded-lg bg-zinc-900 p-4">
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
