// Código comum às funções da API. Os dados ficam no Netlify Blobs;
// enquanto nada foi salvo pelo admin, o site usa data/seed.json.
import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const KEY = "dados";
export const dataStore = () => getStore({ name: "jud2k26", consistency: "strong" });
export const votesStore = () => getStore({ name: "jud2k26-torcida", consistency: "strong" });
// Each vote is its own entry (v/<gameId>/<lado>-<unique>), so simultaneous votes never overwrite each other;
// the tally counts entries by listing the game's prefix.
export const votePrefix = (id) => `v/${id}/`;
export async function tally(store, id) {
  const counts = { h: 0, a: 0 };
  for await (const page of store.list({ prefix: votePrefix(id), paginate: true })) {
    for (const { key } of page.blobs) {
      const lado = key.slice(votePrefix(id).length, votePrefix(id).length + 1);
      if (lado === "h" || lado === "a") counts[lado]++;
    }
  }
  return counts;
}
const STATUS = ["agendado", "encerrado", "wo", "adiado"];
const NAIPES = ["F", "M"];

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const isKey = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(s);
const isText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const optText = (s, max) => s === undefined || s === "" || (typeof s === "string" && s.length <= max);

// Returns an error message, or "" when the document is valid.
export function validate(d) {
  if (!d || typeof d !== "object") return "Documento inválido.";
  delete d._rev;
  if (!d.evento || !optText(d.evento.aviso, 400) || !optText(d.evento.popup, 400) || !optText(d.evento.nome, 80)) return "Dados do evento inválidos.";
  for (const [name, col] of [["modalidades", d.modalidades], ["locais", d.locais], ["equipes", d.equipes]]) {
    if (!col || typeof col !== "object" || Array.isArray(col)) return `Lista de ${name} inválida.`;
    for (const [k, v] of Object.entries(col)) {
      if (!isKey(k) || !v || !isText(v.nome, 40)) return `Item inválido em ${name}: ${k}.`;
      if (!optText(v.destaque, 20) || !optText(v.curto, 12)) return `Item inválido em ${name}: ${k}.`;
    }
  }
  if (!Array.isArray(d.jogos) || d.jogos.length > 2000) return "Lista de jogos inválida.";
  const ids = new Set();
  for (const g of d.jogos) {
    const where = g && g.id ? `jogo ${g.id}` : "um jogo";
    if (!g || !isKey(g.id) || ids.has(g.id)) return `Identificador repetido ou inválido em ${where}.`;
    ids.add(g.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.data) || !/^\d{2}:\d{2}$/.test(g.hora)) return `Data ou horário inválido em ${where}.`;
    if (!d.locais[g.local]) return `Local inexistente em ${where}.`;
    if (!d.modalidades[g.modalidade]) return `Modalidade inexistente em ${where}.`;
    if (!NAIPES.includes(g.naipe)) return `Naipe inválido em ${where}.`;
    if (!d.equipes[g.mandante] || !d.equipes[g.visitante]) return `Equipe inexistente em ${where}.`;
    if (g.mandante === g.visitante) return `Uma equipe não pode jogar contra si mesma (${where}).`;
    if (!STATUS.includes(g.status)) return `Situação inválida em ${where}.`;
    if (g.placar !== undefined && g.placar !== null) {
      if (!Array.isArray(g.placar) || g.placar.length !== 2 || !g.placar.every((n) => Number.isInteger(n) && n >= 0 && n < 1000))
        return `Placar inválido em ${where}.`;
    }
    if ((g.status === "encerrado" || g.status === "wo") && !Array.isArray(g.placar)) return `Informe o placar em ${where}.`;
    if (g.parciais !== undefined && (!Array.isArray(g.parciais) || g.parciais.length > 7 || !g.parciais.every((p) => optText(p, 12))))
      return `Parciais inválidas em ${where}.`;
    if (!optText(g.obs, 140)) return `Observação longa demais em ${where}.`;
  }
  return "";
}

