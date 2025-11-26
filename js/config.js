// config.js
// Metadatos y utilidades globales para el carrito

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
  const cartEl = document.getElementById("metaCart");
  const userEl = document.getElementById("metaUser");
  const apiEl  = document.getElementById("metaApi");
  const badge  = document.getElementById("metaConn");

  if (cartEl) cartEl.textContent = CAR_ID;
  if (userEl) userEl.textContent = USER_ID;
  if (apiEl)  apiEl.textContent = API_BASE;

  if (!badge) return;

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
  if (!box) return;
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
//  METADATOS – BIND BOTÓN APLICAR
// ===============================================================
function bindMeta() {
  const btn = document.getElementById("btnApplyMeta");
  if (!btn) return;

  btn.onclick = () => {
    CAR_ID = document.getElementById("inpCartId").value.trim() || 1;
    USER_ID = document.getElementById("inpUserId").value.trim() || 1;
    API_BASE = document.getElementById("inpApiBase").value.trim() || API_BASE;

    updateMeta();
    setStatus("Metadatos actualizados", "info");

    try { if (wsControl) wsControl.close(); } catch (e) {}
    setTimeout(initControlWS, 600);
  };
}
