// ===============================================================
//  Control Carrito IoT – Cliente Web 
//  Movimiento persistente + comando rápido + SECUENCIAS RTC + VELOCIDAD
// ===============================================================

// ---------------- METADATOS ----------------
let API_BASE = "ws://54.167.184.108:5500";
let CAR_ID = 1;
let USER_ID = 1;

// Estado extra: MODO CREACIÓN / EDICIÓN DE SECUENCIA
let seqMode = false;
let seqSteps = []; // {orden, idOperacion}
let editingSeqId = null; // null = creando nueva, != null = editando pasos de esa secuencia

// WS persistente para movimiento
let wsControl = null;
let wsControlConnected = false;

// 🔴 bandera para bloquear movimientos mientras corre la secuencia
let movimientosBloqueados = false;

// Actualizar valores en pantalla
function updateMeta() {
  document.getElementById("metaCart").textContent = CAR_ID;
  document.getElementById("metaUser").textContent = USER_ID;
  document.getElementById("metaApi").textContent = API_BASE;

  const badge = document.getElementById("metaConn");
  if (wsControlConnected) {
    badge.textContent = "Conectado (persistente)";
    badge.className = "badge bg-success";
  } else {
    badge.textContent = "Desconectado";
    badge.className = "badge bg-danger";
  }
}

// ---------------- UTILIDADES ----------------
function setStatus(text, type = "secondary") {
  const box = document.getElementById("status");
  box.className = `alert alert-${type} status-box mb-3`;
  box.textContent = text;
}

function buildWS(path) {
  let url = API_BASE.replace(/\/+$/, "") + path;
  if (path.startsWith("/ws/r/")) {
    url += (url.includes("?") ? "&" : "?") +
      `dispositivo=${CAR_ID}&usuario=${USER_ID}`;
  }
  return url;
}

// ===============================================================
//  🔵 WEBSOCKET PERSISTENTE
// ===============================================================
function initControlWS() {
  const url = `${API_BASE}/ws/r/control-movimiento?dispositivo=${CAR_ID}&usuario=${USER_ID}`;
  wsControl = new WebSocket(url);

  wsControl.onopen = () => {
    wsControlConnected = true;
    updateMeta();
    if (!seqMode) setStatus("Conexión persistente activa", "success");
  };

  wsControl.onerror = () => setStatus("Error en WebSocket persistente", "danger");

  wsControl.onclose = () => {
    wsControlConnected = false;
    updateMeta();
    setTimeout(initControlWS, 1500);
  };
}

function sendPersistentAction(accion) {
  if (seqMode) return;

  // si los movimientos están bloqueados, no mandamos nada
  if (movimientosBloqueados) return;

  if (!wsControl || wsControl.readyState !== 1) {
    setStatus("Esperando reconexión...", "warning");
    return;
  }

  wsControl.send(JSON.stringify({ accion }));
}

// ===============================================================
//  💨 MODO COMANDO RÁPIDO
// ===============================================================
function sendWS(path, onReply) {
  const url = buildWS(path);
  let ws = new WebSocket(url);

  ws.onopen = () => console.log("WS rápido conectado");

  let first = true;

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);

      if (first && data?.msg === "WebSocket listo") {
        first = false;
        return;
      }

      if (onReply) onReply(ev.data);

    } catch (e) {}

    ws.close();
  };

  ws.onerror = () => setStatus("Error en WebSocket rápido", "danger");
}

// ===============================================================
//  🔘 ACCIONES DE MOVIMIENTO
// ===============================================================
const ACTIONS = {
  up: { op: 1, path: "adelante" },
  down: { op: 2, path: "atras" },
  stop: { op: 3, path: "detener" },
  left: { op: 4, path: "giro/90/izquierda" },
  right: { op: 5, path: "giro/90/derecha" },
  upLeft: { op: 6, path: "izquierda" },
  upRight: { op: 7, path: "derecha" },
  downLeft: { op: 8, path: "atras-izquierda" },
  downRight: { op: 9, path: "atras-derecha" },
  turn360L: { op: 10, path: "giro/360/izquierda" },
  turn360R: { op: 11, path: "giro/360/derecha" }
};

// ===============================================================
//  🚫 BOTONES — SOLO PARA SECUENCIAS (NO MOVIMIENTO EN MODO NORMAL)
// ===============================================================
function bindMovButtons() {
  const map = {
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
    btnTurn360R: "turn360R",
  };

  for (let id in map) {
    const key = map[id];
    const btn = document.getElementById(id);

    btn.onclick = () => {
      if (!seqMode) return;

      const act = ACTIONS[key];
      if (!act) return;

      addStepByOp(act.op);
    };
  }
}

// ===============================================================
//  📋 MANEJO DE PASOS EN MEMORIA (seqSteps) Y RENDER
// ===============================================================
const OPERACION_NOMBRE = {
  1: "Adelante",
  2: "Atrás",
  3: "Detener",
  4: "Giro 90° Izquierda",
  5: "Giro 90° Derecha",
  6: "Izquierda",
  7: "Derecha",
  8: "Atrás-Izquierda",
  9: "Atrás-Derecha",
  10: "Giro 360° Derecha",
  11: "Giro 360° Izquierda"
};

function addStepByOp(op) {
  seqSteps.push({
    orden: seqSteps.length + 1,
    idOperacion: op
  });
  renderSequenceList();
}

function moveStep(index, delta) {
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= seqSteps.length) return;

  const tmp = seqSteps[index];
  seqSteps[index] = seqSteps[newIndex];
  seqSteps[newIndex] = tmp;

  // Recalcular orden
  seqSteps.forEach((p, i) => p.orden = i + 1);
  renderSequenceList();
}

function deleteStep(index) {
  seqSteps.splice(index, 1);
  seqSteps.forEach((p, i) => p.orden = i + 1);
  renderSequenceList();
}

function renderSequenceList() {
  const list = document.getElementById("sequence");
  list.innerHTML = "";

  seqSteps.forEach((p, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";

    const nombre = OPERACION_NOMBRE[p.idOperacion] || `Operación ${p.idOperacion}`;

    const spanText = document.createElement("span");
    spanText.textContent = `${index + 1}. ${nombre}`;
    li.appendChild(spanText);

    // Controles de edición SOLO si estamos en modo secuencia (creación/edición)
    if (seqMode) {
      const spanBtns = document.createElement("span");

      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.className = "btn btn-sm btn-outline-secondary me-1";
      btnUp.textContent = "↑";
      btnUp.onclick = () => moveStep(index, -1);

      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.className = "btn btn-sm btn-outline-secondary me-1";
      btnDown.textContent = "↓";
      btnDown.onclick = () => moveStep(index, 1);

      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn btn-sm btn-outline-danger";
      btnDel.textContent = "X";
      btnDel.onclick = () => deleteStep(index);

      spanBtns.appendChild(btnUp);
      spanBtns.appendChild(btnDown);
      spanBtns.appendChild(btnDel);

      li.appendChild(spanBtns);
    }

    list.appendChild(li);
  });
}

// ===============================================================
//  ▶️ EJECUTAR SECUENCIA RTC
// ===============================================================
function runSequenceRTC() {
  const id = document.getElementById("selSequences").value;
  if (!id) {
    setStatus("Selecciona secuencia", "warning");
    return;
  }

  // al iniciar la secuencia, bloqueamos los movimientos manuales
  movimientosBloqueados = true;

  sendWS(`/ws/r/ejecutar-secuencia-rtc/${id}?delay=3`,
    () => {
      setStatus("Secuencia RTC ejecutada", "success");

      // 🔴 al finalizar la secuencia, mandamos un DETENER por el WS persistente
      try {
        if (wsControl && wsControl.readyState === 1) {
          wsControl.send(JSON.stringify({ accion: "detener" }));
        }
      } catch (e) {
        console.error("Error enviando detener al finalizar secuencia", e);
      }
    });
}

// ===============================================================
//  📌 LISTAR SECUENCIAS
// ===============================================================
function cargarSecuencias() {
  sendWS("/ws/r/listar-secuencias", (resp) => {
    const data = JSON.parse(resp);
    const sel = document.getElementById("selSequences");

    sel.innerHTML = `<option value="">Seleccionar secuencia...</option>`;

    if (!data?.secuencias) return;

    data.secuencias.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id_secuencia;
      opt.textContent = s.nombre;
      sel.appendChild(opt);
    });
  });
}

// ===============================================================
//  ⭐ MOSTRAR BOTÓN BORRAR + CARGAR PASOS (MODO SOLO LECTURA)
// ===============================================================
document.getElementById("selSequences").addEventListener("change", () => {
  const id = document.getElementById("selSequences").value;
  const btnDel = document.getElementById("btnDeleteSeq");
  const btnNew = document.getElementById("btnNewSeq");
  const btnEdit = document.getElementById("btnEditSeq");

  if (id) {
    btnDel.classList.remove("d-none");
    if (btnNew) btnNew.disabled = true;
    if (btnEdit) btnEdit.classList.remove("d-none");
    editingSeqId = null; // salir de cualquier edición previa
    seqMode = false;
  } else {
    btnDel.classList.add("d-none");
    if (btnNew) btnNew.disabled = false;
    if (btnEdit) btnEdit.classList.add("d-none");
    editingSeqId = null;
    seqMode = false;
  }

  // Cargar pasos en modo solo lectura
  cargarPasosDeSecuencia(id);
});

// ===============================================================
//  ⭐ BORRAR SECUENCIA COMPLETA
// ===============================================================
document.getElementById("btnDeleteSeq").onclick = () => {

  const id = document.getElementById("selSequences").value;
  if (!id) return;

  if (!confirm("¿Seguro que deseas borrar esta secuencia?")) return;

  sendWS(`/ws/r/borrar-secuencia-completa/${id}`, (resp) => {
    const data = JSON.parse(resp);

    if (!data?.ok) {
      setStatus("Error al borrar secuencia", "danger");
      return;
    }

    setStatus("Secuencia eliminada correctamente", "success");

    document.getElementById("sequence").innerHTML = "";
    document.getElementById("btnDeleteSeq").classList.add("d-none");

    cargarSecuencias();
  });
};

// ===============================================================
//  ⭐ EDITAR PASOS DE UNA SECUENCIA EXISTENTE
// ===============================================================
document.getElementById("btnEditSeq").onclick = () => {
  const id = document.getElementById("selSequences").value;
  if (!id) {
    setStatus("Selecciona una secuencia para modificar sus pasos", "warning");
    return;
  }

  editingSeqId = id;
  seqMode = true;
  seqSteps = [];
  document.getElementById("btnSaveSeq").classList.remove("d-none");

  // Cargar pasos desde el servidor y pasarlos a seqSteps para poder editarlos
  sendWS(`/ws/r/obtener-pasos/${id}`, (resp) => {
    const data = JSON.parse(resp);
    seqSteps = [];

    if (data?.pasos) {
      data.pasos.forEach(p => {
        seqSteps.push({
          orden: p.orden,
          idOperacion: p.id_operacion
        });
      });
      // Ordenar por 'orden' por si acaso
      seqSteps.sort((a, b) => a.orden - b.orden);
      seqSteps.forEach((p, i) => p.orden = i + 1);
    }

    renderSequenceList();
    setStatus("Modo edición de pasos activo. Puedes mover o borrar pasos y luego guardar.", "warning");
  });
};

// ===============================================================
//  🔥 CREAR NUEVA SECUENCIA
// ===============================================================
document.getElementById("btnNewSeq").onclick = () => {
  const selId = document.getElementById("selSequences").value;
  if (selId) {
    setStatus("Quita la selección de secuencia antes de crear una nueva", "warning");
    return;
  }

  editingSeqId = null; // es creación nueva
  seqMode = true;
  seqSteps = [];
  document.getElementById("btnSaveSeq").classList.remove("d-none");
  renderSequenceList();
  setStatus("Modo creación activo. Agrega pasos con los controles.", "warning");
};

// ===============================================================
//  💾 GUARDAR SECUENCIA (NUEVA O EDITADA)
// ===============================================================
document.getElementById("btnSaveSeq").onclick = () => {

  if (seqSteps.length === 0) {
    setStatus("Agrega al menos un paso", "danger");
    return;
  }

  // 🔹 CASO 1: estamos editando pasos de una secuencia existente
  if (editingSeqId !== null) {
    const idSec = editingSeqId;

    // 1) Borrar todos los pasos anteriores
    sendWS(`/ws/r/borrar-pasos-secuencia/${idSec}`, (resp) => {
      const data = JSON.parse(resp);
      if (!data?.ok) {
        setStatus("Error borrando pasos anteriores", "danger");
        return;
      }

      // 2) Volver a agregar todos los pasos nuevos
      let total = seqSteps.length;
      let done = 0;

      seqSteps.forEach((p, idx) => {
        const orden = idx + 1;
        const op = p.idOperacion;
        sendWS(`/ws/r/agregar-paso/${idSec}/${orden}/${op}`, () => {
          done++;
          if (done === total) {
            setStatus("Pasos de la secuencia actualizados correctamente", "success");
            seqMode = false;
            editingSeqId = null;
            document.getElementById("btnSaveSeq").classList.add("d-none");
            cargarPasosDeSecuencia(idSec);
          }
        });
      });
    });

    return; // no seguir con lógica de creación nueva
  }

  // 🔹 CASO 2: creación de una secuencia nueva
  const nombre = prompt("Nombre de la secuencia:");
  if (!nombre) return;

  sendWS(`/ws/r/crear-secuencia/${encodeURIComponent(nombre)}?descripcion=`,
    (resp) => {

      const data = JSON.parse(resp);
      if (!data?.ok) {
        setStatus("Error creando secuencia", "danger");
        return;
      }

      const idSec = data.id_secuencia;

      let total = seqSteps.length;
      let done = 0;

      seqSteps.forEach((p, idx) => {
        const orden = idx + 1;
        const op = p.idOperacion;
        sendWS(`/ws/r/agregar-paso/${idSec}/${orden}/${op}`,
          () => {
            done++;
            if (done === total) {
              setStatus("Secuencia guardada correctamente", "success");
              seqMode = false;
              document.getElementById("btnSaveSeq").classList.add("d-none");
              cargarSecuencias();
            }
          });
      });
    });
};

// ===============================================================
//  METADATOS
// ===============================================================
function bindMeta() {
  document.getElementById("btnApplyMeta").onclick = () => {

    CAR_ID = document.getElementById("inpCartId").value.trim() || 1;
    USER_ID = document.getElementById("inpUserId").value.trim() || 1;
    API_BASE = document.getElementById("inpApiBase").value.trim();

    updateMeta();
    setStatus("Metadatos actualizados", "info");

    try { wsControl.close(); } catch {}
    setTimeout(initControlWS, 600);
  };
}

// ===============================================================
//  ⭐ FUNCIÓN PARA CARGAR PASOS (SOLO LECTURA)
// ===============================================================
function cargarPasosDeSecuencia(idSec) {
  if (!idSec) {
    document.getElementById("sequence").innerHTML = "";
    return;
  }

  sendWS(`/ws/r/obtener-pasos/${idSec}`, (resp) => {
    const data = JSON.parse(resp);
    const list = document.getElementById("sequence");
    list.innerHTML = "";

    if (!data?.pasos) return;

    data.pasos.forEach(p => {
      const li = document.createElement("li");
      li.className = "list-group-item";

      const nombre = OPERACION_NOMBRE[p.id_operacion] || `Operación ${p.id_operacion}`;

      li.textContent = `${p.orden}. ${nombre}`;
      list.appendChild(li);
    });
  });
}

// ===============================================================
//  ⭐ SELECT VELOCIDAD
// ===============================================================
function cargarVelocidades() {

  const ws = new WebSocket(API_BASE.replace(/\/+$/, "") + "/ws/r/velocidad");

  ws.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch {}

    const select = document.getElementById("speedSelect");

    if (!data?.velocidades) {
      select.innerHTML = `<option value="">Error</option>`;
      ws.close();
      return;
    }

    select.innerHTML = ``;

    data.velocidades.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id_velocidad;
      opt.textContent = `${v.nombre} (nivel ${v.nivel})`;
      select.appendChild(opt);
    });

    ws.close();
  };

  ws.onerror = () => {
    document.getElementById("speedSelect").innerHTML = `<option>Error</option>`;
  };
}

// Cambiar velocidad automáticamente
document.getElementById("speedSelect").addEventListener("change", () => {
  const id = document.getElementById("speedSelect").value;
  if (!id) return;

  sendWS(`/ws/r/cambiar-velocidad/${id}`, (resp) => {
    const data = JSON.parse(resp);

    if (data?.ok) setStatus("Velocidad cambiada correctamente", "success");
    else setStatus("No se pudo cambiar velocidad", "danger");
  });
});

// ===============================================================
// ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
//     TECLADO – movimiento + secuencias + X STOP
// ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
// ===============================================================

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

  // evitar repetición
  if (keyDownState[key]) return;
  keyDownState[key] = true;

  // ⭐ SECUENCIA: agregar paso con nombre (cuando estamos en seqMode)
  if (seqMode) {
    addStepByOp(act.op);
    setStatus("Paso agregado desde teclado", "info");
    return;
  }

  // ⭐ MODO NORMAL → aplicar acción persistente
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

// ===============================================================
//  🖱️ MOUSE – movimiento mantenido (MODO NORMAL, NO SECUENCIA)
// ===============================================================
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

// ===============================================================
//  ONLOAD
// ===============================================================
window.onload = () => {
  updateMeta();
  bindMeta();
  bindMovButtons();   // botones → solo secuencia en seqMode
  bindMouseMovement(); // botones → movimiento con mouse en modo normal
  initControlWS();

  cargarSecuencias();
  cargarVelocidades();

  document.getElementById("btnRunSeq").onclick = runSequenceRTC;

  setStatus("Listo (teclado + secuencias + velocidad)", "secondary");
};
