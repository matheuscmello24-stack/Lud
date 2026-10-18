// Servidor local para testar o site e o admin sem o Netlify:
//   ADMIN_PASSWORD=teste npm run dev   →  http://localhost:8888 e http://localhost:8888/admin/
// Serve os arquivos estáticos, roda as funções de netlify/functions e simula o Netlify Blobs em .netlify/blobs-dev.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { BlobsServer } from "@netlify/blobs/server";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8888);
const BLOBS_PORT = PORT + 1;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".webp": "image/webp", ".ttf": "font/ttf", ".svg": "image/svg+xml" };

process.env.ADMIN_PASSWORD ||= "teste";
const blobs = new BlobsServer({ directory: join(ROOT, ".netlify/blobs-dev"), port: BLOBS_PORT, token: "dev" });
await blobs.start();
const ctx = { edgeURL: `http://localhost:${BLOBS_PORT}`, uncachedEdgeURL: `http://localhost:${BLOBS_PORT}`, siteID: "dev", token: "dev" };
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(ctx)).toString("base64");

const routes = [];
for (const name of ["data", "admin"]) {
  const mod = await import(`../netlify/functions/${name}.mjs`);
  for (const p of [].concat(mod.config.path)) routes.push([p, mod.default]);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = routes.find(([p]) => p === url.pathname);
  if (route) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks);
    const r = await route[1](new Request(url, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end("Não encontrado");
  }
}).listen(PORT, () => console.log(`Site: http://localhost:${PORT}  ·  Admin: http://localhost:${PORT}/admin/  (senha: ${process.env.ADMIN_PASSWORD})`));
