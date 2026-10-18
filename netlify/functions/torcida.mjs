// GET /api/torcida?ids=a,b,c — contagem do torcidômetro dos jogos pedidos: { id: { h, a } }.
// Sem rate limit (o site consulta a cada minuto); o CDN segura as repetições por alguns segundos.
import { isKey, json, tally, votesStore } from "../lib/shared.mjs";

export default async (req) => {
  if (req.method !== "GET") return json({ erro: "Método não permitido." }, 405);
  const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").filter(isKey).slice(0, 80);
  const store = votesStore();
  const entries = await Promise.all(ids.map(async (id) => [id, await tally(store, id)]));
  return json(Object.fromEntries(entries), 200, { "netlify-cdn-cache-control": "public, s-maxage=8, stale-while-revalidate=20" });
};

export const config = { path: "/api/torcida" };
