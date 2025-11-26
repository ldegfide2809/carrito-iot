// sequences.js
// Manejo de secuencias (crear, editar, borrar, ejecutar)

// Mapa de nombres para renderizar pasos
const OPERACION_NOMBRE = {
  1: "Adelante",
  2: "Atrás",
  3: "Detener",
  4: "Adelante-Derecha",
  5: "Adelante-Izquierda",
  6: "Atrás-Derecha",
  7: "Atrás-Izquierda",
  8: "Giro 90° Derecha",
  9: "Giro 90° Izquierda",
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
  if (!list) return;

  list.innerHTML = "";

  seqSteps.forEach((p, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";

    const nombre = OPERACION_NOMBRE[p.idOperacion] || `Operación ${p.idOperacion}`;

    const spanText = document.createElement("span");
    spanText.textContent = `${index + 1}. ${nombre}`;
    li.appendChild(spanText);

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

// ▶️ EJECUTAR SECUENCIA RTC
function runSequenceRTC() {
  const sel = document.getElementById("selSequences");
  const id = sel ? sel.value : "";

  if (!id) {
    setStatus("Selecciona secuencia", "warning");
    return;
  }

  movimientosBloqueados = true;

  sendWS(`/ws/r/ejecutar-secuencia-rtc/${id}?delay=3`,
    (resp) => {
      movimientosBloqueados = false;

      setStatus("Secuencia RTC ejecutada", "success");

      try {
        if (wsControl && wsControl.readyState === 1) {
          wsControl.send(JSON.stringify({ accion: "detener" }));
        }
      } catch (e) {
        console.error("Error enviando detener al finalizar secuencia", e);
      }
    });
}

// 📌 LISTAR SECUENCIAS
function cargarSecuencias() {
  sendWS("/ws/r/listar-secuencias", (resp) => {
    const data = JSON.parse(resp);
    const sel = document.getElementById("selSequences");
    if (!sel) return;

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

// ⭐ FUNCIÓN PARA CARGAR PASOS (SOLO LECTURA)
function cargarPasosDeSecuencia(idSec) {
  const list = document.getElementById("sequence");
  if (!list) return;

  if (!idSec) {
    list.innerHTML = "";
    return;
  }

  sendWS(`/ws/r/obtener-pasos/${idSec}`, (resp) => {
    const data = JSON.parse(resp);
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

// ⭐ BOTONES / SELECT DE SECUENCIAS
function bindSequenceUI() {
  const sel    = document.getElementById("selSequences");
  const btnDel = document.getElementById("btnDeleteSeq");
  const btnNew = document.getElementById("btnNewSeq");
  const btnEdit = document.getElementById("btnEditSeq");
  const btnSave = document.getElementById("btnSaveSeq");

  // cambio en select
  if (sel) {
    sel.addEventListener("change", () => {
      const id = sel.value;

      if (btnDel) {
        if (id) btnDel.classList.remove("d-none");
        else btnDel.classList.add("d-none");
      }

      if (btnNew) btnNew.disabled = !!id;

      if (btnEdit) {
        if (id) btnEdit.classList.remove("d-none");
        else btnEdit.classList.add("d-none");
      }

      editingSeqId = null;
      seqMode = false;

      cargarPasosDeSecuencia(id);
    });
  }

  // borrar secuencia
  if (btnDel) {
    btnDel.onclick = () => {
      const id = sel ? sel.value : "";
      if (!id) return;

      if (!confirm("¿Seguro que deseas borrar esta secuencia?")) return;

      sendWS(`/ws/r/borrar-secuencia-completa/${id}`, (resp) => {
        const data = JSON.parse(resp);

        if (!data?.ok) {
          setStatus("Error al borrar secuencia", "danger");
          return;
        }

        setStatus("Secuencia eliminada correctamente", "success");

        const list = document.getElementById("sequence");
        if (list) list.innerHTML = "";

        btnDel.classList.add("d-none");

        cargarSecuencias();
      });
    };
  }

  // editar secuencia
  if (btnEdit) {
    btnEdit.onclick = () => {
      const id = sel ? sel.value : "";
      if (!id) {
        setStatus("Selecciona una secuencia para modificar sus pasos", "warning");
        return;
      }

      editingSeqId = id;
      seqMode = true;
      seqSteps = [];
      if (btnSave) btnSave.classList.remove("d-none");

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
          seqSteps.sort((a, b) => a.orden - b.orden);
          seqSteps.forEach((p, i) => p.orden = i + 1);
        }

        renderSequenceList();
        setStatus("Modo edición de pasos activo. Puedes mover o borrar pasos y luego guardar.", "warning");
      });
    };
  }

  // nueva secuencia
  if (btnNew) {
    btnNew.onclick = () => {
      const selVal = sel ? sel.value : "";
      if (selVal) {
        setStatus("Quita la selección de secuencia antes de crear una nueva", "warning");
        return;
      }

      editingSeqId = null;
      seqMode = true;
      seqSteps = [];
      if (btnSave) btnSave.classList.remove("d-none");
      renderSequenceList();
      setStatus("Modo creación activo. Agrega pasos con los controles.", "warning");
    };
  }

  // guardar (nueva o editada)
  if (btnSave) {
    btnSave.onclick = () => {
      if (seqSteps.length === 0) {
        setStatus("Agrega al menos un paso", "danger");
        return;
      }

      // editar existente
      if (editingSeqId !== null) {
        const idSec = editingSeqId;

        sendWS(`/ws/r/borrar-pasos-secuencia/${idSec}`, (resp) => {
          const data = JSON.parse(resp);
          if (!data?.ok) {
            setStatus("Error borrando pasos anteriores", "danger");
            return;
          }

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
                btnSave.classList.add("d-none");
                cargarPasosDeSecuencia(idSec);
              }
            });
          });
        });

        return;
      }

      // crear nueva
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
            sendWS(`/ws/r/agregar-paso/${idSec}/${orden}/${op}`, () => {
              done++;
              if (done === total) {
                setStatus("Secuencia guardada correctamente", "success");
                seqMode = false;
                btnSave.classList.add("d-none");
                cargarSecuencias();
              }
            });
          });
        });
    };
  }
}

// 🚫 BOTONES — SOLO PARA SECUENCIAS (NO MOVIMIENTO EN MODO NORMAL)
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
    if (!btn) continue;

    btn.onclick = () => {
      if (!seqMode) return;

      const act = ACTIONS[key];
      if (!act) return;

      addStepByOp(act.op);
    };
  }
}
