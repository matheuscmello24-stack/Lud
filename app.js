(function () {
  "use strict";

  var API_URL = "api/data.php";
  var SEED_URL = "data/seed.json";
  var REFRESH_MS = 60000;
  var STORE_KEY = "jud2k26:equipe";
  var VOTES_KEY = "jud2k26:votos";
  var POPUP_KEY = "jud2k26:aviso-visto";
  var POPUP_PADRAO = "Site em fase de teste. Tabela de acompanhamento. Em caso de divergência, prevalece a súmula oficial da organização.";
  var DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  var DIAS_LONGO = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
  var NAIPE = { F: "Feminino", M: "Masculino" };

  var D = null;
  var T = {};            // torcidômetro: { gameId: { h, a } }
  var state = { dia: null, equipe: "", naipe: "", mod: "", local: "" };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { return null; }
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

  // ---------- data loading: the admin's saved data, or the seed file until something is saved ----------
  function getJSON(url) {
    url += (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function loadData(cb) {
    getJSON(API_URL).catch(function () { return getJSON(SEED_URL); }).then(cb, function () { cb(null); });
  }

  // ---------- torcidômetro ----------
  function myVotes() {
    try { return JSON.parse(localStorage.getItem(VOTES_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveVotes(v) {
    try { localStorage.setItem(VOTES_KEY, JSON.stringify(v)); } catch (e) {}
  }
  function loadVotes() {
    var ids = D.jogos.filter(function (g) { return g.data === state.dia; }).map(function (g) { return g.id; }).sort();
    if (!ids.length) return Promise.resolve();
    return getJSON("api/torcida.php?ids=" + encodeURIComponent(ids.join(","))).then(function (counts) {
      Object.keys(counts).forEach(function (id) {
        // A cached response must never roll back a vote this visitor just cast.
        var cur = T[id], next = counts[id];
        if (!cur || next.h + next.a >= cur.h + cur.a) T[id] = next;
      });
    }, function () {});
  }
  function shortName(key) { return (D.equipes[key] || { nome: key }).nome; }

  function torcidaHTML(g) {
    var c = T[g.id] || { h: 0, a: 0 };
    var total = c.h + c.a;
    var mine = myVotes()[g.id];
    var closed = finished(g);
    var open = !closed && !mine;
    var ph = total ? Math.round((c.h / total) * 100) : 50;
    var pa = 100 - ph;
    // Keep each side wide enough to read and tap.
    var wh = Math.min(85, Math.max(15, ph));
    var info = closed ? "Votação encerrada" : mine ? "Você torce por " + esc(shortName(mine === "h" ? g.mandante : g.visitante)) : "Toque no lado do seu time";
    if (total) info += " · " + total + (total === 1 ? " voto" : " votos");
    function side(lado, pct, w, team) {
      var label = total ? "<b>" + pct + "%</b>" : "";
      var name = '<span class="t-name">' + esc(shortName(team)) + "</span>";
      return '<button type="button" class="t-side ' + lado + (mine === lado ? " chosen" : "") + (w < 30 ? " narrow" : "") +
        '" style="width:' + w + '%" data-lado="' + lado + '"' + (open ? "" : " disabled") +
        ' aria-label="Torcer por ' + esc(shortName(team)) + (total ? ", " + pct + "% dos votos" : "") + '">' +
        (lado === "h" ? label + name : name + label) + "</button>";
    }
    return '<div class="torcida' + (open ? " open" : "") + '" data-id="' + esc(g.id) + '">' +
      '<div class="t-head"><span class="t-title">Torcidômetro</span><span class="t-info">' + info + "</span></div>" +
      '<div class="t-bar">' + side("h", ph, wh, g.mandante) + side("a", pa, 100 - wh, g.visitante) + "</div></div>";
  }

  function vote(id, lado) {
    if (myVotes()[id]) return;
    var before = T[id] || { h: 0, a: 0 };
    var v = myVotes(); v[id] = lado; saveVotes(v);
    T[id] = { h: before.h + (lado === "h" ? 1 : 0), a: before.a + (lado === "a" ? 1 : 0) };
    renderJogos();
    function undo(msg) {
      var v2 = myVotes(); delete v2[id]; saveVotes(v2);
      T[id] = before; renderJogos(); toast(msg);
    }
    fetch("api/votar.php", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: id, lado: lado }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, b: b }; }); })
      .then(function (res) {
        if (res.ok) { T[id] = res.b; renderJogos(); toast("Voto registrado!"); return; }
        if (res.status === 409) { T[id] = before; renderJogos(); toast(res.b.erro || "Votação encerrada."); return; }
        undo(res.b.erro || "Não foi possível registrar o voto. Tente de novo.");
      }, function () { undo("Sem conexão. O voto não foi registrado."); });
  }

  // ---------- aviso inicial ----------
  function showPopup() {
    var seen = false;
    try { seen = sessionStorage.getItem(POPUP_KEY) === "1"; } catch (e) {}
    var dlg = $("popup");
    if (seen || !dlg) return;
    $("popup-texto").textContent = (D && D.evento.popup) || POPUP_PADRAO;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    $("popup-ok").focus();
  }
  function closePopup() {
    try { sessionStorage.setItem(POPUP_KEY, "1"); } catch (e) {}
    var dlg = $("popup");
    if (typeof dlg.close === "function" && dlg.open) dlg.close(); else dlg.removeAttribute("open");
  }

  // ---------- URL state ----------
  function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    ["dia", "equipe", "naipe", "mod", "local"].forEach(function (k) { if (h.get(k)) state[k] = h.get(k); });
  }
  function writeHash() {
    var h = new URLSearchParams();
    Object.keys(state).forEach(function (k) { if (state[k]) h.set(k, state[k]); });
    var s = h.toString();
    history.replaceState(null, "", s ? "#" + s : location.pathname + location.search);
  }

  // ---------- helpers ----------
  function teamHTML(key, cls) {
    var t = D.equipes[key] || { nome: key };
    return '<div class="team ' + (cls || "") + '">' + esc(t.nome) + (t.destaque ? "<em>" + esc(t.destaque) + "</em>" : "") + "</div>";
  }
  function teamText(key) {
    var t = D.equipes[key] || { nome: key };
    return t.nome + (t.destaque ? " " + t.destaque : "");
  }
  function hasScore(g) { return Array.isArray(g.placar) && g.placar.length === 2 && g.placar[0] != null && g.placar[1] != null; }
  function finished(g) { return (g.status === "encerrado" || g.status === "wo") && hasScore(g); }

  function filtered(ignoreDay) {
    return D.jogos.filter(function (g) {
      if (!ignoreDay && state.dia && g.data !== state.dia) return false;
      if (state.equipe && g.mandante !== state.equipe && g.visitante !== state.equipe) return false;
      if (state.naipe && g.naipe !== state.naipe) return false;
      if (state.mod && g.modalidade !== state.mod) return false;
      if (state.local && g.local !== state.local) return false;
      return true;
    });
  }

  // ---------- filters UI ----------
  function chip(label, value, current, extra) {
    return '<button class="chip" data-v="' + esc(value) + '" aria-pressed="' + (value === current) + '">' + label + (extra || "") + "</button>";
  }

  function renderFilters() {
    var dias = Array.from(new Set(D.jogos.map(function (g) { return g.data; }))).sort();
    if (!state.dia || dias.indexOf(state.dia) < 0) {
      var t = todayISO();
      state.dia = dias.indexOf(t) >= 0 ? t : (dias.find(function (d) { return d >= t; }) || dias[dias.length - 1]);
    }
    var today = todayISO();
    $("days").innerHTML = dias.map(function (d) {
      var dt = parseISO(d);
      return '<button class="day' + (d === today ? " today" : "") + '" data-v="' + d + '" aria-pressed="' + (d === state.dia) + '"><b>' +
        DIAS[dt.getDay()] + "</b><small>" + String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0") + "</small></button>";
    }).join("");

    var mine = store(STORE_KEY);
    $("f-equipe").innerHTML = chip("Todas as atléticas", "", state.equipe) +
      Object.keys(D.equipes).map(function (k) { return chip(esc(teamText(k)), k, state.equipe, k === mine ? '<span class="star">★</span>' : ""); }).join("");

    $("f-naipe").innerHTML = [["", "Todos"], ["F", '<i class="dot dot-f"></i>Fem'], ["M", '<i class="dot dot-m"></i>Masc']].map(function (o) {
      return '<button data-v="' + o[0] + '" aria-pressed="' + (o[0] === state.naipe) + '">' + o[1] + "</button>";
    }).join("");

    $("f-mod").innerHTML = chip("Todas", "", state.mod) +
      Object.keys(D.modalidades).map(function (k) { return chip(esc(D.modalidades[k].nome), k, state.mod); }).join("");

    // Only venues with games on the selected day; a stale venue filter is cleared.
    var locais = Object.keys(D.locais || {}).filter(function (k) {
      return D.jogos.some(function (g) { return g.data === state.dia && g.local === k; });
    });
    if (state.local && locais.indexOf(state.local) < 0) state.local = "";
    $("f-local").innerHTML = locais.length > 1 ? chip("Todos os locais", "", state.local) +
      locais.map(function (k) { return chip(esc(D.locais[k].nome), k, state.local); }).join("") : "";
    $("f-local").hidden = locais.length < 2;
  }

  // ---------- games ----------
  function gameHTML(g, mine) {
    var mod = D.modalidades[g.modalidade] || { nome: g.modalidade, curto: g.modalidade };
    var local = (D.locais[g.local] || { nome: g.local }).nome;
    var done = finished(g);
    var hc = "home", ac = "away";
    if (done && g.placar[0] !== g.placar[1]) {
      var homeWins = g.placar[0] > g.placar[1];
      hc += homeWins ? " win" : " lose"; ac += homeWins ? " lose" : " win";
    }
    if (mine && g.mandante === mine) hc += " mine";
    if (mine && g.visitante === mine) ac += " mine";

    // The official VS mark always sits in the centre; scores flank it, as in the art.
    var scored = done && hasScore(g);
    var sh = scored ? '<div class="sc home-sc">' + g.placar[0] + "</div>" : '<div class="sc"></div>';
    var sa = scored ? '<div class="sc away-sc">' + g.placar[1] + "</div>" : '<div class="sc"></div>';
    var status = "";
    if (g.status === "encerrado") status = '<span class="tag">Final</span>';
    else if (g.status === "wo") status = '<span class="tag">W.O.</span>';
    else if (g.status === "adiado") status = '<span class="tag">Adiado</span>';
    var sets = scored && g.parciais && g.parciais.length ? '<span class="sets">' + g.parciais.map(esc).join(" ") + "</span>" : "";

    return '<article class="game ' + (g.naipe === "M" ? "m" : "f") + '" aria-label="' +
      esc(mod.nome + " " + NAIPE[g.naipe] + ", " + g.hora + ", " + local + ", " + teamText(g.mandante) + " contra " + teamText(g.visitante) +
        (scored ? ", placar " + g.placar[0] + " a " + g.placar[1] : "")) + '">' +
      '<div class="bar">' +
        '<div class="when"><span class="hora">' + esc(g.hora) + '</span><span class="mod-m">' + esc(mod.curto) + "</span>" + status + "</div>" +
        teamHTML(g.mandante, hc) + sh +
        '<div class="vs"><img src="assets/vs.png" alt="contra">' + sets + "</div>" +
        sa + teamHTML(g.visitante, ac) +
        '<div class="mod">' + esc(mod.curto) + "</div>" +
      "</div>" +
      (g.status === "adiado" || (finished(g) && !((T[g.id] || {}).h + (T[g.id] || {}).a)) ? "" : torcidaHTML(g)) +
      (g.obs ? '<p class="obs">' + esc(g.obs) + "</p>" : "") +
      "</article>";
  }

  function renderJogos() {
    var list = filtered(false);
    var mine = state.equipe || store(STORE_KEY);
    if (!list.length) { $("view-jogos").innerHTML = '<div class="empty">Nenhum jogo com esses filtros neste dia.</div>'; return; }
    // One block per venue, in time order, like the official schedule art.
    var dt = parseISO(state.dia);
    var dayLabel = DIAS_LONGO[dt.getDay()] + " " + String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0");
    var order = Object.keys(D.locais);
    var byLocal = {};
    list.forEach(function (g) { (byLocal[g.local] = byLocal[g.local] || []).push(g); });
    var html = "";
    Object.keys(byLocal).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); }).forEach(function (k) {
      var games = byLocal[k].sort(function (a, b) { return a.hora.localeCompare(b.hora); });
      html += '<section class="venue"><header class="venue-head"><h2>' + esc((D.locais[k] || { nome: k }).nome) + "</h2><span>" + dayLabel + "</span></header>" +
        games.map(function (g) { return gameHTML(g, mine); }).join("") + "</section>";
    });
    $("view-jogos").innerHTML = html;
  }

  // ---------- render ----------
  function render() {
    renderFilters();
    renderJogos();

    var up = new Date(D.evento.atualizadoEm);
    $("updated").textContent = isNaN(up) ? "" : "Atualizado em " + up.toLocaleDateString("pt-BR") + " às " +
      up.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    $("aviso").textContent = D.evento.aviso || "";
    writeHash();
  }

  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  // ---------- events ----------
  function bind() {
    $("days").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; state.dia = b.dataset.v; render();
      loadVotes().then(renderJogos);
    });
    $("view-jogos").addEventListener("click", function (e) {
      var b = e.target.closest(".torcida.open .t-side"); if (!b) return;
      vote(b.closest(".torcida").dataset.id, b.dataset.lado);
    });
    $("popup-ok").addEventListener("click", closePopup);
    $("popup").addEventListener("cancel", closePopup);
    $("f-equipe").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      state.equipe = b.dataset.v; store(STORE_KEY, state.equipe); render();
    });
    $("f-naipe").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; state.naipe = b.dataset.v; render();
    });
    $("f-mod").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; state.mod = b.dataset.v; render();
    });
    $("f-local").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; state.local = b.dataset.v; render();
    });
    $("share").addEventListener("click", function () {
      var data = { title: document.title, text: (D.evento.nome || "") + " · tabela de jogos", url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { toast("Link copiado"); }, function () { toast(location.href); });
      else toast(location.href);
    });
  }

  function refresh() {
    if (document.hidden) return;
    loadData(function (d) { if (d) { D = d; render(); loadVotes().then(renderJogos); } });
  }

  readHash();
  if (!state.equipe) state.equipe = store(STORE_KEY) || "";
  loadData(function (d) {
    if (!d) { $("view-jogos").innerHTML = '<div class="empty">Não foi possível carregar a tabela. Tente recarregar a página.</div>'; return; }
    D = d; bind(); render(); showPopup();
    loadVotes().then(renderJogos);
    setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
  });
})();
