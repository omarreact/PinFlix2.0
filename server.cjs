/* eslint-disable @typescript-eslint/no-require-imports -- cPanel Passenger requires a CommonJS startup file. */
// cPanel/Passenger entry point. Install dependencies and run npm run build first.
const http = require('node:http');
const next = require('next');
const port = Number(process.env.PORT) || 3000;
const app = next({ dev: false });
const handler = app.getRequestHandler();
app.prepare().then(() => {
  http.createServer(handler).listen(port, () => {
    console.log('PinFlix server ready');
  });
}).catch(() => {
  console.error('PinFlix startup failed. Verify the production build and server configuration.');
  process.exit(1);
});
