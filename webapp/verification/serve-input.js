import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, relative, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
export function createInputServer() {
  return createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path === '/') { res.writeHead(302, { Location: '/examples/microbit-input/' }); res.end(); return; }
      if (!path.startsWith('/src/') && !path.startsWith('/examples/')) { res.writeHead(404); res.end(); return; }
      let file = resolve(root, '.' + path);
      if (relative(root, file).startsWith('..') || path.includes('\0')) { res.writeHead(403); res.end(); return; }
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      if (!types[extname(file)]) { res.writeHead(403); res.end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  createInputServer().listen(port, '127.0.0.1', () => console.log(`Input example: http://127.0.0.1:${port}/examples/microbit-input/`));
}
