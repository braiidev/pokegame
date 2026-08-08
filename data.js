/* ============================================================
   data.js — POKÉDESAFÍO v3.0
   Datos y funciones puras. Sin estado de juego.
   Lo usan: core.js y ui.js
   ============================================================ */
"use strict";

/* ===== LOCALSTORAGE ===== */
const lsGet = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v;
  } catch (e) {
    return d;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
};
const lsDel = (k) => {
  try {
    localStorage.removeItem(k);
  } catch (e) {}
};

/* ===== CONSTANTES GLOBALES ===== */
const STAT_CAP = 100; // máximo de puntos por stat
const CD_MAX = 4; // cargas máximas de un ataque especial
const CD_RATE = 2 * 60 * 1000; // 1 carga cada 2 min
const RATE = 5 * 60 * 1000; // 1 energía cada 5 min
const ENERGY_MAX_BASE = 10; // tope absoluto de energía (NUNCA más de 10)

/* ===== TIPOS ===== */
const TYPE_ES = {
  normal: "Normal",
  fire: "Fuego",
  water: "Agua",
  grass: "Planta",
  electric: "Eléctrico",
  ice: "Hielo",
  fighting: "Lucha",
  poison: "Veneno",
  ground: "Tierra",
  flying: "Volador",
  psychic: "Psíquico",
  bug: "Bicho",
  rock: "Roca",
  ghost: "Fantasma",
  dragon: "Dragón",
  steel: "Acero",
  dark: "Siniestro",
  fairy: "Hada",
};
const TYPE_COL = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#E3B415",
  grass: "#7AC74C",
  ice: "#66c7c2",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  steel: "#8f8fa8",
  dark: "#705746",
  fairy: "#D685AD",
};

/* ===== MOVIMIENTOS POR TIPO (b=básico físico, s=especial) ===== */
const MOVES = {
  normal: { b: ["Golpe Cuerpo", 55], s: ["Hiperrayo", 90] },
  fire: { b: ["Ascuas", 50], s: ["Lanzallamas", 90] },
  water: { b: ["Pistola Agua", 50], s: ["Hidrobomba", 90] },
  grass: { b: ["Látigo Cepa", 50], s: ["Rayo Solar", 90] },
  electric: { b: ["Impactrueno", 50], s: ["Trueno", 90] },
  ice: { b: ["Nieve Polvo", 50], s: ["Rayo Hielo", 90] },
  fighting: { b: ["Golpe Kárate", 50], s: ["Sumisión", 90] },
  poison: { b: ["Residuos", 50], s: ["Bomba Lodo", 90] },
  ground: { b: ["Terratemblor", 55], s: ["Terremoto", 95] },
  flying: { b: ["Ataque Ala", 55], s: ["Pájaro Osado", 90] },
  psychic: { b: ["Confusión", 50], s: ["Psíquico", 90] },
  bug: { b: ["Picadura", 50], s: ["Tijera X", 90] },
  rock: { b: ["Lanzarrocas", 50], s: ["Avalancha", 90] },
  ghost: { b: ["Lengüetazo", 50], s: ["Bola Sombra", 90] },
  dragon: { b: ["Dragoaliento", 55], s: ["Garra Dragón", 90] },
  steel: { b: ["Garra Metal", 50], s: ["Foco Resplandor", 90] },
  dark: { b: ["Mordisco", 50], s: ["Pulso Umbrío", 90] },
  fairy: { b: ["Viento Feérico", 50], s: ["Fuerza Lunar", 90] },
};

/* ===== TABLA DE EFECTIVIDAD ===== */
const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  fairy: {
    fire: 0.5,
    fighting: 2,
    poison: 0.5,
    dragon: 2,
    dark: 2,
    steel: 0.5,
  },
};

/* ===== ESTADOS QUE CAUSA CADA TIPO (solo ataques especiales) ===== */
const TYPE2STATUS = {
  electric: "paralyze",
  flying: "paralyze",
  poison: "poison",
  ground: "poison",
  grass: "sleep",
  fairy: "sleep",
  bug: "sleep",
};
const STATUS_META = {
  poison: { i: "🟣", t: "VEN" },
  paralyze: { i: "⚡", t: "PAR" },
  sleep: { i: "💤", t: "DOR" },
};

/* ===== SPRITES ===== */
const sprUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const API_BASE = "https://pokeapi.co/api/v2/pokemon/";

/* ===== EVOLUCIONES POR NIVEL ===== */
const EVOS = {
  1: { to: 2, lvl: 16 },
  2: { to: 3, lvl: 32 },
  4: { to: 5, lvl: 16 },
  5: { to: 6, lvl: 36 },
  7: { to: 8, lvl: 16 },
  8: { to: 9, lvl: 36 },
  10: { to: 11, lvl: 7 },
  11: { to: 12, lvl: 10 },
  13: { to: 14, lvl: 7 },
  14: { to: 15, lvl: 16 },
  16: { to: 17, lvl: 18 },
  17: { to: 18, lvl: 36 },
  19: { to: 20, lvl: 20 },
  21: { to: 22, lvl: 20 },
  23: { to: 24, lvl: 22 },
  27: { to: 28, lvl: 22 },
  29: { to: 30, lvl: 16 },
  32: { to: 33, lvl: 16 },
  41: { to: 42, lvl: 22 },
  43: { to: 44, lvl: 21 },
  46: { to: 47, lvl: 24 },
  48: { to: 49, lvl: 31 },
  50: { to: 51, lvl: 26 },
  52: { to: 53, lvl: 28 },
  54: { to: 55, lvl: 33 },
  56: { to: 57, lvl: 28 },
  60: { to: 61, lvl: 25 },
  63: { to: 64, lvl: 16 },
  66: { to: 67, lvl: 28 },
  69: { to: 70, lvl: 21 },
  72: { to: 73, lvl: 30 },
  74: { to: 75, lvl: 25 },
  77: { to: 78, lvl: 40 },
  79: { to: 80, lvl: 37 },
  81: { to: 82, lvl: 30 },
  84: { to: 85, lvl: 31 },
  86: { to: 87, lvl: 34 },
  88: { to: 89, lvl: 38 },
  92: { to: 93, lvl: 25 },
  96: { to: 97, lvl: 26 },
  98: { to: 99, lvl: 28 },
  100: { to: 101, lvl: 30 },
  104: { to: 105, lvl: 28 },
  109: { to: 110, lvl: 35 },
  111: { to: 112, lvl: 42 },
  116: { to: 117, lvl: 32 },
  118: { to: 119, lvl: 33 },
  129: { to: 130, lvl: 20 },
  147: { to: 148, lvl: 30 },
  148: { to: 149, lvl: 55 },
};

/* ===== PIEDRAS EVOLUTIVAS ===== */
const STONE_MOVES = {
  fuego: [
    [37, 38],
    [58, 59],
    [133, 136],
  ],
  agua: [
    [61, 62],
    [90, 91],
    [120, 121],
    [133, 134],
  ],
  trueno: [
    [25, 26],
    [133, 135],
  ],
  hoja: [
    [44, 45],
    [70, 71],
    [102, 103],
  ],
  lunar: [
    [30, 31],
    [33, 34],
    [35, 36],
    [39, 40],
  ],
};
const STONE_INFO = {
  fuego: ["🔥", "Piedra Fuego", 300],
  agua: ["💧", "Piedra Agua", 300],
  trueno: ["⚡", "Piedra Trueno", 300],
  hoja: ["🍃", "Piedra Hoja", 300],
  lunar: ["🌙", "Piedra Lunar", 300],
};

/* ===== BIOMAS DE EXPLORACIÓN ===== */
const BIOMES = [
  {
    id: "forest",
    name: "Bosque Verde",
    icon: "🌳",
    pool: [10, 13, 16, 25, 43, 69],
    minBadge: 0,
  },
  {
    id: "prairie",
    name: "Pradera Ámbar",
    icon: "🌾",
    pool: [19, 23, 37, 58, 63, 66, 77, 133],
    minBadge: 0,
  },
  {
    id: "coast",
    name: "Costa Marea",
    icon: "🌊",
    pool: [7, 54, 60, 72, 86, 90, 98, 120],
    minBadge: 1,
  },
  {
    id: "mountain",
    name: "Montaña Cuarzo",
    icon: "⛰️",
    pool: [41, 50, 56, 66, 74, 75, 81, 95],
    minBadge: 2,
  },
  {
    id: "cave",
    name: "Cueva Penumbra",
    icon: "🕳️",
    pool: [41, 46, 50, 92, 93],
    minBadge: 3,
  },
];

/* ===== ZONAS DEL MAPA (con gimnasios) ===== */
const ZONES = [
  {
    name: "Bosque Cuarzo",
    icon: "🌲",
    badge: "Medalla Cuarzo",
    pool: [10, 13, 16, 25, 43, 69],
    gym: {
      name: "Líder Petra",
      team: [
        { id: 74, lvl: 8 },
        { id: 95, lvl: 10 },
      ],
    },
    nodes: 7,
  },
  {
    name: "Costa Marea",
    icon: "🌊",
    badge: "Medalla Marea",
    pool: [54, 60, 72, 86, 90, 98, 120],
    gym: {
      name: "Líder Nereo",
      team: [
        { id: 120, lvl: 11 },
        { id: 73, lvl: 13 },
      ],
    },
    nodes: 7,
  },
  {
    name: "Pico Voltio",
    icon: "🌩️",
    badge: "Medalla Voltio",
    pool: [81, 100, 25, 77, 27, 111],
    gym: {
      name: "Líder Rai",
      team: [
        { id: 81, lvl: 14 },
        { id: 25, lvl: 15 },
        { id: 125, lvl: 16 },
      ],
    },
    nodes: 6,
  },
  {
    name: "Monte Penumbra",
    icon: "🌫️",
    badge: "Medalla Penumbra",
    pool: [92, 41, 48, 88, 104, 46],
    gym: {
      name: "Líder Ébano",
      team: [
        { id: 92, lvl: 17 },
        { id: 93, lvl: 18 },
        { id: 42, lvl: 18 },
      ],
    },
    nodes: 7,
  },
];

/* ===== FUNCIONES PURAS (cálculos basados en datos) ===== */
/* Stat según stat base, nivel y si es HP */
const statOf = (base, lvl, isHp) =>
  Math.floor((base * 2 * lvl) / 100) + (isHp ? lvl + 10 : 5);
/* XP necesaria para subir de nivel */
const xpNeed = (lvl) => 20 + lvl * 15;
/* XP que da un enemigo derrotado */
const xpGive = (kind, lvl) => (kind === "wild" ? 12 + lvl * 4 : 25 + lvl * 6);
/* Multiplicador de efectividad de un tipo contra los tipos defensores */
function effectiveness(t, defs) {
  let m = 1;
  for (const d of defs) {
    const r = CHART[t];
    if (r && r[d] !== undefined) m *= r[d];
  }
  return m;
}
/* Chip HTML de un tipo */
const chip = (t) =>
  `<b class="tchip" style="background:${TYPE_COL[t]}">${TYPE_ES[t]}</b>`;
/* Velocidad efectiva (parálisis reduce a la mitad) */
const effSpe = (f) =>
  f.spe * (f.status && f.status.type === "paralyze" ? 0.5 : 1);
/* Escapa HTML para evitar inyección */
const esc = (s) =>
  String(s).replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
  );
/* Utilidades básicas compartidas */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const $ = (s) => document.querySelector(s);
