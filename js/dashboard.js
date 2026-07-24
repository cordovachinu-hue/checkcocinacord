/* ============================================================
   CÓRDOVA RESTAURANTE — Dashboard gerencial
   ============================================================ */

// onlyStation debe coincidir con lo definido en js/alarms.js (REMINDER_TASKS)
const TASK_SLOTS = [
  { taskId: "area_clean", time: "11:00", col: 0, onlyStation: null },
  { taskId: "staff_meal", time: "11:00", col: 1, onlyStation: "armado" },
  { taskId: "area_clean", time: "17:00", col: 2, onlyStation: null },
  { taskId: "staff_meal", time: "17:00", col: 3, onlyStation: "armado" },
  { taskId: "burlete", time: "15:00", col: 4, onlyStation: "parrilla" },
  { taskId: "towel_wash", time: "15:00", col: 5, onlyStation: null },
];

function todayKeyD() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtDuration(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function minutesSinceD(hm) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0);
  return Math.floor((d - target) / 60000);
}
function beepD(times = 1) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
      t += 0.4;
    }
  } catch (e) {}
}

// ---------- Acceso con clave simple (sin cuentas de Firebase) ----------
// La sesión se guarda en este navegador (sessionStorage) mientras la
// pestaña quede abierta; al cerrarla, pide la clave de nuevo.
const SESSION_KEY = "cordova_dash_session";

function showDashboard(show) {
  document.getElementById("login-view").style.display = show ? "none" : "block";
  document.getElementById("dash-view").style.display = show ? "block" : "none";
  if (show) startDashboard();
}

document.getElementById("btn-login").addEventListener("click", () => {
  const pass = document.getElementById("login-pass").value;
  const msg = document.getElementById("login-msg");
  if (pass === ADMIN_PASSCODE) {
    msg.textContent = "";
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
    showDashboard(true);
  } else {
    msg.textContent = "❌ Clave incorrecta.";
  }
});

document.getElementById("login-pass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-login").click();
});

document.getElementById("btn-logout").addEventListener("click", () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  showDashboard(false);
});

let alreadySignedIn = false;
try { alreadySignedIn = sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) {}
showDashboard(alreadySignedIn);

// ---------- Reloj ----------
function renderClockD() {
  const now = new Date();
  const el = document.getElementById("clock-time");
  if (el) el.textContent = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}
setInterval(renderClockD, 1000 * 10);
renderClockD();

// ---------- Dashboard state ----------
let currentDate = todayKeyD();
let unsubChecklists = null;
let unsubTasks = null;
let unsubConfig = null;
let lastMissingCount = -1;
let checklistDocs = [];
let taskDocs = [];
let activationDate = null; // null = siempre activo (comportamiento de siempre)

function isDateBeforeActivation(dateStr) {
  return !!activationDate && dateStr < activationDate;
}

function renderActivationStatus() {
  const input = document.getElementById("f-activation-date");
  const status = document.getElementById("activation-status");
  if (!input || !status) return;
  input.value = activationDate || "";
  if (!activationDate) {
    status.style.color = "var(--green)";
    status.textContent = "✅ Sistema activo (sin fecha de inicio configurada) — las alarmas funcionan con normalidad en todas las estaciones.";
  } else if (todayKeyD() >= activationDate) {
    status.style.color = "var(--green)";
    status.textContent = `✅ Sistema activo desde el ${activationDate}.`;
  } else {
    status.style.color = "var(--yellow)";
    status.textContent = `🕓 Aún no está activo. Se activará automáticamente el ${activationDate} — hasta entonces, ninguna estación sonará alarmas ni se marcará como incumplida.`;
  }
}

function subscribeConfig() {
  if (unsubConfig) unsubConfig();
  unsubConfig = db.collection("config").doc("settings").onSnapshot((doc) => {
    const data = doc.exists ? doc.data() : null;
    activationDate = (data && typeof data.activationDate === "string") ? data.activationDate : null;
    renderActivationStatus();
    renderAll();
  }, (err) => {
    console.warn("No se pudo leer config/settings:", err);
  });
}

function wireActivationControls() {
  document.getElementById("btn-save-activation").addEventListener("click", () => {
    const val = document.getElementById("f-activation-date").value;
    if (!val) {
      alert("Selecciona una fecha primero.");
      return;
    }
    db.collection("config").doc("settings").set({ activationDate: val }, { merge: true })
      .catch((e) => alert("No se pudo guardar la fecha: " + e.message));
  });
  document.getElementById("btn-clear-activation").addEventListener("click", () => {
    if (!window.confirm("¿Quitar la fecha de inicio? El sistema quedará activo siempre (comportamiento normal) en todas las estaciones.")) return;
    db.collection("config").doc("settings").set({ activationDate: firebase.firestore.FieldValue.delete() }, { merge: true })
      .catch((e) => alert("No se pudo quitar la fecha: " + e.message));
  });
}

function startDashboard() {
  const dateInput = document.getElementById("f-date");
  dateInput.value = currentDate;
  dateInput.addEventListener("change", () => {
    currentDate = dateInput.value || todayKeyD();
    subscribe();
  });
  document.getElementById("btn-today").addEventListener("click", () => {
    currentDate = todayKeyD();
    dateInput.value = currentDate;
    subscribe();
  });
  wireActivationControls();
  // Renderiza el esqueleto (5 estaciones, KPIs en 0) de inmediato, sin
  // esperar respuesta de Firestore — así el dashboard nunca se ve
  // completamente vacío, incluso si la base de datos tarda o falla.
  renderAll();
  subscribe();
  subscribeConfig();
  setInterval(renderAll, 20000); // refresca estados de "atrasado" aunque no cambien los datos
}

function showConnError(msg) {
  const el = document.getElementById("overdue-banner-slot");
  if (el) el.innerHTML = `<div class="sticky-alert">⚠️ ${msg} Revisa que hayas publicado las reglas de Firestore y que tu conexión a internet esté activa.</div>`;
}

function subscribe() {
  if (unsubChecklists) unsubChecklists();
  if (unsubTasks) unsubTasks();

  unsubChecklists = db.collection("checklists").where("date", "==", currentDate).onSnapshot((snap) => {
    checklistDocs = [];
    snap.forEach((doc) => checklistDocs.push({ id: doc.id, ...doc.data() }));
    renderAll();
  }, (err) => {
    console.error("Error leyendo checklists:", err);
    showConnError("No se pudieron cargar los checklists (" + err.code + ").");
  });

  unsubTasks = db.collection("tasks").where("date", "==", currentDate).onSnapshot((snap) => {
    taskDocs = [];
    snap.forEach((doc) => taskDocs.push({ id: doc.id, ...doc.data() }));
    renderAll();
  }, (err) => {
    console.error("Error leyendo tasks:", err);
    showConnError("No se pudieron cargar las tareas (" + err.code + ").");
  });
}

function findChecklist(stationId, turno) {
  return checklistDocs.find((d) => d.station === stationId && d.turno === turno);
}
function findTask(stationId, taskId, time) {
  return taskDocs.find((d) => d.station === stationId && d.taskId === taskId && d.time === time);
}

function cellStatus(stationId, turno) {
  const isToday = currentDate === todayKeyD();
  const doc = findChecklist(stationId, turno);
  const mins = isToday ? minutesSinceD(turno) : 9999;
  const isDue = !isToday || mins >= 0;
  const isOverdue = !isToday || mins > SCHEDULE.graceMinutes;

  if (!doc) {
    // Si la fecha consultada es anterior a la fecha de inicio configurada
    // en gerencia, el sistema aún no estaba activo: no se cuenta como
    // incumplimiento, se muestra neutral.
    if (isDateBeforeActivation(currentDate)) return { cls: "", label: "🕓 Aún no activo" };
    if (isToday && !isDue) return { cls: "", label: "— aún no es la hora" };
    if (isToday && isDue && !isOverdue) return { cls: "warn", label: "⏳ En curso" };
    return { cls: "missing", label: "🔴 No realizado" };
  }
  if (doc.criticalNegativeCount > 0) {
    return { cls: "missing", label: `🔴 CRÍTICO (${doc.criticalNegativeCount})`, doc };
  }
  if (!doc.onTime) {
    return { cls: "late", label: `🟠 Atrasado${doc.negativeCount ? " · " + doc.negativeCount + " negativas" : ""}`, doc };
  }
  if (doc.negativeCount > 0) {
    return { cls: "warn", label: `🟡 ${doc.negativeCount} negativas`, doc };
  }
  return { cls: "ok", label: "✅ Completo", doc };
}

function renderKPIs() {
  const isToday = currentDate === todayKeyD();
  const expectedTotal = STATIONS.length * SCHEDULE.checklistTimes.length;
  const completed = checklistDocs.length;
  let missing = 0;
  STATIONS.forEach((s) => {
    SCHEDULE.checklistTimes.forEach((t) => {
      const st = cellStatus(s.id, t);
      if (st.cls === "missing") missing++;
    });
  });
  const criticalCount = checklistDocs.filter((d) => d.criticalNegativeCount > 0).length;
  const negativeTotal = checklistDocs.reduce((sum, d) => sum + (d.negativeCount || 0), 0);
  const rushedCount = checklistDocs.filter((d) => d.rushedFill).length;

  document.getElementById("kpi-grid").innerHTML = `
    <div class="kpi"><div class="num">${completed}/${expectedTotal}</div><div class="lbl">Checklists diligenciados</div></div>
    <div class="kpi"><div class="num" style="color:var(--brand-red)">${missing}</div><div class="lbl">No realizados</div></div>
    <div class="kpi"><div class="num" style="color:var(--brand-red)">${criticalCount}</div><div class="lbl">Con incumplimiento crítico</div></div>
    <div class="kpi"><div class="num" style="color:var(--brand-gold)">${negativeTotal}</div><div class="lbl">Respuestas negativas totales</div></div>
    <div class="kpi"><div class="num" style="color:#b8752a">${rushedCount}</div><div class="lbl">⚡ Diligenciados muy rápido (sospechoso)</div></div>
  `;

  if (isToday) {
    if (lastMissingCount !== -1 && missing > lastMissingCount) beepD(2);
    lastMissingCount = missing;
    const banner = document.getElementById("overdue-banner-slot");
    banner.innerHTML = missing > 0
      ? `<div class="sticky-alert">🔴 ${missing} checklist(s) sin diligenciar hoy. Revisa la tabla de abajo.</div>`
      : `<div class="sticky-alert ok">✅ Todo al día por ahora.</div>`;
  } else {
    document.getElementById("overdue-banner-slot").innerHTML = "";
  }
}

function renderChecklistTable() {
  const tbody = document.getElementById("checklist-table-body");
  tbody.innerHTML = "";
  STATIONS.forEach((s) => {
    const tr = document.createElement("tr");
    const cells = SCHEDULE.checklistTimes.map((t) => {
      const st = cellStatus(s.id, t);
      const clickable = st.doc ? `style="cursor:pointer" onclick="openDetail('${s.id}','${t}')"` : "";
      const sub = st.doc
        ? `<div style="font-size:0.78rem;color:var(--brand-wood-dark);margin-top:4px;">👤 ${st.doc.responsable} · ⏱ ${fmtDuration(st.doc.fillSeconds)}</div>${st.doc.rushedFill ? '<div style="font-size:0.75rem;color:#b8752a;font-weight:700;margin-top:2px;">⚡ Posible diligenciado apresurado</div>' : ""}`
        : "";
      return `<td ${clickable}><span class="status-pill ${st.cls || ''}">${st.label}</span>${sub}</td>`;
    });
    tr.innerHTML = `<td><strong>${s.icon} ${s.name}</strong></td>${cells.join("")}`;
    tbody.appendChild(tr);
  });
}

function renderTasksTable() {
  const tbody = document.getElementById("tasks-table-body");
  tbody.innerHTML = "";
  STATIONS.forEach((s) => {
    const tr = document.createElement("tr");
    const cells = TASK_SLOTS.map((slot) => {
      if (slot.onlyStation && slot.onlyStation !== s.id) return `<td style="color:var(--brand-wood-dark)">—</td>`;
      const doc = findTask(s.id, slot.taskId, slot.time);
      if (doc) return `<td><span class="status-pill ok">✅ Hecho</span></td>`;
      if (isDateBeforeActivation(currentDate)) return `<td><span class="status-pill" style="color:var(--text-secondary)">🕓 —</span></td>`;
      return `<td><span class="status-pill missing">🔴 Pendiente</span></td>`;
    });
    tr.innerHTML = `<td><strong>${s.icon} ${s.name}</strong></td>${cells.join("")}`;
    tbody.appendChild(tr);
  });
}

function openDetail(stationId, turno) {
  const doc = findChecklist(stationId, turno);
  if (!doc) return;
  const station = STATIONS.find((s) => s.id === stationId);
  const rows = doc.items.map((it) => {
    const color = it.answer === "no" ? "var(--brand-red)" : it.answer === "si" ? "var(--brand-green)" : "var(--brand-wood-dark)";
    const tag = it.critical && it.answer === "no" ? ' <span class="critical-tag">CRÍTICO</span>' : "";
    return `<div class="item-row"><div class="item-label">${it.label}${tag}</div><div style="font-weight:700;color:${color};text-transform:uppercase;">${it.answer}</div></div>`;
  }).join("");

  document.getElementById("modal-slot").innerHTML = `
    <div class="alarm-overlay" id="detail-modal" onclick="if(event.target===this) this.remove()">
      <div class="alarm-box" style="max-width:560px; text-align:left; max-height:80vh; overflow:auto;">
        <h3 style="color:var(--brand-dark)">${station.icon} ${station.name} — Turno ${turno}</h3>
        <p style="margin:0 0 10px;"><strong>Responsable:</strong> ${doc.responsable} ${doc.inspector ? " · <strong>Inspector:</strong> " + doc.inspector : ""}</p>
        <p style="margin:0 0 10px;"><strong>Tiempo de diligenciamiento:</strong> ${fmtDuration(doc.fillSeconds)} ${doc.rushedFill ? '<span class="critical-tag" style="background:#b8752a;border-color:#b8752a;">⚡ SOSPECHOSAMENTE RÁPIDO</span>' : '<span style="color:var(--brand-green);font-weight:700;">✓ normal</span>'}</p>
        ${rows}
        ${doc.observaciones ? `<p style="margin-top:12px;"><strong>Observaciones:</strong> ${doc.observaciones}</p>` : ""}
        ${doc.evidenciaURL ? `<p style="margin-top:10px;"><a href="${doc.evidenciaURL}" target="_blank">📷 Ver foto de evidencia</a></p>` : ""}
        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="document.getElementById('detail-modal').remove()">Cerrar</button>
      </div>
    </div>
  `;
}

let complianceChart = null;
function renderComplianceChart() {
  const canvas = document.getElementById("compliance-chart");
  if (!canvas || typeof Chart === "undefined") return;

  let ok = 0, warn = 0, missing = 0;
  STATIONS.forEach((s) => {
    SCHEDULE.checklistTimes.forEach((t) => {
      const st = cellStatus(s.id, t);
      if (st.cls === "ok") ok++;
      else if (st.cls === "warn" || st.cls === "late") warn++;
      else if (st.cls === "missing") missing++;
      // celdas "aún no es la hora" (cls === "") no cuentan en ningún lado todavía
    });
  });

  const data = [ok, warn, missing];
  const colors = ["#5c7a45", "#c9a227", "#9b3b2e"];
  const labels = ["Completo sin novedades", "Con novedades / atrasado", "No realizado"];

  if (complianceChart) {
    complianceChart.data.datasets[0].data = data;
    complianceChart.update();
  } else {
    complianceChart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        cutout: "68%",
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        animation: { duration: 400 },
      },
    });
  }

  document.getElementById("chart-legend").innerHTML = labels
    .map((l, i) => `<span><span class="dot" style="background:${colors[i]}"></span>${l} (${data[i]})</span>`)
    .join("");
}

function renderAll() {
  renderKPIs();
  renderChecklistTable();
  renderTasksTable();
  renderComplianceChart();
}
