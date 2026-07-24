/* ============================================================
   CÓRDOVA RESTAURANTE — Lógica de la página de estación
   ============================================================ */

const pageLoadedAt = Date.now();

const params = new URLSearchParams(window.location.search);
const stationId = params.get("station");
const station = STATIONS.find((s) => s.id === stationId);

if (!station) {
  document.body.innerHTML = `<div class="wrap"><div class="card"><h2>Estación no encontrada</h2><p><a href="index.html">← Volver</a></p></div></div>`;
  throw new Error("Estación inválida");
}

document.title = `Córdova · ${station.name}`;
document.getElementById("station-title").textContent = `${station.icon} ${station.name}`;

// Llenar el selector de responsables con la lista fija de personal
const respSelect = document.getElementById("f-responsable");
STAFF_NAMES.forEach((name) => {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  respSelect.appendChild(opt);
});

// Reloj
function renderClock() {
  const now = new Date();
  document.getElementById("clock-time").textContent =
    String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  document.getElementById("clock-date").textContent =
    now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}
renderClock();
setInterval(renderClock, 1000 * 10);

// Render checklist items
const answers = {};
const list = document.getElementById("items-list");
station.items.forEach((it) => {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <div class="item-label">${it.label}${it.critical ? '<span class="critical-tag">CRÍTICO</span>' : ""}</div>
    <div class="toggle-group" data-item="${it.id}">
      <button type="button" class="toggle-btn yes" data-val="si">Sí</button>
      <button type="button" class="toggle-btn no" data-val="no">No</button>
      <button type="button" class="toggle-btn na" data-val="na">N/A</button>
    </div>
  `;
  list.appendChild(row);
});

list.querySelectorAll(".toggle-group").forEach((group) => {
  const itemId = group.dataset.item;
  group.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      answers[itemId] = btn.dataset.val;
    });
  });
});

function todayKeyLocal() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* ============================================================
   Cola local (modo sin internet)
   Si no hay conexión, o Firestore falla al enviar, el checklist
   NO se pierde: se guarda en localStorage y se reintenta enviar
   automáticamente cuando vuelva la conexión.
   ============================================================ */
const QUEUE_KEY = "cordova_offline_queue";

function readQueue() {
  try {
    return JSON.parse(safeStorage.get(QUEUE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
function writeQueue(arr) {
  safeStorage.set(QUEUE_KEY, JSON.stringify(arr));
  renderQueueBadge();
}
function queueSubmission(payload) {
  const q = readQueue();
  q.push(payload);
  writeQueue(q);
}

function renderQueueBadge() {
  const el = document.getElementById("queue-alert-slot");
  if (!el) return;
  const q = readQueue();
  if (q.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="sticky-alert warn">📴 ${q.length} registro(s) guardados localmente, pendientes por enviar cuando vuelva la conexión.</div>`;
}

async function flushQueue() {
  if (!navigator.onLine) return;
  const q = readQueue();
  if (q.length === 0) return;
  const remaining = [];
  for (const payload of q) {
    try {
      await db.collection("checklists").add(payload);
    } catch (e) {
      remaining.push(payload);
    }
  }
  writeQueue(remaining);
  if (remaining.length === 0) console.info("Cola sincronizada con Firestore.");
}

window.addEventListener("online", flushQueue);
setInterval(flushQueue, 30000);
document.addEventListener("DOMContentLoaded", () => {
  renderQueueBadge();
  flushQueue();
});

document.getElementById("btn-submit").addEventListener("click", async () => {
  const responsable = document.getElementById("f-responsable").value.trim();
  const turno = document.getElementById("f-turno").value;
  const inspector = document.getElementById("f-inspector").value.trim();
  const observaciones = document.getElementById("f-observaciones").value.trim();
  const fileInput = document.getElementById("f-evidencia");
  const msg = document.getElementById("submit-msg");
  const online = navigator.onLine;

  if (!responsable) return (msg.textContent = "⚠️ Escribe el nombre del responsable."), (msg.style.color = "var(--brand-red)");
  if (!turno) return (msg.textContent = "⚠️ Selecciona el turno."), (msg.style.color = "var(--brand-red)");

  const missing = station.items.filter((it) => !answers[it.id]);
  if (missing.length > 0) {
    msg.style.color = "var(--brand-red)";
    msg.textContent = `⚠️ Faltan ${missing.length} preguntas por responder.`;
    return;
  }
  // La foto de evidencia es opcional: si Storage no está activado en tu
  // proyecto de Firebase, simplemente no se sube y el checklist se envía igual.

  document.getElementById("btn-submit").disabled = true;
  msg.style.color = "var(--brand-wood-dark)";
  msg.textContent = online ? "Enviando…" : "Sin conexión: guardando localmente…";

  const itemsPayload = station.items.map((it) => ({
    id: it.id,
    label: it.label,
    critical: !!it.critical,
    answer: answers[it.id],
  }));
  const negativeCount = itemsPayload.filter((i) => i.answer === "no").length;
  const criticalNegativeCount = itemsPayload.filter((i) => i.answer === "no" && i.critical).length;

  const mins = minutesSince(turno);
  const onTime = mins <= SCHEDULE.graceMinutes;

  // ---- Velocidad de diligenciamiento ----
  // Si alguien "llena" un checklist de 20+ preguntas en 10 segundos, es
  // evidencia de que no lo está leyendo. 3 segundos por pregunta como
  // mínimo razonable para leer y decidir cada respuesta.
  const fillSeconds = Math.round((Date.now() - pageLoadedAt) / 1000);
  const minExpectedSeconds = station.items.length * 3;
  const rushedFill = fillSeconds < minExpectedSeconds;

  let evidenciaURL = null;
  if (online) {
    try {
      if (storage && fileInput.files[0]) {
        const file = fileInput.files[0];
        const path = `evidencias/${station.id}/${todayKeyLocal()}/${Date.now()}_${file.name}`;
        const ref = storage.ref().child(path);
        await ref.put(file);
        evidenciaURL = await ref.getDownloadURL();
      }
    } catch (e) {
      console.warn("No se pudo subir la evidencia (revisa Firebase Storage). Se guarda el checklist sin foto.", e);
    }
  }

  const payload = {
    date: todayKeyLocal(),
    station: station.id,
    stationName: station.name,
    turno,
    responsable,
    inspector: inspector || null,
    items: itemsPayload,
    negativeCount,
    criticalNegativeCount,
    onTime,
    fillSeconds,
    rushedFill,
    observaciones: observaciones || null,
    evidenciaURL,
    createdAtMs: Date.now(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  // Marcamos como hecho localmente de una vez: la persona SÍ lo diligenció,
  // así que la alarma de "atrasado" debe parar aunque el envío quede
  // pendiente de sincronizar por falta de internet.
  markChecklistDone(station.id, turno);

  if (!online) {
    queueSubmission(payload);
    msg.style.color = "var(--brand-gold)";
    msg.textContent = "📴 Sin internet: se guardó en este PC y se enviará solo cuando vuelva la conexión.";
    document.getElementById("sticky-alert-slot").innerHTML = "";
    setTimeout(() => window.location.reload(), 3000);
    return;
  }

  try {
    await db.collection("checklists").add(payload);
    msg.style.color = "var(--brand-green)";
    msg.textContent = "✅ Checklist enviado correctamente. ¡Gracias!";
    document.getElementById("sticky-alert-slot").innerHTML = "";
    setTimeout(() => window.location.reload(), 2500);
  } catch (e) {
    console.warn("Falló el envío en línea, se guarda en cola local para reintentar:", e);
    queueSubmission(payload);
    msg.style.color = "var(--brand-gold)";
    msg.textContent = "⚠️ No se pudo enviar ahora mismo: se guardó localmente y se reintentará solo.";
    document.getElementById("sticky-alert-slot").innerHTML = "";
    setTimeout(() => window.location.reload(), 3000);
  }
});

// Botón para reiniciar el estado local de hoy (alarmas/tareas marcadas en
// este PC). Solo afecta esta estación/PC, no borra lo ya enviado a Firestore.
const resetBtn = document.getElementById("btn-reset-today");
if (resetBtn) {
  resetBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const ok = window.confirm(
      "¿Reiniciar el estado de hoy en esta estación?\n\nEsto borra las alarmas ya sonadas y las tareas/checklist marcados como hechos HOY en este PC, para volver a empezar de cero. No borra nada de lo ya enviado al dashboard."
    );
    if (!ok) return;
    const count = resetTodayLocalState(station.id);
    alert(`Listo. Se reinició el estado local de hoy (${count} registro(s) borrados). La página se va a recargar.`);
    window.location.reload();
  });
}

// Iniciar motor de alarmas para esta estación
initStationAlarms(station.id);
