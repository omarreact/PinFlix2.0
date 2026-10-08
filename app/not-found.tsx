import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-[75vh] flex-col items-center justify-center px-4 text-center">
        <span className="font-display text-7xl font-bold text-accent sm:text-9xl">
          404
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-white sm:text-2xl">
          Title or page not found
        </h1>
        <p className="mt-2 max-w-sm text-xs text-zinc-400">
          The movie, series, or page you are looking for could not be found.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-xs font-bold text-[#0b100e] transition hover:bg-accent-soft"
        >
          Return Home
        </Link>
      </main>
      <Footer />
    </>
  );
}
