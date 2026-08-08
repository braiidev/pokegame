// ============================================================
// ui.js — POKÉDESAFÍO v2.1
// Conexión de botones con la lógica, timer de energía y arranque.
// Requiere: data.js y core.js cargados antes.
// ============================================================

// ===== NAVEGACIÓN =====
$("#mcAdv").onclick = function () {
  renderSlots();
  show("scrSlots");
};
$("#slotsBack").onclick = function () {
  show("scrTitle");
};
$("#arcBack").onclick = function () {
  show("scrTitle");
};
$("#advNameOk").onclick = function () {
  confirmName();
};
$("#advNameBack").onclick = function () {
  cancelName();
};

// ===== CAMPAMENTO =====
$("#cbMap").onclick = function () {
  openMap();
};
$("#cbExplore").onclick = function () {
  openExplore();
};
$("#cbRest").onclick = function () {
  doRest();
};
$("#cbCenter").onclick = function () {
  openCenter();
};
$("#cbLab").onclick = function () {
  openLab();
};
$("#cbShop").onclick = function () {
  openShop();
};
$("#cbTeam").onclick = function () {
  openTeam();
};
$("#cbDex").onclick = function () {
  openDex();
};
$("#cbInf").onclick = function () {
  enterInf();
};

// ===== VOLVER =====
$("#mapBack").onclick = function () {
  openCamp();
};
$("#expBack").onclick = function () {
  openCamp();
};
$("#teamBack").onclick = function () {
  teamBack();
};
$("#dexBack").onclick = function () {
  openCamp();
};

// ===== BATALLA (overlays) =====
$("#bagClose").onclick = function () {
  $("#ovBag").classList.remove("show");
};
$("#swapClose").onclick = function () {
  $("#ovSwap").classList.remove("show");
  swapForced = false;
};
$("#dlgNext").onclick = function () {
  nextLine();
};

// ===== CAPTURA Y MOTES =====
$("#nickOk").onclick = function () {
  doNickOk();
};
$("#nickSkip").onclick = function () {
  doNickSkip();
};
$("#renOk").onclick = function () {
  doRenOk();
};
$("#renCancel").onclick = function () {
  doRenCancel();
};

// ===== FIN DE JUEGO / FARO =====
$("#endOk").onclick = function () {
  $("#ovEnd").classList.remove("show");
  openMap();
};

// ===== PIEDRAS / FICHA / TALLER / LAB / CENTRO / TIENDA =====
$("#stoneBack").onclick = function () {
  $("#ovStone").classList.remove("show");
};
$("#fichaClose").onclick = function () {
  $("#ovFicha").classList.remove("show");
};
$("#tallerBack").onclick = function () {
  closeTaller();
};
$("#labBack").onclick = function () {
  closeLab();
};
$("#centerBack").onclick = function () {
  closeCenter();
};
$("#shopBack").onclick = function () {
  closeShop();
};
$("#miClose").onclick = function () {
  closeMonItems();
};

// ===== REPARTIR PUNTOS / RESET =====
$("#ptsAuto").onclick = function () {
  ptsAuto();
};
$("#ptsClose").onclick = function () {
  ptsClose();
};
$("#resetBtn").onclick = function () {
  doReset();
};

// ===== MODO INFINITO =====
$("#infNextBtn").onclick = function () {
  infNext();
};
$("#infTeamBtn").onclick = function () {
  $("#ovInf").classList.remove("show");
  openTeam();
};
$("#infEnergyBtn").onclick = function () {
  buyEnergy();
  openInfHub();
};
$("#infExitBtn").onclick = function () {
  exitInf();
};
$("#infBarBuy").onclick = function () {
  buyEnergy();
};
$("#infBarPts").onclick = function () {
  openPts(activePlayerMon(), "battle");
};
$("#infBarExit").onclick = function () {
  exitInf();
};

// ===== SONIDO =====
$("#btnMute").onclick = function () {
  muted = !muted;
  lsSet("pk_mute", muted ? "1" : "0");
  $("#btnMute").textContent = muted ? "🔇" : "🔊";
};
$("#btnMute").textContent = muted ? "🔇" : "🔊";

// ===== DEV =====
$("#btnDev").onclick = function () {
  devToggle();
};
$("#devClose").onclick = function () {
  devToggle();
};
$("#devCoins").onclick = function () {
  if (MODE === "adv" && G) {
    G.coins += 500;
    updateHud();
  }
  dlog("DEV +500🪙", "warn");
};
$("#devEnergy").onclick = function () {
  if (G) {
    G.energy = eMax();
    updateHud();
  }
  dlog("DEV energía full", "warn");
};
$("#devHeal").onclick = function () {
  if (G) {
    G.team.forEach(function (m) {
      m.hp = m.maxHp;
      m.status = null;
    });
    toast("DEV: equipo curado");
  }
  dlog("DEV curar", "warn");
};
$("#devBadge").onclick = function () {
  if (G && G.badges.length < 4) {
    const z = ZONES[G.badges.length];
    G.badges.push(z.badge.n);
    G.zone = Math.max(G.zone, G.badges.length);
    updateHud();
    save();
  }
  dlog("DEV medalla", "warn");
};

// ===== TIMER DE ENERGÍA + REGEN PS =====
setInterval(function () {
  if (MODE === "adv") {
    updateEnergyChip();
    healTick();
    if (BT && !BT.busy && !BT.ended) renderActions();
  }
}, 1000);

// ===== TECLA ESCAPE (cierra overlays) =====
window.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    if (swapForced) return;
    const ids = [
      "#ovBag",
      "#ovSwap",
      "#ovShop",
      "#ovPts",
      "#ovDexMon",
      "#ovCenter",
      "#ovLab",
      "#ovName",
      "#ovRename",
      "#ovTaller",
      "#ovFicha",
      "#ovStone",
      "#ovMonItems",
    ];
    for (let i = 0; i < ids.length; i++) {
      const el = $(ids[i]);
      if (el) el.classList.remove("show");
    }
  }
});

// ===== ARRANQUE =====
window.__pokeBooted = true;
dlog("POKÉDESAFÍO v2.1 cargado", "ok");
if (devOn) {
  $("#devPanel").style.display = "block";
  $("#btnDev").classList.add("on");
}
updateHud();
(function () {
  const b = document.getElementById("bootErr");
  if (b) {
    b.style.display = "block";
    b.style.background = "#2fae7d";
    b.textContent = "✅ POKÉDESAFÍO cargó correctamente. ¡A jugar!";
    setTimeout(function () {
      b.style.display = "none";
    }, 2000);
  }
})();
// ===== FIXES =====
// Cerrar la ficha Pokédex tocando fuera de la tarjeta
$("#ovDexMon").onclick = function (e) {
  if (e.target === this) this.classList.remove("show");
};
// Botón SALIR en el campamento (vuelve a las tarjetas)
(function () {
  var hg = document.querySelector(".hub-grid");
  if (hg && !document.getElementById("cbExit")) {
    var b = document.createElement("button");
    b.id = "cbExit";
    b.type = "button";
    b.className = "hbtn";
    b.style.background = "#ffd6d0";
    b.innerHTML =
      '<span class="t">🚪 SALIR</span><span class="d">Volver a las tarjetas</span>';
    b.onclick = function () {
      save();
      renderSlots();
      show("scrSlots");
    };
    hg.appendChild(b);
  }
})();
// == FIN ui.js ==
