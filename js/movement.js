// movement.js
// Acciones de movimiento + teclado y mouse

// Mapeo según tu BD / lógica:
const ACTIONS = {
  up:       { op: 1, path: "adelante" },
  down:     { op: 2, path: "atras" },
  stop:     { op: 3, path: "detener" },

  // Giro 90° en su lugar
  left:     { op: 9, path: "giro/90/izquierda" },
  right:    { op: 8, path: "giro/90/derecha" },

  // Adelante diagonales
  upLeft:   { op: 5, path: "izquierda" },
  upRight:  { op: 4, path: "derecha" },

  // Atrás diagonales
  downLeft:  { op: 7, path: "atras-izquierda" },
  downRight: { op: 6, path: "atras-derecha" },

  // Giros 360°
  turn360L: { op: 11, path: "giro/360/izquierda" },
  turn360R: { op: 10, path: "giro/360/derecha" }
};

// movimientos que mantienen
const HOLDABLE = {
  up: true,
  down: true,
  upLeft: true,
  downLeft: true,
  upRight: true,
  downRight: true
};

// mapa teclas → acciones
const KEY_MAP = {
  w: "up",
  s: "down",
  q: "upLeft",
  e: "upRight",
  z: "downLeft",
  c: "downRight",

  a: "left",
  d: "right",
  f: "turn360L",
  r: "turn360R",

  x: "stop"   // ⭐ TECLA X PARA DETENER
};

let keyDownState = {};

// KEYDOWN
document.addEventListener("keydown", (evt) => {
  const key = evt.key.toLowerCase();
  if (!KEY_MAP[key]) return;

  const action = KEY_MAP[key];
  const act = ACTIONS[action];
  if (!act) return;

  if (keyDownState[key]) return;
  keyDownState[key] = true;

  if (seqMode) {
    addStepByOp(act.op);
    setStatus("Paso agregado desde teclado", "info");
    return;
  }

  sendPersistentAction(act.path);

  if (action === "stop")
    setStatus("Detenido", "warning");
  else
    setStatus("Moviendo: " + act.path, "info");
});

// KEYUP
document.addEventListener("keyup", (evt) => {
  const key = evt.key.toLowerCase();
  if (!KEY_MAP[key]) return;

  const action = KEY_MAP[key];
  keyDownState[key] = false;

  if (seqMode) return;
  if (action === "stop") return;

  if (HOLDABLE[action]) {
    sendPersistentAction("detener");
    setStatus("Detenido", "warning");
  }
});

// 🖱️ MOUSE – movimiento mantenido (MODO NORMAL, NO SECUENCIA)
function bindMouseMovement() {
  const mouseMap = {
    btnUp: "up",
    btnDown: "down",
    btnLeft: "left",
    btnRight: "right",
    btnUpLeft: "upLeft",
    btnUpRight: "upRight",
    btnDownLeft: "downLeft",
    btnDownRight: "downRight",
    btnStop: "stop",
    btnTurn360L: "turn360L",
    btnTurn360R: "turn360R"
  };

  for (let id in mouseMap) {
    const actionKey = mouseMap[id];
    const btn = document.getElementById(id);
    if (!btn) continue;

    const startHandler = () => {
      if (seqMode) return;
      const act = ACTIONS[actionKey];
      if (!act) return;

      if (actionKey === "stop") {
        sendPersistentAction("detener");
        setStatus("Detenido", "warning");
      } else {
        sendPersistentAction(act.path);
        setStatus("Moviendo: " + act.path, "info");
      }
    };

    const endHandler = () => {
      if (seqMode) return;
      if (actionKey === "stop") return;

      if (HOLDABLE[actionKey]) {
        sendPersistentAction("detener");
        setStatus("Detenido", "warning");
      }
    };

    btn.addEventListener("mousedown", startHandler);
    btn.addEventListener("mouseup", endHandler);
    btn.addEventListener("mouseleave", endHandler);
  }
}
