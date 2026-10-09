import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
const target = new URL(process.env.BDIX_ROOT_URL ?? 'http://cds3.cineplexbd.net/index.php');
if (!['http:', 'https:'].includes(target.protocol) || target.hostname !== 'cds3.cineplexbd.net' || target.username || target.password || target.port) throw new Error('Use the CineplexBD directory origin.');
const directory = dirname(resolve(process.env.MEDIA_REGISTRY_PATH ?? 'data/bdix-sources.json'));
const report = { nodeVersion: process.versions.node, nodeSupported: Number(process.versions.node.split('.')[0]) >= 22, productionBuildExists: false, registryDirectoryWritable: false, originReachable: false, originStatus: null, originFailure: null };
try { await access('.next/BUILD_ID', constants.R_OK); report.productionBuildExists = true; } catch { /* Build required. */ }
const probe = resolve(directory, `.pinflix-check-${process.pid}`);
let created = false;
try { await mkdir(directory, { recursive: true }); await writeFile(probe, 'probe', { flag: 'wx', mode: 0o600 }); created = true; report.registryDirectoryWritable = true; } catch { /* Report only. */ }
finally { if (created) await rm(probe, { force: true }); }
try { const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(8000) }); report.originStatus = response.status; report.originReachable = response.ok; await response.body?.cancel(); if (!response.ok) report.originFailure = 'http_error'; } catch (error) { report.originFailure = error?.name === 'TimeoutError' ? 'timeout' : 'network_error'; }
console.log(JSON.stringify(report, null, 2));
if (!report.nodeSupported || !report.productionBuildExists || !report.registryDirectoryWritable || !report.originReachable) process.exitCode = 1;
