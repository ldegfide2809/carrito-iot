// velocidad.js
// Select de velocidad + carga desde servidor

function cargarVelocidades() {
  const ws = new WebSocket(API_BASE.replace(/\/+$/, "") + "/ws/r/velocidad");

  ws.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch (e) {}

    const select = document.getElementById("speedSelect");
    if (!select) {
      ws.close();
      return;
    }

    if (!data?.velocidades) {
      select.innerHTML = `<option value="">Error</option>`;
      ws.close();
      return;
    }

    select.innerHTML = "";

    data.velocidades.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id_velocidad;
      opt.textContent = `${v.nombre} (nivel ${v.nivel})`;
      select.appendChild(opt);
    });

    ws.close();
  };

  ws.onerror = () => {
    const select = document.getElementById("speedSelect");
    if (select) {
      select.innerHTML = `<option>Error</option>`;
    }
  };
}

function bindVelocidadUI() {
  const select = document.getElementById("speedSelect");
  if (!select) return;

  select.addEventListener("change", () => {
    const id = select.value;
    if (!id) return;

    sendWS(`/ws/r/cambiar-velocidad/${id}`, (resp) => {
      const data = JSON.parse(resp);

      if (data?.ok) setStatus("Velocidad cambiada correctamente", "success");
      else setStatus("No se pudo cambiar velocidad", "danger");
    });
  });
}
