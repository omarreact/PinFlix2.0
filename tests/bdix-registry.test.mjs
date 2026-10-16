import test from "node:test";
import assert from "node:assert/strict";
import { canonicalBdixUrl, bdixScope, parseBdixDirectory, filterBdixDirectory }
  from "../lib/bdix-registry.ts";
const fixture = [
  "1. BUSINESS NETWORK FTP SERVER",
  "  * http://server1.ftpbd.net/FTP-1",
  "  * http://server1.ftpbd.net/FTP-1/",
  "  * http://media.ftpbd.net:8096",
  "  * https://www.facebook.com/groups/example",
  "2. SAM ONLINE FTP SERVER",
  "  * http://172.16.50.4",
  "  * http://172.16.50.7",
  "3. MOVIEHUB FTP SERVER",
  "  * http://103.81.104.98/Data",
].join("\n");
test("normalizes paths and de-duplicates without dropping distinct sources", () => {
  assert.equal(canonicalBdixUrl("HTTP://Example.COM/a/"), "http://example.com/a");
  assert.equal(parseBdixDirectory(fixture).length, 5);
});
test("marks private IPs, media ports and data paths correctly", () => {
  const records = parseBdixDirectory(fixture);
  assert.equal(records.find(x => x.url.includes("172.16.50.4"))?.scope, "private-ip");
  assert.equal(records.find(x => x.port === 8096)?.kind, "vod-candidate");
  assert.equal(records.find(x => x.url.endsWith("/Data"))?.kind, "directory-candidate");
  assert.ok(records.every(x => x.rights === "unknown" && !x.approvedForPlayback && x.status === "unverified"));
});
test("categorizes and paginates without claiming sources work", () => {
  const entries = parseBdixDirectory(fixture);
  const page = filterBdixDirectory(entries, { page: 1, limit: 1, scope: "private-ip" });
  assert.equal(page.total, 2);
  assert.equal(page.items.length, 1);
  assert.equal(page.hasNext, true);
  assert.equal(bdixScope("10.10.10.1"), "private-ip");
  assert.equal(bdixScope("103.58.73.9"), "ip-literal");
  assert.equal(bdixScope("127.0.0.1"), "special-address");
});
test("rejects malformed and credential-bearing references", () => {
  assert.equal(canonicalBdixUrl("http://user:pass@example.com/movie"), null);
  assert.equal(canonicalBdixUrl("file:///etc/passwd"), null);
});
