// main.js
// Punto de entrada de la app del carrito

window.onload = () => {
  updateMeta();
  bindMeta();

  bindSequenceUI();
  bindMovButtons();
  bindVelocidadUI();
  bindMouseMovement();

  initControlWS();

  cargarSecuencias();
  cargarVelocidades();

  const btnRun = document.getElementById("btnRunSeq");
  if (btnRun) {
    btnRun.onclick = runSequenceRTC;
  }

  setStatus("Listo (teclado + secuencias + velocidad)", "secondary");
};
