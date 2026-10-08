"use client";

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import {
  type LibraryTitle,
  setWatchlist,
} from "@/lib/library";

/**
 * Synchronize local watchlist item to Firestore if user is authenticated.
 */
export async function syncWatchlistToCloud(item: LibraryTitle, enabled: boolean) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const docId = `${item.type}_${item.id}`;
    const ref = doc(db, "users", user.uid, "watchlist", docId);
    if (enabled) {
      await setDoc(ref, {
        tmdbId: item.id,
        type: item.type,
        title: item.title,
        posterPath: item.posterPath,
        year: item.year,
        addedAt: Date.now(),
      });
    } else {
      await deleteDoc(ref);
    }
  } catch (error) {
    console.warn("Failed to sync watchlist to cloud:", error);
  }
}

/**
 * Synchronize playback progress to Firestore if user is authenticated.
 */
export async function syncProgressToCloud(
  item: LibraryTitle,
  seconds: number,
  duration: number,
  season?: number,
  episode?: number,
  completed = false,
) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const docId =
      item.type === "tv"
        ? `tv_${item.id}_s${season ?? 1}e${episode ?? 1}`
        : `movie_${item.id}`;
    const ref = doc(db, "users", user.uid, "progress", docId);
    await setDoc(
      ref,
      {
        tmdbId: item.id,
        type: item.type,
        title: item.title,
        posterPath: item.posterPath,
        year: item.year,
        season: item.type === "tv" ? season ?? 1 : null,
        episode: item.type === "tv" ? episode ?? 1 : null,
        seconds,
        duration,
        completed,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn("Failed to sync progress to cloud:", error);
  }
}

/**
 * Listen to cloud watchlist updates and hydrate local state.
 */
export function subscribeToCloudWatchlist(uid: string) {
  const q = query(
    collection(db, "users", uid, "watchlist"),
    orderBy("addedAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const item: LibraryTitle = {
          id: data.tmdbId,
          type: data.type,
          title: data.title,
          year: data.year,
          posterPath: data.posterPath,
        };
        if (change.type === "added" || change.type === "modified") {
          setWatchlist(item, true);
        } else if (change.type === "removed") {
          setWatchlist(item, false);
        }
      });
    },
    (err) => {
      console.warn("Cloud watchlist subscription error:", err);
    },
  );
}
