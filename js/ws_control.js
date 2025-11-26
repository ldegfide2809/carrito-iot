// ws_control.js
// WebSocket persistente para movimiento

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
