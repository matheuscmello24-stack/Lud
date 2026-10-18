// Rotas do admin, protegidas pela senha ADMIN_PASSWORD (variável de ambiente no Netlify):
// POST /api/login confere a senha; PUT /api/salvar grava o documento inteiro.
import { KEY, authorized, dataStore, json, validate } from "../lib/shared.mjs";

const MAX_BYTES = 512 * 1024;

export default async (req) => {
  const { pathname } = new URL(req.url);
  if (!process.env.ADMIN_PASSWORD) return json({ erro: "A senha do admin não foi configurada no Netlify (variável ADMIN_PASSWORD)." }, 500);
  if (!authorized(req)) return json({ erro: "Senha incorreta ou sessão expirada. Entre novamente." }, 401);

  if (pathname === "/api/login") {
    return req.method === "POST" ? json({ ok: true }) : json({ erro: "Método não permitido." }, 405);
  }

  if (req.method !== "PUT") return json({ erro: "Método não permitido." }, 405);
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ erro: "Dados grandes demais." }, 413);
  let payload;
  try { payload = JSON.parse(raw); } catch { return json({ erro: "JSON inválido." }, 400); }
  const { rev, dados } = payload || {};
  const problem = validate(dados);
  if (problem) return json({ erro: problem }, 422);

  // Optimistic locking: the admin sends the revision it loaded; a save is refused if someone saved in between.
  const conflict = () => json({ erro: "Outra pessoa salvou alterações antes de você. Os dados foram recarregados; refaça a última alteração.", conflito: true }, 409);
  const store = dataStore();
  const current = await store.getWithMetadata(KEY, { type: "json" });
  const currentRev = current ? current.data._rev || 1 : 0;
  if (Number(rev) !== currentRev) return conflict();

  dados._rev = currentRev + 1;
  dados.evento.atualizadoEm = new Date().toISOString();
  // Conditional write closes the gap between the read above and this write.
  const opts = !current ? { onlyIfNew: true } : current.etag ? { onlyIfMatch: current.etag } : {};
  const result = await store.setJSON(KEY, dados, opts);
  if (!result.modified) return conflict();
  return json(dados);
};

export const config = {
  path: ["/api/login", "/api/salvar"],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
