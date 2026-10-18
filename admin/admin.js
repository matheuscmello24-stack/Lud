(function () {
  "use strict";

  var PW_KEY = "jud2k26:admin";
  var DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  var NAIPE = { F: "Feminino", M: "Masculino" };
  var STATUS = { agendado: "Agendado", encerrado: "Encerrado", wo: "W.O.", adiado: "Adiado" };

  var D = null;          // current data, including _rev (revision) from the server
  var pw = "";
  var busy = false;
  var ui = { tab: "resultados", dia: "", local: "", editing: "", novoDia: "" };
  var lote = [];         // games parsed from the bulk-import box, ready to save

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function session(v) {
    try { if (v === undefined) return sessionStorage.getItem(PW_KEY) || ""; if (v) sessionStorage.setItem(PW_KEY, v); else sessionStorage.removeItem(PW_KEY); } catch (e) { return ""; }
  }
  function toast(msg, isErr) {
    var t = $("toast"); t.textContent = msg; t.classList.toggle("err", !!isErr); t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, isErr ? 6000 : 2400);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dayLabel(iso) {
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return DIAS[d.getDay()] + " " + p[2] + "/" + p[1];
  }
  function teamName(k) { var t = D.equipes[k]; return t ? t.nome + (t.destaque ? " " + t.destaque : "") : k; }
  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function keyFrom(name, col) {
    var base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 16) || "ITEM";
    var k = base, i = 2;
    while (col[k]) k = base + i++;
    return k;
  }

  // ---------- server ----------
  function request(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "content-type": "application/json" }, opts.headers || {}, pw ? { "x-admin-senha": pw } : {});
    opts.cache = "no-store";
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, ok: r.ok, body: body }; });
    });
  }

  function load() {
    return request("../api/data.php?admin=1&t=" + Date.now()).then(function (r) {
      if (r.ok) return r.body;
      if (r.status === 404) {
        // Nothing saved yet: start from the seed; the first save creates the record.
        return fetch("../data/seed.json?t=" + Date.now(), { cache: "no-store" }).then(function (x) { return x.json(); }).then(function (d) { d._rev = 0; return d; });
      }
      throw new Error(r.body.erro || "Não foi possível carregar os dados (erro " + r.status + ").");
    }).then(function (d) { D = d; });
  }

  // Applies `mutate` to a copy and saves the whole document. `mutate` may return an error message to abort.
  function save(mutate, okMsg) {
    if (busy) return Promise.resolve(false);
    var next = clone(D);
    var problem = mutate(next);
    if (problem) { toast(problem, true); return Promise.resolve(false); }
    var rev = next._rev; delete next._rev;
    setBusy(true);
    return request("../api/salvar.php", { method: "POST", body: JSON.stringify({ rev: rev, dados: next }) }).then(function (r) {
      if (r.ok) { D = r.body; render(); toast(okMsg || "Salvo"); return true; }
      if (r.status === 401) { logout(r.body.erro); return false; }
      if (r.status === 409) { return load().then(function () { render(); toast(r.body.erro, true); return false; }); }
      toast(r.body.erro || "Erro ao salvar (" + r.status + "). Tente de novo.", true);
      return false;
    }, function () {
      toast("Sem conexão. Nada foi salvo; tente de novo.", true);
      return false;
    }).then(function (v) { setBusy(false); return v; });
  }
  function setBusy(v) {
    busy = v;
    document.querySelectorAll("#app button[type=submit], #app .btn").forEach(function (b) { if (!b.hasAttribute("data-locked")) b.disabled = v; });
  }

  // ---------- login ----------
  function showLogin(msg) {
    $("app").hidden = true; $("sair").hidden = true; $("login").hidden = false;
    $("login-erro").textContent = msg || "";
    $("senha").focus();
  }
  function logout(msg) { pw = ""; session(""); showLogin(msg); }
  function enter() {
    return load().then(function () {
      $("login").hidden = true; $("app").hidden = false; $("sair").hidden = false;
      render();
    });
  }
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var candidate = $("senha").value;
    $("login-erro").textContent = "";
    pw = candidate;
    request("../api/login.php", { method: "POST", body: "{}" }).then(function (r) {
      if (!r.ok) { pw = ""; $("login-erro").textContent = r.body.erro || "Não foi possível entrar."; return; }
      session(candidate); $("senha").value = "";
      return enter();
    }).catch(function (err) { pw = ""; $("login-erro").textContent = err.message || "Sem conexão com o servidor."; });
  });
  $("sair").addEventListener("click", function () { logout(""); });

  // ---------- filters ----------
  // Days with games, plus a new day the admin is preparing (it has no games yet).
  function days() {
    var ds = D.jogos.map(function (g) { return g.data; });
    if (ui.novoDia) ds.push(ui.novoDia);
    return Array.from(new Set(ds)).sort();
  }
  function nextDay(iso) {
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function renderFilters() {
    var ds = days();
    if (!ui.dia || ds.indexOf(ui.dia) < 0) {
      var t = todayISO();
      ui.dia = ds.indexOf(t) >= 0 ? t : (ds.find(function (d) { return d >= t; }) || ds[ds.length - 1] || "");
    }
    $("dias").innerHTML = ds.map(function (d) {
      return '<button type="button" class="chip" data-v="' + d + '" aria-pressed="' + (d === ui.dia) + '">' + dayLabel(d) + "</button>";
    }).join("") + '<button type="button" class="chip novo" data-novo="1">+ Novo dia</button>';
    var ls = Object.keys(D.locais);
    $("locais").innerHTML = ls.length > 1 ? ['<button type="button" class="chip" data-v="" aria-pressed="' + (!ui.local) + '">Todos os locais</button>']
      .concat(ls.map(function (k) { return '<button type="button" class="chip" data-v="' + k + '" aria-pressed="' + (k === ui.local) + '">' + esc(D.locais[k].nome) + "</button>"; })).join("") : "";
    $("filters").hidden = ui.tab === "cadastros" || ui.tab === "evento";
  }
  function dayGames(useLocal) {
    return D.jogos.filter(function (g) { return g.data === ui.dia && (!useLocal || !ui.local || g.local === ui.local); })
      .sort(function (a, b) { return a.hora.localeCompare(b.hora) || a.local.localeCompare(b.local); });
  }

  // ---------- Resultados ----------
  function renderResultados() {
    var list = dayGames(true);
    if (!list.length) { $("lista-resultados").innerHTML = '<div class="empty">Nenhum jogo neste dia. Cadastre na aba Jogos.</div>'; return; }
    var html = "", lastLocal = null;
    var byLocal = Object.keys(D.locais);
    list.sort(function (a, b) { return byLocal.indexOf(a.local) - byLocal.indexOf(b.local) || a.hora.localeCompare(b.hora); });
    list.forEach(function (g) {
      if (g.local !== lastLocal) { html += '<h3 class="venue-title">' + esc((D.locais[g.local] || {}).nome || g.local) + "</h3>"; lastLocal = g.local; }
      var mod = D.modalidades[g.modalidade] || { nome: g.modalidade };
      var p = Array.isArray(g.placar) ? g.placar : ["", ""];
      html += '<form class="card res ' + (g.naipe === "M" ? "m" : "f") + '" data-id="' + esc(g.id) + '">' +
        '<div class="res-head"><b>' + esc(g.hora) + "</b><span>" + esc(mod.nome) + " " + NAIPE[g.naipe] + '</span><span class="state ' + g.status + '">' + STATUS[g.status] + "</span></div>" +
        '<div class="score-row">' +
          '<span class="t">' + esc(teamName(g.mandante)) + "</span>" +
          '<input type="number" inputmode="numeric" min="0" max="999" name="sh" id="sh-' + esc(g.id) + '" value="' + p[0] + '" aria-label="Placar de ' + esc(teamName(g.mandante)) + '">' +
          '<span class="x">×</span>' +
          '<input type="number" inputmode="numeric" min="0" max="999" name="sa" id="sa-' + esc(g.id) + '" value="' + p[1] + '" aria-label="Placar de ' + esc(teamName(g.visitante)) + '">' +
          '<span class="t r">' + esc(teamName(g.visitante)) + "</span>" +
        "</div>" +
        '<div class="res-more">' +
          '<div><label for="st-' + esc(g.id) + '">Situação</label><select name="status" id="st-' + esc(g.id) + '">' +
            Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === g.status ? " selected" : "") + ">" + STATUS[k] + "</option>"; }).join("") +
          "</select></div>" +
          (mod.sets ? '<div><label for="pa-' + esc(g.id) + '">Parciais</label><input name="parciais" id="pa-' + esc(g.id) + '" placeholder="25/13 25/17" value="' + esc((g.parciais || []).join(" ")) + '"></div>' : "<div></div>") +
          '<div class="full"><label for="ob-' + esc(g.id) + '">Observação (opcional)</label><input name="obs" id="ob-' + esc(g.id) + '" maxlength="140" value="' + esc(g.obs || "") + '"></div>' +
        "</div>" +
        '<div class="actions"><button type="submit" class="btn primary">Salvar resultado</button>' +
          (g.status !== "agendado" || g.placar ? '<button type="button" class="btn" data-acao="limpar">Limpar resultado</button>' : "") + "</div>" +
        "</form>";
    });
    $("lista-resultados").innerHTML = html;
  }

  $("lista-resultados").addEventListener("input", function (e) {
    // Typing a score on a scheduled game marks it as finished.
    if (e.target.name !== "sh" && e.target.name !== "sa") return;
    var f = e.target.form, st = f.elements.status;
    if (st.value === "agendado" && (f.elements.sh.value !== "" || f.elements.sa.value !== "")) st.value = "encerrado";
  });
  $("lista-resultados").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, id = f.dataset.id, el = f.elements;
    var status = el.status.value;
    var sh = el.sh.value.trim(), sa = el.sa.value.trim();
    var hasScore = sh !== "" && sa !== "";
    if ((status === "encerrado" || status === "wo") && !hasScore) { toast("Preencha os dois placares para marcar como " + STATUS[status] + ".", true); return; }
    if ((sh === "") !== (sa === "")) { toast("Preencha os dois placares ou deixe os dois em branco.", true); return; }
    save(function (d) {
      var g = d.jogos.find(function (x) { return x.id === id; });
      if (!g) return "Esse jogo foi removido por outra pessoa.";
      g.status = status;
      if (hasScore && status !== "agendado" && status !== "adiado") g.placar = [parseInt(sh, 10), parseInt(sa, 10)]; else delete g.placar;
      var parc = el.parciais ? el.parciais.value.trim().split(/[\s,;]+/).filter(Boolean) : [];
      if (parc.length && g.placar) g.parciais = parc; else delete g.parciais;
      var obs = el.obs.value.trim();
      if (obs) g.obs = obs; else delete g.obs;
    }, "Resultado salvo: " + teamName(D.jogos.find(function (x) { return x.id === id; }).mandante) + " × " + teamName(D.jogos.find(function (x) { return x.id === id; }).visitante));
  });
  $("lista-resultados").addEventListener("click", function (e) {
    var b = e.target.closest("[data-acao=limpar]"); if (!b) return;
    var id = b.closest("form").dataset.id;
    save(function (d) {
      var g = d.jogos.find(function (x) { return x.id === id; });
      if (!g) return "Esse jogo foi removido por outra pessoa.";
      g.status = "agendado"; delete g.placar; delete g.parciais; delete g.obs;
    }, "Resultado removido");
  });

  // ---------- Jogos ----------
  function options(col, selected, placeholder) {
    return (placeholder ? '<option value="">' + placeholder + "</option>" : "") + Object.keys(col).map(function (k) {
      var label = col === D.equipes ? teamName(k) : col[k].nome;
      return '<option value="' + esc(k) + '"' + (k === selected ? " selected" : "") + ">" + esc(label) + "</option>";
    }).join("");
  }
  function fillFormSelects(keep) {
    keep = keep || {};
    $("j-local").innerHTML = options(D.locais, keep.local || ui.local);
    $("j-mod").innerHTML = options(D.modalidades, keep.modalidade);
    $("j-mandante").innerHTML = options(D.equipes, keep.mandante, "Escolha…");
    $("j-visitante").innerHTML = options(D.equipes, keep.visitante, "Escolha…");
  }
  function resetForm(keep) {
    ui.editing = "";
    $("jogo-form-titulo").textContent = "Novo jogo";
    $("jogo-salvar").textContent = "Adicionar jogo";
    $("jogo-cancelar").hidden = true;
    $("jogo-dica").hidden = false;
    fillFormSelects(keep);
    $("j-data").value = (keep && keep.data) || ui.dia || todayISO();
    $("j-hora").value = (keep && keep.hora) || "";
    var n = keep && keep.naipe;
    $("j-naipe-f").checked = n === "F"; $("j-naipe-m").checked = n === "M";
  }
  function renderJogos() {
    if (!ui.editing && !$("j-local").options.length) resetForm();
    else if (!ui.editing) {
      // Keep what the admin typed, but refresh the option lists (registers may have changed).
      var keep = { local: $("j-local").value, modalidade: $("j-mod").value, mandante: $("j-mandante").value, visitante: $("j-visitante").value };
      fillFormSelects(keep);
    }
    var keepLocal = $("lote-local").value;
    $("lote-local").innerHTML = options(D.locais, keepLocal || ui.local);
    if (!$("lote-data").value) $("lote-data").value = ui.dia || todayISO();
    var list = dayGames(true);
    $("jogos-titulo").textContent = ui.dia ? "Jogos de " + dayLabel(ui.dia) + " (" + list.length + ")" : "";
    $("lista-jogos").innerHTML = list.length ? list.map(function (g) {
      var mod = D.modalidades[g.modalidade] || { nome: g.modalidade };
      return '<div class="row ' + (g.naipe === "M" ? "m" : "f") + (g.id === ui.editing ? " editing" : "") + '" data-id="' + esc(g.id) + '">' +
        '<span class="h">' + esc(g.hora) + "</span>" +
        '<span class="d"><b>' + esc(teamName(g.mandante)) + " × " + esc(teamName(g.visitante)) + "</b><small>" +
          esc(mod.nome) + " " + NAIPE[g.naipe] + " · " + esc((D.locais[g.local] || {}).nome || g.local) + " · " + STATUS[g.status] +
          (g.placar ? " " + g.placar[0] + "×" + g.placar[1] : "") + "</small></span>" +
        '<span class="b"><button type="button" class="btn sm" data-acao="editar">Editar</button><button type="button" class="btn sm danger" data-acao="excluir">Excluir</button></span>' +
        "</div>";
    }).join("") : '<div class="empty">Nenhum jogo neste dia.</div>';
  }
  function addHour(hhmm) {
    var p = hhmm.split(":"), h = (+p[0] + 1) % 24;
    return String(h).padStart(2, "0") + ":" + p[1];
  }

  $("jogo-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var naipe = $("j-naipe-f").checked ? "F" : $("j-naipe-m").checked ? "M" : "";
    var g = {
      data: $("j-data").value, hora: $("j-hora").value.slice(0, 5), local: $("j-local").value, modalidade: $("j-mod").value,
      naipe: naipe, mandante: $("j-mandante").value, visitante: $("j-visitante").value,
    };
    if (!g.data || !g.hora || !g.local || !g.modalidade || !g.naipe || !g.mandante || !g.visitante) { toast("Preencha todos os campos do jogo.", true); return; }
    if (g.mandante === g.visitante) { toast("Escolha duas equipes diferentes.", true); return; }
    var editing = ui.editing;
    var clash = D.jogos.find(function (x) { return x.id !== editing && x.data === g.data && x.hora === g.hora && x.local === g.local; });
    save(function (d) {
      if (editing) {
        var cur = d.jogos.find(function (x) { return x.id === editing; });
        if (!cur) return "Esse jogo foi removido por outra pessoa.";
        Object.assign(cur, g);
      } else {
        g.id = newId("j"); g.status = "agendado";
        d.jogos.push(g);
      }
    }, (editing ? "Jogo atualizado" : "Jogo adicionado") + (clash ? ". Atenção: já existe outro jogo nesse horário e local." : "")).then(function (ok) {
      if (!ok) return;
      ui.dia = g.data;
      if (editing) resetForm({ data: g.data, local: g.local, modalidade: g.modalidade });
      else resetForm({ data: g.data, hora: addHour(g.hora), local: g.local, modalidade: g.modalidade, naipe: g.naipe });
      render();
    });
  });
  $("jogo-cancelar").addEventListener("click", function () { resetForm(); render(); });
  // Choosing a date with no games yet makes it the selected day, so its list (empty) is shown.
  $("j-data").addEventListener("change", function () {
    var v = $("j-data").value; if (!v) return;
    if (!D.jogos.some(function (g) { return g.data === v; })) ui.novoDia = v;
    ui.dia = v; render();
  });

  // ---------- bulk import ----------
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  }
  function findTeam(text) {
    var t = norm(text);
    return Object.keys(D.equipes).find(function (k) {
      var e = D.equipes[k];
      return norm(e.nome) === t || norm(e.nome + " " + (e.destaque || "")) === t || norm(k) === t;
    });
  }
  function findMod(text) {
    var t = norm(text);
    return Object.keys(D.modalidades).find(function (k) {
      var m = D.modalidades[k];
      return norm(m.curto) === t || norm(m.nome) === t || norm(k) === t;
    });
  }
  var NAIPE_TXT = { F: "F", FEM: "F", FEMININO: "F", FEMININA: "F", M: "M", MASC: "M", MASCULINO: "M", MASCULINA: "M" };
  function parseLine(line, n) {
    var m = line.match(/^(\d{1,2})\s*[:hH]\s*(\d{2})\s+(.+?)\s+(?:X|x|×|VS|vs|Vs)\s+(.+)$/);
    if (!m) return { erro: "Linha " + n + ": não entendi. Use HORÁRIO EQUIPE x EQUIPE MODALIDADE NAIPE." };
    var hora = String(m[1]).padStart(2, "0") + ":" + m[2];
    var rest = m[4].trim().split(/\s+/);
    if (rest.length < 3) return { erro: "Linha " + n + ": faltou a modalidade ou o naipe." };
    var naipe = NAIPE_TXT[norm(rest.pop())];
    var mod = findMod(rest.pop());
    var t1 = findTeam(m[3]), t2 = findTeam(rest.join(" "));
    var faltas = [];
    if (+m[1] > 23 || +m[2] > 59) faltas.push("horário inválido");
    if (!t1) faltas.push('equipe "' + m[3].trim() + '" não cadastrada');
    if (!t2) faltas.push('equipe "' + rest.join(" ") + '" não cadastrada');
    if (!mod) faltas.push("modalidade não cadastrada");
    if (!naipe) faltas.push("naipe deve ser F ou M");
    if (t1 && t1 === t2) faltas.push("equipes iguais");
    if (faltas.length) return { erro: "Linha " + n + ": " + faltas.join("; ") + "." };
    return { jogo: { hora: hora, modalidade: mod, naipe: naipe, mandante: t1, visitante: t2 } };
  }
  function conferirLote() {
    var data = $("lote-data").value, local = $("lote-local").value;
    var linhas = $("lote-texto").value.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var out = [], erros = 0;
    lote = [];
    if (!data) { out.push('<li class="erro">Escolha a data.</li>'); erros++; }
    if (!linhas.length) { out.push('<li class="erro">Cole ao menos um jogo.</li>'); erros++; }
    linhas.forEach(function (l, i) {
      var r = parseLine(l, i + 1);
      if (r.erro) { erros++; out.push('<li class="erro">' + esc(r.erro) + "</li>"); return; }
      var g = r.jogo;
      var dup = D.jogos.some(function (x) { return x.data === data && x.hora === g.hora && x.local === local; }) ||
        lote.some(function (x) { return x.hora === g.hora; });
      lote.push(g);
      out.push("<li>" + esc(g.hora + " · " + teamName(g.mandante) + " × " + teamName(g.visitante) + " · " + D.modalidades[g.modalidade].nome + " " + NAIPE[g.naipe]) +
        (dup ? " <b>(já existe jogo nesse horário e local)</b>" : "") + "</li>");
    });
    if (erros) lote = [];
    $("lote-resultado").innerHTML = '<ul class="lote-lista">' + out.join("") + "</ul>";
    $("lote-importar").disabled = !lote.length;
    $("lote-importar").textContent = lote.length ? "Importar " + lote.length + (lote.length > 1 ? " jogos" : " jogo") : "Importar";
  }
  $("lote-conferir").addEventListener("click", conferirLote);
  $("lote-texto").addEventListener("input", function () { lote = []; $("lote-importar").disabled = true; $("lote-importar").textContent = "Importar"; });
  $("lote-importar").addEventListener("click", function () {
    if (!lote.length) return;
    var data = $("lote-data").value, local = $("lote-local").value, n = lote.length;
    var novos = lote.map(function (g) { return Object.assign({ id: newId("j"), data: data, local: local, status: "agendado" }, g); });
    save(function (d) { novos.forEach(function (g) { d.jogos.push(g); }); }, n + (n > 1 ? " jogos importados" : " jogo importado") + " em " + dayLabel(data)).then(function (ok) {
      if (!ok) return;
      lote = []; $("lote-texto").value = ""; $("lote-resultado").innerHTML = "";
      $("lote-importar").disabled = true; $("lote-importar").textContent = "Importar";
      ui.dia = data; ui.novoDia = "";
      if (!ui.editing) $("j-data").value = data;
      render();
    });
  });

  $("lista-jogos").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-acao]"); if (!b) return;
    var id = b.closest(".row").dataset.id;
    var g = D.jogos.find(function (x) { return x.id === id; });
    if (!g) return;
    if (b.dataset.acao === "editar") {
      ui.editing = id;
      fillFormSelects(g);
      $("j-data").value = g.data; $("j-hora").value = g.hora;
      $("j-naipe-f").checked = g.naipe === "F"; $("j-naipe-m").checked = g.naipe === "M";
      $("jogo-form-titulo").textContent = "Editar jogo";
      $("jogo-salvar").textContent = "Salvar alterações";
      $("jogo-cancelar").hidden = false; $("jogo-dica").hidden = true;
      renderJogos();
      $("jogo-form").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Delete asks for a second tap instead of a dialog.
    if (b.dataset.confirm !== "1") {
      b.dataset.confirm = "1"; b.textContent = "Confirmar exclusão";
      setTimeout(function () { if (b.isConnected) { b.dataset.confirm = ""; b.textContent = "Excluir"; } }, 4000);
      return;
    }
    save(function (d) {
      var i = d.jogos.findIndex(function (x) { return x.id === id; });
      if (i < 0) return "Esse jogo já tinha sido removido.";
      d.jogos.splice(i, 1);
    }, "Jogo excluído");
    if (ui.editing === id) resetForm();
  });

  // ---------- Cadastros ----------
  function usage(tipo, k) {
    return D.jogos.filter(function (g) {
      return tipo === "equipes" ? g.mandante === k || g.visitante === k : tipo === "locais" ? g.local === k : g.modalidade === k;
    }).length;
  }
  function renderCadastros() {
    ["equipes", "locais", "modalidades"].forEach(function (tipo) {
      var col = D[tipo];
      $("cad-" + tipo).innerHTML = Object.keys(col).map(function (k) {
        var v = col[k], n = usage(tipo, k);
        return '<form class="cad-row" data-tipo="' + tipo + '" data-k="' + esc(k) + '">' +
          '<input name="nome" value="' + esc(v.nome) + '" aria-label="Nome" required maxlength="40">' +
          (tipo === "equipes" ? '<input name="destaque" value="' + esc(v.destaque || "") + '" placeholder="Complemento" aria-label="Complemento" maxlength="20">' : "") +
          (tipo === "modalidades" ? '<input name="curto" value="' + esc(v.curto || "") + '" placeholder="Sigla" aria-label="Sigla" required maxlength="12">' +
            '<label class="check"><input type="checkbox" name="sets"' + (v.sets ? " checked" : "") + "> sets</label>" : "") +
          '<span class="uso">' + (n ? "em " + n + (n > 1 ? " jogos" : " jogo") : "sem jogos") + "</span>" +
          '<button type="submit" class="btn sm">Salvar</button>' +
          '<button type="button" class="btn sm danger" data-acao="remover"' + (n ? ' disabled data-locked title="Em uso: altere ou exclua os jogos antes"' : "") + ">Excluir</button>" +
          "</form>";
      }).join("") || '<p class="muted small">Nada cadastrado.</p>';
    });
  }
  function readCad(form, tipo) {
    var el = form.elements, v = { nome: el.nome.value.trim() };
    if (tipo === "equipes" && el.destaque.value.trim()) v.destaque = el.destaque.value.trim();
    if (tipo === "modalidades") { v.curto = el.curto.value.trim().toUpperCase(); if (el.sets.checked) v.sets = true; }
    return v;
  }
  document.querySelector("[data-panel=cadastros]").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, tipo = f.dataset.tipo, v = readCad(f, tipo);
    if (!v.nome) return;
    if (f.classList.contains("cad-add")) {
      save(function (d) { d[tipo][keyFrom(v.nome, d[tipo])] = v; }, "Cadastrado: " + v.nome).then(function (ok) { if (ok) f.reset(); });
    } else {
      var k = f.dataset.k;
      save(function (d) { if (!d[tipo][k]) return "Item removido por outra pessoa."; d[tipo][k] = v; }, "Atualizado: " + v.nome);
    }
  });
  document.querySelector("[data-panel=cadastros]").addEventListener("click", function (e) {
    var b = e.target.closest("[data-acao=remover]"); if (!b || b.disabled) return;
    var f = b.closest("form"), tipo = f.dataset.tipo, k = f.dataset.k;
    if (b.dataset.confirm !== "1") {
      b.dataset.confirm = "1"; b.textContent = "Confirmar";
      setTimeout(function () { if (b.isConnected) { b.dataset.confirm = ""; b.textContent = "Excluir"; } }, 4000);
      return;
    }
    save(function (d) {
      if (usage(tipo, k)) return "Ainda há jogos usando esse cadastro.";
      delete d[tipo][k];
    }, "Excluído");
  });

  // ---------- Evento ----------
  function renderEvento() {
    if (document.activeElement && document.activeElement.closest("#evento-form")) return;
    $("ev-nome").value = D.evento.nome || "";
    $("ev-aviso").value = D.evento.aviso || "";
    $("ev-popup").value = D.evento.popup || "";
  }
  $("evento-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = $("ev-nome").value.trim(), aviso = $("ev-aviso").value.trim(), popup = $("ev-popup").value.trim();
    save(function (d) { d.evento.nome = nome; d.evento.aviso = aviso; if (popup) d.evento.popup = popup; else delete d.evento.popup; }, "Dados do evento salvos");
  });
  $("backup").addEventListener("click", function () {
    var data = clone(D); delete data._rev;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jud2k26-backup-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  // ---------- tabs & render ----------
  document.querySelector(".tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    ui.tab = b.dataset.tab; render();
  });
  $("dias").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.novo) {
      // Start a new day: suggest the day after the last one and open the game form on it.
      var ds = days(), sug = ds.length ? nextDay(ds[ds.length - 1]) : todayISO();
      ui.novoDia = sug; ui.dia = sug; ui.tab = "jogos";
      if (ui.editing) resetForm();
      $("j-data").value = sug; $("lote-data").value = sug;
      render();
      $("j-data").focus();
      toast("Novo dia " + dayLabel(sug) + ". Ajuste a data se precisar e cadastre os jogos.");
      return;
    }
    ui.dia = b.dataset.v;
    $("lote-data").value = ui.dia;
    if (!ui.editing) $("j-data").value = ui.dia;
    render();
  });
  $("locais").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return; ui.local = b.dataset.v; render();
  });

  function render() {
    document.querySelectorAll(".tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === ui.tab); });
    document.querySelectorAll(".panel").forEach(function (p) { p.hidden = p.dataset.panel !== ui.tab; });
    renderFilters();
    if (ui.tab === "resultados") renderResultados();
    if (ui.tab === "jogos") renderJogos();
    if (ui.tab === "cadastros") renderCadastros();
    if (ui.tab === "evento") renderEvento();
  }

  // ---------- start ----------
  pw = session();
  if (!pw) { showLogin(""); return; }
  request("../api/login.php", { method: "POST", body: "{}" }).then(function (r) {
    if (!r.ok) return logout(r.status === 401 ? "" : r.body.erro);
    return enter();
  }).catch(function () { showLogin("Sem conexão com o servidor."); });
})();
