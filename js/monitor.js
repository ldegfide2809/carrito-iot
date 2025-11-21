// ------------------------------------------------------
// Monitor del Carrito IoT (WebSocket puro)
// Compatible con ws_server.py sin modificar el servidor
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const inpApiBase = document.getElementById("inpApiBase");
  const btnConnect = document.getElementById("btnConnect");
  const metaApi = document.getElementById("metaApi");
  const metaConn = document.getElementById("metaConn");
  const btnRefresh = document.getElementById("btnRefresh");
  const btnClear = document.getElementById("btnClear");
  const logBox = document.getElementById("log");

  // 🔹 Ahora por defecto apunta a tu servidor público
  let WS_BASE = "ws://54.167.184.108:5500";
  let wsMov = null;  // stream /ws/stream/ultimo-movimiento
  let wsObs = null;  // stream /ws/stream/obstaculo-json

  const MAX_HIST = 10;
  const histMov = [];   // {texto, accion, ts}
  const histObs = [];   // {id, ts}

  // 🔹 Mapeo de operaciones (id → texto)
  const MOVIMIENTOS = {
    1: "Adelante",
    2: "Atrás",
    3: "Detener",
    4: "Vuelta adelante derecha",
    5: "Vuelta adelante izquierda",
    6: "Vuelta atrás derecha",
    7: "Vuelta atrás izquierda",
    8: "Giro 90° derecha",
    9: "Giro 90° izquierda",
    10: "Giro 360° derecha",
    11: "Giro 360° izquierda"
  };

  // Añadir línea al log
  const addLog = (text, type = "secondary") => {
    const entry = document.createElement("div");
    entry.className = `log-entry text-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  };

  // Normalizar la URL base a ws:// o wss://
  function normalizaBaseUrl(raw) {
    let url = (raw || "").trim();
    if (!url) return WS_BASE;

    if (url.startsWith("http://")) {
      url = "ws://" + url.slice(7);
    } else if (url.startsWith("https://")) {
      url = "wss://" + url.slice(8);
    } else if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
      // Si no tiene esquema, asumimos ws://
      url = "ws://" + url;
    }

    // Quitar / al final
    url = url.replace(/\/+$/, "");
    return url;
  }

  function actualizarEstadoConexion(conectado) {
    if (conectado) {
      metaConn.className = "badge bg-success status-badge";
      metaConn.textContent = "Conectado";
    } else {
      metaConn.className = "badge bg-danger status-badge";
      metaConn.textContent = "Desconectado";
    }
  }

  // Cierra sockets previos si existen
  function cerrarSockets() {
    if (wsMov) {
      try { wsMov.close(); } catch {}
      wsMov = null;
    }
    if (wsObs) {
      try { wsObs.close(); } catch {}
      wsObs = null;
    }
    actualizarEstadoConexion(false);
  }

  // Conectar a los streams del servidor
  function conectarWebSockets() {
    cerrarSockets();

    WS_BASE = normalizaBaseUrl(inpApiBase.value || WS_BASE);
    metaApi.textContent = WS_BASE;

    const qs = "?dispositivo=1&usuario=1";

    // ===== Stream de último movimiento =====
    try {
      wsMov = new WebSocket(`${WS_BASE}/ws/stream/ultimo-movimiento${qs}`);

      wsMov.onopen = () => {
        addLog("🟢 Conectado al stream de movimientos", "success");
        actualizarEstadoConexion(true);
      };

      wsMov.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }

        // El servidor primero manda {"ok": true, "stream": "..."} → lo ignoramos
        if (!data) return;
        if (data.operacion == null && !data.accion) return;

        const textoMovimiento = MOVIMIENTOS[data.operacion] || `ID ${data.operacion}`;
        const accion = data.accion ? ` (${data.accion})` : "";

        addLog(`🚗 Movimiento: ${textoMovimiento}${accion}`, "primary");

        histMov.push({
          texto: textoMovimiento,
          accion,
          ts: new Date().toISOString()
        });
        if (histMov.length > MAX_HIST) histMov.shift();
      };

      wsMov.onerror = () => {
        addLog("⚠️ Error en WebSocket de movimientos", "danger");
      };

      wsMov.onclose = () => {
        addLog("🔴 Desconectado del stream de movimientos", "danger");
        actualizarEstadoConexion(false);
      };
    } catch (e) {
      addLog("🚫 No se pudo conectar al stream de movimientos", "danger");
    }

    // ===== Stream de obstáculos JSON =====
    try {
      wsObs = new WebSocket(`${WS_BASE}/ws/stream/obstaculo-json${qs}`);

      wsObs.onopen = () => {
        addLog("🟢 Conectado al stream de obstáculos", "success");
      };

      wsObs.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }

        // Igual, ignorar el primer {"ok": true, "stream": "..."}
        if (data.tipo !== "obstaculo") return;

        const idObs = data.id_obstaculo ?? "?";
        addLog(`⚠️ Obstáculo detectado: ID ${idObs}`, "warning");

        histObs.push({
          id: idObs,
          ts: data.timestamp || new Date().toISOString()
        });
        if (histObs.length > MAX_HIST) histObs.shift();
      };

      wsObs.onerror = () => {
        addLog("⚠️ Error en WebSocket de obstáculos", "danger");
      };

      wsObs.onclose = () => {
        addLog("🔴 Desconectado del stream de obstáculos", "danger");
      };
    } catch (e) {
      addLog("🚫 No se pudo conectar al stream de obstáculos", "danger");
    }
  }

  // Mostrar resumen de los últimos X movimientos/obstáculos (en esta sesión)
  function mostrarHistorialLocal() {
    addLog("📘 Resumen de los últimos movimientos (sesión actual):", "info");

    if (histMov.length === 0) {
      addLog("Sin movimientos registrados aún.", "secondary");
    } else {
      histMov.forEach(m => {
        addLog(`➡️ ${m.texto}${m.accion || ""}`, "dark");
      });
    }

    if (histObs.length > 0) {
      addLog("📙 Últimos obstáculos (sesión actual):", "info");
      histObs.forEach(o => {
        addLog(`⚠️ Obstáculo ID ${o.id}`, "warning");
      });
    }
  }

  // BOTONES
  btnConnect.addEventListener("click", () => {
    conectarWebSockets();
    // Mostramos lo que haya en el histórico local (al inicio estará vacío)
    mostrarHistorialLocal();
  });

  btnRefresh.addEventListener("click", mostrarHistorialLocal);

  btnClear.addEventListener("click", () => {
    logBox.innerHTML = "";
  });

  addLog("Monitor listo. Ingresa la URL WebSocket del servidor y presiona Conectar.", "secondary");

  // Opcional: rellenar el input con el valor por defecto
  inpApiBase.value = WS_BASE;
  metaApi.textContent = WS_BASE;
});
