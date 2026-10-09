# PinFlix2.0 on cPanel / BDIX hosting

The Vercel frontend, Firebase account/progress sync, and existing Cloudflare media catalog continue to work. A cPanel account is useful for domain DNS, email and an optional BDIX-connected Node server. It does not automatically connect Vercel to a local ISP network. Check that your plan supports Node 22 or newer, Passenger applications and outbound BDIX access before choosing this deployment.

## cPanel Node application

1. Upload this repository without `.git`, `.env.local`, `node_modules` or `.next`. Create a Node application in cPanel, set production mode and use `server.cjs` as the startup file. Activate the environment using the command cPanel provides.
2. Configure the existing Firebase/TMDB environment variables, plus:

   ```dotenv
   MEDIA_PROXY_ALLOWED_HOSTS=cds3.cineplexbd.net
   MEDIA_SOURCE_ALLOWED_HOSTS=cds3.cineplexbd.net
   MEDIA_REGISTRY_PATH=/home/YOUR_ACCOUNT/private/pinflix/bdix-sources.json
   BDIX_ROOT_URL=http://cds3.cineplexbd.net/index.php
   BDIX_MAX_PAGES=200
   TMDB_READ_ACCESS_TOKEN=YOUR_SERVER_SIDE_TMDB_TOKEN
   ```

   Keep tokens in cPanel environment settings, never in browser variables or Git.
3. Run `npm ci`, `npm run build`, and `npm run hosting:check` in Terminal. The readiness report verifies Node, build, writable catalog directory and origin access. A failure to reach the origin means this host cannot serve that BDIX source.
4. Run `npm run ingest`. Importing matches exact TMDB title/year and episode keys; ambiguous matches are skipped. Existing entries survive failed crawls. Add this command to cron only after a successful manual import, and prevent overlapping runs.
5. Restart the Node application, enable HTTPS and test a catalog title, seeking, captions and saved progress. Passenger and your hosting plan must support long streamed responses. The included Nginx example is for a separate VPS, not cPanel shared hosting.

Use `MEDIA_DELISTED_KEYS=movie:123,tv:456:s1e2` to hide catalog keys. The resolver and importer honor this list.

## Vercel and BDIX

Use Vercel for the existing HTTPS/Cloudflare sources. A raw HTTP BDIX URL is proxied by the server hosting this Next application. If that server is Vercel, Vercel must itself reach the BDIX origin; a cPanel account does not change that. For restricted BDIX streaming, run this app on the BDIX-connected Node host, or supply an operator-managed HTTPS media gateway URL in the registry and explicitly allowlist its host. Do not assume an arbitrary public cloud server can reach the ISP origin.

The connection badge reports server-to-origin reachability. It does not measure the viewer's ISP or promise unmetered traffic.

## Optional BDIX VPS containers

Create `.env.local` with the server variables above, then run
`docker compose up --build -d` and `docker compose exec app npm run ingest`.
The catalog volume persists across rebuilds. The Nginx example bootstraps HTTP
on port 80; configure TLS before public use. A VPS needs its own BDIX routing.
