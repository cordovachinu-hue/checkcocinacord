/* ============================================================
   CÓRDOVA RESTAURANTE — Registro de Service Worker + indicador
   de conexión. Se incluye en las 3 páginas.
   ============================================================ */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("No se pudo registrar el service worker:", e));
  });
}

function renderConnStatus() {
  const el = document.getElementById("conn-status");
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = "🟢 En línea";
    el.className = "conn-pill online";
  } else {
    el.textContent = "🔴 Sin conexión";
    el.className = "conn-pill offline";
  }
}
window.addEventListener("online", renderConnStatus);
window.addEventListener("offline", renderConnStatus);
document.addEventListener("DOMContentLoaded", renderConnStatus);
setInterval(renderConnStatus, 15000);
