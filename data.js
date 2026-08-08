// ============================================================
// data.js — POKÉDESAFÍO v2.1
// Datos puros: tipos, efectividades, movimientos, evoluciones,
// biomas, zonas, jefe y prólogo. Sin lógica de juego.
// ============================================================

// ---- Nombres y colores de tipos ----
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

// ---- Movimientos por tipo: b = básico (físico, ∞), s = especial (cargas) ----
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

// ---- Tabla de efectividades (atacante → defensor) ----
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

// ---- Estados que puede aplicar un movimiento especial, según su tipo ----
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

// ---- URL de sprites (la que faltaba) ----
const sprUrl = function (id) {
  return (
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" +
    id +
    ".png"
  );
};

// ---- Constantes de balance ----
const STAT_CAP = 100; // máximo de puntos por stat
const CD_RATE = 2 * 60 * 1000; // 1 carga de enfriamiento cada 2 min
const CD_MAX = 4; // cargas máximas de un ataque especial
const MT_PRICE = { fis: 300, esp: 500 }; // precio de aprender un ataque (taller)

// ---- Evoluciones por nivel (Gen 1) ----
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

// ---- Piedras evolutivas: especie → evolución ----
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
const TRADE_LOCKED = [64, 67, 75, 93]; // evolucionan por intercambio (bloqueado por ahora)

// ---- Helpers de datos ----
function stoneNeededFor(sp) {
  for (const k in STONE_MOVES) {
    for (let i = 0; i < STONE_MOVES[k].length; i++) {
      if (STONE_MOVES[k][i][0] === sp) return k;
    }
  }
  return null;
}
function evoHint(m) {
  const e = EVOS[m.species];
  if (e) return "🥚→Nv" + e.lvl;
  const sk = stoneNeededFor(m.species);
  if (sk) return "🪨 " + STONE_INFO[sk][1];
  if (TRADE_LOCKED.indexOf(m.species) !== -1) return "🔒 evol. especial";
  return "";
}

// ---- Biomas de exploración ----
const BIOMES = [
  {
    id: "forest",
    name: "Bosque Verde",
    icon: "🌳",
    d: "El clásico bosque del inicio. Pokémon amigables.",
    pool: [10, 13, 16, 25, 43, 69],
    minBadge: 0,
  },
  {
    id: "prairie",
    name: "Pradera Ámbar",
    icon: "🌾",
    d: "Pastos altos y sorpresas. ¡Eevee merodea por aquí!",
    pool: [19, 23, 37, 58, 63, 66, 77, 133],
    minBadge: 0,
  },
  {
    id: "coast",
    name: "Costa Marea",
    icon: "🌊",
    d: "Arena, olas y Pokémon de agua.",
    pool: [7, 54, 60, 72, 86, 90, 98, 120],
    minBadge: 1,
  },
  {
    id: "mountain",
    name: "Montaña Cuarzo",
    icon: "⛰️",
    d: "Rocas duras y tipos lucha.",
    pool: [41, 50, 56, 66, 74, 75, 81, 95],
    minBadge: 2,
  },
  {
    id: "cave",
    name: "Cueva Penumbra",
    icon: "🕳️",
    d: "Oscura y misteriosa. Pokémon fantasma.",
    pool: [41, 46, 50, 92, 93],
    minBadge: 3,
  },
];

// ---- Zonas de aventura (mapa + gimnasios) ----
const ZONES = [
  {
    name: "Bosque Cuarzo",
    icon: "🌲",
    bg: "linear-gradient(#9fd8a0,#4d9e56)",
    badge: { n: "Medalla Cuarzo", i: "🪨" },
    nodes: [
      {
        id: "n0",
        x: 8,
        y: 68,
        type: "story",
        icon: "🚪",
        label: "Entrada del bosque",
        dialog: [
          {
            who: "GUÍA",
            txt: "El Bosque Cuarzo está inquieto desde que la Team Umbra robó el fragmento de luz…",
          },
          {
            who: "GUÍA",
            txt: "¡Cuidado con los Pokémon salvajes! Debilítalos y lanza Pokeballs si quieres capturarlos.",
          },
        ],
      },
      {
        id: "n1",
        x: 28,
        y: 38,
        type: "wild",
        icon: "🌑",
        label: "Sendero Umbrío (fuertes)",
      },
      {
        id: "n2",
        x: 28,
        y: 84,
        type: "wild",
        icon: "🌼",
        label: "Sendero Claro (tranquilo)",
      },
      {
        id: "n3",
        x: 48,
        y: 60,
        type: "choice",
        icon: "🌉",
        label: "Puente Viejo",
        dialog: [
          {
            who: "RECLUTA UMBRA",
            txt: "¡Alto ahí! Este puente es territorio de la Team Umbra. ¡El fragmento de luz es nuestro!",
          },
          { who: "RECLUTA UMBRA", txt: "¿Qué harás, pequeño entrenador?" },
        ],
        choices: [
          { label: "⚔️ ¡Batalla!", effect: "battle" },
          { label: "🪙 Sobornar (100 monedas)", effect: "bribe" },
        ],
      },
      {
        id: "n4",
        x: 64,
        y: 34,
        type: "wild",
        icon: "🍃",
        label: "Claro de Hierbas",
      },
      {
        id: "n5",
        x: 76,
        y: 66,
        type: "spring",
        icon: "⛲",
        label: "Fuente del Bosque",
      },
      {
        id: "n6",
        x: 90,
        y: 44,
        type: "gym",
        icon: "🏟️",
        label: "GIMNASIO de Petra",
      },
    ],
    edges: [
      ["n0", "n1"],
      ["n0", "n2"],
      ["n1", "n3"],
      ["n2", "n3"],
      ["n3", "n4"],
      ["n4", "n5"],
      ["n5", "n6"],
    ],
    pool: [10, 13, 16, 25, 43, 69],
    trainer: {
      name: "Recluta Umbra",
      icon: "🕶️",
      team: [
        { id: 19, off: 0 },
        { id: 41, off: 1 },
      ],
      floor: 5,
    },
    gym: {
      name: "Líder Petra",
      team: [
        { id: 74, off: 0 },
        { id: 95, off: 2 },
      ],
      floor: 6,
    },
  },
  {
    name: "Costa Marea",
    icon: "🌊",
    bg: "linear-gradient(#9fd4f5,#3d84c6)",
    badge: { n: "Medalla Marea", i: "🌊" },
    nodes: [
      {
        id: "m0",
        x: 8,
        y: 60,
        type: "story",
        icon: "🏖️",
        label: "Playa Inicial",
        dialog: [
          {
            who: "GUÍA",
            txt: "La Costa Marea huele a sal… y a problemas. La Umbra también estuvo por aquí.",
          },
          {
            who: "GUÍA",
            txt: "El Líder Nereo entrena en la marea alta. ¡Andá con cuidado!",
          },
        ],
      },
      {
        id: "m1",
        x: 28,
        y: 30,
        type: "trainer",
        icon: "⚠️",
        label: "Acantilados (peligro)",
      },
      {
        id: "m2",
        x: 28,
        y: 82,
        type: "wild",
        icon: "🐚",
        label: "Orilla Tranquila",
      },
      {
        id: "m3",
        x: 46,
        y: 56,
        type: "story",
        icon: "🎣",
        label: "Pescador Paco",
        dialog: [
          {
            who: "PACO",
            txt: "¡Bah! Los peces no pican desde que el faro se apagó…",
          },
          {
            who: "PACO",
            txt: "Tomá, te regalo una Pokeball. ¡Atrapá algo lindo por mí!",
          },
        ],
        gift: { ball: 1 },
      },
      {
        id: "m4",
        x: 62,
        y: 76,
        type: "wild",
        icon: "🌊",
        label: "Bancos de Coral",
      },
      {
        id: "m5",
        x: 74,
        y: 38,
        type: "choice",
        icon: "🕳️",
        label: "Gruta Sospechosa",
        dialog: [
          { who: "???", txt: "Jeje… otro niño perdido buscando medallas…" },
          { who: "RECLUTA UMBRA", txt: "¡La Umbra no perdona!" },
        ],
        choices: [
          { label: "⚔️ ¡Enfrentarlos!", effect: "battle" },
          { label: "🏃 Pasar de puntillas (50% de suerte)", effect: "sneak" },
        ],
      },
      {
        id: "m6",
        x: 90,
        y: 60,
        type: "gym",
        icon: "🏟️",
        label: "GIMNASIO de Nereo",
      },
    ],
    edges: [
      ["m0", "m1"],
      ["m0", "m2"],
      ["m1", "m3"],
      ["m2", "m3"],
      ["m3", "m4"],
      ["m4", "m5"],
      ["m5", "m6"],
    ],
    pool: [54, 60, 72, 86, 90, 98, 120],
    trainer: {
      name: "Explorador Umbra",
      icon: "🕶️",
      team: [
        { id: 21, off: 0 },
        { id: 72, off: 1 },
      ],
      floor: 8,
    },
    gym: {
      name: "Líder Nereo",
      team: [
        { id: 120, off: 0 },
        { id: 73, off: 2 },
      ],
      floor: 9,
    },
  },
  {
    name: "Pico Voltio",
    icon: "🌩️",
    bg: "linear-gradient(#cfd8e8,#8a93b8)",
    badge: { n: "Medalla Voltio", i: "⚡" },
    nodes: [
      {
        id: "v0",
        x: 8,
        y: 62,
        type: "story",
        icon: "🌬️",
        label: "Base del Pico",
        dialog: [
          {
            who: "GUÍA",
            txt: "El viento aquí huele a ozono… Rai entrena entre relámpagos.",
          },
          {
            who: "GUÍA",
            txt: "Los Pokémon eléctricos son veloces: ¡cuidá tu velocidad!",
          },
        ],
      },
      {
        id: "v1",
        x: 28,
        y: 36,
        type: "wild",
        icon: "💨",
        label: "Ladera Ventosa",
      },
      {
        id: "v2",
        x: 28,
        y: 84,
        type: "choice",
        icon: "📡",
        label: "Torre de Antenas",
        dialog: [
          {
            who: "CAZADOR UMBRA",
            txt: "¡Estas antenas amplifican nuestra señal! ¡Ni un paso más!",
          },
        ],
        choices: [
          { label: "⚔️ ¡Batalla!", effect: "battle" },
          { label: "🪙 Sobornar (100 monedas)", effect: "bribe" },
        ],
      },
      {
        id: "v3",
        x: 52,
        y: 56,
        type: "wild",
        icon: "⚡",
        label: "Cumbres Eléctricas",
      },
      {
        id: "v4",
        x: 72,
        y: 78,
        type: "spring",
        icon: "⛲",
        label: "Manantial del Trueno",
      },
      {
        id: "v5",
        x: 90,
        y: 42,
        type: "gym",
        icon: "🏟️",
        label: "GIMNASIO de Rai",
      },
    ],
    edges: [
      ["v0", "v1"],
      ["v0", "v2"],
      ["v1", "v3"],
      ["v2", "v3"],
      ["v3", "v4"],
      ["v4", "v5"],
    ],
    pool: [81, 100, 25, 77, 27, 111],
    trainer: {
      name: "Cazador Umbra",
      icon: "🕶️",
      team: [
        { id: 41, off: 0 },
        { id: 52, off: 1 },
      ],
      floor: 13,
    },
    gym: {
      name: "Líder Rai",
      team: [
        { id: 81, off: 0 },
        { id: 25, off: 1 },
        { id: 125, off: 2 },
      ],
      floor: 14,
    },
  },
  {
    name: "Monte Penumbra",
    icon: "🌫️",
    bg: "linear-gradient(#6d5a8f,#3b3155)",
    badge: { n: "Medalla Penumbra", i: "👻" },
    nodes: [
      {
        id: "p0",
        x: 8,
        y: 58,
        type: "story",
        icon: "🌁",
        label: "Pie del Monte",
        dialog: [
          {
            who: "GUÍA",
            txt: "La niebla del Monte Penumbra esconde fantasmas… y a la Umbra.",
          },
          {
            who: "GUÍA",
            txt: "Ébano, la líder, solo respeta a quien no tiembla en la oscuridad.",
          },
        ],
      },
      {
        id: "p1",
        x: 26,
        y: 32,
        type: "wild",
        icon: "🌫️",
        label: "Bosque de Niebla",
      },
      {
        id: "p2",
        x: 26,
        y: 82,
        type: "trainer",
        icon: "🌑",
        label: "Sombra Umbra",
      },
      {
        id: "p3",
        x: 50,
        y: 56,
        type: "choice",
        icon: "🏮",
        label: "Cementerio de Faroles",
        dialog: [
          {
            who: "SOMBRA UMBRA",
            txt: "Los faroles se apagaron solos… ¿o fuimos nosotros? Jeje…",
          },
        ],
        choices: [
          { label: "⚔️ ¡Enfrentarlos!", effect: "battle" },
          { label: "🏃 Pasar de puntillas (50% de suerte)", effect: "sneak" },
        ],
      },
      {
        id: "p4",
        x: 68,
        y: 30,
        type: "wild",
        icon: "🕯️",
        label: "Sendero de Ánimas",
      },
      {
        id: "p5",
        x: 74,
        y: 76,
        type: "spring",
        icon: "⛲",
        label: "Fuente Espectral",
      },
      {
        id: "p6",
        x: 90,
        y: 50,
        type: "gym",
        icon: "🏟️",
        label: "GIMNASIO de Ébano",
      },
    ],
    edges: [
      ["p0", "p1"],
      ["p0", "p2"],
      ["p1", "p3"],
      ["p2", "p3"],
      ["p3", "p4"],
      ["p3", "p5"],
      ["p4", "p6"],
      ["p5", "p6"],
    ],
    pool: [92, 41, 48, 88, 104, 46],
    trainer: {
      name: "Sombra Umbra",
      icon: "🕶️",
      team: [
        { id: 92, off: 0 },
        { id: 88, off: 1 },
      ],
      floor: 16,
    },
    gym: {
      name: "Líder Ébano",
      team: [
        { id: 92, off: 0 },
        { id: 93, off: 1 },
        { id: 42, off: 2 },
      ],
      floor: 17,
    },
  },
  {
    name: "Faro de Cristal",
    icon: "🗼",
    bg: "linear-gradient(#23234a,#6a4f9e)",
    badge: null,
    boss: true,
    nodes: [
      {
        id: "f0",
        x: 12,
        y: 60,
        type: "story",
        icon: "🌊",
        label: "Base del Faro",
        dialog: [
          {
            who: "PROF. ÁLAMO",
            txt: "¡Lo lograste, campeón! Las 4 medallas abren el Faro de Cristal.",
          },
          {
            who: "PROF. ÁLAMO",
            txt: "El General Nox está arriba con el Zapdos corrompido… ¡liberalo y salvá la región!",
          },
        ],
      },
      {
        id: "f1",
        x: 84,
        y: 42,
        type: "boss",
        icon: "🗼",
        label: "EL FARO DE CRISTAL",
      },
    ],
    edges: [["f0", "f1"]],
    pool: [41, 92, 81],
  },
];

// ---- Jefe final ----
const BOSS = {
  name: "General Nox",
  icon: "🕶️",
  team: [
    { id: 42, off: 0 },
    { id: 93, off: 1 },
    { id: 145, off: 3 },
  ],
  floor: 20,
};

// ---- Prólogo ----
const PROLOGUE = [
  {
    who: "PROF. ÁLAMO",
    txt: "¡Bienvenido a la Región Ámbar, joven entrenador! Soy el Profesor Álamo.",
  },
  {
    who: "PROF. ÁLAMO",
    txt: "Una desgracia: ¡el FARO DE CRISTAL se apagó! La Team Umbra robó sus 4 fragmentos de luz.",
  },
  {
    who: "PROF. ÁLAMO",
    txt: "Sin el faro, los Pokémon andan nerviosos. Necesito a alguien valiente… ¡y ese sos vos!",
  },
  {
    who: "PROF. ÁLAMO",
    txt: "Recuperá los fragmentos venciendo a los líderes que la Umbra corrompió. ¡Tomá esto para empezar!",
  },
];
// == FIN data.js ==
