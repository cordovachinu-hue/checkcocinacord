/* ============================================================
   CÓRDOVA RESTAURANTE — Motor de alarmas
   Funciona 100% en el navegador: mientras esta página quede
   abierta en el PC de la estación, sonará y mostrará el aviso
   a la hora programada en data.js (SCHEDULE).
   ============================================================ */

// Tareas recordatorio adicionales (no son el checklist de mise en place)
// Alcance por tarea:
//  - Limpieza de área: TODAS las estaciones (11 am y 5 pm)
//  - Lavado de trapos: TODAS las estaciones
//  - Comida del personal: SOLO Armado / Cantador (11 am y 5 pm)
//  - Burlete del Rational: SOLO Parrilla
const REMINDER_TASKS = [
  { id: "area_clean", label: "Limpieza general del área", emoji: "🧹", times: SCHEDULE.areaCleanTimes, onlyStation: null },
  { id: "towel_wash", label: "Lavado de trapos de cocina", emoji: "🧺", times: [SCHEDULE.towelWashTime], onlyStation: null },
  { id: "staff_meal", label: "Servir la comida del personal", emoji: "🍽️", times: SCHEDULE.staffMealTimes, onlyStation: "armado" },
  { id: "burlete", label: "Limpieza del burlete del Rational", emoji: "🧽", times: [SCHEDULE.burleteTime], onlyStation: "parrilla" },
];

// Envoltorio seguro de localStorage: si el navegador lo bloquea (ej. al
// abrir el archivo directamente en vez de por https), la app no se rompe,
// simplemente no recuerda qué avisos ya sonaron durante esta sesión.
const safeStorage = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, val) { try { localStorage.setItem(key, val); } catch (e) {} },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
};

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function minutesSince(hm) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0);
  return Math.floor((d - target) / 60000);
}

function fmtDatePretty() {
  return new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ---------- Sonido ----------
// beep(): aviso corto (usado para nags/backgound). sirenStart()/sirenStop():
// alarma tipo sirena, fuerte y en bucle, para cuando hay que llamar la
// atención de verdad y que nadie pueda "no darse cuenta".
function beep(times = 2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
      t += 0.5;
    }
  } catch (e) {
    console.warn("No se pudo reproducir sonido de alarma:", e);
  }
}

let __sirenCtx = null;
let __sirenTimer = null;

// Golpe de sirena tipo alarma real: barrido de frecuencia (sube y baja)
// con onda "sawtooth" (más áspera que una onda senoidal/cuadrada normal)
// y volumen casi al máximo — pensado para que sea imposible de ignorar.
function _sirenHit() {
  try {
    if (!__sirenCtx) __sirenCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = __sirenCtx;
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    const dur = 1.05;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(650, t0);
    osc.frequency.linearRampToValueAtTime(1600, t0 + dur / 2);
    osc.frequency.linearRampToValueAtTime(650, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.04);
    gain.gain.setValueAtTime(0.9, t0 + dur - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);

    // Segunda voz un poco más aguda y desfasada: da textura de sirena real
    // (dos tonos batiendo entre sí) en vez de un tono plano.
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(900, t0);
    osc2.frequency.linearRampToValueAtTime(1900, t0 + dur / 2);
    osc2.frequency.linearRampToValueAtTime(900, t0 + dur);
    gain2.gain.setValueAtTime(0.0001, t0);
    gain2.gain.exponentialRampToValueAtTime(0.45, t0 + 0.04);
    gain2.gain.setValueAtTime(0.45, t0 + dur - 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(t0);
    osc2.stop(t0 + dur + 0.02);
  } catch (e) {
    console.warn("No se pudo reproducir la sirena:", e);
  }
}

function sirenStart() {
  sirenStop();
  _sirenHit();
  // Casi continua: cada golpe dura ~1.05s y el siguiente arranca a 1.1s,
  // así queda un sonido de sirena prácticamente ininterrumpido.
  __sirenTimer = setInterval(_sirenHit, 1100);
}

function sirenStop() {
  if (__sirenTimer) {
    clearInterval(__sirenTimer);
    __sirenTimer = null;
  }
}

// Reintenta "despertar" el audio con la primera interacción del usuario
// (los navegadores bloquean sonido sin interacción previa). Con un solo
// clic en cualquier parte de la página durante el turno, queda habilitado.
document.addEventListener("click", () => {
  if (__sirenCtx && __sirenCtx.state === "suspended") __sirenCtx.resume();
}, { once: false });

function notifyBrowser(title, body) {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "assets/logo.png" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }
}

// ---------- Overlay visual ----------
function showAlarmOverlay({ emoji, title, message, actionLabel, onAction, secondaryLabel, onSecondary }) {
  const existing = document.getElementById("alarm-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "alarm-overlay";
  overlay.className = "alarm-overlay";
  overlay.innerHTML = `
    <div class="alarm-box alarm-box-siren">
      <div class="emoji">${emoji}</div>
      <h3>${title}</h3>
      <p>${message}</p>
      <p class="alarm-hint">🔊 Esta alarma seguirá sonando hasta que respondas.</p>
      <div style="display:flex; gap:10px; justify-content:center; margin-top:18px;">
        ${secondaryLabel ? `<button class="btn btn-secondary" id="alarm-secondary">${secondaryLabel}</button>` : ""}
        <button class="btn btn-primary" id="alarm-action">${actionLabel || "Entendido"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  sirenStart();
  const close = (cb) => {
    sirenStop();
    overlay.remove();
    if (cb) cb();
  };
  document.getElementById("alarm-action").onclick = () => close(onAction);
  if (secondaryLabel) {
    document.getElementById("alarm-secondary").onclick = () => close(onSecondary);
  }
}

// ---------- Marcado de tareas ----------
function taskDoneKey(taskId, time) {
  return `task_done:${todayKey()}:${taskId}:${time}`;
}

function markTaskDone(stationId, task, time) {
  safeStorage.set(taskDoneKey(task.id, time), "1");
  if (typeof db !== "undefined" && db) {
    db.collection("tasks").add({
      date: todayKey(),
      station: stationId,
      taskId: task.id,
      label: task.label,
      time,
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch((e) => console.warn("No se pudo guardar la tarea en Firestore", e));
  }
}

function isTaskDone(taskId, time) {
  return safeStorage.get(taskDoneKey(taskId, time)) === "1";
}

function checklistDoneKey(stationId, turno) {
  return `checklist_done:${todayKey()}:${stationId}:${turno}`;
}

function markChecklistDone(stationId, turno) {
  safeStorage.set(checklistDoneKey(stationId, turno), "1");
}

function isChecklistDone(stationId, turno) {
  return safeStorage.get(checklistDoneKey(stationId, turno)) === "1";
}

// ---------- Motor principal (para estacion.html) ----------
function initStationAlarms(stationId) {
  if ("Notification" in window && Notification.permission === "default") {
    // Se pide el permiso silenciosamente; si el usuario lo niega, igual
    // funcionan el sonido y el aviso en pantalla.
    Notification.requestPermission();
  }

  const firedKey = (eventKey) => `fired:${todayKey()}:${eventKey}`;

  function checkOnce() {
    const hm = nowHM();

    // 1) Checklist de mise en place
    SCHEDULE.checklistTimes.forEach((t) => {
      const key = firedKey(`checklist:${t}`);
      if (hm === t && !safeStorage.get(key)) {
        safeStorage.set(key, "1");
        notifyBrowser("Córdova · Checklist de mise en place", `Es hora de diligenciar el checklist (${t}).`);
        showAlarmOverlay({
          emoji: "⏰",
          title: "Hora del checklist de mise en place",
          message: `Turno de las ${t}. Diligencia el checklist completo de tu estación ahora.`,
          actionLabel: "Ir al checklist",
          onAction: () => {
            document.getElementById("form-top")?.scrollIntoView({ behavior: "smooth" });
          },
        });
      }
    });

    // Nag: si pasó la hora + minutos de gracia y no se ha marcado como hecho,
    // vuelve a sonar la alarma COMPLETA (no solo un beep) cada 10 min — la
    // idea es que sea imposible de pasar por alto.
    SCHEDULE.checklistTimes.forEach((t) => {
      const mins = minutesSince(t);
      if (mins >= SCHEDULE.graceMinutes && mins < 600 && !isChecklistDone(stationId, t)) {
        const nagKey = firedKey(`nag:${t}:${Math.floor(mins / 10)}`);
        if (!safeStorage.get(nagKey)) {
          safeStorage.set(nagKey, "1");
          notifyBrowser("Córdova · Checklist atrasado", `El checklist de las ${t} sigue sin diligenciarse.`);
          showAlarmOverlay({
            emoji: "🚨",
            title: "¡Checklist atrasado!",
            message: `Ya pasaron ${mins} minutos desde las ${t} y el checklist de mise en place no se ha enviado.`,
            actionLabel: "Ir al checklist ahora",
            onAction: () => document.getElementById("form-top")?.scrollIntoView({ behavior: "smooth" }),
          });
        }
      }
    });

    // 2) Tareas recordatorio (área, comida, burlete, trapos)
    REMINDER_TASKS.forEach((task) => {
      if (task.onlyStation && task.onlyStation !== stationId) return;
      task.times.forEach((t) => {
        const key = firedKey(`task:${task.id}:${t}`);
        if (hm === t && !safeStorage.get(key)) {
          safeStorage.set(key, "1");
          notifyBrowser(`Córdova · ${task.label}`, `Recordatorio de las ${t}.`);
          showAlarmOverlay({
            emoji: task.emoji,
            title: task.label,
            message: `Recordatorio de las ${t}. Márcalo como hecho cuando lo completes.`,
            actionLabel: "Marcar como hecho",
            onAction: () => markTaskDone(stationId, task, t),
            secondaryLabel: "Recordar en 10 min",
            onSecondary: () => safeStorage.remove(key),
          });
        }
      });

      // Nag de tareas: si ya pasó la hora + minutos de gracia y nadie la
      // marcó como hecha, vuelve a insistir cada 10 min.
      task.times.forEach((t) => {
        const mins = minutesSince(t);
        if (mins >= SCHEDULE.graceMinutes && mins < 240 && !isTaskDone(task.id, t)) {
          const nagKey = firedKey(`tasknag:${task.id}:${t}:${Math.floor(mins / 10)}`);
          if (!safeStorage.get(nagKey)) {
            safeStorage.set(nagKey, "1");
            showAlarmOverlay({
              emoji: task.emoji,
              title: `Pendiente: ${task.label}`,
              message: `Han pasado ${mins} minutos desde las ${t} y esta tarea no se ha marcado como hecha.`,
              actionLabel: "Marcar como hecho",
              onAction: () => markTaskDone(stationId, task, t),
              secondaryLabel: "Recordar en 10 min",
            });
          }
        }
      });
    });
  }

  checkOnce();
  setInterval(checkOnce, 15000);

  // Barra pegajosa de estado (se actualiza cada 30s)
  function renderStickyBar() {
    const el = document.getElementById("sticky-alert-slot");
    if (!el) return;
    const hm = nowHM();
    const overdue = SCHEDULE.checklistTimes.filter((t) => minutesSince(t) >= SCHEDULE.graceMinutes && minutesSince(t) < 600 && !isChecklistDone(stationId, t));
    if (overdue.length > 0) {
      el.innerHTML = `<div class="sticky-alert">⏰ Falta diligenciar el checklist de las ${overdue.join(" y ")}. <button class="btn btn-secondary" onclick="document.getElementById('form-top').scrollIntoView({behavior:'smooth'})">Completar ahora</button></div>`;
    } else {
      el.innerHTML = "";
    }
  }
  renderStickyBar();
  setInterval(renderStickyBar, 30000);
}
