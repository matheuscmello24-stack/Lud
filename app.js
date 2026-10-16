(function () {
  "use strict";

  var DATA_URL = "data/jogos.js";
  var REFRESH_MS = 60000;
  var STORE_KEY = "jud2k26:equipe";
  var DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  var NAIPE = { F: "Feminino", M: "Masculino" };

  var D = null;
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

  // ---------- data loading (cache-busted, so results refresh without a full reload) ----------
  function loadData(cb) {
    var s = document.createElement("script");
    s.src = DATA_URL + "?v=" + Date.now();
    s.onload = function () { s.remove(); cb(window.JUD_DATA); };
    s.onerror = function () { s.remove(); cb(null); };
    document.head.appendChild(s);
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

    var locais = Object.keys(D.locais || {});
    $("f-local").innerHTML = locais.length > 1 ? chip("Todos os locais", "", state.local) +
      locais.map(function (k) { return chip(esc(D.locais[k].nome), k, state.local); }).join("") : "";
    $("f-local").hidden = locais.length < 2;
  }

  // ---------- games ----------
  function gameHTML(g, mine) {
    var mod = D.modalidades[g.modalidade] || { nome: g.modalidade, curto: g.modalidade };
    var local = (D.locais[g.local] || { nome: g.local }).nome;
    var done = finished(g);
    var live = g.status === "ao_vivo";
    var hc = "home", ac = "away";
    if (done && g.placar[0] !== g.placar[1]) {
      var homeWins = g.placar[0] > g.placar[1];
      hc += homeWins ? " win" : " lose"; ac += homeWins ? " lose" : " win";
    }
    if (mine && g.mandante === mine) hc += " mine";
    if (mine && g.visitante === mine) ac += " mine";

    var center;
    if ((done || live) && hasScore(g)) {
      center = '<div class="score">' + g.placar[0] + "<i>×</i>" + g.placar[1] + "</div>" +
        (g.parciais && g.parciais.length ? '<div class="sets">' + g.parciais.map(esc).join(" · ") + "</div>" : "");
    } else {
      center = '<div class="label">VS</div>';
    }

    var badge = "";
    if (live) badge = '<span class="badge live">Ao vivo</span>';
    else if (g.status === "encerrado") badge = '<span class="badge">Encerrado</span>';
    else if (g.status === "wo") badge = '<span class="badge">W.O.</span>';
    else if (g.status === "adiado") badge = '<span class="badge">Adiado</span>';

    return '<article class="game ' + (g.naipe === "M" ? "m" : "f") + '" aria-label="' +
      esc(mod.nome + " " + NAIPE[g.naipe] + ", " + g.hora + ", " + teamText(g.mandante) + " contra " + teamText(g.visitante)) + '">' +
      '<div class="game-time">' + esc(g.hora) + "</div>" +
      '<div class="game-meta"><span class="hora">' + esc(g.hora) + '</span><span class="mod">' + esc(mod.curto) + "</span>" +
      "<span>" + esc(mod.nome) + " " + NAIPE[g.naipe] + '</span><span class="sep">·</span><span>' + esc(local) + "</span>" +
      (g.fase ? '<span class="sep">·</span><span>' + esc(g.fase) + "</span>" : "") + badge + "</div>" +
      '<div class="match">' + teamHTML(g.mandante, hc) + '<div class="vs">' + center + "</div>" + teamHTML(g.visitante, ac) + "</div>" +
      (g.obs ? '<div class="obs">' + esc(g.obs) + "</div>" : "") +
      '<div class="game-mod">' + esc(mod.curto) + "</div>" +
      "</article>";
  }

  function renderJogos() {
    var list = filtered(false).slice().sort(function (a, b) {
      return a.hora.localeCompare(b.hora) || a.local.localeCompare(b.local);
    });
    var mine = state.equipe || store(STORE_KEY);
    if (!list.length) { $("view-jogos").innerHTML = '<div class="empty">Nenhum jogo com esses filtros neste dia.</div>'; return; }
    var html = "", last = null;
    list.forEach(function (g) {
      if (g.hora !== last) {
        var n = list.filter(function (x) { return x.hora === g.hora; }).length;
        html += '<div class="slot"><h2>' + esc(g.hora) + "</h2><span>" + n + (n > 1 ? " jogos" : " jogo") + "</span></div>";
        last = g.hora;
      }
      html += gameHTML(g, mine);
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
    });
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
    loadData(function (d) { if (d) { D = d; render(); } });
  }

  readHash();
  if (!state.equipe) state.equipe = store(STORE_KEY) || "";
  loadData(function (d) {
    if (!d) { $("view-jogos").innerHTML = '<div class="empty">Não foi possível carregar a tabela. Tente recarregar a página.</div>'; return; }
    D = d; bind(); render();
    setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
  });
})();
