/**
 * Permission-gated, metadata-only directory indexer for Type A sources.
 * It never downloads films, subtitles or media segments. Does not accept URL
 * arguments from the public application. Use only with explicit host approval.
 *
 * Usage:
 *   BDIX_CRAWLER_RIGHTS_CONFIRMED=true \
 *   BDIX_CRAWLER_ALLOWED_HOSTS=cdn.example.org \
 *   node services/bdix-crawler/scan.mjs https://cdn.example.org/approved/ output.json
 */
import fs from "node:fs/promises";
import dns from "node:dns/promises";
import net from "node:net";
import { normalizeBdixFilename } from "../../lib/bdix-filename.ts";

const root = process.argv[2], destination = process.argv[3];
const enabled = process.env.BDIX_CRAWLER_RIGHTS_CONFIRMED === "true";
const hosts = new Set((process.env.BDIX_CRAWLER_ALLOWED_HOSTS || "").split(",")
  .map(s => s.trim().toLowerCase()).filter(Boolean));
if (!enabled || !root || !destination) {
  throw new Error("Explicit rights confirmation, approved root URL and destination required");
}
const rootUrl = new URL(root);
if (rootUrl.protocol !== "https:" || rootUrl.username || rootUrl.password ||
    !hosts.has(rootUrl.hostname.toLowerCase()) || net.isIP(rootUrl.hostname))
  throw new Error("Crawler requires an explicitly approved HTTPS hostname");

function publicIp(address) {
  if (net.isIP(address) === 6) {
    const a=address.toLowerCase();
    return !/^(::|::1|fc|fd|fe[89ab]|ff|2001:db8)/.test(a);
  }
  if (!net.isIP(address)) return false;
  const [a,b,c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && c === 0));
}
async function validateDestination(url) {
  if (url.protocol !== "https:" || url.host !== rootUrl.host ||
      !url.pathname.startsWith(rootUrl.pathname)) throw Error("Source escaped approved root");
  const entries = await dns.lookup(url.hostname, { all:true });
  if (!entries.length || entries.some(entry => !publicIp(entry.address)))
    throw Error("Approved source resolved to a restricted address");
}
const agent = "PinFlixAuthorizedMetadataIndexer/1.0";
async function readPage(url) {
  await validateDestination(url);
  const response=await fetch(url, {
    redirect:"manual",signal:AbortSignal.timeout(8000),
    headers:{ "User-Agent":agent,"Accept":"text/html" },cache:"no-store",
  });
  if (response.status>=300&&response.status<400) throw Error("Redirects not permitted");
  if (!response.ok) throw Error("Source HTTP " + response.status);
  if (!(response.headers.get("content-type")||"").toLowerCase().includes("text/html"))
    throw Error("Not an HTML directory");
  if (Number(response.headers.get("content-length")||0)>250_000)
    throw Error("Index response exceeds byte budget");
  const body=await response.text();
  if (body.length>250_000) throw Error("Index too large");
  return body;
}
function links(html,base) {
  const links=[];
  for(const a of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']{1,2000})["'][^>]*>/gi)) {
    const href=a[1].replace(/&amp;/g,"&");
    try{
      const url=new URL(href,base);
      if(url.protocol==="https:" && url.host===rootUrl.host &&
        url.pathname.startsWith(rootUrl.pathname) &&
        !url.username && !url.password && !url.hash) links.push(url);
    }catch{}
  }
  return [...new Map(links.map(u=>[u.href,u])).values()];
}
async function checkRobots() {
  const robots=new URL("/robots.txt",rootUrl);
  if(robots.host!==rootUrl.host)throw Error("Robots origin mismatch");
  await validateDestination(new URL(root));
  const resp=await fetch(robots,{redirect:"manual",signal:AbortSignal.timeout(3000),headers:{"User-Agent":agent}});
  if(resp.status===404)return;
  if(!resp.ok)throw Error("Cannot establish robots policy");
  const text=(await resp.text()).slice(0,50_000);
  const lines=text.split(/\r?\n/);
  let applies=false;
  for(const line of lines){
    const agentLine=line.match(/^\s*user-agent:\s*(.*)/i);
    if(agentLine) applies=agentLine[1].trim()==="*";
    const rule=line.match(/^\s*disallow:\s*(.*)/i);
    if(applies && rule && rule[1].trim() &&
       rootUrl.pathname.startsWith(rule[1].trim()))
      throw Error("robots.txt disallows this index");
  }
}
await checkRobots();
const queue=[{url:rootUrl,depth:0}];
const visited=new Set(),found=new Map();
const MAX_REQUESTS=35,MAX_DEPTH=3,MAX_ASSETS=1500;
while(queue.length && visited.size<MAX_REQUESTS && found.size<MAX_ASSETS) {
  const item=queue.shift();
  if(visited.has(item.url.href)) continue;
  visited.add(item.url.href);
  await new Promise(resolve=>setTimeout(resolve,1000));
  let page;
  try{page=await readPage(item.url)}catch(err){
    console.error("Skipped directory:",String(err).slice(0,180));continue;
  }
  for(const url of links(page,item.url)){
    const record=normalizeBdixFilename(url.pathname);
    if(record.extension && record.title){
      found.set(url.href,{ ...record, url:url.href, sourceHost:rootUrl.host,
        rights:"operator-confirmed", playbackApproved:false });
    } else if(item.depth<MAX_DEPTH && (url.pathname.endsWith("/") ||
      (!/\.[a-z0-9]{1,8}$/i.test(url.pathname)))){
      if(!visited.has(url.href) && queue.length<100)queue.push({url,depth:item.depth+1});
    }
  }
}
const output={
  schema:"pinflix.bdix.metadata.v1", sourceRoot:rootUrl.href,
  collectedAt:new Date().toISOString(), requests:visited.size,
  assetCount:found.size, mediaDownloaded:false,
  records:[...found.values()],
};
await fs.writeFile(destination,JSON.stringify(output,null,2)+"\n","utf8");
console.log("Indexed "+found.size+" media filenames from "+visited.size+" approved HTML indexes.");
