/* ============================================================
   core.js — POKÉDESAFÍO v3.0
   Estado, guardado, energía, audio, API, motor de batalla,
   XP/evolución y modo infinito.
   Depende de: data.js
   Lo usa: ui.js
   ============================================================ */
"use strict";

/* ===== ESTADO GLOBAL ===== */
let MODE = "title",
  G = null,
  SLOT = -1,
  BT = null,
  INF = null;
let mapRollback = null,
  swapForced = false,
  pendingEvos = [];

/* ===== UTILIDADES UI BÁSICAS (compartidas) ===== */
function toast(m) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2400);
}
function showOvl(id) {
  const o = $("#" + id);
  if (o) o.classList.add("show");
}
function hideOvl(id) {
  const o = $("#" + id);
  if (o) o.classList.remove("show");
}
let devOn = lsGet("pk_dev", "0") === "1";
function dlog(m) {
  try {
    console.log("[POKE] " + m);
  } catch (e) {}
}
function devError(e) {
  const m = (e && (e.message || e.stack)) || String(e);
  toast("⚠️ Error: " + m.slice(0, 60));
  try {
    console.error(e);
  } catch (x) {}
}
window.addEventListener("error", (e) => devError(e));
window.addEventListener("unhandledrejection", (e) => devError(e.reason));

/* ===== FULLSCREEN ===== */
function goFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  } else {
    document.body.classList.add("nofs");
  }
}
function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } else goFullscreen();
}

/* ===== AUDIO ===== */
let AC = null,
  muted = lsGet("pk_mute", "0") === "1";
function ac() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) AC = new C();
  }
  return AC;
}
function tone(f, d, type, v, delay) {
  if (muted) return;
  try {
    const c = ac();
    if (!c) return;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type || "square";
    o.frequency.value = f;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime + (delay || 0);
    g.gain.setValueAtTime(v || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t);
    o.stop(t + d + 0.02);
  } catch (e) {}
}
const SFX = {
  atk() {
    tone(240, 0.08);
  },
  hit() {
    tone(150, 0.15, "sawtooth", 0.08);
  },
  crit() {
    tone(110, 0.22, "sawtooth", 0.1);
  },
  heal() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.1, "triangle", 0.06, i * 0.09));
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.13, "square", 0.05, i * 0.11),
    );
  },
  lose() {
    [330, 262, 196, 131].forEach((f, i) =>
      tone(f, 0.22, "triangle", 0.07, i * 0.18),
    );
  },
  catchJ() {
    [784, 988, 1175].forEach((f, i) =>
      tone(f, 0.12, "triangle", 0.07, i * 0.1),
    );
  },
  buy() {
    tone(880, 0.06);
    tone(1175, 0.09, "square", 0.05, 0.06);
  },
  appear() {
    tone(440, 0.07);
    tone(587, 0.09, "square", 0.05, 0.08);
  },
};

/* ===== GUARDADO ===== */
function save() {
  if (SLOT < 0 || !G) return;
  try {
    lsSet("pk_slot" + SLOT, JSON.stringify(G));
    const si = $("#saveInd");
    if (si) {
      si.classList.add("show");
      clearTimeout(si._h);
      si._h = setTimeout(() => si.classList.remove("show"), 800);
    }
  } catch (e) {}
}
function loadSlot(i) {
  try {
    return JSON.parse(lsGet("pk_slot" + i, null));
  } catch (e) {
    return null;
  }
}

/* ===== ENERGÍA ===== */
function eMax() {
  return G
    ? Math.min(
        ENERGY_MAX_BASE,
        5 + G.badges.length + (G.inf && G.inf.unlocked ? 1 : 0),
      )
    : 5;
}
function energyTick() {
  if (!G) return;
  const now = Date.now();
  if (G.energy < eMax()) {
    const add = Math.floor((now - G.lastTick) / RATE);
    if (add > 0) {
      G.energy = Math.min(eMax(), G.energy + add);
      G.lastTick += add * RATE;
    }
  } else G.lastTick = now;
}
function healTick() {
  if (!G) return;
  const now = Date.now();
  if (!G.lastHealTick) G.lastHealTick = now;
  const all = G.team.concat(G.box);
  if (all.every((m) => m.hp >= m.maxHp)) {
    G.lastHealTick = now;
    return;
  }
  const add = Math.floor((now - G.lastHealTick) / RATE);
  if (add > 0) {
    const pct = Math.min(100, add * 10);
    all.forEach((m) => {
      m.hp = Math.min(m.maxHp, m.hp + Math.floor((m.maxHp * pct) / 100));
    });
    G.lastHealTick += add * RATE;
  }
}
function spendEnergy() {
  energyTick();
  if (G.energy < 1) {
    toast("⚡ Sin energía: DESCANSA o comprá energía (100🪙).");
    return false;
  }
  G.energy--;
  renderStatusBar();
  save();
  return true;
}
function teamAlive() {
  return G && G.team.some((m) => m.hp > 0);
}
function avgTeamLvl() {
  if (!G || !G.team.length) return 5;
  return Math.round(G.team.reduce((a, m) => a + m.lvl, 0) / G.team.length);
}
setInterval(() => {
  if (MODE === "adv" && G) {
    energyTick();
    healTick();
    renderStatusBar();
  }
}, 1000);

/* ===== API ===== */
const cache = new Map();
const nameCache = new Map();
async function getPoke(id) {
  if (cache.has(id)) return cache.get(id);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(API_BASE + id, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const dd = await r.json();
    cache.set(id, dd);
    return dd;
  } catch (e) {
    clearTimeout(to);
    throw new Error(e.name === "AbortError" ? "timeout" : e.message || "red");
  }
}
async function speciesName(id) {
  if (nameCache.has(id)) return nameCache.get(id);
  if (G && G.dex && G.dex.names[id]) {
    nameCache.set(id, G.dex.names[id]);
    return G.dex.names[id];
  }
  try {
    const r = await fetch("https://pokeapi.co/api/v2/pokemon-species/" + id);
    const d = await r.json();
    const es = d.names.find((n) => n.language.name === "es");
    const n = es ? es.name : d.name.toUpperCase();
    nameCache.set(id, n);
    if (G && G.dex) G.dex.names[id] = n;
    return n;
  } catch (e) {
    return "Nº" + id;
  }
}

/* ===== CREACIÓN DE POKÉMON ===== */
function recalcMon(m) {
  m.maxHp = statOf(m.base.hp, m.lvl, true) + m.pts.ps * 3;
  m.atk = statOf(m.base.attack, m.lvl) + m.pts.atk * 2;
  m.def = statOf(m.base.defense, m.lvl) + m.pts.def * 2;
  m.vel = statOf(m.base.speed, m.lvl) + m.pts.vel * 2;
  m.spa = m.atk;
  m.spd = m.def;
  m.spe = m.vel;
}
function makeMoves(t0) {
  const M = MOVES[t0];
  return [
    { name: M.b[0], type: t0, power: M.b[1], cat: "fis", pp: Infinity },
    { name: M.s[0], type: t0, power: M.s[1], cat: "esp", pp: 3, maxpp: 3 },
  ];
}
function makeMon(dd, lvl) {
  const b = {};
  dd.stats.forEach((s) => (b[s.stat.name] = s.base_stat));
  const types = dd.types.map((t) => t.type.name);
  const m = {
    species: dd.id,
    name: dd.name.toUpperCase(),
    nick: dd.name.toUpperCase(),
    lvl: lvl,
    xp: 0,
    bankPts: 0,
    resets: 0,
    pts: { ps: 0, atk: 0, def: 0, vel: 0 },
    base: b,
    types: types,
    status: null,
    hp: 0,
    sprF: dd.sprites.front_default,
    sprB: dd.sprites.back_default || dd.sprites.front_default,
    art:
      (dd.sprites.other &&
        dd.sprites.other["official-artwork"] &&
        dd.sprites.other["official-artwork"].front_default) ||
      dd.sprites.front_default,
  };
  recalcMon(m);
  m.hp = m.maxHp;
  m.moves = makeMoves(types[0]);
  return m;
}
function makeFighter(dd, lvl) {
  const b = {};
  dd.stats.forEach((s) => (b[s.stat.name] = s.base_stat));
  const types = dd.types.map((t) => t.type.name);
  const f = {
    id: dd.id,
    name: dd.name.toUpperCase(),
    nick: dd.name.toUpperCase(),
    lvl: lvl,
    base: b,
    types: types,
    status: null,
    hp: 0,
    moves: makeMoves(types[0]),
    sprF: dd.sprites.front_default,
    sprB: dd.sprites.back_default || dd.sprites.front_default,
    art:
      (dd.sprites.other &&
        dd.sprites.other["official-artwork"] &&
        dd.sprites.other["official-artwork"].front_default) ||
      dd.sprites.front_default,
  };
  f.maxHp = statOf(b.hp, lvl, true);
  f.atk = statOf(b.attack, lvl);
  f.def = statOf(b.defense, lvl);
  f.spa = statOf(b["special-attack"], lvl);
  f.spd = statOf(b["special-defense"], lvl);
  f.spe = statOf(b.speed, lvl);
  f.hp = f.maxHp;
  return f;
}

/* ===== XP / EVOLUCIÓN ===== */
function queueEvo(m) {
  if (pendingEvos.indexOf(m) === -1) pendingEvos.push(m);
}
function gainXp(m, amt) {
  if (!m) return;
  m.xp = (m.xp || 0) + amt;
  let ups = 0;
  while (m.xp >= xpNeed(m.lvl) && m.lvl < 100) {
    m.xp -= xpNeed(m.lvl);
    m.lvl++;
    m.bankPts += 3;
    ups++;
  }
  if (ups) {
    recalcMon(m);
    m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.2));
    toast("⬆️ ¡" + m.nick + " subió a Nv." + m.lvl + "! +" + ups * 3 + " pts");
    const e = EVOS[m.species];
    if (e && m.lvl >= e.lvl) queueEvo(m);
  }
}
async function processEvos() {
  while (pendingEvos.length) {
    const m = pendingEvos.shift();
    let e = EVOS[m.species];
    while (e && m.lvl >= e.lvl) {
      const ok = await new Promise((res) => {
        confirmBox(
          "¡¿Qué?! ¡<b>" +
            esc(m.nick) +
            "</b> (Nv." +
            m.lvl +
            ") está evolucionando!<br>¿Dejarlo evolucionar?",
          () => res(true),
        );
        $("#cfNo").onclick = () => {
          hideOvl("ovConfirm");
          res(false);
          cfCb = null;
        };
      });
      if (!ok) {
        toast("🚫 No evolucionó. Se le preguntará al subir de nivel.");
        return;
      }
      await doEvolve(m, e.to);
      e = EVOS[m.species];
    }
  }
}
async function doEvolve(m, toId) {
  let dd;
  try {
    dd = await getPoke(toId);
  } catch (e) {
    toast("⚠️ Sin conexión.");
    return;
  }
  const oldName = m.name;
  const b = {};
  dd.stats.forEach((s) => (b[s.stat.name] = s.base_stat));
  const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  m.base = b;
  m.species = toId;
  m.name = dd.name.toUpperCase();
  if (m.nick === oldName) m.nick = m.name;
  m.types = dd.types.map((t) => t.type.name);
  m.sprF = dd.sprites.front_default;
  m.sprB = dd.sprites.back_default || m.sprB;
  m.art =
    (dd.sprites.other &&
      dd.sprites.other["official-artwork"] &&
      dd.sprites.other["official-artwork"].front_default) ||
    m.art;
  recalcMon(m);
  m.hp = Math.min(
    m.maxHp,
    Math.max(m.hp <= 0 ? 0 : 1, Math.round(m.maxHp * ratio)),
  );
  m.moves = makeMoves(m.types[0]);
  if (G && G.dex) {
    G.dex.caught[toId] = 1;
    G.dex.seen[toId] = 1;
  }
  save();
  toast("✨ ¡" + oldName + " evolucionó a " + m.name + "!");
}
function evoHint(m) {
  const e = EVOS[m.species];
  if (e) return "🥚→Nv" + e.lvl;
  for (const k in STONE_MOVES) {
    for (let i = 0; i < STONE_MOVES[k].length; i++) {
      if (STONE_MOVES[k][i][0] === m.species) return "🪨 " + STONE_INFO[k][1];
    }
  }
  return "";
}
function hasStoneFor(m) {
  for (const k in STONE_MOVES) {
    for (let i = 0; i < STONE_MOVES[k].length; i++) {
      if (STONE_MOVES[k][i][0] === m.species && (G.stones[k] || 0) > 0)
        return true;
    }
  }
  return false;
}

/* ===== MENSAJES DE BATALLA ===== */
let msgQ = Promise.resolve();
function say(t) {
  msgQ = msgQ
    .then(
      () =>
        new Promise((res) => {
          let done = false;
          const el = $("#logTxt");
          if (el) el.textContent = "";
          let i = 0;
          const fin = () => {
            if (!done) {
              done = true;
              clearInterval(iv);
              clearTimeout(g);
              res();
            }
          };
          const iv = setInterval(() => {
            if (el) el.textContent = t.slice(0, ++i);
            if (i >= t.length) setTimeout(fin, 120);
          }, 12);
          const g = setTimeout(fin, 8000);
        }),
    )
    .catch(() => {});
  return msgQ;
}

/* ===== MOTOR DE BATALLA ===== */
function battleEnd() {
  if (BT) BT.ended = true;
}
function activePlayerMon() {
  return G ? G.team[G.active] : null;
}
function setBusy(b) {
  if (BT) BT.busy = b;
  const ba = $("#battleActions");
  if (ba) ba.style.opacity = b ? ".6" : "1";
}
function battleStart(cfg) {
  BT = cfg;
  BT.busy = true;
  BT.ended = false;
  BT.queue = cfg.queue ? cfg.queue.slice() : [];
  BT.enemy = cfg.enemy;
  renderBattleScreen();
  setBusy(true);
  (async () => {
    try {
      await say(cfg.intro || "¡" + BT.enemy.name + " apareció!");
      const p = activePlayerMon();
      if (BT.enemy && p && BT.enemy.spe > effSpe(p))
        await say("⚡ ¡" + BT.enemy.name + " es más rápido!");
      if (BT && !BT.ended) setBusy(false);
    } catch (e) {
      devError(e);
      if (BT && !BT.ended) setBusy(false);
    }
  })();
}
function calcDmg(att, def, move) {
  const eff = effectiveness(move.type, def.types);
  if (eff === 0) return { dmg: 0, eff: 0, crit: false };
  const A = move.cat === "esp" ? att.spa : att.atk,
    D = move.cat === "esp" ? def.spd : def.def;
  let dmg = (((2 * att.lvl) / 5 + 2) * move.power * A) / D / 50 + 2;
  const stab = att.types.indexOf(move.type) !== -1 ? 1.5 : 1;
  const crit =
    Math.random() < Math.min(0.25, 0.06 + Math.max(0, att.spe - def.spe) / 500);
  dmg *= eff * stab * (crit ? 1.5 : 1) * rnd(0.85, 1);
  return { dmg: Math.max(1, Math.floor(dmg)), eff: eff, crit: crit };
}
async function playerAttack(mv) {
  const p = activePlayerMon(),
    e = BT.enemy;
  if (!p || !e) return;
  if (mv.cat === "esp") mv.pp--;
  await say("¡" + p.nick + " usó " + mv.name + "!");
  const r = calcDmg(p, e, mv);
  if (r.eff === 0) {
    await say("No afecta a " + e.name + "…");
    return;
  }
  e.hp = Math.max(0, e.hp - r.dmg);
  const en = $("#enImg");
  if (en) en.classList.add("hit");
  const ar = $("#arena");
  if (ar) ar.classList.add("shake");
  setTimeout(() => {
    const e2 = $("#enImg");
    if (e2) e2.classList.remove("hit");
    const a2 = $("#arena");
    if (a2) a2.classList.remove("shake");
  }, 500);
  updateBattleHp();
  if (r.crit) {
    SFX.crit();
    await say("¡Golpe crítico!");
  }
  if (r.eff > 1) await say("¡Es súper eficaz!");
  else if (r.eff < 1) await say("No es muy eficaz…");
  const st = TYPE2STATUS[mv.type];
  if (
    mv.cat === "esp" &&
    st &&
    e.hp > 0 &&
    !e.status &&
    Math.random() < Math.min(0.5, 0.2 * r.eff)
  ) {
    e.status = {
      type: st,
      dur: st === "sleep" ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0,
    };
    await say(
      {
        poison: "¡" + e.name + " fue envenenado!",
        paralyze: "¡" + e.name + " quedó paralizado!",
        sleep: "¡" + e.name + " se durmió!",
      }[st],
    );
  }
}
async function enemyAttack() {
  if (!BT || BT.ended) return;
  const e = BT.enemy,
    p = activePlayerMon();
  if (!e || e.hp <= 0 || !p) return;
  if (e.status) {
    const t = e.status.type;
    if (t === "sleep") {
      if (e.status.dur > 0) {
        e.status.dur--;
        await say(e.name + " está dormido...");
        return;
      }
      e.status = null;
      await say("¡" + e.name + " se despertó!");
    } else if (t === "paralyze" && Math.random() < 0.25) {
      await say("¡" + e.name + " está paralizado!");
      return;
    }
  }
  const mv = e.moves[1].pp > 0 && Math.random() < 0.5 ? e.moves[1] : e.moves[0];
  if (mv.cat === "esp") mv.pp--;
  await say("¡" + e.name + " usó " + mv.name + "!");
  const r = calcDmg(e, p, mv);
  if (r.eff === 0) {
    await say("No afecta a " + p.nick + "…");
    return;
  }
  p.hp = Math.max(0, p.hp - r.dmg);
  const pl = $("#plImg");
  if (pl) pl.classList.add("hit");
  const ar = $("#arena");
  if (ar) ar.classList.add("shake");
  setTimeout(() => {
    const p2 = $("#plImg");
    if (p2) p2.classList.remove("hit");
    const a2 = $("#arena");
    if (a2) a2.classList.remove("shake");
  }, 500);
  updateBattleHp();
  renderStatusBar();
  if (r.crit) {
    SFX.crit();
    await say("¡Golpe crítico!");
  }
  if (r.eff > 1) await say("¡Es súper eficaz!");
  else if (r.eff < 1) await say("No es muy eficaz…");
  const st = TYPE2STATUS[mv.type];
  if (
    mv.cat === "esp" &&
    st &&
    p.hp > 0 &&
    !p.status &&
    Math.random() < Math.min(0.5, 0.2 * r.eff)
  ) {
    p.status = {
      type: st,
      dur: st === "sleep" ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0,
    };
    await say(
      {
        poison: "¡" + p.nick + " fue envenenado!",
        paralyze: "¡" + p.nick + " quedó paralizado!",
        sleep: "¡" + p.nick + " se durmió!",
      }[st],
    );
  }
}
async function endRound() {
  if (!BT || BT.ended) return;
  const p = activePlayerMon(),
    e = BT.enemy;
  if (e && e.hp > 0 && e.status && e.status.type === "poison") {
    const dd = Math.max(1, Math.floor(e.maxHp * 0.06));
    e.hp = Math.max(0, e.hp - dd);
    await say(e.name + " sufre por veneno.");
    updateBattleHp();
  }
  if (p && p.hp > 0 && p.status && p.status.type === "poison") {
    const dd = Math.max(1, Math.floor(p.maxHp * 0.06));
    p.hp = Math.max(0, p.hp - dd);
    await say(p.nick + " sufre por veneno.");
    updateBattleHp();
    renderStatusBar();
  }
  if (e && e.hp <= 0) {
    await say("¡" + e.name + " se debilitó!");
    const en = $("#enImg");
    if (en) en.classList.add("faint");
    SFX.win();
    await sleep(500);
    if (BT.xpMode) gainXp(activePlayerMon(), xpGive("wild", e.lvl));
    processEvos();
    if (BT.queue && BT.queue.length) {
      BT.enemy = BT.queue.shift();
      renderBattleUI();
      await say(
        "¡" +
          (BT.trainerName || "El rival") +
          " envió a " +
          BT.enemy.name +
          "!",
      );
      setBusy(false);
      return;
    }
    BT.ended = true;
    if (BT.onWin) BT.onWin();
    return;
  }
  if (p && p.hp <= 0) {
    await say("¡" + p.nick + " se debilitó!");
    const pl = $("#plImg");
    if (pl) pl.classList.add("faint");
    SFX.lose();
    await sleep(500);
    const mates = G.team.filter((m) => m.hp > 0 && m !== p);
    if (mates.length) {
      openSwapBattle(true);
      return;
    }
    BT.ended = true;
    if (BT.onLose) BT.onLose();
    return;
  }
  setBusy(false);
  renderBattleButtons();
}
async function doTurn(i) {
  if (!BT || BT.busy || BT.ended) return;
  const p = activePlayerMon(),
    mv = p.moves[i];
  if (!mv) return;
  if (mv.cat === "esp" && mv.pp <= 0) return;
  setBusy(true);
  try {
    const playerFirst = effSpe(p) >= effSpe(BT.enemy);
    if (playerFirst) {
      await playerAttack(mv);
      if (!BT.ended && BT.enemy.hp > 0 && p.hp > 0) await enemyAttack();
    } else {
      await enemyAttack();
      if (!BT.ended && p.hp > 0 && BT.enemy.hp > 0) await playerAttack(mv);
    }
    if (!BT.ended) await endRound();
  } catch (e) {
    devError(e);
    setBusy(false);
  }
}
async function doRun() {
  if (!BT) return;
  BT.ended = true;
  await say("¡Huiste!");
  await sleep(400);
  if (BT.onFlee) BT.onFlee();
}
async function throwBall() {
  if (!BT || BT.busy || BT.ended || !BT.canCatch) return;
  setBusy(true);
  try {
    if (G.items.ball < 1) {
      await say("¡No te quedan Pokeballs!");
      setBusy(false);
      return;
    }
    G.items.ball--;
    renderStatusBar();
    renderBattleButtons();
    save();
    await say("¡" + G.name + " lanzó una Pokeball!");
    const e = BT.enemy;
    const ratio = e.hp / e.maxHp;
    let ch = ratio <= 0.2 ? 0.9 : ratio <= 0.5 ? 0.45 : 0.2;
    if (e.status) ch += 0.15;
    ch = Math.min(0.95, ch);
    await say("¡Una… dos… tres…!");
    await sleep(900);
    if (Math.random() < ch) {
      BT.ended = true;
      SFX.catchJ();
      if (G.dex) {
        G.dex.caught[e.id] = 1;
        G.dex.seen[e.id] = 1;
      }
      await say("¡Se capturó a " + e.name + "! 🎉");
      if (BT.onCatch) BT.onCatch(e);
      return;
    }
    await say("¡Vaya! " + e.name + " se liberó.");
    await sleep(380);
    await enemyAttack();
    if (!BT.ended) await endRound();
  } catch (e) {
    devError(e);
    setBusy(false);
  }
}

/* ===== RENDER BATALLA ===== */
function renderBattleScreen() {
  const p = activePlayerMon(),
    e = BT.enemy;
  renderScreen(`
 <div id="arena">
  <div class="info einfo"><div class="row"><span class="pname" id="enName">${e ? esc(e.name) : "?"}</span><span class="plv" id="enLv">${e ? "Nv." + e.lvl : ""}</span></div>
   <div class="trow">${e ? e.types.map(chip).join("") : ""}</div>
   <div class="hpwrap"><div class="hpbar"><div class="hpfill" id="enHpFill"></div></div></div>
   <div class="hpnum" id="enHpTxt"></div></div>
  <div class="plat ep"></div>
  <div class="spr esp"><img id="enImg" src="${e ? e.sprF : ""}"></div>
  <div class="pball" id="pball"></div>
  <div class="plat pp"></div>
  <div class="spr psp"><img id="plImg" src="${p ? p.sprB : ""}"></div>
  <div class="info pinfo"><div class="row"><span class="pname" id="plName">${p ? esc(p.nick) : "?"}</span><span class="plv" id="plLv">${p ? "Nv." + p.lvl : ""}</span></div>
   <div class="hpwrap"><div class="hpbar"><div class="hpfill" id="plHpFill"></div></div></div>
   <div class="hpnum" id="plHpTxt"></div></div>
 </div>
 <div id="logBox">...</div>
 <div id="battleActions"></div>`);
  renderBattleUI();
  renderBattleButtons();
  updateBattleHp();
}
function renderBattleUI() {
  const p = activePlayerMon(),
    e = BT && BT.enemy;
  if (p) {
    const pn = $("#plName");
    if (pn) pn.textContent = p.nick;
    const pl = $("#plLv");
    if (pl) pl.textContent = "Nv." + p.lvl;
    const pi = $("#plImg");
    if (pi) pi.src = p.sprB;
  }
  if (e) {
    const en = $("#enName");
    if (en) en.textContent = e.name;
    const el = $("#enLv");
    if (el) el.textContent = "Nv." + e.lvl;
    const ei = $("#enImg");
    if (ei) ei.src = e.sprF;
  }
  updateBattleHp();
}
function updateBattleHp() {
  const p = activePlayerMon(),
    e = BT && BT.enemy;
  if (p) {
    const pct = Math.max(0, (p.hp / p.maxHp) * 100);
    const f = $("#plHpFill");
    if (f) {
      f.style.width = pct + "%";
      f.className = "hpfill" + (pct <= 20 ? " low" : pct <= 50 ? " mid" : "");
    }
    const ht = $("#plHpTxt");
    if (ht) ht.textContent = p.hp + "/" + p.maxHp;
  }
  if (e) {
    const pct = Math.max(0, (e.hp / e.maxHp) * 100);
    const f = $("#enHpFill");
    if (f) {
      f.style.width = pct + "%";
      f.className = "hpfill" + (pct <= 20 ? " low" : pct <= 50 ? " mid" : "");
    }
    const ht = $("#enHpTxt");
    if (ht) ht.textContent = e.hp + "/" + e.maxHp;
  }
}
function renderBattleButtons() {
  const ba = $("#battleActions");
  if (!ba) return;
  ba.innerHTML = "";
  const p = activePlayerMon();
  if (!p || !BT) return;
  p.moves.forEach((mv, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bbtn";
    btn.style.background = TYPE_COL[mv.type];
    btn.style.color = "#fff";
    btn.innerHTML =
      mv.name + (mv.cat === "esp" ? " (" + mv.pp + "/" + mv.maxpp + ")" : "");
    if (mv.cat === "esp" && mv.pp <= 0) btn.disabled = true;
    btn.onclick = () => doTurn(i);
    ba.appendChild(btn);
  });
  const bag = document.createElement("button");
  bag.type = "button";
  bag.className = "bbtn secondary";
  bag.innerHTML = "🎒 MOCHILA";
  bag.onclick = () => openBagBattle();
  ba.appendChild(bag);
  if (BT.canSwap) {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "bbtn secondary";
    sw.innerHTML = "🔄 CAMBIAR";
    sw.onclick = () => openSwapBattle(false);
    ba.appendChild(sw);
  }
  if (BT.canCatch) {
    const bl = document.createElement("button");
    bl.type = "button";
    bl.className = "bbtn";
    bl.style.background = "var(--red)";
    bl.style.color = "#fff";
    bl.innerHTML = "🔴 POKEBALL";
    bl.onclick = () => throwBall();
    ba.appendChild(bl);
  }
  if (BT.canRun) {
    const rn = document.createElement("button");
    rn.type = "button";
    rn.className = "bbtn danger";
    rn.innerHTML = "🏃 HUIR";
    rn.onclick = () => doRun();
    ba.appendChild(rn);
  }
}
function openBagBattle() {
  const b = G.items;
  const list = $("#bagList");
  list.innerHTML = "";
  const items = [
    ["potion", "💉 Poción", "Cura 40% PS"],
    ["antidote", "🧪 Antídoto", "Cura veneno"],
    ["antipar", "⚡ Antiparalizador", "Cura parálisis"],
    ["despertar", "☕ Despertador", "Quita sueño"],
  ];
  items.forEach(([k, nm, ds]) => {
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<span style="font-size:20px">' +
      nm.split(" ")[0] +
      '</span><span class="inf"><span class="nm">' +
      nm.split(" ")[1] +
      " ×" +
      (b[k] || 0) +
      '</span><br><span class="ds">' +
      ds +
      "</span></span>";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-sq";
    btn.textContent = "USAR";
    btn.disabled = (b[k] || 0) < 1;
    btn.onclick = async () => {
      hideOvl("ovBag");
      if (BT && BT.busy) return;
      setBusy(true);
      b[k]--;
      const p = activePlayerMon();
      if (k === "potion") {
        p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.4));
        SFX.heal();
        await say("¡" + p.nick + " recuperó PS!");
        updateBattleHp();
        renderStatusBar();
      } else {
        p.status = null;
        SFX.heal();
        await say("¡" + p.nick + " se curó!");
      }
      save();
      renderStatusBar();
      await sleep(300);
      await enemyAttack();
      if (!BT.ended) await endRound();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
  showOvl("ovBag");
}
function openSwapBattle(forced) {
  const p = activePlayerMon();
  const mates = G.team.filter((m) => m.hp > 0 && m !== p);
  $("#swapTitle").textContent = forced
    ? "¡Elige quién sigue!"
    : "🔄 Cambiar Pokémon";
  $("#swapHint").textContent = forced
    ? "Tu pokémon cayó. Elige el siguiente."
    : "Cambiar consume el turno.";
  const list = $("#swapList");
  list.innerHTML = "";
  mates.forEach((m) => {
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
      "</span></span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = "ELEGIR";
    b.onclick = async () => {
      hideOvl("ovSwap");
      G.active = G.team.indexOf(m);
      renderBattleUI();
      await say("¡Adelante, " + m.nick + "!");
      if (!forced) {
        await enemyAttack();
        if (!BT.ended) await endRound();
      } else setBusy(false);
    };
    row.appendChild(b);
    list.appendChild(row);
  });
  if (!mates.length)
    list.innerHTML = '<p style="font-weight:800">Sin pokémon disponibles.</p>';
  showOvl("ovSwap");
}
$("#swapClose").onclick = () => {
  hideOvl("ovSwap");
  if (BT && !BT.ended) setBusy(false);
};
$("#bagClose").onclick = () => hideOvl("ovBag");

/* ===== MODO INFINITO ===== */
function infInit() {
  INF = { active: true, battles: 0, victories: 0, continues: 0 };
}
function exitInf() {
  if (INF) {
    if (!G.inf) G.inf = { unlocked: true, bestBattles: 0, bestVictories: 0 };
    G.inf.bestBattles = Math.max(G.inf.bestBattles || 0, INF.battles);
    G.inf.bestVictories = Math.max(G.inf.bestVictories || 0, INF.victories);
    G.team.forEach((m) => {
      if (m.hp > m.maxHp) m.hp = m.maxHp;
    });
    INF = null;
  }
  save();
  renderStatusBar();
  renderCamp();
}
async function spawnInfBattle() {
  if (!INF) infInit();
  if (!teamAlive()) {
    toast("💀 Equipo debilitado. Pagá Continuar o salí.");
    openInfHub();
    return;
  }
  const strongest = Math.max.apply(
    null,
    G.team.map((m) => m.lvl),
  );
  const lvl = Math.max(2, strongest + Math.floor(rnd(-2, 3)));
  let dd = null;
  const id = 1 + Math.floor(Math.random() * 151);
  for (let i = 0; i < 3 && !dd; i++) {
    try {
      dd = await getPoke(id);
    } catch (e) {
      await sleep(500);
    }
  }
  if (!dd) {
    toast("⚠️ Sin conexión.");
    openInfHub();
    return;
  }
  const e = makeFighter(dd, lvl);
  if (G.dex) G.dex.seen[dd.id] = 1;
  battleStart({
    kind: "inf",
    enemy: e,
    canCatch: false,
    canRun: false,
    canSwap: true,
    xpMode: true,
    intro:
      "¡Batalla " +
      (INF.battles + 1) +
      "! ¡" +
      e.name +
      " salvaje (Nv." +
      lvl +
      ")!",
    onWin: infOnWin,
    onLose: infOnLose,
    onFlee: exitInf,
  });
}
function infOnWin() {
  INF.victories++;
  INF.battles++;
  G.coins += 15 + BT.enemy.lvl * 5;
  const act = activePlayerMon();
  if (INF.battles % 10 === 0) {
    G.energy = Math.min(eMax(), G.energy + 1);
    G.team.forEach((m) => {
      if (m === act)
        m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.65));
      else {
        if (m.hp <= 0) m.hp = Math.floor(m.maxHp * 0.4);
        else m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.4));
      }
    });
    toast("⭐ ¡Batalla " + INF.battles + "! +1⚡ y cura mejorada (+65%/+40%)");
  } else {
    if (act) act.hp = Math.min(act.maxHp, act.hp + Math.floor(act.maxHp * 0.4));
    G.team.forEach((m) => {
      if (m !== act && m.hp > 0)
        m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.2));
    });
  }
  if (BT && BT.xpMode) gainXp(activePlayerMon(), xpGive("wild", BT.enemy.lvl));
  processEvos();
  save();
  renderStatusBar();
  openInfHub();
}
function infOnLose() {
  const cost = 2 + INF.continues;
  $("#contText").textContent = "Tu equipo cayó. ¿Continuar la batalla?";
  $("#contCost").textContent =
    "Continuar: " + cost + "⚡ (tenés " + G.energy + "⚡, " + G.coins + "🪙)";
  $("#contBuy").style.display =
    G.coins >= 100 && G.energy < eMax() ? "" : "none";
  $("#contYes").onclick = async function () {
    if (G.energy < cost) {
      toast("⚡ No tenés suficiente energía.");
      return;
    }
    G.energy -= cost;
    INF.continues++;
    G.team.forEach((m) => {
      m.hp = m.maxHp;
      m.status = null;
    });
    hideOvl("ovContinue");
    save();
    renderStatusBar();
    await spawnInfBattle();
  };
  $("#contBuy").onclick = function () {
    if (G.coins >= 100 && G.energy < eMax()) {
      G.coins -= 100;
      G.energy = Math.min(eMax(), G.energy + 1);
      save();
      renderStatusBar();
      $("#contCost").textContent =
        "Continuar: " +
        cost +
        "⚡ (tenés " +
        G.energy +
        "⚡, " +
        G.coins +
        "🪙)";
      $("#contBuy").style.display =
        G.coins >= 100 && G.energy < eMax() ? "" : "none";
    }
  };
  $("#contNo").onclick = function () {
    hideOvl("ovContinue");
    exitInf();
  };
  showOvl("ovContinue");
}
/* openInfHub se define en ui.js (dibuja la pantalla) */

/* ===== RENDER BASE (status bar, button bar, screen) ===== */
function renderStatusBar() {
  const sb = $("#statusBar");
  if (!sb) return;
  if (!G) {
    sb.innerHTML = '<span class="logo-mini">POKÉDESAFÍO</span>';
    return;
  }
  const ko = G.team.filter((m) => m.hp <= 0).length;
  const bank = G.team.reduce((a, m) => a + (m.bankPts || 0), 0);
  const stones = Object.values(G.stones).reduce((a, b) => a + b, 0);
  sb.innerHTML =
    '<span class="logo-mini">POKÉDESAFÍO</span>' +
    '<span class="schip">📅 <b>' +
    G.day +
    "</b></span>" +
    '<span class="schip">⚡ <b>' +
    G.energy +
    "/" +
    eMax() +
    "</b></span>" +
    '<span class="schip">🪙 <b>' +
    G.coins +
    "</b></span>" +
    '<span class="schip">🏅 <b>' +
    G.badges.length +
    "/4</b></span>" +
    '<span class="schip">🪨 <b>' +
    stones +
    "</b></span>" +
    '<span class="schip">👥 <b>' +
    G.team.length +
    "/6</b>" +
    (ko ? " (" + ko + " KO)" : "") +
    "</span>" +
    (bank
      ? '<span class="schip" style="background:#ffe9a8">✨ <b>' +
        bank +
        "</b></span>"
      : "") +
    '<button class="fsbtn" id="fsBtn" type="button">⛶</button>';
  const fs = $("#fsBtn");
  if (fs) fs.onclick = toggleFullscreen;
}
function setButtons(list) {
  const bb = $("#buttonBar");
  if (!bb) return;
  bb.innerHTML = "";
  list.forEach((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bbtn" + (b.cls ? " " + b.cls : "");
    btn.innerHTML = b.label;
    if (b.disabled) btn.disabled = true;
    btn.onclick = b.fn;
    bb.appendChild(btn);
  });
}
function renderScreen(contentHTML) {
  const c = $("#content");
  if (c) c.innerHTML = contentHTML;
}
/* confirmBox lo usa processEvos; cfCb es global */
let cfCb = null;
function confirmBox(html, cb) {
  $("#cfTxt").innerHTML = html;
  cfCb = cb;
  showOvl("ovConfirm");
}
$("#cfYes").onclick = () => {
  hideOvl("ovConfirm");
  if (cfCb) cfCb();
  cfCb = null;
};
$("#cfNo").onclick = () => {
  hideOvl("ovConfirm");
  cfCb = null;
};
