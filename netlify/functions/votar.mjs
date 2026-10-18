// POST /api/votar { id, lado: "h" | "a" } — registra um voto no torcidômetro.
// Um voto por pessoa e jogo é controlado no navegador; aqui há limite de requisições por IP
// e a votação só vale para jogos que ainda não terminaram.
import { randomUUID } from "node:crypto";
import { KEY, dataStore, isKey, json, tally, votePrefix, votesStore } from "../lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ erro: "Requisição inválida." }, 400); }
  const { id, lado } = body || {};
  if (!isKey(id) || (lado !== "h" && lado !== "a")) return json({ erro: "Voto inválido." }, 400);

  // Until the admin saves for the first time the game list lives only in the seed file; then any well-formed id is accepted.
  const saved = await dataStore().get(KEY, { type: "json" });
  if (saved) {
    const game = saved.jogos.find((g) => g.id === id);
    if (!game) return json({ erro: "Jogo não encontrado." }, 404);
    if (game.status === "encerrado" || game.status === "wo") return json({ erro: "A votação deste jogo já foi encerrada." }, 409);
  }

  const store = votesStore();
  await store.set(`${votePrefix(id)}${lado}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`, "1");
  return json(await tally(store, id));
};

export const config = {
  path: "/api/votar",
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
