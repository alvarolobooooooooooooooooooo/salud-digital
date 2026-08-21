// Splash nativo de Salud Digital.
// Si hay conexión, redirige a /login.html; si no, muestra la pantalla offline y
// reintenta automáticamente cuando vuelve la red.
//
// /login.html (no la raíz, que es la landing) decide solo el destino: al cargar
// llama a /api/auth/me y, si HAY sesión, redirige por rol
// (super_admin→/admin.html, receptionist→/recepcion-inicio.html, resto→
// /dashboard.html); si NO hay sesión, muestra el formulario de login. Un overlay
// (#authLoader) cubre la pantalla durante la verificación para que no parpadee.
const APP_URL = "https://portalsaluddigital.com/login.html";

const connecting = document.getElementById("state-connecting");
const offline = document.getElementById("state-offline");
const retryBtn = document.getElementById("retry");

function show(which) {
  connecting.classList.toggle("hidden", which !== "connecting");
  offline.classList.toggle("hidden", which !== "offline");
}

function connect() {
  if (navigator.onLine) {
    show("connecting");
    // replace(): "atrás" no debe volver a este splash.
    window.location.replace(APP_URL);
  } else {
    show("offline");
  }
}

window.addEventListener("online", connect);
window.addEventListener("offline", () => show("offline"));
if (retryBtn) retryBtn.addEventListener("click", connect);

// Respaldo: por si el evento 'online' no dispara, reintenta cada 4s.
setInterval(() => {
  if (navigator.onLine && !offline.classList.contains("hidden")) connect();
}, 4000);

connect();
