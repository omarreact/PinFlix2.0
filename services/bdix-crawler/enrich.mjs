/**
 * Optional TMDB enrichment for media filename metadata produced by scan.mjs.
 * Outputs REVIEW CANDIDATES (never playback authorization).
 * Usage: TMDB_READ_ACCESS_TOKEN=... node services/bdix-crawler/enrich.mjs input.json output.json
 */
import fs from "node:fs/promises";
const [inputPath, outputPath] = process.argv.slice(2);
const token = process.env.TMDB_READ_ACCESS_TOKEN;
if (!inputPath || !outputPath || !token) throw new Error("Input, output and server-side TMDB token required");

const input = JSON.parse(await fs.readFile(inputPath, "utf8"));
if (input.schema !== "pinflix.bdix.metadata.v1" || !Array.isArray(input.records))
  throw new Error("Unsupported metadata format");
const output = [];
const max = Math.min(150, input.records.length);
const normalize = s=>String(s).toLowerCase().normalize("NFKC").replace(/[^a-z0-9]+/g," ").trim();
for (const record of input.records.slice(0,max)) {
  if (!record || typeof record.title !== "string" || !record.title.trim()) continue;
  const kind = record.season === null ? "movie" : "tv";
  const endpoint = new URL("https://api.themoviedb.org/3/search/" + kind);
  endpoint.searchParams.set("query",record.title);
  endpoint.searchParams.set("include_adult","false");
  if (record.year) endpoint.searchParams.set(kind==="movie"?"year":"first_air_date_year",String(record.year));
  let suggestions = [];
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization:"Bearer "+token, Accept:"application/json" },
      redirect:"error", signal:AbortSignal.timeout(8000),
    });
    if (response.status===429) { console.error("TMDB rate limited; stopping"); break; }
    if (!response.ok) throw Error("TMDB HTTP " + response.status);
    const parsed=await response.json();
    suggestions=(parsed.results||[]).slice(0,5).map(item=>{
      const title=item.title||item.name||"";
      const year=Number((item.release_date||item.first_air_date||"").slice(0,4))||null;
      const exact=normalize(title)===normalize(record.title);
      const yearMatch=!record.year||!year||Math.abs(record.year-year)<=1;
      return {tmdbId:item.id,title,year,score:(exact?0.80:0.35)+(yearMatch?0.15:0)};
    }).sort((a,b)=>b.score-a.score);
  } catch (error) {
    console.error("Metadata lookup skipped:",String(error).slice(0,120));
  }
  const top=suggestions[0]||null;
  output.push({
    original:record.original,normalizedTitle:record.title,
    year:record.year,season:record.season,episode:record.episode,
    sourceHost:record.sourceHost,
    sourceUrl:record.url,
    candidate:top,
    decision:top && top.score>=0.92?"high-confidence-candidate":top?"manual-review":"unmatched",
    approval:"not-authorized-for-playback",
    metadataProvider:"TMDB",
  });
  await new Promise(resolve=>setTimeout(resolve,350));
}
await fs.writeFile(outputPath,JSON.stringify({
  schema:"pinflix.bdix.enriched.v1",generatedAt:new Date().toISOString(),
  total:output.length,items:output,
},null,2)+"\n","utf8");
console.log("Prepared "+output.length+" metadata review items. No streams were enabled.");
