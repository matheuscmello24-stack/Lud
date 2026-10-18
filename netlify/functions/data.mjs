// GET /api/data: dados públicos do site. Sem rate limit, pois o site consulta a cada minuto.
import { KEY, dataStore, json } from "../lib/shared.mjs";

export default async (req) => {
  if (req.method !== "GET") return json({ erro: "Método não permitido." }, 405);
  const admin = new URL(req.url).searchParams.has("admin");
  const found = await dataStore().getWithMetadata(KEY, { type: "json" });
  // 404 = nada salvo ainda; o navegador cai para data/seed.json.
  if (!found) return json({ vazio: true }, 404);
  // A short CDN cache keeps function calls low while the public page polls; the admin always reads fresh.
  const cdn = admin ? "no-store" : "public, s-maxage=10, stale-while-revalidate=20";
  return json({ ...found.data, _rev: found.data._rev || 1 }, 200, { "netlify-cdn-cache-control": cdn, "netlify-vary": "query=admin" });
};

export const config = { path: "/api/data" };
