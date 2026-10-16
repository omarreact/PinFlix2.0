import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BdixRegistryView from "@/components/BdixRegistryView";

export const metadata = {
  title: "BDIX Source Registry | PinFlix",
  description: "Research inventory of BDIX directory references with explicit verification and rights labels.",
};
export default function BdixPage() {
  return <>
    <Navbar />
    <main className="mx-auto min-h-[80vh] max-w-7xl px-4 pb-24 pt-28 sm:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">PinFlix Network Intelligence</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">BDIX source registry</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          Research candidates gathered from published Bangladesh ISP directories.
          These entries are not verified live streams and are not automatically eligible for playback or crawling.
          HTTP and private-address entries cannot be reliably tested from this HTTPS website.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-400">Loading source registry…</p>}>
        <BdixRegistryView />
      </Suspense>
    </main>
    <Footer />
  </>;
}
