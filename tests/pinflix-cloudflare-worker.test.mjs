import test from "node:test";
import assert from "node:assert/strict";
import handler from "../cloudflare/pinflix-media-worker.mjs";

const token = "operator-access-test";
const signing = "fake-test-secret-that-is-long-enough-for-hmac";
function bucket() {
  const objects = new Map([
    ["catalog/movie:123.json", JSON.stringify({sources:[{label:"Test MP4",path:"media/movie/123.mp4"}]})],
    ["media/movie/123.mp4", "FAKE_VIDEO_DATA"],
    ["media/diagnostic/edge-health.mp4", "DUMMY_MP4_FIXTURE"],
    ["media/diagnostic/edge-index.m3u8", "#EXTM3U\n#EXTINF:1.0,\nedge-segment000.ts\n#EXT-X-ENDLIST"],
    ["media/diagnostic/edge-segment000.ts", "FAKE_DIAGNOSTIC_TS"],
    ["catalog-public/movie:123.json", JSON.stringify({public:true,sources:[{label:"Free public MP4",path:"media/movie/123.mp4"}]})],
    ["catalog-public/movie:456.json", JSON.stringify({public:false,sources:[{label:"Unpublished",path:"media/movie/123.mp4"}]})],
    ["catalog/tv:456:s1e2.json", JSON.stringify({sources:[{label:"Episode HLS",path:"media/tv/456/s1e2/master.m3u8"}]})],
    ["media/tv/456/s1e2/master.m3u8", "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST"],
    ["media/tv/456/s1e2/segment.ts", "FAKE_SEGMENT_DATA"],
  ]);
  const wrap = (key, body) => ({
    key, size:new TextEncoder().encode(body).byteLength,
    httpEtag:'"mock-etag"', range:undefined,
    body:new Response(body).body, text:async()=>body, json:async()=>JSON.parse(body)
  });
  return {
    async get(key) {const data=objects.get(key);return data===undefined?null:wrap(key,data);},
    async head(key) {const data=objects.get(key);return data===undefined?null:wrap(key,data);}
  };
}
function env() {return {MEDIA:bucket(),CATALOG_TOKEN:token,SIGNING_KEY:signing,
  CORS_ORIGINS:"https://pin-flix2-0.vercel.app"};}
function request(url, init={}) {return handler.fetch(new Request(url,init),env());}
test("healthy service, but catalog cannot be accessed without bearer", async()=>{
  const health=await request("https://media.example.org/health");
  assert.equal(health.status,200);
  assert.equal((await health.json()).r2,true);
  const denied=await request("https://media.example.org/resolve?key=movie%3A123");
  assert.equal(denied.status,401);
});
test("resolves only cataloged objects; unknown or invalid keys do not leak", async()=>{
  const headers={Authorization:"Bearer "+token};
  const ok=await request("https://media.example.org/resolve?key=movie%3A123",{headers});
  assert.equal(ok.status,200);
  const body=await ok.json();
  assert.equal(body.sources.length,1);
  assert.ok(body.sources[0].url.startsWith("https://media.example.org/m/media/movie/123.mp4?exp="));
  const notFound=await request("https://media.example.org/resolve?key=movie%3A999",{headers});
  assert.deepEqual((await notFound.json()).sources,[]);
  const invalid=await request("https://media.example.org/resolve?key=movie%3A0",{headers});
  assert.equal(invalid.status,400);
});
test("rejects unsigned and tampered downloads; signed MP4 is served",async()=>{
  const unsigned=await request("https://media.example.org/m/media/movie/123.mp4");
  assert.equal(unsigned.status,403);
  const urls=await(await request("https://media.example.org/resolve?key=movie%3A123",
    {headers:{Authorization:"Bearer "+token}})).json();
  const signed=urls.sources[0].url;
  const good=await request(signed,{headers:{Origin:"https://pin-flix2-0.vercel.app"}});
  assert.equal(good.status,200);
  assert.equal(good.headers.get("Access-Control-Allow-Origin"),"https://pin-flix2-0.vercel.app");
  assert.equal(await good.text(),"FAKE_VIDEO_DATA");
  assert.equal((await request(signed.replace("123.mp4","124.mp4"))).status,403);
});
test("rewrites all local HLS segment URLs to signed URLs",async()=>{
  const result=await(await request("https://media.example.org/resolve?key=tv%3A456%3As1e2",
    {headers:{Authorization:"Bearer "+token}})).json();
  const playlist=await request(result.sources[0].url);
  assert.equal(playlist.status,200);
  const text=await playlist.text();
  assert.match(text,/segment\.ts\?exp=\d+&sig=[0-9a-f]{64}/);
  const segment=text.split("\n").find(x=>x.startsWith("https://"));
  assert.equal((await request(segment)).status,200);
});
test("CORS denies unknown web origins, non-media routes return 404",async()=>{
  const r=await request("https://media.example.org/health",{headers:{Origin:"https://evil.example"}});
  assert.equal(r.headers.get("Access-Control-Allow-Origin"),null);
  assert.equal((await request("https://media.example.org/unlisted")).status,404);
});

test("diagnostic issues a real signed URL only for its own test asset", async()=>{
  const info=await request("https://media.example.org/diagnostic");
  assert.equal(info.status,200);
  const data=await info.json();
  assert.equal(data.kind,"mp4");
  assert.equal(data.label,"PinFlix diagnostic test clip");
  assert.match(data.playbackUrl,/^https:\/\/media\.example\.org\/m\/media\/diagnostic\/edge-health\.mp4\?exp=/);
  const fetched=await request(data.playbackUrl);
  assert.equal(fetched.status,200);
  assert.equal(await fetched.text(),"DUMMY_MP4_FIXTURE");
});

test("opt-in public catalog works without bearer while unpublished entries stay closed", async()=>{
  const published=await request("https://media.example.org/public-resolve?key=movie%3A123");
  assert.equal(published.status,200);
  const publishedData=await published.json();
  assert.equal(publishedData.sources.length,1);
  assert.match(publishedData.sources[0].url,/^https:\/\/media\.example\.org\/m\//);
  const denied=await request("https://media.example.org/public-resolve?key=movie%3A456");
  assert.deepEqual((await denied.json()).sources,[]);
  const absent=await request("https://media.example.org/public-resolve?key=movie%3A111");
  assert.deepEqual((await absent.json()).sources,[]);
  assert.equal((await request("https://media.example.org/resolve?key=movie%3A123")).status,401);
});
test("diagnostic HLS playlist and segment are signed",async()=>{
  const data=await(await request("https://media.example.org/diagnostic")).json();
  assert.match(data.hlsPlaybackUrl,/^https:\/\/media\.example\.org\/m\/media\/diagnostic\/edge-index\.m3u8/);
  const playlist=await request(data.hlsPlaybackUrl);
  assert.equal(playlist.status,200);
  const text=await playlist.text();
  const segmentUrl=text.split("\n").find(x=>x.startsWith("https://"));
  assert.match(segmentUrl,/edge-segment000\.ts\?exp=\d+&sig=[0-9a-f]{64}/);
  const segment=await request(segmentUrl);
  assert.equal(await segment.text(),"FAKE_DIAGNOSTIC_TS");
});
