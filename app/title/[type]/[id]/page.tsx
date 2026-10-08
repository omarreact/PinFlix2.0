import { Suspense } from "react";
import TitleView from "@/components/TitleView";

type RouteSearchParams = Record<string, string | string[] | undefined>;

interface TitlePageProps {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<RouteSearchParams>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveEpisodeNumber(value: string | string[] | undefined): number {
  const raw = first(value);
  if (!raw || !/^[0-9]+$/.test(raw)) return 1;

  const number = Number(raw);
  return Number.isSafeInteger(number) && number > 0 && number <= 999
    ? number
    : 1;
}

export default async function TitlePage({
  params,
  searchParams,
}: TitlePageProps) {
  // This project runs Next.js 16, where both route inputs are Promises.
  const [{ type, id }, query] = await Promise.all([params, searchParams]);

  // Keep the existing movie/TV details, trailers and episode selector.
  // Resolve the TV playback identity and episode from the URL on the server.
  const tvPlayback = type === "tv"
    ? {
        tmdbId: id,
        season: positiveEpisodeNumber(query.season),
        episode: positiveEpisodeNumber(query.episode),
        play: first(query.play) === "1",
      }
    : undefined;

  return (
    <Suspense>
      <TitleView tvPlayback={tvPlayback} />
    </Suspense>
  );
}
