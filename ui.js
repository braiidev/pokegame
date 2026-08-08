/* ============================================================
   ui.js — POKÉDESAFÍO v2.0.6
   Interfaz: pantallas, botones, equipo, mapa, tienda, pokédex.
   Depende de: data.js y core.js
   ============================================================ */
"use strict";

/* ===== FIX: confirmBox resetea ambos botones (evita bug del diálogo de evolución) ===== */
function confirmBox(html, cb) {
  $("#cfTxt").innerHTML = html;
  cfCb = cb;
  $("#cfYes").onclick = () => {
    hideOvl("ovConfirm");
    if (cfCb) cfCb();
    cfCb = null;
  };
  $("#cfNo").onclick = () => {
    hideOvl("ovConfirm");
    cfCb = null;
  };
  showOvl("ovConfirm");
}

/* ===== MENÚ PRINCIPAL ===== */
function renderMenu() {
  renderScreen(`
 <div class="menu-wrap">
  <h1 class="logo">POKÉ<em>DESAFÍO</em></h1>
  <div class="tagline">🗺️ Región Ámbar · El Faro de Cristal se apagó…</div>
  <div class="mode-grid">
   <div class="mode-card" id="mcAdv"><div class="ico">🎴</div><h3>ENTRAR</h3><p>Aventura + Desafío Infinito, todo en tu tarjeta de entrenador.</p></div>
  </div>
  <p class="credit">Datos: PokéAPI · Gen 1 · v3.0</p>
 </div>`);
  setButtons([{ label: "🎴 ENTRAR", fn: () => enterGame() }]);
  $("#mcAdv").onclick = () => enterGame();
}
function enterGame() {
  goFullscreen();
  renderSlots();
}

/* ===== TARJETAS DE ENTRENADOR ===== */
function renderSlots() {
  renderScreen(
    '<p class="picktitle">▸ ELIGE TU TARJETA DE ENTRENADOR</p><div class="slot-grid" id="slotGrid"></div>',
  );
  setButtons([{ label: "◂ VOLVER", cls: "secondary", fn: () => renderMenu() }]);
  const g = $("#slotGrid");
  g.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    (function (i) {
      const dd = loadSlot(i);
      const el = document.createElement("div");
      el.className = "slot";
      if (dd && dd.team) {
        const lead = dd.team[0];
        el.innerHTML =
          "<h4>TARJETA " +
          (i + 1) +
          '</h4><div class="sum"><b>' +
          esc(dd.name) +
          "</b><br>🏅 " +
          dd.badges.length +
          "/4 · 🪙 " +
          dd.coins +
          "<br>" +
          (lead ? esc(lead.nick) + " Nv." + lead.lvl : "—") +
          "</div>";
        const sb = document.createElement("div");
        sb.className = "slot-btns";
        const cont = document.createElement("button");
        cont.type = "button";
        cont.className = "btn-big grn";
        cont.textContent = "CONTINUAR ▸";
        cont.onclick = () => startContinue(i, dd);
        sb.appendChild(cont);
        const wipe = document.createElement("button");
        wipe.type = "button";
        wipe.className = "btn-big red";
        wipe.textContent = "BORRAR";
        wipe.onclick = () =>
          confirmBox("¿Borrar la tarjeta " + (i + 1) + "?", () => {
            lsDel("pk_slot" + i);
            renderSlots();
          });
        sb.appendChild(wipe);
        el.appendChild(sb);
      } else {
        el.innerHTML =
          "<h4>TARJETA " +
          (i + 1) +
          '</h4><div class="sum" style="opacity:.5">— Vacía —<br>¡Nueva aventura!</div>';
        const sb = document.createElement("div");
        sb.className = "slot-btns";
        const nw = document.createElement("button");
        nw.type = "button";
        nw.className = "btn-big";
        nw.textContent = "NUEVA AVENTURA ▸";
        nw.onclick = () => newAdventure(i);
        sb.appendChild(nw);
        el.appendChild(sb);
      }
      g.appendChild(el);
    })(i);
  }
}
function startContinue(i, dd) {
  SLOT = i;
  G = dd;
  MODE = "adv";
  if (!G.lastTick) G.lastTick = Date.now();
  if (!G.lastHealTick) G.lastHealTick = Date.now();
  if (!G.day) G.day = 1;
  if (!G.enemyAdvance) G.enemyAdvance = 0;
  if (!G.stones) G.stones = { fuego: 0, agua: 0, trueno: 0, hoja: 0, lunar: 0 };
  if (!G.inf) G.inf = { unlocked: false, bestBattles: 0, bestVictories: 0 };
  if (!G.dex) G.dex = { seen: {}, caught: {}, names: {} };
  if (!G.visited) G.visited = {};
  if (!G.flags) G.flags = {};
  G.team.forEach((m) => {
    if (!m.pts) m.pts = { ps: 0, atk: 0, def: 0, vel: 0 };
    if (m.bankPts === undefined) m.bankPts = 0;
    if (m.resets === undefined) m.resets = 0;
    recalcMon(m);
  });
  energyTick();
  healTick();
  renderStatusBar();
  renderCamp();
}
function newAdventure(i) {
  SLOT = i;
  MODE = "adv";
  showOvl("ovName");
  setTimeout(() => {
    const el = $("#advNameInput");
    if (el) el.focus();
  }, 100);
  window.__pendingSlot = i;
}
$("#advNameOk").onclick = async function () {
  const name = ($("#advNameInput").value.trim() || "ENTRENADOR")
    .toUpperCase()
    .slice(0, 12);
  G = {
    name: name,
    day: 1,
    enemyAdvance: 0,
    energy: 5,
    lastTick: Date.now(),
    lastHealTick: Date.now(),
    coins: 100,
    items: { ball: 5, potion: 2, antidote: 0, antipar: 0, despertar: 0 },
    stones: { fuego: 0, agua: 0, trueno: 0, hoja: 0, lunar: 0 },
    badges: [],
    zone: 0,
    nodeId: "n0",
    visited: {},
    flags: {},
    inf: { unlocked: false, bestBattles: 0, bestVictories: 0 },
    dex: { seen: {}, caught: {}, names: {} },
    team: [],
    box: [],
    active: 0,
  };
  MODE = "adv";
  hideOvl("ovName");
  save();
  renderStatusBar();
  playDialog(
    [
      {
        who: "PROF. ÁLAMO",
        txt: "¡Bienvenido a la Región Ámbar! Soy el Profesor Álamo.",
      },
      {
        who: "PROF. ÁLAMO",
        txt: "¡El FARO DE CRISTAL se apagó! La Team Umbra robó sus fragmentos de luz.",
      },
      {
        who: "PROF. ÁLAMO",
        txt: "Necesito a alguien valiente… ¡y ese eres tú! Elige tu pokémon inicial.",
      },
    ],
    null,
    () => pickStarter(),
  );
};
$("#advNameBack").onclick = () => {
  hideOvl("ovName");
  SLOT = -1;
  renderSlots();
};
async function pickStarter() {
  renderScreen(
    '<p class="picktitle">▸ ELIGE TU POKÉMON INICIAL</p><div class="cards" id="starterRow"></div><p style="text-align:center;font-weight:800;margin-top:10px" id="starterMsg"></p>',
  );
  setButtons([{ label: "◂ VOLVER", cls: "secondary", fn: () => renderCamp() }]);
  $("#starterMsg").textContent = "Cargando…";
  try {
    const trio = await Promise.all([getPoke(1), getPoke(4), getPoke(7)]);
    const row = $("#starterRow");
    row.innerHTML = "";
    trio.forEach((dd) => {
      const card = document.createElement("div");
      card.className = "scard";
      const art =
        (dd.sprites.other &&
          dd.sprites.other["official-artwork"] &&
          dd.sprites.other["official-artwork"].front_default) ||
        dd.sprites.front_default;
      card.innerHTML =
        '<img src="' +
        art +
        '"><h3 class="px">' +
        dd.name.toUpperCase() +
        "</h3>";
      card.onclick = async () => {
        const m = makeMon(dd, 5);
        m.isStarter = true;
        G.team.push(m);
        if (G.dex) {
          G.dex.caught[dd.id] = 1;
          G.dex.seen[dd.id] = 1;
        }
        save();
        renderStatusBar();
        renderCamp();
        toast("¡" + m.nick + " se une a ti! Abre el MAPA para comenzar.");
      };
      row.appendChild(card);
    });
    $("#starterMsg").textContent = "";
  } catch (e) {
    devError(e);
    $("#starterMsg").textContent = "⚠️ Sin conexión. Recarga.";
  }
}

/* ===== CAMPAMENTO ===== */
function renderCamp() {
  renderScreen(`
 <div class="panel">
  <div class="camp-top"><img id="campArt" src="">
   <div class="camp-info">
    <div class="camp-name" id="campName">—</div>
    <div class="camp-stats" id="campStats">—</div>
    <div class="camp-chips" id="campChips"></div>
   </div></div>
  <div class="camp-msg" id="campMsg"></div>
  <div class="hub-grid" id="hubGrid"></div>
 </div>`);
  renderCampButtons();
  renderCampInfo();
}
function renderCampInfo() {
  const p = G.team[G.active];
  $("#campArt").src = p ? p.art : "";
  $("#campName").textContent =
    (p ? (p.isStarter ? "❤️ " : "") + p.nick : "—") +
    " · Nv." +
    (p ? p.lvl : 0);
  $("#campStats").textContent = p
    ? "PS " +
      p.hp +
      "/" +
      p.maxHp +
      " · ⚔" +
      p.atk +
      " 🛡" +
      p.def +
      " 💨" +
      p.vel +
      " · " +
      (p.status ? STATUS_META[p.status.type].i : "sano")
    : "—";
  const ko = G.team.filter((m) => m.hp <= 0).length;
  const bank = G.team.reduce((a, m) => a + (m.bankPts || 0), 0);
  const chips = [];
  if (bank)
    chips.push(
      '<span class="cchip warn">✨ ' + bank + " pts por repartir</span>",
    );
  if (ko)
    chips.push(
      '<span class="cchip" style="background:#ffd6d0">💀 ' + ko + " KO</span>",
    );
  $("#campChips").innerHTML = chips.join("");
}
function renderCampButtons() {
  const wiped = !teamAlive();
  const hg = $("#hubGrid");
  hg.innerHTML = "";
  const btns = [
    {
      label:
        "🗺️ " +
        (G && Object.keys(G.visited || {}).length
          ? "CONTINUAR AVENTURA"
          : "COMENZAR AVENTURA"),
      cls: "primary",
      disabled: wiped,
      fn: () => openMap(),
    },
    {
      label: "⚔️ DESAFÍO INFINITO",
      cls: "inf",
      disabled: !teamAlive(),
      fn: () => {
        if (!G.inf)
          G.inf = { unlocked: false, bestBattles: 0, bestVictories: 0 };
        if (!G.inf.unlocked) {
          G.inf.unlocked = true;
          toast("⚔️ ¡Modo Infinito desbloqueado!");
        }
        if (G.energy < 1) {
          toast("⚡ Necesitás 1⚡ para entrar.");
          return;
        }
        G.energy--;
        save();
        renderStatusBar();
        infInit();
        openInfHub();
      },
    },
    { label: "🌍 EXPLORAR", cls: "", disabled: wiped, fn: () => openExplore() },
    { label: "💤 DESCANSAR", cls: "rest", fn: () => doRest() },
    {
      label: "🏥 CENTRO POKÉMON",
      cls: "heal",
      disabled: !G.team.some((m) => m.hp < m.maxHp || m.status),
      fn: () => openCenter(),
    },
    { label: "🧪 LABORATORIO", cls: "lab", fn: () => openLab() },
    { label: "🛒 TIENDA", cls: "", fn: () => openShop() },
    {
      label: "👥 EQUIPO",
      cls: "",
      fn: () => {
        renderScreen(renderTeamHTML());
        renderTeamButtons();
      },
    },
    { label: "📕 POKÉDEX", cls: "", fn: () => openDex() },
  ];
  btns.forEach((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hbtn " + b.cls;
    btn.innerHTML = '<span class="t">' + b.label + "</span>";
    if (b.disabled) btn.disabled = true;
    btn.onclick = b.fn;
    hg.appendChild(btn);
  });
}
function doRest() {
  G.day++;
  G.energy = eMax();
  G.lastTick = Date.now();
  G.team.forEach((m) => {
    m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.5));
    if (m.hp <= 0) m.hp = Math.floor(m.maxHp * 0.5);
  });
  if (G.enemyAdvance < 5) G.enemyAdvance++;
  SFX.heal();
  save();
  renderStatusBar();
  renderCamp();
  $("#campMsg").textContent =
    "📅 Día " +
    G.day +
    ": ⚡ recargada y equipo curado 50%. ¡La Umbra avanzó! Enemigos +" +
    G.enemyAdvance +
    " Nv.";
}

/* ===== MAPA / ZONAS ===== */
let mapZone = 0;
function openMap() {
  mapZone = Math.min(mapZone, G.zone);
  renderScreen(
    '<p class="picktitle">▸ 🗺️ MAPA DE LA REGIÓN ÁMBAR</p><div id="zoneList" style="display:flex;flex-direction:column;gap:10px;margin-top:10px"></div>',
  );
  setButtons([
    { label: "◂ CAMPAMENTO", cls: "secondary", fn: () => renderCamp() },
  ]);
  const zl = $("#zoneList");
  zl.innerHTML = "";
  ZONES.forEach((z, i) => {
    const locked = i > G.zone;
    const done = G.badges.indexOf(z.badge) !== -1;
    const el = document.createElement("div");
    el.className = "hbtn";
    if (locked) el.style.opacity = ".5";
    el.innerHTML =
      '<span class="t">' +
      z.icon +
      " " +
      z.name +
      (done ? " 🏅" : locked ? " 🔒" : "") +
      '</span><span class="d">' +
      (locked ? "Bloqueada" : done ? "Completada" : "Disponible") +
      "</span>";
    if (!locked) el.onclick = () => enterZone(i);
    zl.appendChild(el);
  });
}
async function enterZone(i) {
  if (!teamAlive()) {
    toast("💀 Equipo debilitado.");
    return;
  }
  if (!spendEnergy()) return;
  const z = ZONES[i];
  const lvl = Math.max(
    2,
    Math.max.apply(
      null,
      G.team.map((m) => m.lvl),
    ) +
      Math.floor(rnd(-2, 3)) +
      G.enemyAdvance,
  );
  let dd = null;
  const id = z.pool[Math.floor(Math.random() * z.pool.length)];
  for (let k = 0; k < 3 && !dd; k++) {
    try {
      dd = await getPoke(id);
    } catch (e) {
      await sleep(500);
    }
  }
  if (!dd) {
    toast("⚠️ Sin conexión.");
    return;
  }
  const e = makeFighter(dd, lvl);
  if (G.dex) G.dex.seen[dd.id] = 1;
  battleStart({
    kind: "wild",
    enemy: e,
    canCatch: true,
    canRun: true,
    canSwap: true,
    xpMode: true,
    intro: "¡" + e.name + " salvaje apareció! (Nv." + lvl + ")",
    onWin: () => {
      G.coins += 15 + e.lvl * 5;
      save();
      renderStatusBar();
      openMap();
    },
    onLose: () => advLose(i),
    onFlee: () => openMap(),
    onCatch: (en) => advCatch(en, () => openMap()),
  });
}
function advLose(zoneIdx) {
  if (mapRollback) {
    G.nodeId = mapRollback.nodeId;
  }
  G.team.forEach((m) => {
    m.hp = Math.max(m.hp, Math.floor(m.maxHp * 0.4));
    m.status = null;
  });
  save();
  renderStatusBar();
  renderCamp();
  $("#campMsg").textContent =
    "😵 Tu equipo cayó. Fueron llevados de vuelta. Descansa o usa el Centro.";
}
function advCatch(en, cb) {
  if (G.dex) {
    G.dex.caught[en.id] = 1;
    G.dex.seen[en.id] = 1;
  }
  $("#nickArt").src = en.art;
  $("#nickTitle").textContent = en.name + " · Nv." + en.lvl;
  $("#nickInput").value = "";
  showOvl("ovNick");
  window.__pendingCatch = { id: en.id, lvl: en.lvl, cb: cb };
}
$("#nickOk").onclick = async function () {
  const c = window.__pendingCatch;
  hideOvl("ovNick");
  if (!c) return;
  const nick = $("#nickInput").value.trim();
  try {
    const dd = await getPoke(c.id);
    const m = makeMon(dd, c.lvl);
    if (nick) m.nick = nick.toUpperCase().slice(0, 12);
    if (G.team.length < 6) G.team.push(m);
    else G.box.push(m);
    save();
    renderStatusBar();
    toast(
      G.team.length <= 6
        ? "¡" + m.nick + " se unió al equipo!"
        : m.nick + " fue al depósito.",
    );
    if (c.cb) c.cb();
  } catch (e) {
    devError(e);
  }
};
$("#nickSkip").onclick = async function () {
  const c = window.__pendingCatch;
  hideOvl("ovNick");
  if (!c) return;
  try {
    const dd = await getPoke(c.id);
    const m = makeMon(dd, c.lvl);
    if (G.team.length < 6) G.team.push(m);
    else G.box.push(m);
    save();
    renderStatusBar();
    toast("¡" + m.nick + " capturado!");
    if (c.cb) c.cb();
  } catch (e) {
    devError(e);
  }
};

/* ===== EXPLORAR ===== */
function openExplore() {
  renderScreen(
    '<p class="picktitle">▸ 🌍 EXPLORAR BIOMAS</p><div id="biomeList" style="display:flex;flex-direction:column;gap:10px;margin-top:10px"></div>',
  );
  setButtons([
    { label: "◂ CAMPAMENTO", cls: "secondary", fn: () => renderCamp() },
  ]);
  const bl = $("#biomeList");
  bl.innerHTML = "";
  BIOMES.forEach((b) => {
    const locked = G.badges.length < b.minBadge;
    const el = document.createElement("div");
    el.className = "hbtn";
    if (locked) el.style.opacity = ".5";
    el.innerHTML =
      '<span class="t">' +
      b.icon +
      " " +
      b.name +
      '</span><span class="d">' +
      (locked ? "Necesitas " + b.minBadge + " medalla(s)" : "Disponible") +
      "</span>";
    if (!locked)
      el.onclick = async () => {
        if (!teamAlive()) {
          toast("💀 Equipo debilitado.");
          return;
        }
        if (!spendEnergy()) return;
        const lvl = Math.max(
          2,
          Math.max.apply(
            null,
            G.team.map((m) => m.lvl),
          ) +
            Math.floor(rnd(-2, 3)) +
            G.enemyAdvance,
        );
        let dd = null;
        const id = b.pool[Math.floor(Math.random() * b.pool.length)];
        for (let k = 0; k < 3 && !dd; k++) {
          try {
            dd = await getPoke(id);
          } catch (e) {
            await sleep(500);
          }
        }
        if (!dd) {
          toast("⚠️ Sin conexión.");
          return;
        }
        const e = makeFighter(dd, lvl);
        if (G.dex) G.dex.seen[dd.id] = 1;
        battleStart({
          kind: "wild",
          enemy: e,
          canCatch: true,
          canRun: true,
          canSwap: true,
          xpMode: true,
          intro: "¡" + e.name + " salvaje apareció! (Nv." + lvl + ")",
          onWin: () => {
            G.coins += 15 + e.lvl * 5;
            save();
            renderStatusBar();
            openExplore();
          },
          onLose: () => {
            advLose(G.zone);
          },
          onFlee: () => openExplore(),
          onCatch: (en) => advCatch(en, () => openExplore()),
        });
      };
    bl.appendChild(el);
  });
}

/* ===== EQUIPO (2 PANELES) ===== */
let teamSel = 0;
function renderTeamHTML() {
  let html =
    '<div class="team-split"><div class="team-items"><h4>🎒 EQUIPAMIENTO</h4><div id="itemList"></div></div>';
  html +=
    '<div class="team-poke"><h4>👥 POKÉMON (' +
    G.team.length +
    '/6)</h4><div class="poke-row" id="pokeRow"></div><div class="ficha" id="fichaBox"></div></div></div>';
  return html;
}
function renderTeamButtons() {
  setButtons([
    {
      label: "◂ VOLVER",
      cls: "secondary",
      fn: () => {
        if (INF) openInfHub();
        else renderCamp();
      },
    },
  ]);
  renderTeamView();
}
function renderTeamView() {
  const il = $("#itemList");
  if (il) {
    il.innerHTML = "";
    const items = [
      ["ball", "🔴 Pokeball"],
      ["potion", "💉 Poción"],
      ["antidote", "🧪 Antídoto"],
      ["antipar", "⚡ Antiparalizador"],
      ["despertar", "☕ Despertador"],
    ];
    items.forEach(([k, nm]) => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML =
        nm + '<span class="cnt">×' + (G.items[k] || 0) + "</span>";
      il.appendChild(row);
    });
    const st = document.createElement("div");
    st.className = "item-row";
    st.style.marginTop = "8px";
    st.innerHTML = "<b>🪨 Piedras</b>";
    il.appendChild(st);
    for (const k in STONE_INFO) {
      const inf = STONE_INFO[k];
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML =
        inf[0] +
        " " +
        inf[1] +
        '<span class="cnt">×' +
        (G.stones[k] || 0) +
        "</span>";
      il.appendChild(row);
    }
  }
  const pr = $("#pokeRow");
  if (pr) {
    pr.innerHTML = "";
    G.team.forEach((m, i) => {
      const sq = document.createElement("div");
      sq.className = "psq" + (i === teamSel ? " sel" : "");
      sq.innerHTML =
        '<img src="' +
        m.art +
        '">' +
        (m.hp <= 0 ? '<span class="ko">💀</span>' : "");
      sq.onclick = () => {
        teamSel = i;
        renderTeamView();
      };
      pr.appendChild(sq);
    });
  }
  renderFicha();
}
function renderFicha() {
  const fb = $("#fichaBox");
  if (!fb) return;
  const m = G.team[teamSel];
  if (!m) {
    fb.innerHTML = '<p style="font-weight:800">Sin pokémon.</p>';
    return;
  }
  const hint = evoHint(m);
  fb.innerHTML =
    '<div class="ficha-head"><img src="' +
    m.art +
    '"><div><div class="nm">' +
    esc(m.nick) +
    '</div><div class="lv">Nv.' +
    m.lvl +
    " · XP " +
    m.xp +
    "/" +
    xpNeed(m.lvl) +
    '</div><div class="trow">' +
    m.types.map(chip).join("") +
    "</div></div></div>" +
    '<div class="sb"><span>PS</span><div class="track"><i style="width:' +
    Math.min(100, (m.hp / m.maxHp) * 100) +
    '%"></i></div><span class="val">' +
    m.hp +
    "/" +
    m.maxHp +
    '</span><span class="pts">+' +
    m.pts.ps * 3 +
    "</span></div>" +
    '<div class="sb"><span>ATQ</span><div class="track"><i style="width:' +
    Math.min(100, m.atk / 1.6) +
    '%"></i></div><span class="val">' +
    m.atk +
    '</span><span class="pts">+' +
    m.pts.atk * 2 +
    "</span></div>" +
    '<div class="sb"><span>DEF</span><div class="track"><i style="width:' +
    Math.min(100, m.def / 1.6) +
    '%"></i></div><span class="val">' +
    m.def +
    '</span><span class="pts">+' +
    m.pts.def * 2 +
    "</span></div>" +
    '<div class="sb"><span>VEL</span><div class="track"><i style="width:' +
    Math.min(100, m.vel / 1.6) +
    '%"></i></div><span class="val">' +
    m.vel +
    '</span><span class="pts">+' +
    m.pts.vel * 2 +
    "</span></div>" +
    (m.bankPts
      ? '<p style="font-weight:900;color:#8a6d00;margin-top:6px">✨ ' +
        m.bankPts +
        " puntos por repartir</p>"
      : "") +
    (hint ? '<p style="font-weight:800;margin-top:4px">' + hint + "</p>" : "") +
    '<div class="ficha-acts" id="fichaActs"></div>';
  renderFichaActs(m);
}
function renderFichaActs(m) {
  const fa = $("#fichaActs");
  if (!fa) return;
  fa.innerHTML = "";
  const mkBtn = (label, fn, dis) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = label;
    if (dis) b.disabled = true;
    b.onclick = fn;
    fa.appendChild(b);
  };
  mkBtn(
    "⭐ ACTIVO",
    () => {
      G.active = G.team.indexOf(m);
      save();
      renderTeamView();
    },
    G.active === G.team.indexOf(m),
  );
  mkBtn(
    "💉 POCIÓN",
    () => {
      if ((G.items.potion || 0) < 1) {
        toast("Sin pociones.");
        return;
      }
      if (m.hp <= 0) {
        toast("Está KO. Usa Centro o Continuar.");
        return;
      }
      if (m.hp >= m.maxHp) {
        toast("Ya está al máximo.");
        return;
      }
      G.items.potion--;
      m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.4));
      SFX.heal();
      save();
      renderStatusBar();
      renderTeamView();
    },
    (G.items.potion || 0) < 1 || m.hp <= 0 || m.hp >= m.maxHp,
  );
  mkBtn(
    "📊 PUNTOS" + (m.bankPts ? " (" + m.bankPts + ")" : ""),
    () => openPts(m, "team"),
    m.bankPts < 1,
  );
  mkBtn("🪨 PIEDRA", () => openStones(m), !hasStoneFor(m));
  mkBtn(
    "📦 DEPÓSITO",
    () => {
      if (G.team.length < 2) {
        toast("Necesitas al menos 1.");
        return;
      }
      G.box.push(G.team.splice(G.team.indexOf(m), 1)[0]);
      if (G.active >= G.team.length) G.active = 0;
      if (teamSel >= G.team.length) teamSel = 0;
      save();
      renderTeamView();
    },
    G.team.length < 2,
  );
}
function openStones(m) {
  let found = false;
  for (const k in STONE_MOVES) {
    for (let i = 0; i < STONE_MOVES[k].length; i++) {
      if (STONE_MOVES[k][i][0] === m.species) {
        found = true;
        if ((G.stones[k] || 0) > 0) {
          confirmBox(
            "¿Usar " +
              STONE_INFO[k][0] +
              " <b>" +
              STONE_INFO[k][1] +
              "</b> en " +
              esc(m.nick) +
              "?",
            async () => {
              G.stones[k]--;
              await doEvolve(m, STONE_MOVES[k][i][1]);
              save();
              renderStatusBar();
              renderTeamView();
            },
          );
          return;
        } else {
          toast("No tenés " + STONE_INFO[k][1] + ". Cómprala en la tienda.");
          return;
        }
      }
    }
  }
  if (!found) toast("Este pokémon no evoluciona con piedras.");
}
let ptsMon = null,
  ptsCtx = "team";
function openPts(m, ctx) {
  ptsMon = m;
  ptsCtx = ctx || "team";
  $("#ptsInfo").textContent =
    m.nick + " · " + m.bankPts + " puntos (máx +" + STAT_CAP + " por stat)";
  const rows = $("#ptsRows");
  rows.innerHTML = "";
  [
    ["ps", "PS"],
    ["atk", "ATQ"],
    ["def", "DEF"],
    ["vel", "VEL"],
  ].forEach(([k, lab]) => {
    const row = document.createElement("div");
    row.className = "sb";
    row.style.gridTemplateColumns = "50px 1fr 44px 40px";
    row.innerHTML =
      "<span>" +
      lab +
      '</span><div class="track"><i style="width:' +
      Math.min(
        100,
        { ps: m.maxHp, atk: m.atk, def: m.def, vel: m.vel }[k] / 1.6,
      ) +
      '%"></i></div><span class="val">' +
      { ps: m.maxHp, atk: m.atk, def: m.def, vel: m.vel }[k] +
      "</span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = "+1";
    b.disabled = m.bankPts < 1 || m.pts[k] >= STAT_CAP;
    b.onclick = () => {
      m.pts[k]++;
      m.bankPts--;
      recalcMon(m);
      save();
      openPts(m, ctx);
    };
    row.appendChild(b);
    rows.appendChild(row);
  });
  showOvl("ovPts");
}
$("#ptsAuto").onclick = () => {
  const m = ptsMon;
  if (!m) return;
  let i = 0;
  const keys = ["ps", "atk", "def", "vel"];
  while (m.bankPts > 0) {
    const k = keys[i % 4];
    if (m.pts[k] < STAT_CAP) {
      m.pts[k]++;
      m.bankPts--;
    }
    if (keys.every((x) => m.pts[x] >= STAT_CAP)) break;
    i++;
    if (i > 600) break;
  }
  recalcMon(m);
  save();
  openPts(m, ptsCtx);
};
$("#ptsClose").onclick = () => {
  hideOvl("ovPts");
  if (ptsCtx === "team") renderTeamView();
};

/* ===== CENTRO POKÉMON ===== */
function openCenter() {
  renderScreen(
    '<p class="picktitle">▸ 🏥 CENTRO POKÉMON</p><div id="centerList" style="margin-top:10px"></div>',
  );
  setButtons([{ label: "◂ VOLVER", cls: "secondary", fn: () => renderCamp() }]);
  const cl = $("#centerList");
  cl.innerHTML = "";
  G.team.forEach((m) => {
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<img src="' +
      m.art +
      '"><span class="inf"><span class="nm">' +
      esc(m.nick) +
      " Nv." +
      m.lvl +
      '</span><br><span class="ds">' +
      (m.hp <= 0 ? "💀 KO" : "PS " + m.hp + "/" + m.maxHp) +
      (m.status ? " · " + STATUS_META[m.status.type].i : "") +
      "</span></span>";
    const bw = document.createElement("div");
    bw.style.cssText = "display:flex;gap:4px";
    const mkB = (label, fn, dis) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-sq";
      b.textContent = label;
      if (dis) b.disabled = true;
      b.onclick = fn;
      bw.appendChild(b);
    };
    mkB("+25%", () => healAt(m, 25), G.coins < 13 || m.hp >= m.maxHp);
    mkB("+50%", () => healAt(m, 50), G.coins < 25 || m.hp >= m.maxHp);
    mkB("FULL", () => healAt(m, 100), G.coins < 50 || m.hp >= m.maxHp);
    if (m.status)
      mkB(
        "💫",
        () => {
          if (G.coins < 10) return;
          G.coins -= 10;
          m.status = null;
          SFX.heal();
          save();
          renderStatusBar();
          openCenter();
        },
        G.coins < 10,
      );
    row.appendChild(bw);
    cl.appendChild(row);
  });
}
function healAt(m, pct) {
  const cost = Math.ceil(pct * 0.5);
  if (G.coins < cost) {
    toast("No alcanza (" + cost + "🪙).");
    return;
  }
  G.coins -= cost;
  m.hp = Math.min(m.maxHp, m.hp + Math.ceil((m.maxHp * pct) / 100));
  SFX.heal();
  save();
  renderStatusBar();
  openCenter();
}

/* ===== LABORATORIO ===== */
function openLab() {
  renderScreen(
    '<p class="picktitle">▸ 🧪 LABORATORIO DEL PROF. ÁLAMO</p><div id="labList" style="margin-top:10px"></div>',
  );
  setButtons([{ label: "◂ VOLVER", cls: "secondary", fn: () => renderCamp() }]);
  const ll = $("#labList");
  ll.innerHTML = "";
  if (!G.box.length) {
    ll.innerHTML =
      '<p style="font-weight:800">Depósito vacío. Atrapa pokémon explorando.</p>';
    return;
  }
  G.box.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<img src="' +
      m.art +
      '"><span class="inf"><span class="nm">' +
      esc(m.nick) +
      " Nv." +
      m.lvl +
      "</span></span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = "DONAR";
    b.onclick = () =>
      confirmBox("¿Donar a " + esc(m.nick) + " al Profesor? (+50🪙)", () => {
        G.box.splice(i, 1);
        G.coins += 50;
        save();
        renderStatusBar();
        openLab();
      });
    row.appendChild(b);
    ll.appendChild(row);
  });
}

/* ===== TIENDA ===== */
function openShop() {
  renderScreen(
    '<p class="picktitle">▸ 🛒 TIENDA</p><div style="text-align:right;font-weight:900" id="shopCoins"></div><div class="shop-list" id="shopList" style="margin-top:8px"></div>',
  );
  setButtons([{ label: "◂ VOLVER", cls: "secondary", fn: () => renderCamp() }]);
  renderShopView();
}
function renderShopView() {
  $("#shopCoins").textContent = "🪙 " + G.coins;
  const sl = $("#shopList");
  sl.innerHTML = "";
  const items = [
    ["ball", "🔴 Pokeball", "Captura pokémon", 150],
    ["potion", "💉 Poción", "Cura 40% PS", 120],
    ["antidote", "🧪 Antídoto", "Cura veneno", 100],
    ["antipar", "⚡ Antiparalizador", "Cura parálisis", 100],
    ["despertar", "☕ Despertador", "Quita sueño", 100],
  ];
  for (const k in STONE_INFO) {
    const inf = STONE_INFO[k];
    items.push([
      "stone_" + k,
      inf[0] + " " + inf[1],
      "Piedra evolutiva",
      inf[2],
    ]);
  }
  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "srow";
    row.innerHTML =
      '<span style="font-size:20px">' +
      it[1].split(" ")[0] +
      '</span><span class="inf"><span class="nm">' +
      it[1] +
      '</span><br><span class="ds">' +
      it[2] +
      "</span></span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "buy";
    b.textContent = it[3] + "🪙";
    b.disabled = G.coins < it[3];
    b.onclick = () => {
      if (G.coins < it[3]) return;
      G.coins -= it[3];
      if (it[0].indexOf("stone_") === 0) {
        G.stones[it[0].replace("stone_", "")]++;
      } else G.items[it[0]] = (G.items[it[0]] || 0) + 1;
      SFX.buy();
      save();
      renderStatusBar();
      renderShopView();
    };
    row.appendChild(b);
    sl.appendChild(row);
  });
}

/* ===== POKEDEX ===== */
function openDex() {
  renderScreen(
    '<p class="picktitle">▸ 📕 POKÉDEX <span id="dexCount"></span></p><div id="dexGrid"></div>',
  );
  setButtons([{ label: "◂ VOLVER", cls: "secondary", fn: () => renderCamp() }]);
  const caught = G.dex ? Object.keys(G.dex.caught).length : 0;
  const seen = G.dex ? Object.keys(G.dex.seen).length : 0;
  $("#dexCount").textContent = "· " + seen + " vistos · " + caught + "/151";
  const g = $("#dexGrid");
  g.innerHTML = "";
  for (let id = 1; id <= 151; id++) {
    (function (id) {
      const c = document.createElement("div");
      const got = G.dex && G.dex.caught[id],
        seenIt = G.dex && G.dex.seen[id];
      c.className = "dcell" + (got ? " caught" : seenIt ? " seen" : "");
      if (seenIt || got) {
        const img = document.createElement("img");
        img.src = sprUrl(id);
        img.loading = "lazy";
        c.appendChild(img);
        if (got) {
          const bi = document.createElement("span");
          bi.className = "bi";
          bi.textContent = "🔴";
          c.appendChild(bi);
        }
      } else c.textContent = "?";
      c.onclick = () => dexDetail(id);
      g.appendChild(c);
    })(id);
  }
}
async function dexDetail(id) {
  showOvl("ovDexMon");
  $("#dexMonBox").innerHTML = '<p style="font-weight:800">Cargando…</p>';
  const seen = G.dex && G.dex.seen[id],
    got = G.dex && G.dex.caught[id];
  try {
    const dd = await getPoke(id);
    const nm = await speciesName(id);
    const b = {};
    dd.stats.forEach((s) => (b[s.stat.name] = s.base_stat));
    const types = dd.types.map((t) => t.type.name);
    const art =
      (dd.sprites.other &&
        dd.sprites.other["official-artwork"] &&
        dd.sprites.other["official-artwork"].front_default) ||
      sprUrl(id);
    $("#dexMonBox").innerHTML = seen
      ? '<img src="' +
        art +
        '" style="width:110px;height:110px;object-fit:contain"><h2 style="font-size:12px;margin:6px 0">' +
        esc(nm) +
        " #" +
        String(id).padStart(3, "0") +
        '</h2><div class="trow">' +
        types.map(chip).join("") +
        '</div><p style="font-weight:900;margin-top:6px">' +
        (got ? "🔴 ¡CAPTURADO!" : "👁️ Visto") +
        '</p><div style="text-align:left;margin-top:8px"><div class="sb"><span>PS</span><div class="track"><i style="width:' +
        Math.min(100, b.hp / 1.6) +
        '%"></i></div><span class="val">' +
        b.hp +
        '</span></div><div class="sb"><span>ATQ</span><div class="track"><i style="width:' +
        Math.min(100, b.attack / 1.6) +
        '%"></i></div><span class="val">' +
        b.attack +
        '</span></div><div class="sb"><span>DEF</span><div class="track"><i style="width:' +
        Math.min(100, b.defense / 1.6) +
        '%"></i></div><span class="val">' +
        b.defense +
        '</span></div><div class="sb"><span>VEL</span><div class="track"><i style="width:' +
        Math.min(100, b.speed / 1.6) +
        '%"></i></div><span class="val">' +
        b.speed +
        "</span></div></div>"
      : '<div style="font-size:50px">❓</div><h2 style="font-size:12px">???</h2><p style="font-weight:800">Aún no lo viste.</p>';
  } catch (e) {
    $("#dexMonBox").innerHTML =
      '<p style="font-weight:800">⚠️ Sin conexión.</p>';
  }
}
$("#dexMonClose").onclick = () => hideOvl("ovDexMon");

/* ===== MODO INFINITO (hub) ===== */
function openInfHub() {
  if (!INF) infInit();
  $("#infStats").innerHTML =
    "⚔️ Batallas: <b>" +
    INF.battles +
    "</b> · 🏆 Victorias: <b>" +
    INF.victories +
    "</b><br><small>Récord: " +
    ((G.inf && G.inf.bestBattles) || 0) +
    " batallas</small>";
  const ts = $("#infTeam");
  ts.innerHTML = "";
  G.team.forEach((m) => {
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<img src="' +
      m.art +
      '"><span class="inf"><span class="nm">' +
      esc(m.nick) +
      " Nv." +
      m.lvl +
      '</span><br><span class="ds">PS ' +
      m.hp +
      "/" +
      m.maxHp +
      (m.hp <= 0 ? " 💀" : "") +
      "</span></span>";
    ts.appendChild(row);
  });
  showOvl("ovInf");
}
$("#infNextBtn").onclick = async function () {
  hideOvl("ovInf");
  await spawnInfBattle();
};
$("#infTeamBtn").onclick = function () {
  hideOvl("ovInf");
  renderScreen(renderTeamHTML());
  renderTeamButtons();
};
$("#infExitBtn").onclick = function () {
  exitInf();
};

/* ===== ARRANQUE ===== */
window.__pokeBooted = true;
MODE = "title";
renderMenu();
setButtons([{ label: "🎴 ENTRAR", fn: () => enterGame() }]);
