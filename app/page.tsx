import Footer, { CtaBanner } from "@/components/Footer";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import Row from "@/components/Row";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <main className="relative z-10 -mt-24 flex flex-col gap-6 sm:-mt-32">
        <Row
          title="Trending Movies"
          path="/trending/movie/week"
          type="movie"
          href="/browse/movie"
        />
        <Row
          title="Popular TV Shows"
          path="/tv/popular"
          type="tv"
          variant="wide"
          href="/browse/tv"
        />
        <Row
          title="Top 10 Today"
          path="/trending/movie/day"
          type="movie"
          variant="top"
          limit={10}
        />
        <Row
          title="Top Rated Movies"
          path="/movie/top_rated"
          type="movie"
          href="/browse/movie"
        />
        <Row
          title="Top Rated TV Shows"
          path="/tv/top_rated"
          type="tv"
          variant="wide"
          href="/browse/tv"
        />
        <Row title="Now Playing" path="/movie/now_playing" type="movie" />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
