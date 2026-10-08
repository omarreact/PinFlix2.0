"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-amber-500/10 p-4 text-amber-400 mb-4">
        <AlertCircle size={36} />
      </div>
      <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-400">
        An error occurred while loading this page. You can try refreshing or return to the home page.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-xs font-bold text-black transition hover:bg-accent-soft"
        >
          <RotateCcw size={14} /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-white/20 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
