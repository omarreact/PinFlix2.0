/**
 * Read-only directory importer. Requires Node.js 22+ and network access.
 * No media crawling, health scanning or Firestore writes.
 *
 * Usage: node scripts/bdix-import.mjs [destination.json]
 */
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { BDIX_DIRECTORY_URL, parseBdixDirectory } from "../lib/bdix-registry.ts";

const destination = resolve(process.argv[2] || "bdix-directory-inventory.json");
const res = await fetch(BDIX_DIRECTORY_URL, {
  signal: AbortSignal.timeout(12000), headers: { Accept: "text/plain" },
});
if (!res.ok) throw new Error("Directory HTTP " + res.status);
const body = await res.text();
const items = parseBdixDirectory(body);
if (items.length < 50) throw new Error("Directory incomplete; no output written");
const payload = {
  schema: "pinflix.bdix.registry.v1",
  generatedAt: new Date().toISOString(),
  source: BDIX_DIRECTORY_URL,
  verification: "unverified-directory-references",
  rightsPolicy: "No crawling or playback until separately authorized",
  total: items.length,
  items,
};
await fs.writeFile(destination, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log("Wrote " + items.length + " unverified references to " + destination);
