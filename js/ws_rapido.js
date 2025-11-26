// ws_rapido.js
// Modo comando rápido (WebSocket efímero)

function sendWS(path, onReply) {
  const url = buildWS(path);
  const ws = new WebSocket(url);

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
    } catch (e) {
      // silencioso
    }

    ws.close();
  };

  ws.onerror = () => setStatus("Error en WebSocket rápido", "danger");
}
