// ============================================================
// core.js — POKÉDESAFÍO v2.1
// Lógica del juego: utilidades, API, stats, motor de batalla,
// evolución, capturas, pantallas y acciones.
// ============================================================

// ===== UTILIDADES =====
const $ = function (s) {
  return document.querySelector(s);
};
const sleep = function (ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
};
const rnd = function (a, b) {
  return a + Math.random() * (b - a);
};
const esc = function (s) {
  return String(s).replace(/[<>&"]/g, function (c) {
    return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
  });
};
const lsGet = function (k, d) {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v;
  } catch (e) {
    return d;
  }
};
const lsSet = function (k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
};
const lsDel = function (k) {
  try {
    localStorage.removeItem(k);
  } catch (e) {}
};
function show(id) {
  const els = document.querySelectorAll(".screen");
  for (let i = 0; i < els.length; i++)
    els[i].classList.toggle("active", els[i].id === id);
  window.scrollTo(0, 0);
}
function toast(m) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(function () {
    t.classList.remove("show");
  }, 2600);
}

// ===== DEV =====
let devOn = lsGet("pk_dev", "0") === "1";
function dlog(m, cls) {
  const box = $("#devLog");
  if (!box) return;
  const d = document.createElement("div");
  if (cls) d.className = cls;
  d.textContent = "[" + new Date().toLocaleTimeString() + "] " + m;
  box.appendChild(d);
  while (box.children.length > 90) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
  renderDevState();
}
function devError(e) {
  const m = (e && (e.message || e.stack)) || String(e);
  dlog("ERR: " + m, "err");
  toast("Un error ocurrió. Abrí el panel 🐛.");
  if (window.__pokeErrors) window.__pokeErrors.push(m);
  if (window.__showErr) window.__showErr();
}
function renderDevState() {
  const el = $("#devState");
  if (!el) return;
  let t = "MODE " + MODE;
  if (MODE === "adv" && G) {
    const p = G.team[G.active];
    t +=
      " | " +
      G.name +
      " D" +
      (G.day || 1) +
      " E" +
      G.energy +
      "/" +
      eMax() +
      " $" +
      G.coins +
      " MED" +
      G.badges.length +
      " node:" +
      G.nodeId +
      "\n" +
      "ACTIVO: " +
      (p ? p.nick + " L" + p.lvl + " " + p.hp + "/" + p.maxHp : "-") +
      " | TEAM " +
      G.team.length +
      " BOX " +
      G.box.length;
  }
  if (BT)
    t += "\nBATALLA " + BT.kind + " busy:" + BT.busy + " ended:" + BT.ended;
  el.textContent = t;
}
function devToggle() {
  devOn = !devOn;
  lsSet("pk_dev", devOn ? "1" : "0");
  $("#devPanel").style.display = devOn ? "block" : "none";
  $("#btnDev").classList.toggle("on", devOn);
  if (devOn) {
    renderDevState();
    dlog("Panel DEV abierto");
  }
}

// ===== API =====
const API = "https://pokeapi.co/api/v2/pokemon/";
const cache = new Map();
const nameCache = new Map();
async function getPoke(id) {
  if (cache.has(id)) return cache.get(id);
  const ctrl = new AbortController();
  const to = setTimeout(function () {
    ctrl.abort();
  }, 8000);
  try {
    const r = await fetch(API + id, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    cache.set(id, d);
    return d;
  } catch (e) {
    clearTimeout(to);
    const m = e.name === "AbortError" ? "timeout 8s" : e.message || "red";
    dlog("API #" + id + " FALLO: " + m, "err");
    throw new Error(m);
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
    const es = d.names.find(function (n) {
      return n.language.name === "es";
    });
    const n = es ? es.name : d.name.toUpperCase();
    nameCache.set(id, n);
    if (G && G.dex) G.dex.names[id] = n;
    return n;
  } catch (e) {
    return "Nº" + id;
  }
}

// ===== STATS Y MOVIMIENTOS =====
const statOf = function (base, lvl, hp) {
  return Math.floor((base * 2 * lvl) / 100) + (hp ? lvl + 10 : 5);
};
const xpNeed = function (lvl) {
  return 20 + lvl * 15;
};
const xpGive = function (kind, lvl) {
  return kind === "wild"
    ? 12 + lvl * 4
    : kind === "trainer"
      ? 25 + lvl * 6
      : 35 + lvl * 7;
};
function moveByKey(k) {
  const i = k.lastIndexOf("__");
  const type = k.slice(0, i),
    slot = k.slice(i + 2);
  const M = MOVES[type];
  const isS = slot === "s";
  return {
    key: k,
    name: isS ? M.s[0] : M.b[0],
    type: type,
    power: isS ? M.s[1] : M.b[1],
    cat: isS ? "esp" : "fis",
  };
}
function ensureMoveSys(m) {
  if (!m.learned)
    m.learned = m.types.flatMap(function (t) {
      return [t + "__b", t + "__s"];
    });
  if (!m.equipped) m.equipped = m.learned.slice(0, 4);
  if (!m.cd) m.cd = {};
  m.equipped.forEach(function (k) {
    const mv = moveByKey(k);
    if (mv.cat === "esp" && !m.cd[k]) m.cd[k] = { c: CD_MAX, t: Date.now() };
  });
}
function cdTick(m) {
  if (!m.cd) return;
  const now = Date.now();
  for (const k in m.cd) {
    const e = m.cd[k];
    if (e.c < CD_MAX) {
      const add = Math.floor((now - e.t) / CD_RATE);
      if (add > 0) {
        e.c = Math.min(CD_MAX, e.c + add);
        e.t += add * CD_RATE;
      }
    } else e.t = now;
  }
}
function resetCd(m) {
  if (!m.cd) return;
  for (const k in m.cd) {
    m.cd[k].c = CD_MAX;
    m.cd[k].t = Date.now();
  }
}
function buildBattleMoves(m) {
  ensureMoveSys(m);
  cdTick(m);
  return m.equipped.map(function (k) {
    const mv = moveByKey(k);
    return Object.assign({}, mv, {
      pp: mv.cat === "esp" ? m.cd[k].c : Infinity,
      maxpp: CD_MAX,
    });
  });
}
function buildMovesAI(t0) {
  const M = MOVES[t0];
  return [
    { name: M.b[0], type: t0, power: M.b[1], cat: "fis", pp: Infinity },
    { name: M.s[0], type: t0, power: M.s[1], cat: "esp", pp: 3, maxpp: 3 },
  ];
}
function makeMon(d, lvl) {
  const b = {};
  d.stats.forEach(function (s) {
    b[s.stat.name] = s.base_stat;
  });
  const types = d.types.map(function (t) {
    return t.type.name;
  });
  const m = {
    species: d.id,
    name: d.name.toUpperCase(),
    nick: d.name.toUpperCase(),
    lvl: lvl,
    xp: 0,
    bankPts: 0,
    resets: 0,
    pts: { ps: 0, atk: 0, def: 0, vel: 0 },
    base: b,
    types: types,
    status: null,
    hp: 0,
    sprF: d.sprites.front_default,
    sprB: d.sprites.back_default || d.sprites.front_default,
    art:
      (d.sprites.other &&
        d.sprites.other["official-artwork"] &&
        d.sprites.other["official-artwork"].front_default) ||
      d.sprites.front_default,
  };
  recalcMon(m);
  m.hp = m.maxHp;
  ensureMoveSys(m);
  m.moves = buildBattleMoves(m);
  return m;
}
function recalcMon(m) {
  m.maxHp = statOf(m.base.hp, m.lvl, true) + m.pts.ps * 3;
  m.atk = statOf(m.base.attack, m.lvl) + m.pts.atk * 2;
  m.def = statOf(m.base.defense, m.lvl) + m.pts.def * 2;
  m.vel = statOf(m.base.speed, m.lvl) + m.pts.vel * 2;
  m.spa = m.atk;
  m.spd = m.def;
  m.spe = m.vel;
}
function makeFighter(d, lvl) {
  const b = {};
  d.stats.forEach(function (s) {
    b[s.stat.name] = s.base_stat;
  });
  const types = d.types.map(function (t) {
    return t.type.name;
  });
  const t0 = types[0];
  const f = {
    id: d.id,
    name: d.name.toUpperCase(),
    nick: d.name.toUpperCase(),
    lvl: lvl,
    base: b,
    types: types,
    status: null,
    hp: 0,
    moves: buildMovesAI(t0),
    sprF: d.sprites.front_default,
    sprB: d.sprites.back_default || d.sprites.front_default,
    art:
      (d.sprites.other &&
        d.sprites.other["official-artwork"] &&
        d.sprites.other["official-artwork"].front_default) ||
      d.sprites.front_default,
  };
  recalcFighter(f);
  f.hp = f.maxHp;
  return f;
}
function recalcFighter(f) {
  f.maxHp = statOf(f.base.hp, f.lvl, true);
  f.atk = statOf(f.base.attack, f.lvl);
  f.def = statOf(f.base.defense, f.lvl);
  f.spa = statOf(f.base["special-attack"], f.lvl);
  f.spd = statOf(f.base["special-defense"], f.lvl);
  f.spe = statOf(f.base.speed, f.lvl);
}
const effSpe = function (f) {
  return f.spe * (f.status && f.status.type === "paralyze" ? 0.5 : 1);
};
function effectiveness(t, defs) {
  let m = 1;
  for (let i = 0; i < defs.length; i++) {
    const r = CHART[t];
    if (r && r[defs[i]] !== undefined) m *= r[defs[i]];
  }
  return m;
}
function calcDmg(att, def, move) {
  const eff = effectiveness(move.type, def.types);
  if (eff === 0) return { dmg: 0, eff: 0, crit: false };
  const A = move.cat === "esp" ? att.spa : att.atk,
    D = move.cat === "esp" ? def.spd : def.def;
  let dmg = (((2 * att.lvl) / 5 + 2) * move.power * A) / D / 50 + 2;
  const stab = att.types.indexOf(move.type) !== -1 ? 1.5 : 1;
  const isCrit =
    Math.random() < Math.min(0.25, 0.06 + Math.max(0, att.spe - def.spe) / 500);
  dmg *= eff * stab * (isCrit ? 1.5 : 1) * rnd(0.85, 1);
  return { dmg: Math.max(1, Math.floor(dmg)), eff: eff, crit: isCrit };
}

// ===== ESTADO =====
let MODE = "title",
  G = null,
  SLOT = -1,
  BT = null,
  mapRollback = null,
  swapForced = false,
  pendingEvos = [];
let INF = {
  active: false,
  snapshot: null,
  runScore: 0,
  runStreak: 0,
  battles: 0,
  continues: 0,
};
let renMon = null,
  ptsMon = null,
  ptsCtx = "team",
  tallerMon = null,
  mapZone = 0,
  pendingCatchAfter = null;
function eMax() {
  return G
    ? Math.min(10, 5 + (G.inf && G.inf.unlocked ? 1 : 0) + G.badges.length)
    : 5;
}
function energyTick() {
  if (!G) return;
  const now = Date.now();
  if (G.energy < eMax()) {
    const add = Math.floor((now - G.lastTick) / (5 * 60 * 1000));
    if (add > 0) {
      G.energy = Math.min(eMax(), G.energy + add);
      G.lastTick += add * (5 * 60 * 1000);
    }
  } else G.lastTick = now;
}
function healTick() {
  if (!G) return;
  const now = Date.now();
  if (!G.lastHealTick) G.lastHealTick = now;
  const all = G.team.concat(G.box);
  if (
    all.every(function (m) {
      return m.hp >= m.maxHp;
    })
  ) {
    G.lastHealTick = now;
    return;
  }
  const add = Math.floor((now - G.lastHealTick) / (5 * 60 * 1000));
  if (add > 0) {
    const pct = Math.min(100, add * 10);
    all.forEach(function (m) {
      m.hp = Math.min(m.maxHp, m.hp + Math.floor((m.maxHp * pct) / 100));
    });
    G.lastHealTick += add * (5 * 60 * 1000);
  }
}
function spendEnergy() {
  energyTick();
  if (G.energy < 1) {
    toast("⚡ Sin energía: DESCANSA o comprá energía (100🪙).");
    return false;
  }
  G.energy--;
  updateHud();
  save();
  return true;
}
function teamAlive() {
  return (
    G &&
    G.team.some(function (m) {
      return m.hp > 0;
    })
  );
}
function save() {
  if (SLOT < 0 || !G) return;
  try {
    lsSet("pk_slot" + SLOT, JSON.stringify(G));
    const si = $("#saveInd");
    if (si) {
      si.classList.add("show");
      clearTimeout(si._h);
      si._h = setTimeout(function () {
        si.classList.remove("show");
      }, 900);
    }
  } catch (e) {
    devError(e);
  }
}
function loadSlot(i) {
  try {
    return JSON.parse(lsGet("pk_slot" + i, null));
  } catch (e) {
    return null;
  }
}

// ===== AUDIO =====
let AC = null,
  muted = lsGet("pk_mute", "0") === "1";
function ac() {
  if (!AC) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) AC = new Ctx();
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
  select: function () {
    tone(660, 0.08);
    tone(990, 0.1, "square", 0.05, 0.07);
  },
  atk: function () {
    tone(240, 0.08);
  },
  hit: function () {
    tone(150, 0.15, "sawtooth", 0.08);
  },
  crit: function () {
    tone(110, 0.22, "sawtooth", 0.1);
  },
  heal: function () {
    [523, 659, 784].forEach(function (f, i) {
      tone(f, 0.1, "triangle", 0.06, i * 0.09);
    });
  },
  win: function () {
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone(f, 0.13, "square", 0.05, i * 0.11);
    });
  },
  lose: function () {
    [330, 262, 196, 131].forEach(function (f, i) {
      tone(f, 0.22, "triangle", 0.07, i * 0.18);
    });
  },
  catchJ: function () {
    [784, 988, 1175].forEach(function (f, i) {
      tone(f, 0.12, "triangle", 0.07, i * 0.1);
    });
  },
  evo: function () {
    [392, 523, 659, 784, 1047].forEach(function (f, i) {
      tone(f, 0.15, "triangle", 0.07, i * 0.13);
    });
  },
  appear: function () {
    tone(440, 0.07);
    tone(587, 0.09, "square", 0.05, 0.08);
  },
  buy: function () {
    tone(880, 0.06);
    tone(1175, 0.09, "square", 0.05, 0.06);
  },
};

// ===== DIÁLOGOS Y HUD =====
let dlgQ = [],
  dlgChoices = null,
  dlgCb = null,
  dlgTyping = null;
function playDialog(lines, choices, cb) {
  dlgQ = lines.slice();
  dlgChoices = choices || null;
  dlgCb = cb || null;
  const dc = $("#dlgChoices");
  if (dc) dc.innerHTML = "";
  const dn = $("#dlgNext");
  if (dn) dn.style.display = "";
  $("#ovDlg").classList.add("show");
  nextLine();
}
function typeDlg(txt) {
  clearInterval(dlgTyping);
  const el = $("#dlgTxt");
  if (!el) return;
  el.textContent = "";
  let i = 0;
  dlgTyping = setInterval(function () {
    el.textContent = txt.slice(0, ++i);
    if (i >= txt.length) clearInterval(dlgTyping);
  }, 12);
}
function nextLine() {
  const l = dlgQ.shift();
  if (!l) {
    if (dlgChoices) {
      $("#dlgNext").style.display = "none";
      const box = $("#dlgChoices");
      box.innerHTML = "";
      dlgChoices.forEach(function (c) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn-big grn";
        b.style.margin = "0";
        b.textContent = c.label;
        b.onclick = function () {
          $("#ovDlg").classList.remove("show");
          if (c.fn) c.fn();
        };
        box.appendChild(b);
      });
    } else {
      $("#ovDlg").classList.remove("show");
      if (dlgCb) dlgCb();
    }
    return;
  }
  const w = $("#dlgWho");
  if (w) w.textContent = l.who || "";
  typeDlg(l.txt);
  SFX.select();
}
let msgQ = Promise.resolve();
function say(t) {
  msgQ = msgQ
    .then(function () {
      return new Promise(function (res) {
        let done = false;
        const el = $("#logTxt");
        if (el) el.textContent = "";
        let i = 0;
        const fin = function () {
          if (!done) {
            done = true;
            clearInterval(iv);
            clearTimeout(guard);
            res();
          }
        };
        const iv = setInterval(function () {
          if (el) el.textContent = t.slice(0, ++i);
          if (i >= t.length) setTimeout(fin, 130);
        }, 12);
        const guard = setTimeout(fin, 8000);
      });
    })
    .catch(function (e) {
      devError(e);
    });
  return msgQ;
}
const chip = function (t) {
  return (
    '<b class="tchip" style="background:' +
    TYPE_COL[t] +
    '">' +
    TYPE_ES[t] +
    "</b>"
  );
};
function updateHud() {
  const ha = $("#hudAdv");
  if (ha) ha.style.display = MODE === "adv" ? "inline-flex" : "none";
  if (MODE === "adv" && G) {
    $("#hudCoins").textContent = "🪙" + G.coins;
    $("#hudBadges").textContent = "🏅" + G.badges.length + "/4";
    $("#hudDay").textContent = "📅" + (G.day || 1);
    updateEnergyChip();
    const infC = $("#hudInfChip");
    if (infC) {
      if (
        G.inf &&
        ((G.inf.bestStreak || 0) > 0 || (G.inf.totalScore || 0) > 0)
      ) {
        infC.style.display = "";
        $("#hudInf").textContent =
          "🔥" + (G.inf.bestStreak || 0) + " 🏆" + (G.inf.totalScore || 0);
      } else infC.style.display = "none";
    }
  }
}
function updateEnergyChip() {
  if (MODE !== "adv" || !G) return;
  energyTick();
  let t = "⚡" + G.energy + "/" + eMax();
  if (G.energy < eMax()) {
    const rem = 5 * 60 * 1000 - (Date.now() - G.lastTick);
    const m = Math.floor(rem / 60000),
      s = Math.floor((rem % 60000) / 1000);
    t += " · " + m + ":" + String(s).padStart(2, "0");
  }
  const he = $("#hudEnergy");
  if (he) he.textContent = t;
}
function setBusy(b) {
  if (BT) BT.busy = b;
  const a = $("#actions");
  if (a) a.classList.toggle("locked", b);
}
function battleEnd() {
  if (BT) BT.ended = true;
}
function askBox(html) {
  return new Promise(function (res) {
    const cf = $("#cfTxt");
    if (cf) cf.innerHTML = html;
    $("#ovConfirm").classList.add("show");
    $("#cfYes").onclick = function () {
      $("#ovConfirm").classList.remove("show");
      res(true);
    };
    $("#cfNo").onclick = function () {
      $("#ovConfirm").classList.remove("show");
      res(false);
    };
  });
}
function activePlayerMon() {
  const T = G ? G.team : null;
  return T ? T[G.active] : null;
}
function bagRef() {
  return G.items;
}
function nextCdTxt(m, k) {
  const e = m.cd && m.cd[k];
  if (!e || e.c >= CD_MAX) return "";
  const rem = Math.max(0, CD_RATE - (Date.now() - e.t));
  const mm = Math.floor(rem / 60000),
    ss = Math.floor((rem % 60000) / 1000);
  return " · ⏳" + mm + ":" + String(ss).padStart(2, "0");
}
function renderStatus(isP) {
  const f = isP ? activePlayerMon() : BT && BT.enemy;
  const el = $(isP ? "#plStatus" : "#enStatus");
  if (!el) return;
  if (f && f.status) {
    const m = STATUS_META[f.status.type];
    el.textContent = m.i + " " + m.t;
    el.className = "st " + f.status.type;
    el.style.display = "inline-block";
  } else el.style.display = "none";
}
function updateHp(isP) {
  const f = isP ? activePlayerMon() : BT && BT.enemy;
  if (!f) return;
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  const fill = $(isP ? "#plHpFill" : "#enHpFill");
  if (!fill) return;
  fill.style.width = pct + "%";
  fill.className = "hpfill" + (pct <= 20 ? " low" : pct <= 50 ? " mid" : "");
  const ht = $(isP ? "#plHpTxt" : "#enHpTxt");
  if (ht) ht.textContent = f.hp + " / " + f.maxHp;
  if (isP && MODE === "adv" && f.xp !== undefined) {
    const xw = $("#plXpWrap");
    if (xw) {
      xw.style.display = "";
      const xf = $("#plXpFill");
      if (xf)
        xf.style.width = Math.min(100, (f.xp / xpNeed(f.lvl)) * 100) + "%";
    }
  }
}
function renderBattleCards() {
  const p = activePlayerMon(),
    e = BT && BT.enemy;
  if (p) {
    $("#plName").textContent = p.nick;
    $("#plLv").textContent = "Nv." + p.lvl;
    $("#plTypes").innerHTML = p.types.map(chip).join("");
    $("#plImg").src = p.sprB;
  }
  if (e) {
    $("#enName").textContent = e.name;
    $("#enLv").textContent = "Nv." + e.lvl;
    $("#enTypes").innerHTML = e.types.map(chip).join("");
    $("#enImg").src = e.sprF;
    const et = $("#enTrainer");
    if (et) et.textContent = BT.trainerName || "";
  }
  renderStatus(true);
  renderStatus(false);
  updateHp(true);
  updateHp(false);
  const ib = $("#infBar");
  if (INF.active && ib) {
    ib.style.display = "flex";
    $("#infBarScore").textContent = "🏆 " + INF.runScore;
    $("#infBarStreak").textContent = "🔥 " + INF.runStreak;
    $("#infBarBattles").textContent = "⚔️ " + INF.battles;
    $("#infBarEnergy").textContent = "⚡ " + G.energy + "/" + eMax();
  } else if (ib) ib.style.display = "none";
}
function mkAct(html, varc, dis, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "act";
  b.style.setProperty("--c", varc);
  b.innerHTML = html;
  b.disabled = !!dis;
  if (fn) b.onclick = fn;
  return b;
}
function renderActions() {
  const p = activePlayerMon();
  if (!p || !BT) return;
  if (MODE === "adv" && G) {
    ensureMoveSys(p);
    if (!BT.busy) p.moves = buildBattleMoves(p);
  }
  const box = $("#actions");
  if (!box) return;
  box.innerHTML = "";
  p.moves.forEach(function (mv, i) {
    let sub;
    if (mv.cat === "esp") {
      const cd =
        MODE === "adv"
          ? "❄️" +
            mv.pp +
            "/" +
            mv.maxpp +
            (mv.pp < mv.maxpp ? nextCdTxt(p, mv.key) : "")
          : "PP " + mv.pp + "/" + mv.maxpp;
      sub = "ESPECIAL · " + cd + " · PODER " + mv.power;
    } else sub = "BÁSICO · ∞ · PODER " + mv.power;
    if (BT.enemy) {
      const h = effectiveness(mv.type, BT.enemy.types);
      sub =
        (h > 1
          ? '<b style="color:#2fae7d">▲ eficaz</b> · '
          : h === 0
            ? '<b style="color:#999">✖ inmune</b> · '
            : h < 1
              ? '<b style="color:#e07b39">▼ resistente</b> · '
              : "") + sub;
    }
    box.appendChild(
      mkAct(
        chip(mv.type) +
          "<span>" +
          mv.name +
          '</span><span class="sub">' +
          sub +
          "</span>",
        TYPE_COL[mv.type] || "#999",
        mv.cat === "esp" && mv.pp <= 0,
        function () {
          doTurn(i);
        },
      ),
    );
  });
  const b = bagRef();
  box.appendChild(
    mkAct(
      '🎒 <span>MOCHILA</span><span class="sub">💉×' +
        (b.potion || 0) +
        " ⭐×" +
        (b.candy || 0) +
        "</span>",
      "#b08d57",
      false,
      function () {
        doTurn("bag");
      },
    ),
  );
  if (BT.canSwap) {
    const alive = aliveTeamMates().length;
    box.appendChild(
      mkAct(
        '🔄 <span>CAMBIAR</span><span class="sub">vivos: ' + alive + "</span>",
        "#58a6d0",
        alive < 1,
        function () {
          doTurn("swap");
        },
      ),
    );
  }
  if (BT.canCatch)
    box.appendChild(
      mkAct(
        '🔴 <span>POKEBALL</span><span class="sub">×' +
          G.items.ball +
          "</span>",
        "#e3350d",
        false,
        function () {
          doTurn("ball");
        },
      ),
    );
  if (BT.canRun)
    box.appendChild(
      mkAct(
        '🏃 <span>HUIR</span><span class="sub">escapás</span>',
        "#9aa0b4",
        false,
        function () {
          doTurn("run");
        },
      ),
    );
}

// ===== FX VISUALES =====
function lunge(isP) {
  const img = $(isP ? "#plImg" : "#enImg");
  if (!img) return;
  img.classList.remove("lunge");
  void img.offsetWidth;
  img.classList.add("lunge");
  setTimeout(function () {
    img.classList.remove("lunge");
  }, 380);
}
function hitFx(isP) {
  const img = $(isP ? "#plImg" : "#enImg");
  if (!img) return;
  img.classList.remove("hit");
  void img.offsetWidth;
  img.classList.add("hit");
  const a = $("#arena");
  if (a) {
    a.classList.remove("shake");
    void a.offsetWidth;
    a.classList.add("shake");
  }
  setTimeout(function () {
    img.classList.remove("hit");
  }, 520);
}
function faintFx(isP, caught) {
  const img = $(isP ? "#plImg" : "#enImg");
  if (img) img.classList.add(caught ? "caught" : "faint");
}
function popup(isP, amount, crit) {
  const d = document.createElement("div");
  d.className = "dpop" + (crit ? " crit" : "");
  d.textContent = (crit ? "✦" : "") + "-" + amount;
  d.style.cssText = isP
    ? "left:" + (22 + rnd(0, 10)) + "%;bottom:" + (34 + rnd(0, 8)) + "%"
    : "right:" + (20 + rnd(0, 10)) + "%;top:" + (20 + rnd(0, 8)) + "%";
  const ar = $("#arena");
  if (ar) ar.appendChild(d);
  setTimeout(function () {
    d.remove();
  }, 1050);
}
function confetti(boxSel) {
  const box = $(boxSel);
  if (!box) return;
  box.innerHTML = "";
  const cols = ["#ffcb05", "#e3350d", "#2a75bb", "#58d0a0", "#fff"];
  for (let i = 0; i < 26; i++) {
    const c = document.createElement("i");
    c.className = "conf";
    c.style.left = rnd(2, 98) + "%";
    c.style.background = cols[i % cols.length];
    c.style.animationDuration = rnd(1.6, 3) + "s";
    c.style.animationDelay = rnd(0, 0.7) + "s";
    box.appendChild(c);
  }
}

// ===== MOTOR DE BATALLA =====
function battleStart(cfg) {
  BT = cfg;
  BT.busy = true;
  BT.ended = false;
  BT.queue = cfg.queue ? cfg.queue.slice() : [];
  BT.enemy = cfg.enemy;
  const enImg = $("#enImg");
  if (enImg) enImg.classList.remove("faint", "caught", "sucked", "free");
  const plImg = $("#plImg");
  if (plImg) plImg.classList.remove("faint");
  const pb = $("#pball");
  if (pb) {
    pb.style.display = "none";
    pb.classList.remove("shake", "pop");
  }
  show("scrBattle");
  renderBattleCards();
  const spr = $("#enSpr");
  if (spr) {
    spr.classList.remove("enter");
    void spr.offsetWidth;
    spr.classList.add("enter");
  }
  SFX.appear();
  renderActions();
  setBusy(true);
  (async function () {
    try {
      await say(cfg.intro || "¡" + BT.enemy.name + " apareció!");
      const p = activePlayerMon();
      if (BT.enemy && p && BT.enemy.spe > effSpe(p))
        await say("⚡ ¡" + BT.enemy.name + " es más rápido y atacará primero!");
      if (BT && !BT.ended) setBusy(false);
    } catch (e) {
      devError(e);
      if (BT && !BT.ended) setBusy(false);
    }
  })();
}
async function strike(att, def, move) {
  if (!BT || BT.ended) return;
  if (isFinite(move.pp)) move.pp--;
  if (move.key && MODE === "adv" && G) {
    const am = G.team[G.active];
    if (am && am.cd && am.cd[move.key])
      am.cd[move.key].c = Math.max(0, Math.min(CD_MAX, move.pp));
  }
  await say("¡" + (att.nick || att.name) + " usó " + move.name + "!");
  const isP = att === activePlayerMon();
  lunge(isP);
  SFX.atk();
  await sleep(250);
  if (BT.ended) return;
  const r = calcDmg(att, def, move);
  if (r.eff === 0) {
    await say("No afecta a " + (def.nick || def.name) + "…");
    renderActions();
    return;
  }
  def.hp = Math.max(0, def.hp - r.dmg);
  hitFx(!isP);
  popup(!isP, r.dmg, r.crit);
  updateHp(!isP);
  if (r.crit) SFX.crit();
  else SFX.hit();
  await sleep(500);
  if (r.crit) await say("¡Golpe crítico!");
  if (r.eff > 1) await say("¡Es súper eficaz!");
  else if (r.eff < 1) await say("No es muy eficaz…");
  const st = TYPE2STATUS[move.type];
  if (
    move.cat === "esp" &&
    st &&
    def.hp > 0 &&
    !def.status &&
    Math.random() < Math.min(0.5, 0.2 * r.eff)
  ) {
    def.status = {
      type: st,
      dur: st === "sleep" ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0,
    };
    renderStatus(def === activePlayerMon());
    const msgs = {
      poison: "¡" + (def.nick || def.name) + " fue envenenado!",
      paralyze: "¡" + (def.nick || def.name) + " quedó paralizado!",
      sleep: "¡" + (def.nick || def.name) + " se durmió!",
    };
    await say(msgs[st]);
  }
  renderActions();
}
async function tryAct(f, fn, isP) {
  if (!BT || BT.ended) return;
  if (f.status) {
    const t = f.status.type;
    if (t === "sleep") {
      if (f.status.dur > 0) {
        f.status.dur--;
        await say((f.nick || f.name) + " está dormido...");
        return false;
      }
      f.status = null;
      renderStatus(isP);
      await say("¡" + (f.nick || f.name) + " se despertó!");
    } else if (t === "paralyze" && Math.random() < 0.25) {
      await say("¡" + (f.nick || f.name) + " está paralizado y no se mueve!");
      return false;
    }
  }
  await fn();
}
async function enemyTurn() {
  if (!BT || BT.ended) return;
  const e = BT.enemy;
  if (!e || e.hp <= 0) return;
  const mv = e.moves[1].pp > 0 && Math.random() < 0.5 ? e.moves[1] : e.moves[0];
  await tryAct(
    e,
    function () {
      return strike(e, activePlayerMon(), mv);
    },
    false,
  );
}
async function poisonTick() {
  if (!BT || BT.ended) return;
  const pairs = [
    [BT.enemy, false],
    [activePlayerMon(), true],
  ];
  for (let pi = 0; pi < pairs.length; pi++) {
    const f = pairs[pi][0],
      isP = pairs[pi][1];
    if (BT.ended) return;
    if (f && f.hp > 0 && f.status && f.status.type === "poison") {
      const d = Math.max(1, Math.floor(f.maxHp * 0.06));
      f.hp = Math.max(0, f.hp - d);
      await say((f.nick || f.name) + " sufre daño por veneno.");
      popup(isP, d, false);
      updateHp(isP);
      SFX.hit();
      await sleep(360);
    }
  }
}

// ===== EXPERIENCIA Y EVOLUCIÓN =====
function queueEvo(m) {
  if (pendingEvos.indexOf(m) === -1) pendingEvos.push(m);
}
function gainXp(m, amt) {
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
    SFX.win();
    toast(
      "⬆️ ¡" + m.nick + " subió a Nv." + m.lvl + "! +" + ups * 3 + " puntos",
    );
    const e = EVOS[m.species];
    if (e && m.lvl >= e.lvl) queueEvo(m);
  }
}
function addLevels(m, n) {
  let ups = 0;
  for (let i = 0; i < n; i++) {
    if (m.lvl >= 100) break;
    m.lvl++;
    m.bankPts += 3;
    ups++;
    const e = EVOS[m.species];
    if (e && m.lvl >= e.lvl) queueEvo(m);
  }
  if (ups) {
    recalcMon(m);
    m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.2));
  }
}
async function doEvolve(m, toId) {
  showLoader("✨ Evolucionando…");
  let d;
  try {
    d = await getPoke(toId);
  } catch (e) {
    hideLoader();
    toast("⚠️ Sin conexión. Reintentá más tarde.");
    return false;
  }
  hideLoader();
  const oldName = m.name;
  const ea = $("#evoArt");
  if (ea) {
    ea.src = m.art;
    ea.classList.add("evoglow");
  }
  $("#evoTxt").textContent = "¡¿Qué?! ¡" + m.nick + " está evolucionando…!";
  const ce = $("#confettiEvo");
  if (ce) ce.innerHTML = "";
  $("#ovEvo").classList.add("show");
  SFX.evo();
  await sleep(1300);
  const b = {};
  d.stats.forEach(function (s) {
    b[s.stat.name] = s.base_stat;
  });
  const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  m.base = b;
  m.species = toId;
  m.name = d.name.toUpperCase();
  if (m.nick === oldName) m.nick = m.name;
  m.types = d.types.map(function (t) {
    return t.type.name;
  });
  m.sprF = d.sprites.front_default;
  m.sprB = d.sprites.back_default || m.sprB;
  m.art =
    (d.sprites.other &&
      d.sprites.other["official-artwork"] &&
      d.sprites.other["official-artwork"].front_default) ||
    m.art;
  recalcMon(m);
  m.hp = Math.min(
    m.maxHp,
    Math.max(m.hp <= 0 ? 0 : 1, Math.round(m.maxHp * ratio)),
  );
  m.types.forEach(function (t) {
    [t + "__b", t + "__s"].forEach(function (k) {
      if (m.learned.indexOf(k) === -1) m.learned.push(k);
    });
  });
  ensureMoveSys(m);
  m.moves = buildBattleMoves(m);
  if (G && G.dex) {
    G.dex.caught[toId] = 1;
    G.dex.seen[toId] = 1;
  }
  const ea2 = $("#evoArt");
  if (ea2) {
    ea2.classList.remove("evoglow");
    ea2.src = m.art;
  }
  $("#evoTxt").innerHTML =
    "¡" + esc(oldName) + " evolucionó a <b>" + esc(m.name) + "</b>! 🎉";
  confetti("#confettiEvo");
  await new Promise(function (res) {
    $("#evoOk").onclick = function () {
      $("#ovEvo").classList.remove("show");
      res();
    };
  });
  save();
  return true;
}
async function evolveCheck(m) {
  let e = EVOS[m.species];
  while (e && m.lvl >= e.lvl) {
    const ok = await askBox(
      "¡¿Qué?! ¡<b>" +
        esc(m.nick) +
        "</b> (Nv." +
        m.lvl +
        ") está evolucionando!<br>¿Dejarlo evolucionar?",
    );
    if (!ok) {
      toast("🚫 No evolucionó. Se le preguntará de nuevo al subir de nivel.");
      return;
    }
    const done = await doEvolve(m, e.to);
    if (!done) return;
    e = EVOS[m.species];
  }
}
async function processEvos() {
  while (pendingEvos.length) {
    const m = pendingEvos.shift();
    await evolveCheck(m);
  }
}

// ===== CAMBIO DE POKÉMON =====
function aliveTeamMates() {
  const T = G ? G.team : null;
  if (!T) return [];
  const p = activePlayerMon();
  return T.filter(function (m) {
    return m.hp > 0 && m !== p;
  });
}
function showSwapOverlay(mates, forced, onPick) {
  swapForced = forced;
  $("#swapTitle").textContent = forced
    ? "¡ELIGE QUIÉN SIGUE!"
    : "🔄 CAMBIAR POKÉMON";
  $("#swapHint").textContent = forced
    ? "El cambio por debilitación es gratis. ¡Tú decides!"
    : "Cambiar consume el turno: ¡el rival atacará!";
  $("#swapClose").style.display = forced ? "none" : "";
  const list = $("#swapList");
  if (!list) return;
  list.innerHTML = "";
  mates.forEach(function (m) {
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<img src="' +
      m.art +
      '"><span class="inf"><span class="nm">' +
      esc(m.nick) +
      '</span><br><span class="ds">Nv.' +
      m.lvl +
      " · " +
      m.hp +
      "/" +
      m.maxHp +
      " PS</span></span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = "ELEGIR";
    b.onclick = function () {
      swapForced = false;
      $("#ovSwap").classList.remove("show");
      onPick(m);
    };
    row.appendChild(b);
    list.appendChild(row);
  });
  $("#ovSwap").classList.add("show");
}
async function activateMon(m) {
  const T = G.team;
  setActive(T.indexOf(m));
  ensureMoveSys(m);
  m.moves = buildBattleMoves(m);
  const pl = $("#plImg");
  if (pl) pl.classList.remove("faint");
  renderBattleCards();
  await say("¡Adelante, " + m.nick + "!");
}
function setActive(i) {
  if (G) G.active = i;
}
function openSwap() {
  if (BT.busy) return;
  showSwapOverlay(aliveTeamMates(), false, function (m) {
    setBusy(true);
    (async function () {
      try {
        await activateMon(m);
        await enemyTurn();
        if (!BT.ended) await finishRound();
      } catch (e) {
        devError(e);
        if (BT && !BT.ended) setBusy(false);
      }
    })();
  });
}

// ===== RESOLUCIÓN DE RONDAS =====
async function onEnemyFaint() {
  await say("¡" + BT.enemy.name + " se debilitó!");
  faintFx(false);
  await sleep(600);
  if (BT.ended) return "end";
  if (MODE === "adv" && BT.xpMode)
    gainXp(
      activePlayerMon(),
      xpGive(BT.kind === "inf" ? "wild" : BT.kind, BT.enemy.lvl),
    );
  if (BT.queue.length) {
    BT.enemy = BT.queue.shift();
    const enImg = $("#enImg");
    if (enImg) enImg.classList.remove("faint", "caught", "sucked", "free");
    renderBattleCards();
    const spr = $("#enSpr");
    if (spr) {
      spr.classList.remove("enter");
      void spr.offsetWidth;
      spr.classList.add("enter");
    }
    SFX.appear();
    await say(
      (BT.trainerName || "El rival") + " envió a " + BT.enemy.name + "!",
    );
    return "cont";
  }
  return "win";
}
async function finishRound() {
  if (!BT || BT.ended) return;
  await poisonTick();
  if (BT.ended) return;
  const p = activePlayerMon();
  if (BT.enemy.hp <= 0) {
    const r = await onEnemyFaint();
    if (r === "win") {
      battleEnd();
      await BT.onWin();
      return;
    }
    if (r === "end") return;
    renderActions();
    setBusy(false);
    return;
  }
  if (p.hp <= 0) {
    await say("¡" + p.nick + " se debilitó!");
    faintFx(true);
    SFX.lose();
    await sleep(700);
    if (BT.ended) return;
    const mates = aliveTeamMates();
    if (mates.length) {
      const picked = await new Promise(function (res) {
        showSwapOverlay(mates, true, function (m) {
          res(m);
        });
      });
      if (BT.ended) return;
      await activateMon(picked);
      renderActions();
      renderStatus(true);
      setBusy(false);
      return;
    }
    battleEnd();
    await BT.onLose();
    return;
  }
  renderActions();
  renderStatus(true);
  renderStatus(false);
  setBusy(false);
}
async function doTurn(action) {
  if (!BT) {
    toast("No hay batalla activa.");
    return;
  }
  if (BT.ended) {
    toast("La batalla ya terminó.");
    return;
  }
  if (BT.busy) {
    toast("⏳ Espera un momento…");
    return;
  }
  if (action === "bag") {
    openBag();
    return;
  }
  if (action === "swap") {
    openSwap();
    return;
  }
  if (action === "ball") {
    await throwBall();
    return;
  }
  setBusy(true);
  try {
    if (action === "run") {
      if (BT.canRun) {
        battleEnd();
        await say("¡Huiste!");
        await sleep(400);
        if (BT.onFlee) BT.onFlee();
        return;
      }
      setBusy(false);
      return;
    }
    const p = activePlayerMon(),
      move = p.moves[action];
    if (!move || (isFinite(move.pp) && move.pp <= 0)) {
      toast("Ese ataque no está disponible.");
      setBusy(false);
      return;
    }
    if (effSpe(p) >= effSpe(BT.enemy)) {
      await tryAct(
        p,
        function () {
          return strike(p, BT.enemy, move);
        },
        true,
      );
      if (!BT.ended && BT.enemy.hp > 0 && p.hp > 0) await enemyTurn();
    } else {
      await enemyTurn();
      if (!BT.ended && p.hp > 0 && BT.enemy.hp > 0)
        await tryAct(
          p,
          function () {
            return strike(p, BT.enemy, move);
          },
          true,
        );
    }
    if (!BT.ended) await finishRound();
  } catch (e) {
    devError(e);
    if (BT && !BT.ended) setBusy(false);
  }
}

// ===== CAPTURA =====
function catchChance(e) {
  const r = e.hp / e.maxHp;
  let c = r <= 0.2 ? 0.9 : r <= 0.5 ? 0.45 : 0.2;
  if (e.status) c += e.status.type === "poison" ? 0.08 : 0.15;
  return Math.min(0.95, c);
}
async function throwBall() {
  if (!BT || BT.ended || BT.busy || !BT.canCatch) return;
  setBusy(true);
  try {
    if (G.items.ball < 1) {
      await say("¡No te quedan Pokeballs!");
      setBusy(false);
      return;
    }
    G.items.ball--;
    updateHud();
    renderActions();
    await say("¡" + G.name + " lanzó una Pokeball!");
    const en = $("#enImg"),
      ball = $("#pball");
    const ok = Math.random() < catchChance(BT.enemy);
    if (en) {
      en.classList.remove("faint", "caught", "free");
      en.classList.add("sucked");
    }
    await sleep(520);
    if (BT.ended) return;
    if (ball) {
      ball.classList.remove("pop", "shake");
      ball.style.display = "block";
    }
    for (let i = 1; i <= 3; i++) {
      if (ball) {
        ball.classList.remove("shake");
        void ball.offsetWidth;
        ball.classList.add("shake");
      }
      tone(180 + i * 70, 0.14, "triangle", 0.07);
      await sleep(780);
      if (BT.ended) return;
    }
    if (ok) {
      battleEnd();
      SFX.catchJ();
      const sp = document.createElement("div");
      sp.className = "dpop spark";
      sp.textContent = "✨ ¡CLIC! ✨";
      sp.style.cssText = "right:12%;top:16%";
      const ar = $("#arena");
      if (ar) ar.appendChild(sp);
      setTimeout(function () {
        sp.remove();
      }, 1250);
      await say("¡Se capturó a " + BT.enemy.name + "! 🎉");
      await sleep(600);
      if (ball) ball.style.display = "none";
      if (G.dex) {
        G.dex.caught[BT.enemy.id] = 1;
        G.dex.seen[BT.enemy.id] = 1;
      }
      if (BT.onCatch) BT.onCatch(BT.enemy);
      return;
    }
    if (ball) ball.classList.add("pop");
    SFX.hit();
    await sleep(430);
    if (BT.ended) return;
    if (ball) {
      ball.style.display = "none";
      ball.classList.remove("pop");
    }
    if (en) {
      en.classList.remove("sucked");
      en.classList.add("free");
    }
    await say("¡Vaya! " + BT.enemy.name + " se liberó.");
    await sleep(380);
    await enemyTurn();
    if (!BT.ended) await finishRound();
  } catch (err) {
    devError(err);
    const ball = $("#pball");
    if (ball) ball.style.display = "none";
    if (BT && !BT.ended) setBusy(false);
  }
}
let pendingCatchAfter = null;
function advCatch(enemy, after) {
  pendingCatchAfter = after;
  if (G.dex) {
    G.dex.caught[enemy.id] = 1;
    G.dex.seen[enemy.id] = 1;
  }
  $("#nickArt").src = enemy.art;
  $("#nickTitle").textContent = enemy.name + " · Nv." + enemy.lvl;
  $("#nickInput").value = "";
  $("#nickInput").placeholder = "Mote para " + enemy.name + "…";
  $("#ovNick").classList.add("show");
  window._catchMon = { id: enemy.id, lvl: enemy.lvl };
}
async function finishCatch(nick) {
  const c = window._catchMon;
  $("#ovNick").classList.remove("show");
  try {
    const d = await getPoke(c.id);
    const m = makeMon(d, c.lvl);
    if (nick) m.nick = nick.toUpperCase().slice(0, 12);
    if (G.team.length < 6) G.team.push(m);
    else G.box.push(m);
    save();
    toast(
      G.team.length <= 6
        ? "✅ ¡" + m.nick + " se unió al equipo!"
        : "📦 " + m.nick + " fue al depósito (equipo lleno)",
    );
    const af = pendingCatchAfter;
    pendingCatchAfter = null;
    if (af) af();
  } catch (e) {
    devError(e);
    toast("⚠️ No se pudo guardar la captura.");
  }
}
function doNickOk() {
  finishCatch($("#nickInput").value.trim());
}
function doNickSkip() {
  finishCatch("");
}

// ===== MOCHILA EN BATALLA =====
function openBag() {
  if (BT && BT.busy) return;
  const b = bagRef(),
    list = $("#bagList");
  if (!list) return;
  list.innerHTML = "";
  const p = activePlayerMon();
  const meta = {
    potion: {
      n: "Poción",
      i: "💉",
      ok: function () {
        return p && p.hp > 0 && p.hp < p.maxHp;
      },
    },
    candy: {
      n: "Caramelo Raro",
      i: "⭐",
      ok: function () {
        return p && p.lvl < 100;
      },
    },
    antidote: {
      n: "Antídoto",
      i: "🧪",
      ok: function () {
        return p && p.status && p.status.type === "poison";
      },
    },
    antipar: {
      n: "Antiparalizador",
      i: "⚡",
      ok: function () {
        return p && p.status && p.status.type === "paralyze";
      },
    },
    despertar: {
      n: "Despertador",
      i: "☕",
      ok: function () {
        return p && p.status && p.status.type === "sleep";
      },
    },
  };
  for (const k in meta) {
    const m = meta[k];
    const cnt = b[k] || 0;
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML = '<span style="font-size:20px">' + m.i + "</span>";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-sq";
    btn.style.flex = "1";
    btn.style.textAlign = "left";
    btn.innerHTML = m.n + " ×" + cnt + (k === "candy" ? " (+1 nivel)" : "");
    btn.disabled = !(cnt > 0 && m.ok());
    btn.onclick = (function (key) {
      return function () {
        useItemBattle(key);
      };
    })(k);
    row.appendChild(btn);
    list.appendChild(row);
  }
  $("#ovBag").classList.add("show");
}
async function useItemBattle(k) {
  $("#ovBag").classList.remove("show");
  if (!BT || BT.ended || BT.busy) return;
  setBusy(true);
  try {
    const b = bagRef(),
      p = activePlayerMon();
    b[k]--;
    if (k === "potion") {
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.4));
      SFX.heal();
      await say("¡Poción! " + p.nick + " recuperó PS.");
      updateHp(true);
    } else if (k === "candy") {
      addLevels(p, 1);
      SFX.win();
      await say("⭐ ¡" + p.nick + " subió a Nv." + p.lvl + "!");
      await processEvos();
      renderBattleCards();
    } else {
      p.status = null;
      SFX.heal();
      renderStatus(true);
      const msgs = {
        antidote: "¡El veneno desapareció!",
        antipar: "¡Adiós parálisis!",
        despertar: "¡Se despertó!",
      };
      await say(msgs[k]);
    }
    save();
    renderActions();
    await sleep(320);
    await enemyTurn();
    if (!BT.ended) await finishRound();
  } catch (e) {
    devError(e);
    if (BT && !BT.ended) setBusy(false);
  }
}

// ===== TALLER =====
function openTaller(m) {
  tallerMon = m;
  ensureMoveSys(m);
  renderTaller();
  $("#ovTaller").classList.add("show");
}
function tallerRow(k, mode) {
  const mv = moveByKey(k);
  const row = document.createElement("div");
  row.className = "listrow";
  row.innerHTML =
    '<span style="font-size:18px">' +
    (mv.cat === "esp" ? "✨" : "💪") +
    "</span>" +
    '<span class="inf"><span class="nm">' +
    mv.name +
    "</span> " +
    chip(mv.type) +
    "<br>" +
    '<span class="ds">' +
    (mv.cat === "esp" ? "ESPECIAL · ❄️" + CD_MAX + " cargas" : "BÁSICO · ∞") +
    " · Poder " +
    mv.power +
    (tallerMon.types.indexOf(mv.type) !== -1 ? " · STAB ×1.5" : "") +
    "</span></span>";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-sq";
  b.style.fontSize = "10px";
  if (mode === "equipped") {
    b.textContent = "QUITAR";
    b.onclick = function () {
      tallerMon.equipped = tallerMon.equipped.filter(function (x) {
        return x !== k;
      });
      save();
      renderTaller();
    };
  } else if (mode === "learned") {
    b.textContent = "EQUIPAR";
    b.style.background = "#d8ffd8";
    b.disabled = tallerMon.equipped.length >= 4;
    b.onclick = function () {
      if (tallerMon.equipped.length >= 4) {
        toast("Máximo 4 equipados. Quita uno primero.");
        return;
      }
      tallerMon.equipped.push(k);
      ensureMoveSys(tallerMon);
      save();
      renderTaller();
    };
  } else {
    const price = MT_PRICE[mv.cat];
    b.innerHTML = "APRENDER<br>" + price + "🪙";
    b.disabled = G.coins < price;
    b.onclick = function () {
      if (G.coins < price) return;
      G.coins -= price;
      tallerMon.learned.push(k);
      SFX.buy();
      save();
      updateHud();
      toast("📖 ¡" + tallerMon.nick + " aprendió " + mv.name + "!");
      renderTaller();
    };
  }
  row.appendChild(b);
  return row;
}
function renderTaller() {
  const m = tallerMon;
  if (!m) return;
  ensureMoveSys(m);
  cdTick(m);
  $("#tallerCoins").textContent = "🪙 " + G.coins;
  $("#tallerMon").textContent = m.nick + " Nv." + m.lvl;
  const eq = $("#tallerEquipped");
  eq.innerHTML = "";
  m.equipped.forEach(function (k) {
    eq.appendChild(tallerRow(k, "equipped"));
  });
  if (!m.equipped.length)
    eq.innerHTML =
      '<p style="font-size:12px;font-weight:800;opacity:.6;padding:4px">Nada equipado.</p>';
  const le = $("#tallerLearned");
  le.innerHTML = "";
  const un = m.learned.filter(function (k) {
    return m.equipped.indexOf(k) === -1;
  });
  un.forEach(function (k) {
    le.appendChild(tallerRow(k, "learned"));
  });
  if (!un.length)
    le.innerHTML =
      '<p style="font-size:12px;font-weight:800;opacity:.6;padding:4px">Todo lo aprendido está equipado.</p>';
  const sh = $("#tallerShop");
  sh.innerHTML = "";
  const all = [];
  for (const t in MOVES) {
    all.push(t + "__b", t + "__s");
  }
  all
    .filter(function (k) {
      return m.learned.indexOf(k) === -1;
    })
    .forEach(function (k) {
      sh.appendChild(tallerRow(k, "shop"));
    });
}
function closeTaller() {
  $("#ovTaller").classList.remove("show");
  tallerMon = null;
  refreshAfterOverlay();
}

// ===== TIENDA =====
function shopItems() {
  const it = [
    {
      k: "ball",
      icon: "🔴",
      n: "Pokeball",
      d: "Para capturar salvajes",
      price: 150,
    },
    {
      k: "potion",
      icon: "💉",
      n: "Poción",
      d: "Cura 40% PS (no revive)",
      price: 120,
    },
    { k: "antidote", icon: "🧪", n: "Antídoto", d: "Cura veneno", price: 100 },
    {
      k: "antipar",
      icon: "⚡",
      n: "Antiparalizador",
      d: "Cura parálisis",
      price: 100,
    },
    {
      k: "despertar",
      icon: "☕",
      n: "Despertador",
      d: "Quita el sueño",
      price: 100,
    },
    {
      k: "candy",
      icon: "⭐",
      n: "Caramelo Raro",
      d: "+1 nivel (da 3 pts, puede evolucionar)",
      price: 150,
    },
    { k: "expS", icon: "🧪", n: "Poción EXP S", d: "+80 XP", price: 40 },
    { k: "expM", icon: "🧪", n: "Poción EXP M", d: "+250 XP", price: 110 },
    { k: "expL", icon: "🧪", n: "Poción EXP L", d: "+800 XP", price: 320 },
    {
      k: "energy",
      icon: "⚡",
      n: "Recarga de Energía",
      d: "+1 ⚡ (máx " + eMax() + ")",
      price: 100,
    },
  ];
  for (const sk in STONE_INFO) {
    const inf = STONE_INFO[sk];
    it.push({
      k: "stone_" + sk,
      icon: inf[0],
      n: inf[1],
      d: "Evoluciona ciertas especies (botón 🪨)",
      price: inf[2],
      stone: sk,
    });
  }
  return it;
}
function openShop() {
  const render = function () {
    $("#shopCoins").textContent = "🪙 " + G.coins;
    const list = $("#shopList");
    if (!list) return;
    list.innerHTML = "";
    shopItems().forEach(function (it) {
      const row = document.createElement("div");
      row.className = "srow";
      let owned = "";
      if (it.stone) owned = " · tenés ×" + (G.stones[it.stone] || 0);
      else if (it.k !== "energy") owned = " · tenés ×" + (G.items[it.k] || 0);
      row.innerHTML =
        '<span class="ico">' +
        it.icon +
        '</span><span class="inf"><span class="nm">' +
        it.n +
        owned +
        '</span><br><span class="ds">' +
        it.d +
        "</span></span>";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "buy";
      b.textContent = it.price + " 🪙";
      b.disabled =
        G.coins < it.price || (it.k === "energy" && G.energy >= eMax());
      b.onclick = function () {
        if (it.k === "energy" && G.energy >= eMax()) {
          toast("⚡ Energía ya al máximo.");
          return;
        }
        G.coins -= it.price;
        if (it.k === "energy") G.energy++;
        else if (it.stone) G.stones[it.stone] = (G.stones[it.stone] || 0) + 1;
        else G.items[it.k] = (G.items[it.k] || 0) + 1;
        SFX.buy();
        save();
        updateHud();
        render();
      };
      row.appendChild(b);
      list.appendChild(row);
    });
  };
  render();
  $("#ovShop").classList.add("show");
}
function closeShop() {
  $("#ovShop").classList.remove("show");
  refreshAfterOverlay();
}

// ===== CENTRO =====
function openCenter() {
  healTick();
  const render = function () {
    $("#centerCoins").textContent = "🪙 " + G.coins;
    const list = $("#centerList");
    if (!list) return;
    list.innerHTML = "";
    const mkRow = function (m, isTeam) {
      const missing = m.maxHp - m.hp;
      const row = document.createElement("div");
      row.className = "listrow";
      row.innerHTML =
        '<img src="' +
        m.art +
        '"><span class="inf"><span class="nm">' +
        (isTeam && G.team[G.active] === m ? "⭐ " : "") +
        esc(m.nick) +
        ' <span style="color:var(--blue)">Nv.' +
        m.lvl +
        '</span> <span style="color:#999;font-size:10px">' +
        (isTeam ? "EQUIPO" : "DEPÓSITO") +
        '</span></span><br><span class="ds">' +
        (m.hp <= 0 ? "💀 DEBILITADO" : "PS " + m.hp + "/" + m.maxHp) +
        (m.status ? " · " + STATUS_META[m.status.type].i : "") +
        "</span></span>";
      const bw = document.createElement("span");
      bw.style.cssText =
        "display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end";
      const healP = function (pct) {
        const hp = Math.min(pct, (missing / m.maxHp) * 100);
        if (hp <= 0) return;
        const cost = Math.ceil(hp * 0.5);
        if (G.coins < cost) {
          toast("No alcanza: necesitás " + cost + "🪙.");
          return;
        }
        G.coins -= cost;
        m.hp = Math.min(m.maxHp, m.hp + Math.ceil((m.maxHp * hp) / 100));
        SFX.heal();
        save();
        updateHud();
        render();
      };
      if (missing > 0) {
        const mkH = function (label, pct, bg) {
          const c = Math.ceil(Math.min(pct, (missing / m.maxHp) * 100) * 0.5);
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn-sq";
          b.style.cssText =
            "font-size:10px;line-height:1.2" + (bg ? ";background:" + bg : "");
          b.innerHTML = label + "<br>" + c + "🪙";
          b.disabled = G.coins < c;
          b.onclick = function () {
            healP(pct);
          };
          bw.appendChild(b);
        };
        mkH("+25%", 25, null);
        mkH("+50%", 50, null);
        mkH("FULL", 100, "#d8ffd8");
      }
      if (m.status) {
        const bs = document.createElement("button");
        bs.type = "button";
        bs.className = "btn-sq";
        bs.style.cssText = "font-size:10px;line-height:1.2";
        bs.innerHTML = "💫 Estado<br>10🪙";
        bs.disabled = G.coins < 10;
        bs.onclick = function () {
          if (G.coins < 10) {
            toast("No alcanza (10🪙).");
            return;
          }
          G.coins -= 10;
          m.status = null;
          SFX.heal();
          save();
          updateHud();
          render();
        };
        bw.appendChild(bs);
      }
      if (missing <= 0 && !m.status) {
        const s = document.createElement("span");
        s.style.cssText = "font-size:11px;font-weight:900;color:#2fae7d";
        s.textContent = "✔ FULL";
        bw.appendChild(s);
      }
      row.appendChild(bw);
      list.appendChild(row);
    };
    G.team.forEach(function (m) {
      mkRow(m, true);
    });
    G.box.forEach(function (m) {
      mkRow(m, false);
    });
  };
  render();
  $("#ovCenter").classList.add("show");
}
function closeCenter() {
  $("#ovCenter").classList.remove("show");
  refreshAfterOverlay();
}

// ===== LABORATORIO =====
function newEncargo() {
  const unlocked = BIOMES.filter(function (b) {
    return G.badges.length >= b.minBadge;
  });
  const pool = (unlocked.length ? unlocked : BIOMES).reduce(function (a, b) {
    return a.concat(b.pool);
  }, []);
  G.encargo = { id: pool[Math.floor(Math.random() * pool.length)] };
  save();
}
function donateValue(m) {
  return (20 + m.lvl * 8) * (G.encargo && m.species === G.encargo.id ? 2 : 1);
}
async function openLab() {
  if (!G.encargo) newEncargo();
  $("#labCoins").textContent = "🪙 " + G.coins;
  $("#labCount").textContent = "🧬 Donados: " + (G.donated || 0);
  const enc = G.encargo;
  try {
    const nm = await speciesName(enc.id);
    $("#labEnc").innerHTML =
      '<img src="' +
      sprUrl(enc.id) +
      '" alt=""><span class="inf"><span class="t">📋 ENCARGO: ' +
      esc(nm).toUpperCase() +
      '</span><br><span class="d">«¡Lo necesito para investigar!» — Recompensa <b style="color:var(--red)">×2</b> 🪙<br>Tarifa normal: 20🪙 + 8🪙 por nivel</span></span>';
  } catch (e) {
    $("#labEnc").innerHTML =
      '<img src="' +
      sprUrl(enc.id) +
      '" alt=""><span class="inf"><span class="t">📋 ENCARGO Nº' +
      enc.id +
      "</span></span>";
  }
  const list = $("#labList");
  if (list) list.innerHTML = "";
  if (!G.box.length) {
    if (list)
      list.innerHTML =
        '<p style="font-weight:800;opacity:.6;padding:10px 2px">El depósito está vacío. ¡Atrapá Pokémon EXPLORANDO!</p>';
  }
  G.box.forEach(function (m, i) {
    const v = donateValue(m);
    const isEnc = G.encargo && m.species === G.encargo.id;
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<img src="' +
      m.art +
      '"><span class="inf"><span class="nm">' +
      esc(m.nick) +
      ' <span style="color:var(--blue)">Nv.' +
      m.lvl +
      "</span>" +
      (isEnc ? ' <span style="color:var(--red)">📋 ¡ENCARGO!</span>' : "") +
      '</span><br><span class="ds">' +
      m.types.map(chip).join(" ") +
      " · PS " +
      m.hp +
      "/" +
      m.maxHp +
      "</span></span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.style.cssText =
      "font-size:10px;line-height:1.2;background:" +
      (isEnc ? "#ffe9a8" : "#fff");
    b.innerHTML = "DONAR<br>+" + v + "🪙";
    b.onclick = function () {
      askBox(
        "¿Transferir a <b>" +
          esc(m.nick) +
          "</b> (Nv." +
          m.lvl +
          ") al Prof. Álamo?<br>Recibirás <b>" +
          v +
          "🪙</b>" +
          (isEnc ? ' · <b style="color:var(--red)">¡ENCARGO ×2!</b>' : "") +
          ".<br>⚠️ No se puede deshacer.",
      ).then(function (ok) {
        if (ok) donateMon(i);
      });
    };
    row.appendChild(b);
    if (list) list.appendChild(row);
  });
  $("#ovLab").classList.add("show");
}
function donateMon(idx) {
  const m = G.box[idx];
  if (!m) return;
  const wasEnc = G.encargo && m.species === G.encargo.id;
  const v = donateValue(m);
  G.box.splice(idx, 1);
  G.coins += v;
  G.donated = (G.donated || 0) + 1;
  if (wasEnc) newEncargo();
  save();
  updateHud();
  SFX.buy();
  toast(
    wasEnc
      ? "📋 ¡Encargo completado! +" + v + "🪙"
      : "🧬 " + m.nick + " donado. +" + v + "🪙",
  );
  $("#ovLab").classList.remove("show");
  openLab();
}
function closeLab() {
  $("#ovLab").classList.remove("show");
  refreshAfterOverlay();
}

// ===== MODO INFINITO =====
function enterInf() {
  if (!G.inf) G.inf = { unlocked: false, totalScore: 0, bestStreak: 0 };
  if (!G.inf.unlocked) {
    G.inf.unlocked = true;
    toast("⚔️ ¡Modo Infinito desbloqueado! +1⚡ máximo.");
  }
  INF = {
    active: true,
    snapshot: G.team.map(function (m) {
      return m.hp;
    }),
    runScore: 0,
    runStreak: 0,
    battles: 0,
    continues: 0,
  };
  G.team.forEach(function (m) {
    m.hp = m.maxHp;
    m.status = null;
  });
  save();
  updateHud();
  openInfHub();
}
function openInfHub() {
  const cost = 1 + Math.floor(INF.battles / 10);
  $("#infScore").textContent = "🏆 " + INF.runScore;
  $("#infStreak").textContent = "🔥 " + INF.runStreak;
  $("#infBattles").textContent = "⚔️ " + INF.battles;
  $("#infEnergy").textContent = "⚡ " + G.energy + "/" + eMax();
  const nb = $("#infNextBtn");
  nb.textContent = "⚔️ SIGUIENTE BATALLA (" + cost + "⚡)";
  nb.disabled = G.energy < cost;
  const ts = $("#infTeam");
  if (ts) {
    ts.innerHTML = "";
    G.team.forEach(function (m) {
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
        (m.bankPts ? " · ✨" + m.bankPts + " pts" : "") +
        (m.resets ? " · 🔁×" + m.resets : "") +
        "</span></span>";
      ts.appendChild(row);
    });
  }
  $("#ovInf").classList.add("show");
}
function infNext() {
  const cost = 1 + Math.floor(INF.battles / 10);
  if (G.energy < cost) {
    toast("⚡ Necesitás " + cost + "⚡. Comprá energía o salí.");
    return;
  }
  G.energy -= cost;
  save();
  updateHud();
  $("#ovInf").classList.remove("show");
  spawnInfBattle();
}
function buyEnergy() {
  if (G.energy >= eMax()) {
    toast("⚡ Energía ya al máximo.");
    return;
  }
  if (G.coins < 100) {
    toast("Necesitás 100🪙.");
    return;
  }
  G.coins -= 100;
  G.energy++;
  SFX.buy();
  save();
  updateHud();
  renderBattleCards();
  toast("⚡ +1 energía.");
}
async function spawnInfBattle() {
  const strongest = Math.max.apply(
    null,
    G.team.map(function (m) {
      return m.lvl;
    }),
  );
  const lvl = Math.max(2, strongest + Math.floor(rnd(-2, 3)));
  showLoader("⚔️ Buscando rival…");
  let d = null;
  const id = 1 + Math.floor(Math.random() * 151);
  for (let i = 0; i < 3 && !d; i++) {
    try {
      d = await getPoke(id);
    } catch (e) {
      await sleep(500);
    }
  }
  hideLoader();
  if (!d) {
    toast("⚠️ Sin conexión.");
    openInfHub();
    return;
  }
  const e = makeFighter(d, lvl);
  await preloadImg(e.sprF);
  await preloadImg(activePlayerMon().sprB);
  battleStart({
    kind: "inf",
    enemy: e,
    canCatch: false,
    canRun: false,
    canSwap: true,
    xpMode: true,
    intro: "¡" + e.name + " salvaje (Nv." + lvl + ")!",
    onWin: infOnWin,
    onLose: infOnLose,
    onFlee: function () {
      exitInf();
    },
  });
}
async function infOnWin() {
  INF.runStreak++;
  const pts = 100 + BT.enemy.lvl * 20 + INF.runStreak * 15;
  INF.runScore += pts;
  const cns = 15 + BT.enemy.lvl * 5;
  G.coins += cns;
  const act = activePlayerMon();
  act.hp = Math.min(act.maxHp, act.hp + Math.floor(act.maxHp * 0.4));
  G.team.forEach(function (m) {
    if (m !== act && m.hp > 0)
      m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.2));
  });
  INF.battles++;
  if (INF.battles % 10 === 0) {
    G.team.forEach(function (m) {
      if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.1));
      resetCd(m);
    });
    toast("🎉 ¡Cada 10 batallas: +10% PS y cooldown completo!");
  }
  await processEvos();
  save();
  updateHud();
  openInfHub();
}
async function infOnLose() {
  const cost = 2 + INF.continues;
  if (G.energy >= cost) {
    const ok = await askBox(
      "¡Tu equipo cayó! ¿Pagar <b>" +
        cost +
        "⚡</b> para seguir con la racha? (PS a full)",
    );
    if (ok) {
      G.energy -= cost;
      INF.continues++;
      G.team.forEach(function (m) {
        m.hp = m.maxHp;
        m.status = null;
      });
      save();
      updateHud();
      openInfHub();
      return;
    }
  }
  exitInf();
}
function exitInf() {
  if (!INF.active) return;
  if (!G.inf) G.inf = { unlocked: false, totalScore: 0, bestStreak: 0 };
  G.inf.totalScore = (G.inf.totalScore || 0) + INF.runScore;
  G.inf.bestStreak = Math.max(G.inf.bestStreak || 0, INF.runStreak);
  G.team.forEach(function (m, i) {
    m.hp = Math.min(m.maxHp, INF.snapshot[i] || 0);
  });
  INF.active = false;
  save();
  updateHud();
  toast(
    "⚔️ Infinito: +" +
      INF.runScore +
      " pts, racha " +
      INF.runStreak +
      ". PS restaurados.",
  );
  $("#ovInf").classList.remove("show");
  openCamp();
}

// ===== TARJETAS DE GUARDADO =====
function renderSlots() {
  const g = $("#slotGrid");
  if (!g) return;
  g.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    (function (i) {
      let d = null;
      try {
        d = loadSlot(i);
      } catch (e) {
        d = null;
      }
      const el = document.createElement("div");
      el.className = "slot";
      if (d && d.team) {
        try {
          const lead = d.team && d.team[0] ? d.team[0] : null;
          const nm = d.name || "ENTRENADOR";
          const bd = (d.badges && d.badges.length) || 0;
          const co = d.coins || 0;
          const infB = (d.inf && d.inf.bestStreak) || 0;
          const infS = (d.inf && d.inf.totalScore) || 0;
          const fav = d.flags && d.flags.faroDone ? " · 🌟" : "";
          el.innerHTML =
            "<h4>TARJETA " +
            (i + 1) +
            '</h4><div class="sum"><b>' +
            esc(nm) +
            "</b><br>🏅 " +
            bd +
            "/4" +
            fav +
            " · 🪙 " +
            co +
            "<br>" +
            (lead
              ? esc(lead.nick || lead.name || "?") + " Nv." + (lead.lvl || 1)
              : "—") +
            "<br>⚔️ Récord: 🔥" +
            infB +
            " · 🏆" +
            infS +
            '</div><div class="slot-btns"><button class="btn-big grn" type="button">CONTINUAR ▸</button> <button class="btn-big red" type="button">BORRAR</button></div>';
          el.querySelector(".btn-big.grn").onclick = function () {
            startContinue(i, d);
          };
          el.querySelector(".btn-big.red").onclick = function () {
            askBox("¿Borrar la tarjeta " + (i + 1) + " para siempre?").then(
              function (ok) {
                if (ok) {
                  lsDel("pk_slot" + i);
                  renderSlots();
                }
              },
            );
          };
        } catch (e) {
          el.innerHTML =
            "<h4>TARJETA " +
            (i + 1) +
            '</h4><div class="sum">⚠️ Guardado antiguo/incompatible.<br>Borrala para empezar de cero.</div>';
          const bb = document.createElement("button");
          bb.className = "btn-big red";
          bb.type = "button";
          bb.textContent = "BORRAR TARJETA";
          bb.onclick = function () {
            lsDel("pk_slot" + i);
            renderSlots();
          };
          el.appendChild(bb);
        }
      } else {
        el.innerHTML =
          "<h4>TARJETA " +
          (i + 1) +
          '</h4><div class="sum" style="opacity:.5">— Vacía —<br>¡Una nueva aventura espera!</div><div class="slot-btns"><button class="btn-big" type="button">NUEVA AVENTURA ▸</button></div>';
        el.querySelector("button").onclick = function () {
          newAdventure(i);
        };
      }
      g.appendChild(el);
    })(i);
  }
}
function startContinue(i, d) {
  SLOT = i;
  G = d;
  G.lastTick = G.lastTick || Date.now();
  G.lastHealTick = G.lastHealTick || Date.now();
  G.day = G.day || 1;
  G.enemyAdvance = G.enemyAdvance || 0;
  G.stones = Object.assign(
    { fuego: 0, agua: 0, trueno: 0, hoja: 0, lunar: 0 },
    G.stones || {},
  );
  G.items = Object.assign(
    {
      ball: 0,
      potion: 0,
      antidote: 0,
      antipar: 0,
      despertar: 0,
      candy: 0,
      expS: 0,
      expM: 0,
      expL: 0,
    },
    G.items || {},
  );
  if (!G.inf) G.inf = { unlocked: false, totalScore: 0, bestStreak: 0 };
  MODE = "adv";
  INF.active = false;
  G.team.concat(G.box).forEach(function (m) {
    ensureMoveSys(m);
    if (m.resets === undefined) m.resets = 0;
  });
  try {
    ac();
  } catch (e) {}
  energyTick();
  healTick();
  updateHud();
  openCamp("¡Bienvenido de vuelta, " + G.name + "!");
}
function newAdventure(i) {
  SLOT = i;
  $("#advNameInput").value = lsGet("pk_name", "");
  $("#ovName").classList.add("show");
  setTimeout(function () {
    const el = $("#advNameInput");
    if (el) el.focus();
  }, 150);
}
function confirmName() {
  const name = ($("#advNameInput").value.trim() || "ENTRENADOR")
    .toUpperCase()
    .slice(0, 12);
  lsSet("pk_name", name);
  G = {
    name: name,
    day: 1,
    enemyAdvance: 0,
    energy: 5,
    lastTick: Date.now(),
    lastHealTick: Date.now(),
    coins: 100,
    items: {
      ball: 5,
      potion: 2,
      antidote: 0,
      antipar: 0,
      despertar: 0,
      candy: 0,
      expS: 0,
      expM: 0,
      expL: 0,
    },
    stones: { fuego: 0, agua: 0, trueno: 0, hoja: 0, lunar: 0 },
    badges: [],
    zone: 0,
    nodeId: "n0",
    visited: {},
    flags: {},
    starterIds: {},
    encargo: null,
    donated: 0,
    inf: { unlocked: false, totalScore: 0, bestStreak: 0 },
    dex: { seen: {}, caught: {}, names: {} },
    team: [],
    box: [],
    active: 0,
  };
  MODE = "adv";
  updateHud();
  $("#ovName").classList.remove("show");
  try {
    ac();
  } catch (e) {}
  playDialog(PROLOGUE, null, function () {
    pickStarterAdv();
  });
}
function cancelName() {
  $("#ovName").classList.remove("show");
  SLOT = -1;
  renderSlots();
  show("scrSlots");
}
async function pickStarterAdv() {
  show("scrAStart");
  const npar = $("#nameInput");
  if (npar) npar.parentElement.style.display = "none";
  $("#starterRow").innerHTML =
    '<div class="loading"><div class="ball"></div><p class="px small">EL PROF. ÁLAMO BUSCA TRES COMPAÑEROS…</p></div>';
  try {
    const trio = await Promise.all([getPoke(1), getPoke(4), getPoke(7)]);
    const row = $("#starterRow");
    row.innerHTML = "";
    trio.forEach(function (d, i) {
      row.appendChild(
        starterCard(d, i, function (dd) {
          const m = makeMon(dd, 5);
          m.isStarter = true;
          G.team.push(m);
          G.starterIds[m.species] = 1;
          if (G.dex) {
            G.dex.caught[dd.id] = 1;
            G.dex.seen[dd.id] = 1;
          }
          const npar = $("#nameInput");
          if (npar) npar.parentElement.style.display = "";
          save();
          openCamp("¡" + m.nick + " se une a ti! Ya está en tu POKÉDEX 📕.");
        }),
      );
    });
  } catch (e) {
    devError(e);
    toast("⚠️ Reintentando…");
    setTimeout(pickStarterAdv, 800);
  }
}

// ===== CAMPAMENTO =====
function refreshAfterOverlay() {
  if (INF.active) {
    openInfHub();
    return;
  }
  if ($("#scrTeam").classList.contains("active")) {
    openTeam();
    return;
  }
  if (MODE === "adv") openCamp();
}
function openCamp(msg) {
  show("scrCamp");
  MODE = "adv";
  healTick();
  updateHud();
  const p = G.team[G.active];
  $("#campArt").src = p ? p.art : "";
  $("#campName").textContent =
    (p ? (p.isStarter ? "❤️ " : "") + p.nick : "—") +
    " · Nv." +
    (p ? p.lvl : 0);
  $("#campBadges").innerHTML =
    ZONES.slice(0, 4)
      .map(function (z) {
        return (
          '<span style="opacity:' +
          (G.badges.indexOf(z.badge.n) !== -1 ? 1 : 0.25) +
          '" title="' +
          z.badge.n +
          '">' +
          z.badge.i +
          "</span>"
        );
      })
      .join("") +
    (G.flags.faroDone ? ' <span title="¡Faro liberado!">🌟</span>' : "");
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
      (p.status ? STATUS_META[p.status.type].i : "") +
      " · XP " +
      (p.xp || 0) +
      "/" +
      xpNeed(p.lvl) +
      (p.bankPts ? " · ✨" + p.bankPts + " pts" : "")
    : "—";
  const chips = [
    "📅 Día " + (G.day || 1),
    "☠️ Umbra +" + (G.enemyAdvance || 0),
    "👥 Equipo " + G.team.length + "/6 · 📦 " + G.box.length,
    "⚡ " + G.energy + "/" + eMax(),
    "💉 ×" + (G.items.potion || 0),
    "🔴 ×" + (G.items.ball || 0),
    "⭐ ×" + (G.items.candy || 0),
    "🪨 ×" +
      Object.values(G.stones).reduce(function (a, b) {
        return a + b;
      }, 0),
  ];
  if (G.inf && ((G.inf.bestStreak || 0) > 0 || (G.inf.totalScore || 0) > 0))
    chips.push(
      "⚔️ Inf: 🔥" + (G.inf.bestStreak || 0) + " 🏆" + (G.inf.totalScore || 0),
    );
  const totalBank = G.team.reduce(function (a, m) {
    return a + (m.bankPts || 0);
  }, 0);
  const html =
    chips
      .map(function (c) {
        return '<span class="cchip">' + c + "</span>";
      })
      .join("") +
    (totalBank > 0
      ? '<span class="cchip warn">✨ ' +
        totalBank +
        " puntos por repartir (👥 → 📊)</span>"
      : "");
  $("#campChips").innerHTML = html;
  const wiped = !teamAlive();
  const needsWarn =
    wiped && !(msg || "").indexOf("💀") !== -1
      ? false
      : wiped && !(msg || "").includes("💀");
  const full =
    (msg || "") +
    (wiped && (msg || "").indexOf("💀") === -1
      ? "\n💀 ¡Equipo DEBILITADO! Descansá o usá el Centro Pokémon."
      : "");
  $("#campMsg").innerHTML = esc(full).replace(/\n/g, "<br>");
  $("#campMsg").style.display = full ? "" : "none";
  $("#cbMap").querySelector(".t").textContent = Object.keys(G.visited).length
    ? "🗺️ CONTINUAR AVENTURA"
    : "🗺️ COMENZAR AVENTURA";
  $("#cbMap").disabled = wiped;
  $("#cbExplore").disabled = wiped;
  $("#cbInfD").textContent =
    "Leveá sin límite · récord 🔥" + ((G.inf && G.inf.bestStreak) || 0);
  $("#cbTeamD").textContent =
    G.team.length + "/6 equipo · " + G.box.length + " depósito";
  $("#cbDexD").textContent =
    Object.keys(G.dex.caught).length + "/151 capturados";
  const needs = G.team.concat(G.box).some(function (m) {
    return m.hp < m.maxHp || m.status;
  });
  $("#cbCenter").disabled = !needs;
  energyTick();
}
function doRest() {
  G.day = (G.day || 1) + 1;
  G.energy = eMax();
  G.lastTick = Date.now();
  const healed = G.team.reduce(function (a, m) {
    const nh = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.5));
    a += nh - m.hp;
    m.hp = nh;
    return a;
  }, 0);
  G.team.concat(G.box).forEach(function (m) {
    ensureMoveSys(m);
    resetCd(m);
  });
  if ((G.enemyAdvance || 0) < 5) G.enemyAdvance = (G.enemyAdvance || 0) + 1;
  SFX.heal();
  save();
  updateHud();
  openCamp(
    "📅 Día " +
      G.day +
      ": ⚡ recargada, +" +
      healed +
      " PS y ❄️ cooldowns listos… ¡pero la Umbra avanzó! Enemigos +" +
      G.enemyAdvance +
      " Nv.",
  );
}

// ===== MAPA =====
function zoneDone(z) {
  const b = ZONES[z].badge;
  return b && G.badges.indexOf(b.n) !== -1;
}
function openMap() {
  show("scrMap");
  MODE = "adv";
  mapZone = Math.min(mapZone, G.zone, ZONES.length - 1);
  const tabs = $("#mapTabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  for (let i = 0; i < ZONES.length; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mtab" + (i === mapZone ? " on" : "");
    const faroLocked = i === ZONES.length - 1 && G.badges.length < 4;
    if (faroLocked) {
      b.textContent = "🔒 Faro (4 🏅)";
      b.disabled = true;
    } else {
      b.textContent =
        ZONES[i].icon +
        " " +
        ZONES[i].name +
        (zoneDone(i)
          ? " 🏅"
          : i === ZONES.length - 1 && G.flags.faroDone
            ? " 🌟"
            : "");
      b.disabled = i > G.zone;
      b.onclick = (function (idx) {
        return function () {
          mapZone = idx;
          openMap();
        };
      })(i);
    }
    tabs.appendChild(b);
  }
  renderMapBox();
}
function nodeState(z, n) {
  if (G.nodeId === n.id && G.zone === z) return "cur";
  if (G.visited[z + "_" + n.id]) return "visited";
  const zdata = ZONES[z];
  const adj = zdata.edges.some(function (e) {
    return (
      (e[0] === G.nodeId && e[1] === n.id) ||
      (e[1] === G.nodeId && e[0] === n.id)
    );
  });
  return G.zone === z && adj ? "avail" : "locked";
}
function renderMapBox() {
  const z = ZONES[mapZone],
    box = $("#mapBox");
  if (!box) return;
  box.style.background = z.bg;
  const svg = $("#mapSvg");
  let lines = "";
  z.edges.forEach(function (e) {
    const na = z.nodes.find(function (n) {
      return n.id === e[0];
    });
    const nb = z.nodes.find(function (n) {
      return n.id === e[1];
    });
    if (na && nb)
      lines +=
        '<line x1="' +
        na.x +
        '%" y1="' +
        na.y +
        '%" x2="' +
        nb.x +
        '%" y2="' +
        nb.y +
        '%" stroke="rgba(37,37,64,.5)" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round"/>';
  });
  if (svg) svg.innerHTML = lines;
  const nd = $("#mapNodes");
  if (nd) nd.innerHTML = "";
  z.nodes.forEach(function (n) {
    const st = nodeState(mapZone, n);
    const d = document.createElement("div");
    d.className = "mnode " + st;
    d.textContent = n.icon;
    d.style.left = n.x + "%";
    d.style.top = n.y + "%";
    d.title = n.label;
    if (nd) nd.appendChild(d);
  });
  const opts = $("#mapOpts");
  if (!opts) return;
  opts.innerHTML = "";
  const cur =
    G.zone === mapZone
      ? z.nodes.find(function (n) {
          return n.id === G.nodeId;
        })
      : null;
  const info = document.createElement("div");
  info.className = "opt";
  info.style.cursor = "default";
  info.style.background = "#fffdf2";
  info.innerHTML = cur
    ? "<b>📍 Estás en: " +
      cur.label +
      '</b><span class="cost">Elegí tu camino · 1⚡ por tramo</span>'
    : "<b>📍 Tu aventura comienza en " +
      z.nodes[0].label +
      '</b><span class="cost">1⚡</span>';
  opts.appendChild(info);
  const dests = cur
    ? z.edges
        .filter(function (e) {
          return e[0] === G.nodeId || e[1] === G.nodeId;
        })
        .map(function (e) {
          return e[0] === G.nodeId ? e[1] : e[0];
        })
        .map(function (id) {
          return z.nodes.find(function (n) {
            return n.id === id;
          });
        })
    : [z.nodes[0]];
  dests.forEach(function (n) {
    if (!n) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opt";
    const done = G.visited[mapZone + "_" + n.id];
    const resolved = G.flags[mapZone + "_" + n.id + "_done"];
    b.innerHTML =
      "<span>" +
      n.icon +
      " " +
      n.label +
      " " +
      (done ? "✓" : "") +
      (resolved ? " · libre" : "") +
      '</span><span class="cost">' +
      (done ? "gratis" : "1⚡") +
      "</span>";
    b.onclick = function () {
      gotoNode(mapZone, n, done);
    };
    opts.appendChild(b);
  });
}
async function gotoNode(z, n, done) {
  if (!teamAlive()) {
    toast("💀 ¡Equipo debilitado! Descansá o usá el Centro.");
    return;
  }
  const fkey = z + "_" + n.id + "_done";
  if (G.flags[fkey]) {
    G.zone = z;
    G.nodeId = n.id;
    G.visited[z + "_" + n.id] = 1;
    save();
    if (n.type === "choice" || n.type === "trainer") {
      toast("🌿 El camino está libre… ¡pero hay Pokémon salvajes! (XP)");
      startWildBattle(
        ZONES[z].pool,
        function () {
          openMap();
        },
        { zone: z, nodeId: n.id, destKey: fkey },
      );
    } else if (n.type === "boss") {
      toast("🌟 ¿Otra vez? ¡Vamos!");
      startTrainerBattle(
        BOSS,
        function () {
          openMap();
        },
        false,
        null,
        { zone: z, nodeId: n.id, destKey: fkey },
        "boss",
      );
    } else {
      toast("✅ Pasás sin problemas.");
      openMap();
    }
    return;
  }
  if (!done && !spendEnergy()) return;
  const rb = { zone: G.zone, nodeId: G.nodeId, destKey: z + "_" + n.id };
  G.zone = z;
  G.nodeId = n.id;
  G.visited[z + "_" + n.id] = 1;
  save();
  dlog("Nodo " + n.id + " (" + n.type + ")");
  const zd = ZONES[z];
  if (n.type === "gym" && zoneDone(z)) {
    openMap();
    toast("🏅 Ya conquistaste este gimnasio.");
    return;
  }
  switch (n.type) {
    case "story":
      if (n.gift) {
        playDialog(n.dialog, null, function () {
          for (const k in n.gift) G.items[k] = (G.items[k] || 0) + n.gift[k];
          G.flags[fkey] = 1;
          save();
          toast("🎁 ¡Recibiste " + n.gift.ball + " Pokeball!");
          openMap();
        });
      } else
        playDialog(n.dialog, null, function () {
          openMap();
        });
      break;
    case "wild":
      startWildBattle(
        zd.pool,
        function () {
          openMap();
        },
        rb,
      );
      break;
    case "trainer":
      startTrainerBattle(
        zd.trainer,
        function () {
          G.flags[fkey] = 1;
          save();
          openMap();
        },
        false,
        null,
        rb,
        null,
      );
      break;
    case "spring":
      if (!done) {
        G.team.forEach(function (m) {
          m.hp = m.maxHp;
          m.status = null;
        });
        SFX.heal();
        save();
        toast("⛲ ¡La fuente curó a tu equipo!");
      } else toast("⛲ La fuente ya está tranquila.");
      openMap();
      break;
    case "choice":
      playDialog(
        n.dialog,
        n.choices.map(function (c) {
          return {
            label: c.label,
            fn: function () {
              resolveChoice(z, n, c.effect, fkey, rb);
            },
          };
        }),
        null,
      );
      break;
    case "gym":
      playDialog(
        [
          {
            who: zd.gym.name,
            txt:
              "¡Otro aspirante! Soy " +
              zd.gym.name.split(" ")[1] +
              ". Demostrame que mereces la " +
              zd.badge.n +
              ".",
          },
        ],
        null,
        function () {
          startTrainerBattle(
            zd.gym,
            function () {
              openMap();
            },
            true,
            z,
            rb,
            null,
          );
        },
      );
      break;
    case "boss":
      playDialog(
        [
          {
            who: "GENERAL NOX",
            txt: "Así que vos frustraste los planes de la Umbra… ¡El poder del Faro será NUESTRO!",
          },
          {
            who: "GENERAL NOX",
            txt: "¡Adelante, mis sombras! ¡Y vos, guardián corrompido… DESPIERTA, ZAPDOS!",
          },
        ],
        null,
        function () {
          startTrainerBattle(
            BOSS,
            function () {
              openMap();
            },
            false,
            null,
            rb,
            "boss",
          );
        },
      );
      break;
  }
}
function resolveChoice(z, n, effect, fkey, rb) {
  const zd = ZONES[z];
  const clearPath = function () {
    G.flags[fkey] = 1;
    save();
    openMap();
  };
  if (effect === "battle") {
    startTrainerBattle(zd.trainer, clearPath, false, null, rb, null);
    return;
  }
  if (effect === "bribe") {
    if (G.coins >= 100) {
      G.coins -= 100;
      save();
      updateHud();
      playDialog(
        [
          {
            who: "RECLUTA UMBRA",
            txt: "Jeje… las monedas hablan. Pasá, pasá…",
          },
        ],
        null,
        clearPath,
      );
    } else {
      toast("No tenés 100🪙… ¡a pelear!");
      startTrainerBattle(zd.trainer, clearPath, false, null, rb, null);
    }
    return;
  }
  if (effect === "sneak") {
    if (Math.random() < 0.5) {
      playDialog(
        [{ who: "TÚ", txt: "(Pasás de puntillas… ¡nadie te vio!)" }],
        null,
        clearPath,
      );
    } else {
      playDialog(
        [{ who: "SOMBRA UMBRA", txt: "¡¿A dónde creés que vas?!" }],
        null,
        function () {
          startTrainerBattle(zd.trainer, clearPath, false, null, rb, null);
        },
      );
    }
    return;
  }
}
function avgTeamLvl() {
  if (!G.team.length) return 5;
  return Math.round(
    G.team.reduce(function (a, m) {
      return a + m.lvl;
    }, 0) / G.team.length,
  );
}
function ensureActiveAlive() {
  if (G.team[G.active].hp > 0) return;
  const i = G.team.findIndex(function (m) {
    return m.hp > 0;
  });
  if (i >= 0) G.active = i;
}
function prepActive() {
  const am = G.team[G.active];
  ensureMoveSys(am);
  am.moves = buildBattleMoves(am);
}

// ===== BATALLAS DE AVENTURA =====
async function startWildBattle(pool, after, rb) {
  mapRollback = rb || null;
  healTick();
  if (!teamAlive()) {
    toast("💀 ¡Equipo debilitado!");
    return;
  }
  ensureActiveAlive();
  prepActive();
  showLoader("🌿 Apareciendo…");
  let d = null;
  for (let i = 0; i < 3 && !d; i++) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    try {
      d = await getPoke(id);
    } catch (e) {
      await sleep(600);
    }
  }
  hideLoader();
  if (!d) {
    toast("⚠️ Conexión perdida.");
    return;
  }
  const anchor = G.team[G.active].lvl;
  const lvl = Math.max(
    2,
    Math.min(100, anchor + Math.floor(rnd(-2, 3)) + (G.enemyAdvance || 0)),
  );
  const e = makeFighter(d, lvl);
  if (G.dex) G.dex.seen[d.id] = 1;
  await preloadImg(e.sprF);
  await preloadImg(G.team[G.active].sprB);
  battleStart({
    kind: "wild",
    enemy: e,
    canCatch: true,
    canRun: true,
    canSwap: true,
    xpMode: true,
    intro: "¡Un " + e.name + " salvaje apareció! (Nv." + lvl + ")",
    onWin: async function () {
      const c = 15 + e.lvl * 5;
      G.coins += c;
      save();
      updateHud();
      toast("🎉 ¡Victoria! +" + c + "🪙");
      await processEvos();
      await sleep(300);
      after();
    },
    onLose: advLose,
    onFlee: function () {
      toast("🏃 Escapaste.");
      after();
    },
    onCatch: function (enemy) {
      advCatch(enemy, after);
    },
  });
}
async function startTrainerBattle(tr, after, isGym, zoneIdx, rb, forceKind) {
  mapRollback = rb || null;
  healTick();
  if (!teamAlive()) {
    toast("💀 ¡Equipo debilitado!");
    return;
  }
  ensureActiveAlive();
  prepActive();
  showLoader(
    isGym
      ? "🏟️ DESAFÍO DE GIMNASIO…"
      : forceKind === "boss"
        ? "🗼 BATALLA FINAL…"
        : "⚔️ COMBATE…",
  );
  const fighters = [];
  const anchor = Math.max(avgTeamLvl(), tr.floor || 5);
  for (let ti = 0; ti < tr.team.length; ti++) {
    const s = tr.team[ti];
    let d = null;
    for (let i = 0; i < 3 && !d; i++) {
      try {
        d = await getPoke(s.id);
      } catch (e) {
        await sleep(600);
      }
    }
    if (d)
      fighters.push(
        makeFighter(
          d,
          Math.max(3, Math.min(100, anchor + s.off + (G.enemyAdvance || 0))),
        ),
      );
  }
  hideLoader();
  if (!fighters.length) {
    toast("⚠️ Conexión perdida.");
    return;
  }
  await preloadImg(fighters[0].sprF);
  await preloadImg(G.team[G.active].sprB);
  battleStart({
    kind: forceKind || (isGym ? "gym" : "trainer"),
    enemy: fighters.shift(),
    queue: fighters,
    trainerName: (tr.icon || "👤") + " " + tr.name,
    canCatch: false,
    canRun: false,
    canSwap: true,
    xpMode: true,
    intro: "¡" + tr.name + " quiere combatir!",
    onWin: async function () {
      if (isGym) {
        await processEvos();
        winBadge(zoneIdx, after);
      } else if (forceKind === "boss") {
        const c = 120;
        G.coins += c;
        save();
        updateHud();
        await processEvos();
        G.flags["4_f1_done"] = 1;
        save();
        if (!G.flags.faroDone) {
          G.flags.faroDone = 1;
          save();
          const et = $("#endTxt");
          if (et)
            et.innerHTML =
              "El <b>Zapdos</b> fue liberado de la corrupción y el Faro de Cristal vuelve a brillar sobre la Región Ámbar.<br><br>El Prof. Álamo te nombra <b>HÉROE DEL FARO</b>. ¡Gracias, " +
              esc(G.name) +
              "!";
          $("#ovEnd").classList.add("show");
          confetti("#confettiEnd");
          SFX.win();
          dlog("¡FARO DE CRISTAL LIBERADO!", "ok");
        } else {
          toast("🌟 El faro brilla de nuevo. +" + c + "🪙");
          await sleep(500);
          after();
        }
      } else {
        const c = 40 + avgTeamLvl() * 3;
        G.coins += c;
        save();
        updateHud();
        toast("🎉 ¡Victoria! +" + c + "🪙");
        await processEvos();
        await sleep(300);
        after();
      }
    },
    onLose: advLose,
  });
}
function winBadge(z, after) {
  const zd = ZONES[z];
  if (G.badges.indexOf(zd.badge.n) === -1) G.badges.push(zd.badge.n);
  G.zone = Math.max(G.zone, z + 1);
  save();
  updateHud();
  $("#badgeIcon").textContent = zd.badge.i;
  $("#badgeName").textContent = zd.badge.n;
  $("#badgeTxt").innerHTML =
    "¡Venciste a " +
    zd.gym.name +
    "!<br>⚡ Energía máxima: " +
    eMax() +
    "<br>" +
    (G.zone < 4
      ? "Nuevo destino desbloqueado: " + ZONES[G.zone].name + " 🗺️"
      : G.badges.length >= 4
        ? "¡El FARO DE CRISTAL te espera! 🗼"
        : "");
  $("#badgeOk").onclick = function () {
    $("#ovBadge").classList.remove("show");
    SFX.win();
    after();
  };
  $("#ovBadge").classList.add("show");
  confetti("#confetti");
  dlog("¡MEDALLA " + zd.badge.n + "!", "ok");
}
async function advLose() {
  let backLabel = "la entrada";
  if (mapRollback) {
    const zd = ZONES[mapRollback.zone];
    const backNode =
      zd &&
      zd.nodes.find(function (x) {
        return x.id === mapRollback.nodeId;
      });
    if (backNode) backLabel = backNode.label;
    G.zone = mapRollback.zone;
    G.nodeId = mapRollback.nodeId;
    delete G.visited[mapRollback.destKey];
  }
  save();
  show("scrCamp");
  MODE = "adv";
  openCamp(
    "😵 Todo se puso negro…\n🔙 Te llevaron de vuelta a «" +
      backLabel +
      "».\n💀 Tus Pokémon quedaron DEBILITADOS: descansá o usá el Centro.",
  );
}

// ===== EXPLORAR =====
function openExplore() {
  show("scrExplore");
  MODE = "adv";
  healTick();
  $("#expInfo").textContent =
    "· ⚡" +
    G.energy +
    "/" +
    eMax() +
    " · salvajes ≈ Nv de tu activo ±2 +" +
    (G.enemyAdvance || 0);
  const g = $("#biomeGrid");
  if (!g) return;
  g.innerHTML = "";
  BIOMES.forEach(function (b) {
    const locked = G.badges.length < b.minBadge;
    const el = document.createElement("div");
    el.className = "biome";
    el.innerHTML =
      '<div class="ico">' +
      b.icon +
      "</div><h4>" +
      b.name +
      "</h4><p>" +
      (locked ? "🔒 Necesitas " + b.minBadge + " medalla(s)" : b.d) +
      "</p>";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-big grn";
    btn.style.marginTop = "6px";
    btn.textContent = "🔍 BUSCAR (1⚡)";
    btn.disabled = locked;
    btn.onclick = function () {
      if (!teamAlive()) {
        toast("💀 ¡Equipo debilitado!");
        return;
      }
      if (!spendEnergy()) return;
      startWildBattle(
        b.pool,
        function () {
          openExplore();
        },
        null,
      );
    };
    el.appendChild(btn);
    g.appendChild(el);
  });
}

// ===== OBJETOS EN POKÉMON =====
function openMonItems(m) {
  window._miMon = m;
  $("#miName").textContent = m.nick.toUpperCase();
  renderMonItems();
  $("#ovMonItems").classList.add("show");
}
function renderMonItems() {
  const m = window._miMon;
  if (!m) return;
  const list = $("#monItemList");
  if (!list) return;
  list.innerHTML = "";
  const items = [
    {
      k: "candy",
      icon: "⭐",
      n: "Caramelo Raro",
      d: "+1 nivel (3 pts)",
      use: function () {
        if ((G.items.candy || 0) < 1) return false;
        G.items.candy--;
        addLevels(m, 1);
        return true;
      },
    },
    {
      k: "expS",
      icon: "🧪",
      n: "Poción EXP S",
      d: "+80 XP",
      use: function () {
        if ((G.items.expS || 0) < 1) return false;
        G.items.expS--;
        gainXp(m, 80);
        return true;
      },
    },
    {
      k: "expM",
      icon: "🧪",
      n: "Poción EXP M",
      d: "+250 XP",
      use: function () {
        if ((G.items.expM || 0) < 1) return false;
        G.items.expM--;
        gainXp(m, 250);
        return true;
      },
    },
    {
      k: "expL",
      icon: "🧪",
      n: "Poción EXP L",
      d: "+800 XP",
      use: function () {
        if ((G.items.expL || 0) < 1) return false;
        G.items.expL--;
        gainXp(m, 800);
        return true;
      },
    },
  ];
  items.forEach(function (it) {
    const cnt = G.items[it.k] || 0;
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<span style="font-size:20px">' +
      it.icon +
      '</span><span class="inf"><span class="nm">' +
      it.n +
      " ×" +
      cnt +
      '</span><br><span class="ds">' +
      it.d +
      "</span></span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = "USAR";
    b.disabled = cnt < 1;
    b.onclick = async function () {
      if (it.use()) {
        save();
        updateHud();
        await processEvos();
        renderMonItems();
        toast("✅ Usado en " + m.nick);
      }
    };
    row.appendChild(b);
    list.appendChild(row);
  });
}
function closeMonItems() {
  $("#ovMonItems").classList.remove("show");
  refreshAfterOverlay();
}

// ===== PIEDRAS =====
function openStones(m) {
  const list = $("#stoneList");
  if (!list) return;
  list.innerHTML = "";
  let any = false;
  const need = stoneNeededFor(m.species);
  for (const k in STONE_MOVES) {
    let pair = null;
    for (let i = 0; i < STONE_MOVES[k].length; i++) {
      if (STONE_MOVES[k][i][0] === m.species) {
        pair = STONE_MOVES[k][i];
        break;
      }
    }
    if (!pair) continue;
    const have = (G.stones[k] || 0) > 0;
    if (!have && k !== need) continue;
    any = true;
    const inf = STONE_INFO[k];
    const row = document.createElement("div");
    row.className = "listrow";
    row.innerHTML =
      '<span style="font-size:20px">' +
      inf[0] +
      '</span><span class="inf"><span class="nm">' +
      inf[1] +
      " ×" +
      (G.stones[k] || 0) +
      '</span><br><span class="ds">' +
      (have
        ? "Evoluciona a " + esc(m.nick)
        : "Necesitás esta piedra (tienda)") +
      "</span></span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = "USAR";
    b.disabled = !have;
    b.onclick = (function (key, p2) {
      return async function () {
        $("#ovStone").classList.remove("show");
        const ok = await askBox(
          "¿Usar " +
            inf[0] +
            " <b>" +
            inf[1] +
            "</b> en <b>" +
            esc(m.nick) +
            "</b>?<br>¡Evolucionará de inmediato!",
        );
        if (!ok) return;
        G.stones[key]--;
        save();
        await doEvolve(m, p2[1]);
        refreshAfterOverlay();
      };
    })(k, pair);
    row.appendChild(b);
    list.appendChild(row);
  }
  if (!any)
    list.innerHTML =
      '<p style="font-weight:800;opacity:.6;padding:6px">Este Pokémon no evoluciona con piedras.</p>';
  $("#ovStone").classList.add("show");
}

// ===== FICHA =====
function openFicha(m) {
  const rows = [
    ["PS", m.base.hp, true, "ps", 3],
    ["ATQ", m.base.attack, false, "atk", 2],
    ["DEF", m.base.defense, false, "def", 2],
    ["VEL", m.base.speed, false, "vel", 2],
  ];
  const hint = evoHint(m);
  let html =
    '<img src="' +
    m.art +
    '" style="width:110px;height:110px;object-fit:contain" alt="">' +
    '<h3 class="px" style="font-size:12px;margin:8px 0">' +
    esc(m.nick) +
    (m.resets
      ? ' <span style="color:#7b5ea7">🔁×' + m.resets + "</span>"
      : "") +
    "</h3>" +
    '<p style="font-weight:900">Nv.' +
    m.lvl +
    (m.xp !== undefined ? " · XP " + m.xp + "/" + xpNeed(m.lvl) : "") +
    " · " +
    m.types.map(chip).join(" ") +
    "</p>" +
    '<p style="font-size:12.5px;font-weight:800;color:#555">PS ' +
    m.hp +
    "/" +
    m.maxHp +
    (m.status ? " · " + STATUS_META[m.status.type].i : "") +
    (hint ? " · " + hint : "") +
    "</p>" +
    '<div style="text-align:left;margin-top:8px">';
  rows.forEach(function (r) {
    const lab = r[0],
      base = r[1],
      isHp = r[2],
      k = r[3],
      mult = r[4];
    const lv = statOf(base, m.lvl, isHp);
    const pts = (m.pts ? m.pts[k] : 0) * mult;
    const tot = lv + pts;
    html +=
      '<div class="ptrow" style="grid-template-columns:44px 1fr 48px 48px">' +
      "<b>" +
      lab +
      '</b><span class="sub" style="font-size:11px;color:#666">base ' +
      base +
      " → nivel " +
      lv +
      "</span>" +
      '<span style="font-weight:900;color:' +
      (pts > 0 ? "#8a6d00" : "#bbb") +
      ';text-align:right">+' +
      pts +
      "</span>" +
      '<span class="v">' +
      tot +
      "</span></div>";
  });
  html +=
    '</div><p style="font-size:11px;font-weight:800;color:#666;margin-top:6px">✨ Sin repartir: ' +
    (m.bankPts || 0) +
    (m.equipped ? " · 🛠️ Ataques " + m.equipped.length + "/4" : "") +
    "</p>";
  $("#fichaBox").innerHTML = html;
  $("#fichaBox").innerHTML = html;
  $("#ovFicha").classList.add("show");
}

// ===== EQUIPO =====
function monCard(m, idx, inTeam) {
  const el = document.createElement("div");
  el.className = "listrow";
  const active = inTeam && idx === G.active;
  const hint = evoHint(m);
  el.innerHTML =
    '<img src="' +
    m.art +
    '">' +
    '<span class="inf"><span class="nm">' +
    (active ? "⭐ " : "") +
    (m.isStarter ? "❤️ " : "") +
    esc(m.nick) +
    ' <span style="color:var(--blue)">Nv.' +
    m.lvl +
    "</span>" +
    (m.resets
      ? ' <span style="color:#7b5ea7">🔁×' + m.resets + "</span>"
      : "") +
    (m.hp <= 0 ? ' <span style="color:var(--red)">💀</span>' : "") +
    "</span><br>" +
    '<span class="ds">PS ' +
    m.hp +
    "/" +
    m.maxHp +
    " · ⚔" +
    m.atk +
    " 🛡" +
    m.def +
    " 💨" +
    m.vel +
    " · 🛠️" +
    (m.equipped || []).length +
    "/4" +
    (hint ? " · " + hint : "") +
    " · " +
    (m.status ? STATUS_META[m.status.type].i : "✨" + m.bankPts + " pts") +
    "</span></span>";
  const bw = document.createElement("span");
  bw.style.cssText =
    "display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end";
  const mk = function (txt, fn, dis, bg) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.style.fontSize = "11px";
    if (bg) b.style.background = bg;
    b.textContent = txt;
    b.disabled = !!dis;
    b.onclick = fn;
    bw.appendChild(b);
  };
  if (inTeam) {
    mk(
      "⭐",
      function () {
        G.active = idx;
        save();
        openTeam();
      },
      active,
    );
    mk(
      "↑",
      function () {
        if (idx > 0) {
          const t = G.team[idx - 1];
          G.team[idx - 1] = G.team[idx];
          G.team[idx] = t;
          if (G.active === idx) G.active = idx - 1;
          else if (G.active === idx - 1) G.active = idx;
          save();
          openTeam();
        }
      },
      idx === 0,
    );
    mk(
      "↓",
      function () {
        if (idx < G.team.length - 1) {
          const t = G.team[idx + 1];
          G.team[idx + 1] = G.team[idx];
          G.team[idx] = t;
          if (G.active === idx) G.active = idx + 1;
          else if (G.active === idx + 1) G.active = idx;
          save();
          openTeam();
        }
      },
      idx === G.team.length - 1,
    );
    mk("📦", function () {
      if (G.team.length < 2) {
        toast("Necesitás al menos 1 Pokémon.");
        return;
      }
      G.box.push(G.team.splice(idx, 1)[0]);
      if (G.active >= G.team.length) G.active = 0;
      save();
      openTeam();
    });
  } else {
    mk("⬆️", function () {
      if (G.team.length >= 6) {
        toast("Equipo lleno (6).");
        return;
      }
      G.team.push(G.box.splice(idx, 1)[0]);
      save();
      openTeam();
    });
  }
  mk(
    "📋",
    function () {
      openFicha(m);
    },
    false,
    "#e8f7ff",
  );
  mk(
    "🛠️",
    function () {
      openTaller(m);
    },
    false,
    "#e3f2fd",
  );
  if (stoneNeededFor(m.species))
    mk(
      "🪨",
      function () {
        openStones(m);
      },
      false,
      "#ffe9a8",
    );
  mk(
    "🍬",
    function () {
      openMonItems(m);
    },
    false,
    "#e2f8ec",
  );
  mk("✏️", function () {
    renMon = m;
    $("#renArt").src = m.art;
    $("#renName").textContent = m.nick;
    $("#renInput").value = m.nick;
    $("#ovRename").classList.add("show");
    setTimeout(function () {
      const e2 = $("#renInput");
      if (e2) e2.focus();
    }, 150);
  });
  mk(
    "📊",
    function () {
      openPts(m, "team");
    },
    m.bankPts < 1,
    m.bankPts > 0 ? "#ffe9a8" : null,
  );
  if (m.bankPts > 0) {
    const last = bw.lastChild;
    last.textContent = "📊✨" + m.bankPts;
  }
  el.appendChild(bw);
  return el;
}
function doRenOk() {
  const n = $("#renInput").value.trim();
  if (renMon && n) {
    renMon.nick = n.toUpperCase().slice(0, 12);
    save();
    toast("✏️ ¡Mote guardado!");
  }
  $("#ovRename").classList.remove("show");
  renMon = null;
  refreshAfterOverlay();
}
function doRenCancel() {
  $("#ovRename").classList.remove("show");
  renMon = null;
}
function openTeam() {
  show("scrTeam");
  MODE = "adv";
  healTick();
  const tp = $("#teamPanel");
  if (tp) {
    tp.innerHTML = "";
    G.team.forEach(function (m, i) {
      tp.appendChild(monCard(m, i, true));
    });
  }
  const bp = $("#boxPanel");
  if (bp) {
    bp.innerHTML = "";
    if (!G.box.length)
      bp.innerHTML =
        '<p style="font-weight:800;opacity:.6">Depósito vacío. ¡Atrapá más Pokémon explorando o en el Infinito!</p>';
    G.box.forEach(function (m, i) {
      bp.appendChild(monCard(m, i, false));
    });
  }
}
function teamBack() {
  if (INF.active) {
    openInfHub();
    return;
  }
  if (MODE === "adv") openCamp();
}

// ===== REPARTIR PUNTOS / RESET =====
function openPts(m, ctx) {
  ptsMon = m;
  ptsCtx = ctx || "team";
  renderPts();
  $("#ovPts").classList.add("show");
}
function renderPts() {
  const m = ptsMon;
  if (!m) return;
  $("#ptsInfo").textContent =
    m.nick +
    " · puntos: " +
    m.bankPts +
    " (máx +" +
    STAT_CAP +
    " por stat)" +
    (m.resets ? " · 🔁×" + m.resets : "");
  const rows = $("#ptsRows");
  if (!rows) return;
  rows.innerHTML = "";
  const defs = [
    ["ps", "PS"],
    ["atk", "ATQ"],
    ["def", "DEF"],
    ["vel", "VEL"],
  ];
  defs.forEach(function (d) {
    const k = d[0],
      lab = d[1];
    const r = document.createElement("div");
    r.className = "ptrow";
    const cur = { ps: m.maxHp, atk: m.atk, def: m.def, vel: m.vel }[k];
    r.innerHTML =
      "<b>" +
      lab +
      '</b><span class="sub" style="font-size:11px;color:#666">+' +
      { ps: 3, atk: 2, def: 2, vel: 2 }[k] +
      " por punto · " +
      m.pts[k] +
      "/" +
      STAT_CAP +
      '</span><span class="v">' +
      cur +
      "</span>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-sq";
    b.textContent = "+1";
    b.disabled = m.bankPts < 1 || m.pts[k] >= STAT_CAP;
    b.onclick = function () {
      m.pts[k]++;
      m.bankPts--;
      recalcMon(m);
      m.hp = Math.min(m.hp, m.maxHp);
      save();
      renderPts();
    };
    r.appendChild(b);
    rows.appendChild(r);
  });
  const rs = $("#ptsReset");
  if (rs) {
    if (m.lvl >= 50) {
      rs.style.display = "";
      const rb = $("#resetBtn");
      if (rb) {
        rb.disabled = G.coins < 100;
        rb.textContent =
          "🔁 HACER RESET (100🪙)" + (G.coins < 100 ? " · sin monedas" : "");
      }
    } else rs.style.display = "none";
  }
}
async function doReset() {
  const m = ptsMon;
  if (!m) return;
  if (m.lvl < 50 || G.coins < 100) return;
  const ok = await askBox(
    "¿Resetear a <b>" +
      esc(m.nick) +
      "</b>?<br>Vuelve a Nv5, recuperás todos los puntos +5 bonus. Cuesta <b>100🪙</b>.",
  );
  if (!ok) return;
  G.coins -= 100;
  const spent = m.pts.ps + m.pts.atk + m.pts.def + m.pts.vel;
  m.bankPts += spent + 5;
  m.pts = { ps: 0, atk: 0, def: 0, vel: 0 };
  m.lvl = 5;
  m.xp = 0;
  m.resets = (m.resets || 0) + 1;
  recalcMon(m);
  m.hp = m.maxHp;
  m.status = null;
  resetCd(m);
  save();
  updateHud();
  renderPts();
  toast(
    "🔁 ¡" + m.nick + " reseteado! +" + (spent + 5) + " puntos para repartir.",
  );
}
function ptsAuto() {
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
    if (
      keys.every(function (x) {
        return m.pts[x] >= STAT_CAP;
      })
    )
      break;
    i++;
    if (i > 600) break;
  }
  recalcMon(m);
  save();
  renderPts();
  toast("✨ Puntos repartidos automáticamente.");
}
function ptsClose() {
  $("#ovPts").classList.remove("show");
  if (ptsCtx === "battle") return;
  refreshAfterOverlay();
}

// ===== POKÉDEX =====
function openDex() {
  show("scrDex");
  MODE = "adv";
  const caught = Object.keys(G.dex.caught).length,
    seen = Object.keys(G.dex.seen).length;
  $("#dexCount").textContent =
    "· " + seen + " vistos · " + caught + " capturados / 151";
  const g = $("#dexGrid");
  if (!g) return;
  g.innerHTML = "";
  for (let id = 1; id <= 151; id++) {
    const c = document.createElement("div");
    const got = G.dex.caught[id],
      seenIt = G.dex.seen[id];
    c.className = "dcell" + (got ? " caught" : seenIt ? " seen" : "");
    if (seenIt || got) {
      const img = document.createElement("img");
      img.src = sprUrl(id);
      img.loading = "lazy";
      img.alt = "";
      c.appendChild(img);
      c.title =
        (G.dex.names[id] || "Nº" + id) + (got ? " · ¡CAPTURADO!" : " · visto");
      if (got) {
        const b = document.createElement("span");
        b.className = "bi";
        b.textContent = "🔴";
        c.appendChild(b);
      }
    } else {
      c.textContent = "?";
      c.title = "???";
    }
    c.onclick = (function (did) {
      return function () {
        dexDetail(did);
      };
    })(id);
    g.appendChild(c);
  }
}
async function dexDetail(id) {
  $("#ovDexMon").classList.add("show");
  $("#dexMonBox").innerHTML =
    '<div style="padding:20px"><div class="lball"></div><p class="px small">CARGANDO FICHA…</p></div>';
  const seen = G.dex.seen[id],
    got = G.dex.caught[id];
  try {
    const d = await getPoke(id);
    const nm = await speciesName(id);
    const b = {};
    d.stats.forEach(function (s) {
      b[s.stat.name] = s.base_stat;
    });
    const types = d.types.map(function (t) {
      return t.type.name;
    });
    const art =
      (d.sprites.other &&
        d.sprites.other["official-artwork"] &&
        d.sprites.other["official-artwork"].front_default) ||
      sprUrl(id);
    $("#dexMonBox").innerHTML = seen
      ? '<img src="' +
        art +
        '" style="width:130px;height:130px;object-fit:contain" alt="">' +
        '<h3 class="px" style="font-size:12px;margin:8px 0">' +
        esc(nm) +
        ' <span style="color:#999">#' +
        String(id).padStart(3, "0") +
        "</span></h3>" +
        '<div class="trow">' +
        types.map(chip).join("") +
        "</div>" +
        '<p style="font-weight:900;margin-top:6px">' +
        (got ? "🔴 ¡CAPTURADO!" : "👁️ Visto, aún sin capturar") +
        "</p>" +
        '<div class="sbars" style="max-width:270px;margin:8px auto">' +
        statRow("PS", b.hp) +
        statRow("ATQ", b.attack) +
        statRow("DEF", b.defense) +
        statRow("VEL", b.speed) +
        "</div>"
      : '<div style="font-size:56px">❓</div><h3 class="px" style="font-size:12px;margin:8px 0">???</h3>' +
        '<p style="font-weight:800">Aún no viste a este Pokémon.<br>¡Seguí explorando!</p>';
  } catch (e) {
    $("#dexMonBox").innerHTML =
      '<p style="font-weight:800">⚠️ Sin conexión.</p>';
  }
}

// ===== HELPERS DE CARTAS =====
function starterCard(d, i, pick) {
  const b = {};
  d.stats.forEach(function (s) {
    b[s.stat.name] = s.base_stat;
  });
  const types = d.types.map(function (t) {
    return t.type.name;
  });
  const art =
    (d.sprites.other &&
      d.sprites.other["official-artwork"] &&
      d.sprites.other["official-artwork"].front_default) ||
    d.sprites.front_default;
  const el = document.createElement("div");
  el.className = "scard";
  el.style.setProperty("--d", i * 0.12 + "s");
  el.innerHTML =
    '<img src="' +
    art +
    '"><h3 class="px">' +
    d.name.toUpperCase() +
    "</h3>" +
    '<div class="trow">' +
    types.map(chip).join("") +
    "</div>" +
    '<div class="sbars">' +
    statRow("PS", b.hp) +
    statRow("ATQ", b.attack) +
    statRow("DEF", b.defense) +
    statRow("VEL", b.speed) +
    "</div>" +
    '<button class="pick" type="button">ELEGIR</button>';
  el.addEventListener("click", function () {
    pick(d);
  });
  return el;
}
function statRow(l, v) {
  return (
    '<div class="sb"><span>' +
    l +
    '</span><div class="track"><i style="width:' +
    Math.min(100, v / 1.6) +
    '%"></i></div><em>' +
    v +
    "</em></div>"
  );
}
function preloadImg(u) {
  return new Promise(function (r) {
    if (!u) return r();
    const i = new Image();
    i.onload = function () {
      r();
    };
    i.onerror = function () {
      r();
    };
    i.src = u;
    setTimeout(r, 3000);
  });
}
// == FIN core.js ==
