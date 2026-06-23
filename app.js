/* Tableros DORA — dashboard web (datos: data.json generado por build_dashboard_data.py) */
/* Los procesos (key/label/color) vienen del JSON -> sin strings de proceso hardcodeados. */
let DATA = null, CURRENT = null, CHARTS = [], PROCS = [], PORT_INI = null, PORT_FIN = null, RECURSOS = null;
/* paleta por proyecto (gráfico de productividad en el tiempo) */
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#38bdf8", "#a855f7", "#ef4444", "#f472b6", "#22d3ee"];

const $ = (s) => document.querySelector(s);
const cssv = (n) => getComputedStyle(document.body).getPropertyValue(n).trim();
const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("es-CO").format(Math.round(n));
const pct = (n) => n == null ? "—" : (n * 100).toFixed(1).replace(".", ",") + "%";
const pct0 = (n) => n == null ? "—" : Math.round(n * 100) + "%";
/* moneda COP compacta (millones) para los cuadros de costo internos */
const fmtMoney = (n) => n == null ? "—" : (n >= 1e6
  ? "$" + (n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " M"
  : "$" + new Intl.NumberFormat("es-CO").format(Math.round(n)));
/* etiqueta homologada de proyecto (igual que el menú desplegable) */
const shorten = (s, n = 16) => (s && s.length > n ? s.slice(0, n - 1) + "…" : (s || ""));
const etiqueta = (p) => `${p.codigo} · ${p.nombre}`;            // largo (ejes horizontales / tooltips)
const etiqueta2l = (p) => `${p.codigo}\n${shorten(p.nombre, 14)}`; // 2 líneas (ejes de barras verticales)

/* ---------- carga ---------- */
fetch("data.json").then(r => r.json()).then(async d => {
  DATA = d;
  PROCS = d.procesos; // [{key,label,color}]
  $("#corte").textContent = d.corte;
  $("#gen").textContent = d.generado;
  $("#filas").textContent = fmt(d.total_filas);
  // hora de la última actualización junto al corte (muestra la fecha si difiere del corte)
  const gp = (d.generado || "").split(" "), act = $("#actualizado");
  if (act) {
    act.textContent = (gp[0] && gp[0] !== d.corte) ? `${gp[0]} ${gp[1] || ""}`.trim() : (gp[1] || "—");
    const pill = act.closest(".pill"); if (pill) pill.title = `Última actualización: ${d.generado} (hora Colombia)`;
  }
  // recursos/costos = archivo INTERNO (gitignored); ausente en la versión pública -> sección oculta
  try { const rr = await fetch("data_recursos.json"); RECURSOS = rr.ok ? await rr.json() : null; }
  catch (_) { RECURSOS = null; }
  const sel = $("#proySel");
  sel.innerHTML = `<option value="__all__">▦ Portafolio (todos)</option>` +
    d.proyectos.map(p => `<option value="${p.codigo}">${p.codigo} · ${p.nombre}</option>`).join("");
  sel.onchange = () => render(sel.value);
  render("__all__");
}).catch(e => { $("#content").innerHTML = `<div class="card">Error cargando datos: ${e}</div>`; });

/* recursos: equipo activo a una fecha (serie en breakpoints) + selección de área dinámica */
let REC_STATE = null;
const AREA_LBL = { "REQUERIMIENTOS": "Requerimientos", "DESARROLLO": "Desarrollo", "PRUEBAS QA Y TESTER": "QA", "TRANSVERSAL": "Transversal", "MESA DE AYUDA": "Mesa de Ayuda", "AUSENTE": "Ausente" };
const AREA_COL = { "REQUERIMIENTOS": "#6366f1", "DESARROLLO": "#38bdf8", "PRUEBAS QA Y TESTER": "#f59e0b", "TRANSVERSAL": "#a855f7", "MESA DE AYUDA": "#f472b6", "AUSENTE": "#5d6678" };
const AREA_ORDER = ["REQUERIMIENTOS", "DESARROLLO", "PRUEBAS QA Y TESTER", "TRANSVERSAL", "MESA DE AYUDA", "AUSENTE"];

function snapRec(resObj, fechas, dateStr) {
  if (!resObj || !resObj.serie) return null;
  let i = 0;
  for (let j = 0; j < fechas.length; j++) { if (fechas[j] <= dateStr) i = j; else break; }
  return resObj.serie[i];
}
function recursosBody(s, areaSel) {
  if (!s) return "";
  const pa = s.por_area || {};
  const totalN = AREA_ORDER.reduce((a, k) => a + ((pa[k] && pa[k].n) || 0), 0);
  const sumC = (i) => AREA_ORDER.reduce((a, k) => a + ((pa[k] && pa[k].c && pa[k].c[i]) || 0), 0);
  const sel = (areaSel && pa[areaSel]) ? pa[areaSel] : null;
  const n = sel ? sel.n : totalN;
  const c = sel ? sel.c : [sumC(0), sumC(1), sumC(2)];
  const chip = (k) => (pa[k] && pa[k].n) ? `<span class="rchip${areaSel === k ? " on" : ""}" onclick="recSelArea('${k}')"><span class="rdot" style="background:${AREA_COL[k]}"></span>${AREA_LBL[k]} <b>${pa[k].n}</b></span>` : "";
  const box = (lbl, val, col) => `<div class="costbox" style="--c:${col}"><div class="cbl">${lbl}</div><div class="cbv" title="$${new Intl.NumberFormat("es-CO").format(Math.round(val))}">${fmtMoney(val)}</div><div class="cbs">mensual</div></div>`;
  return `<div class="rrow">
      <div class="rbig"><div class="rbign">${n}</div><div class="rbigl">${sel ? AREA_LBL[areaSel] : "personas"}</div></div>
      <div class="rchips">${AREA_ORDER.map(chip).join("")}${areaSel ? `<span class="rchip rclear" onclick="recSelArea('${areaSel}')">✕ ver todas</span>` : ""}</div>
    </div>
    <div class="rsub">💲 Costo mensual ${sel ? "· " + AREA_LBL[areaSel] : "del equipo"} (banda salarial)</div>
    <div class="costrow">
      ${box("Mínimo", c[0], "#38bdf8")}
      ${box("Medio", c[1], "#10b981")}
      ${box("Máximo", c[2], "#ef4444")}
    </div>`;
}
function recSelArea(k) {
  if (!REC_STATE) return;
  REC_STATE.area = (REC_STATE.area === k) ? null : k;
  $("#recBody").innerHTML = recursosBody(snapRec(REC_STATE.resObj, RECURSOS.fechas, REC_STATE.date), REC_STATE.area);
}
function recursosCard(resObj, titulo, nota) {
  if (!resObj || !RECURSOS) return "";
  const def = RECURSOS.fecha_ref || "";
  return `<div class="card fade rcard" style="margin-top:16px">
    <h3>👥 Recursos del equipo${titulo ? " · " + titulo : ""}</h3>
    <div class="hint">${nota ? nota + " · " : ""}equipo activo a la fecha · <b>clic en un área</b> para redimensionar el costo</div>
    <div class="filterbar"><label>Fecha de consulta <input type="date" id="recFecha"></label></div>
    <div id="recBody">${recursosBody(snapRec(resObj, RECURSOS.fechas, def), null)}</div>
  </div>`;
}
function setupRecursos(resObj) {
  const fi = $("#recFecha");
  if (!fi || !RECURSOS || !resObj) return;
  const F = RECURSOS.fechas, ref = RECURSOS.fecha_ref;
  REC_STATE = { resObj, date: ref, area: null };
  fi.min = F[0]; fi.max = F[F.length - 1]; fi.value = ref;
  fi.onchange = () => { REC_STATE.date = fi.value || ref; $("#recBody").innerHTML = recursosBody(snapRec(resObj, F, REC_STATE.date), REC_STATE.area); };
}

/* productividad persona-día por proceso: HU gestionadas (salidas) / día hábil / personas del área */
const PROC_AREA = { REQUERIMIENTOS: "REQUERIMIENTOS", DESARROLLO: "DESARROLLO", QA: "PRUEBAS QA Y TESTER" };
function prodPersonaDia(cod) {
  const p = DATA.proyectos.find(x => x.codigo === cod);
  const rec = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos[cod] : null;
  if (!p || !rec) return null;
  const snap = snapRec(rec, RECURSOS.fechas, RECURSOS.fecha_ref);
  const dias = p.kpis.dias_transcurridos;
  const out = {};
  for (const proc in PROC_AREA) {
    const salidas = (p.flujo || []).reduce((s, f) => s + ((f.salidas && f.salidas[proc]) || 0), 0);
    const personas = snap && snap.por_area[PROC_AREA[proc]] ? snap.por_area[PROC_AREA[proc]].n : 0;
    out[proc] = { salidas, personas, dias, val: (dias && personas) ? salidas / dias / personas : null };
  }
  return out;
}
const PROD_PROCS = [["REQUERIMIENTOS", "Requerimientos", "#6366f1"], ["DESARROLLO", "Desarrollo", "#38bdf8"], ["QA", "QA", "#f59e0b"]];
/* proyecto: productividad persona-día por proceso EN EL TIEMPO, con filtro Desde/Hasta */
function setupProdPersona(cod) {
  const el = $("#cProdPD"); if (!el) return;
  const p = DATA.proyectos.find(x => x.codigo === cod);
  const rec = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos[cod] : null;
  const fl = p && p.flujo ? p.flujo : [];
  if (!fl.length || !rec) return;
  const c = mkChart(el), ax = axisBase();
  const dmin = fl[0].fecha, dmax = fl[fl.length - 1].fecha;
  const fi = $("#pdIni"), ff = $("#pdFin");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;
  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax; if (a > b) { const t = a; a = b; b = t; }
    const rows = fl.filter(f => f.fecha >= a && f.fecha <= b);
    const dates = rows.map(f => f.fecha);
    const series = PROD_PROCS.map(([key, l, co]) => ({
      name: l, type: "line", smooth: true, showSymbol: true, symbol: "circle", symbolSize: 6, color: co, connectNulls: true,
      data: rows.map(f => {
        const per = (snapRec(rec, RECURSOS.fechas, f.fecha) || { por_area: {} }).por_area[PROC_AREA[key]];
        const n = per ? per.n : 0;
        return n ? +((f.salidas[key] || 0) / n).toFixed(3) : 0;
      }),
    }));
    c.setOption({
      tooltip: { trigger: "axis", ...ax.tooltip, valueFormatter: (v) => v == null ? "—" : v.toFixed(3).replace(".", ",") + " HU/pers." },
      legend: { data: PROD_PROCS.map(p => p[1]), textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "circle" },
      grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: dates, axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 10, formatter: (v) => v.slice(5) } },
      yAxis: { type: "value", name: "HU/persona/día", nameTextStyle: { color: ax.textColor, fontSize: 10 }, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
      series,
    }, true);
  }
  fi.onchange = ff.onchange = apply;
  apply();
}
/* portafolio: líneas de dispersión en el tiempo — X = fechas, una línea por proyecto, con filtro
   Desde/Hasta propio (productividad del proyecto = salidas REQ+DEV+QA ÷ personas de esas áreas, por día) */
function setupProdComp() {
  const el = $("#cProdComp"); if (!el) return;
  const ps = DATA.proyectos.filter(p => RECURSOS && RECURSOS.proyectos && RECURSOS.proyectos[p.codigo]);
  let dmin = null, dmax = null;
  ps.forEach(p => (p.flujo || []).forEach(f => { if (dmin == null || f.fecha < dmin) dmin = f.fecha; if (dmax == null || f.fecha > dmax) dmax = f.fecha; }));
  if (dmin == null) return;
  const c = mkChart(el), ax = axisBase();
  const fi = $("#pcIni"), ff = $("#pcFin");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;
  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax; if (a > b) { const t = a; a = b; b = t; }
    const series = ps.map((p, i) => {
      const rec = RECURSOS.proyectos[p.codigo];
      const rows = (p.flujo || []).filter(f => f.fecha >= a && f.fecha <= b);
      const data = rows.map(f => {
        const snap = snapRec(rec, RECURSOS.fechas, f.fecha) || { por_area: {} };
        let sal = 0, per = 0;
        for (const proc in PROC_AREA) { sal += (f.salidas[proc] || 0); const pa = snap.por_area[PROC_AREA[proc]]; per += pa ? pa.n : 0; }
        return [f.fecha, per ? +(sal / per).toFixed(3) : 0];
      });
      return { name: etiqueta(p), type: "line", smooth: true, showSymbol: true, symbol: "circle", symbolSize: 6, connectNulls: true, lineStyle: { width: 2 }, color: PALETTE[i % PALETTE.length], data };
    });
    c.setOption({
      tooltip: { trigger: "axis", ...ax.tooltip, valueFormatter: (v) => v == null ? "—" : v.toFixed(3).replace(".", ",") + " HU/pers." },
      legend: { type: "scroll", data: series.map(s => s.name), textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
      grid: { left: 8, right: 18, top: 38, bottom: 6, containLabel: true },
      xAxis: { type: "time", axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 10, formatter: (val) => echarts.format.formatTime("dd/MM", val) } },
      yAxis: { type: "value", name: "HU/persona/día", nameTextStyle: { color: ax.textColor, fontSize: 10 }, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
      series,
    }, true);
  }
  fi.onchange = ff.onchange = apply;
  apply();
}

$("#themeBtn").onclick = () => {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "dark" ? "light" : "dark";
  setTimeout(() => render(CURRENT), 50); // re-render charts con nuevo tema
};

/* ---------- helpers UI ---------- */
function kpi(label, icon, iconBg, valHtml, foot, barPct) {
  return `<div class="card kpi fade">
    <div class="label"><span class="ic" style="background:${iconBg}20;color:${iconBg}">${icon}</span>${label}</div>
    <div class="val">${valHtml}</div>
    ${foot ? `<div class="foot">${foot}</div>` : ""}
    ${barPct != null ? `<div class="bar-mini"><i style="width:0" data-w="${Math.min(100, barPct * 100)}"></i></div>` : ""}
  </div>`;
}
function animateBars() {
  document.querySelectorAll(".bar-mini > i").forEach(i => {
    requestAnimationFrame(() => { i.style.width = i.dataset.w + "%"; });
  });
}
function countUp() {
  document.querySelectorAll("[data-count]").forEach(el => {
    const target = +el.dataset.count, dur = 800, t0 = performance.now();
    const suf = el.dataset.suf || "", dec = +(el.dataset.dec || 0);
    function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = target * e;
      el.textContent = (dec ? v.toFixed(dec).replace(".", ",")
        : new Intl.NumberFormat("es-CO").format(Math.round(v))) + suf;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
function disposeCharts() { CHARTS.forEach(c => c.dispose()); CHARTS = []; }
function mkChart(el) { const c = echarts.init(el, null, { renderer: "canvas" }); CHARTS.push(c); return c; }
function axisBase() {
  return {
    textColor: cssv("--muted"), line: cssv("--line"),
    tooltip: {
      backgroundColor: cssv("--card"), borderColor: cssv("--line"),
      textStyle: { color: cssv("--text"), fontSize: 12 }, padding: [8, 12],
    },
  };
}
window.addEventListener("resize", () => CHARTS.forEach(c => c.resize()));

/* ---------- router ---------- */
function render(key) {
  CURRENT = key || "__all__";
  disposeCharts();
  if (CURRENT === "__all__") renderPortfolio();
  else renderProject(DATA.proyectos.find(p => p.codigo === CURRENT));
  animateBars();
}

/* ---------- vista proyecto ---------- */
function renderProject(p) {
  const k = p.kpis;
  const restQA = k.dias_restantes?.QA;
  const head = `<div class="project-title fade">
    <h2>${p.nombre}</h2>
    <span class="tag">${p.codigo}</span>
    ${p.producto ? `<span class="tag">${p.producto}</span>` : ""}
    ${p.estado ? `<span class="tag">${p.estado}</span>` : ""}
  </div>`;

  const kpis = `<div class="grid kpis">
    ${kpi("HU Totales", "▦", "#6366f1",
      `<span data-count="${k.hu_total}">0</span>`,
      `${fmt(k.hu_pendientes)} pendientes de producción`)}
    ${kpi("HU Removidas", "✕", "#94a3b8",
      `<span data-count="${k.removidas || 0}">0</span>`,
      "Removido/Cancelado · fuera del conteo")}
    ${kpi("En Producción", "✓", "#10b981",
      `<span data-count="${k.hu_prod}">0</span>`,
      `de ${fmt(k.hu_total)} HU`, k.pct_prod)}
    ${kpi("% Puesta en Producción", "◎", "#38bdf8",
      `<span data-count="${(k.pct_prod || 0) * 100}" data-dec="1" data-suf="%">0</span>`,
      "HU en producción / totales", k.pct_prod)}
    ${kpi("% Avance ponderado", "◔", "#a855f7",
      k.pct_avance == null ? "—" : `<span data-count="${k.pct_avance * 100}" data-dec="0" data-suf="%">0</span>`,
      k.pct_avance == null ? "sin homologación de avance" : "promedio por etapa", k.pct_avance)}
    ${kpi("Velocidad", "⚡", "#f59e0b",
      `<span data-count="${k.velocidad || 0}" data-dec="2">0</span> <small>HU/día</small>`,
      `${fmt(k.dias_transcurridos)} días hábiles transcurridos`)}
    ${kpi("Días hábiles a cierre QA", "⏳", restQA != null && restQA <= 10 ? "#ef4444" : "#38bdf8",
      restQA == null ? "—" : `<span data-count="${restQA}">0</span>`,
      p.cierre?.QA ? `cierre QA ${p.cierre.QA}` : "sin fecha de cierre")}
  </div>`;

  const charts = `<div class="grid charts">
    <div class="card fade"><h3>Avance por proceso en el tiempo</h3>
      <div class="hint">HU en cada etapa por fecha de corte (apilado)</div>
      <div id="cArea" class="chart tall"></div></div>
    <div class="card fade"><h3>Distribución actual</h3>
      <div class="hint">HU por proceso al ${DATA.corte}</div>
      <div id="cDonut" class="chart tall"></div></div>
  </div>
  <div class="grid charts-2" style="margin-top:16px">
    <div class="card fade"><h3>Tendencia de producción</h3>
      <div class="hint">Total de HU vs. puestas en producción</div>
      <div id="cLine" class="chart"></div></div>
    <div class="card fade"><h3>Productividad · real vs. requerida</h3>
      <div class="hint">Arco externo = real (verde si cumple / rojo si va por debajo) · arco interno = requerida (cierre QA)</div>
      <div id="cGauge" class="chart"></div></div>
  </div>`;

  const flujoUI = `
  <div class="card fade" style="margin-top:16px">
    <h3>Tabla consolidada · HU por etapa y fecha</h3>
    <div class="hint">Conteo de HU en cada etapa por día (tipo tabla dinámica). Cambia la métrica para ver variaciones o gestiones.</div>
    <div class="filterbar">
      <label>Métrica
        <select id="tblMode">
          <option value="count">Conteo (HU en la etapa)</option>
          <option value="delta">Δ Variación día a día</option>
          <option value="ent">Entradas (gestión)</option>
          <option value="sal">Salidas (gestión)</option>
        </select>
      </label>
      <span class="hint" style="margin:0">▸ filas = etapas · columnas = fechas (desliza →)</span>
    </div>
    <div id="pivWrap" class="pivwrap"></div>
  </div>
  <div class="card fade" style="margin-top:16px">
    <h3>Variación de HU por etapa en el tiempo</h3>
    <div class="hint">Por día y etapa: <b>entradas hacia arriba (+)</b> y <b>salidas hacia abajo (−)</b>. Filtra por rango de fechas y por etapa.</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="flIni"></label>
      <label>Hasta <input type="date" id="flFin"></label>
      <label>Etapa <select id="flProc">${"<option value='__all__'>Todas las etapas</option>" + PROCS.map(pr => `<option value="${pr.key}">${pr.label}</option>`).join("")}</select></label>
    </div>
    <div id="cFlujo" class="chart tall"></div>
  </div>`;
  const recObj = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos[p.codigo] : null;
  const recursos = recursosCard(recObj, null, RECURSOS ? "Planta " + RECURSOS.planta_archivo : null);
  const prodUI = recObj ? `
  <div class="card fade" style="margin-top:16px">
    <h3>⚙️ Productividad persona-día por proceso · en el tiempo</h3>
    <div class="hint">HU gestionadas (salidas del proceso) ÷ personas del área, por día · filtra el rango de fechas</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="pdIni"></label>
      <label>Hasta <input type="date" id="pdFin"></label>
    </div>
    <div id="cProdPD" class="chart"></div>
  </div>` : "";
  $("#content").innerHTML = head + kpis + recursos + charts + flujoUI + prodUI;
  countUp();
  setupRecursos(recObj);
  drawArea($("#cArea"), p);
  drawDonut($("#cDonut"), p);
  drawLine($("#cLine"), p);
  drawGauge($("#cGauge"), p, k);
  setupPivot(p);
  drawFlujo($("#cFlujo"), p);
  if (recObj) setupProdPersona(p.codigo);
}

/* tabla dinámica: filas = etapas, columnas = fechas, métrica seleccionable */
function setupPivot(p) {
  const sel = $("#tblMode"), wrap = $("#pivWrap");
  const draw = () => { wrap.innerHTML = buildPivot(p, sel.value); wrap.scrollLeft = wrap.scrollWidth; };
  sel.onchange = draw;
  draw();
}

function buildPivot(p, mode) {
  const dates = p.serie.map(s => s.fecha);
  const fmap = Object.fromEntries((p.flujo || []).map(f => [f.fecha, f]));
  const sum6 = (s) => PROCS.reduce((a, pr) => a + (s[pr.key] || 0), 0);
  const hasSH = p.serie.some(s => (s.total - sum6(s)) > 0);
  const hasRem = p.serie.some(s => (s.removidas || 0) > 0);

  // valor de una etapa 'key' en la fecha índice i, según la métrica
  const val = (key, i) => {
    const s = p.serie[i];
    if (mode === "count") return s[key] || 0;
    if (mode === "delta") return i === 0 ? null : (s[key] || 0) - (p.serie[i - 1][key] || 0);
    const f = fmap[dates[i]];
    if (!f) return null;
    return (mode === "ent" ? f.entradas : f.salidas)[key] || 0;
  };
  const shVal = (i) => {                       // fila "sin homologar" (derivada)
    if (mode === "ent" || mode === "sal") return null;   // el flujo no la rastrea
    const now = p.serie[i].total - sum6(p.serie[i]);
    if (mode === "count") return now;
    return i === 0 ? null : now - (p.serie[i - 1].total - sum6(p.serie[i - 1]));
  };
  const remVal = (i) => {                      // fila "removidas" (fuera del conteo)
    if (mode === "ent" || mode === "sal") return null;   // el flujo no rastrea EXCLUIR
    const now = p.serie[i].removidas || 0;
    if (mode === "count") return now;
    return i === 0 ? null : now - (p.serie[i - 1].removidas || 0);
  };
  const totVal = (i) => {
    const s = p.serie[i];
    if (mode === "count") return s.total;
    if (mode === "delta") return i === 0 ? null : s.total - p.serie[i - 1].total;
    const f = fmap[dates[i]]; if (!f) return null;
    const o = (mode === "ent" ? f.entradas : f.salidas);
    return PROCS.reduce((a, pr) => a + (o[pr.key] || 0), 0);
  };
  const cell = (v) => {
    if (v == null) return `<td class="czero">·</td>`;
    if (mode === "count") return `<td>${v}</td>`;
    const cls = v > 0 ? "cpos" : v < 0 ? "cneg" : "czero";
    return `<td class="${cls}">${v > 0 ? "+" + v : v}</td>`;
  };

  let h = `<table class="piv"><thead><tr><th>Etapa</th>` +
    dates.map(d => `<th>${d.slice(5)}</th>`).join("") + `</tr></thead><tbody>`;
  for (const pr of PROCS) {
    h += `<tr><th><span class="sw-i" style="background:${pr.color}"></span>${pr.label}</th>` +
      dates.map((d, i) => cell(val(pr.key, i))).join("") + `</tr>`;
  }
  if (hasSH) {
    h += `<tr><th><span class="sw-i" style="background:#5d6678"></span>Sin homologar</th>` +
      dates.map((d, i) => cell(shVal(i))).join("") + `</tr>`;
  }
  if (hasRem) {
    h += `<tr><th><span class="sw-i" style="background:#94a3b8"></span>Removidas</th>` +
      dates.map((d, i) => cell(remVal(i))).join("") + `</tr>`;
  }
  h += `<tr class="tot"><th>Total HU<br><span style="font-weight:400;font-size:10px;color:var(--muted)">(sin removidas)</span></th>` + dates.map((d, i) => cell(totVal(i))).join("") + `</tr>`;
  return h + `</tbody></table>`;
}

/* variación de HU por etapa en el tiempo: entradas (+) arriba, salidas (−) abajo.
   Filtros: rango de fechas (flIni/flFin) y etapa (flProc). */
function drawFlujo(el, p) {
  const c = mkChart(el), ax = axisBase();
  const fl = p.flujo || [];
  if (!fl.length) { el.innerHTML = `<div class="hint" style="padding:20px">Sin movimientos de etapa registrados.</div>`; return; }
  const dmin = fl[0].fecha, dmax = fl[fl.length - 1].fecha;
  const fi = $("#flIni"), ff = $("#flFin"), fp = $("#flProc");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;

  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax;
    if (a > b) { const t = a; a = b; b = t; }
    const rows = fl.filter(f => f.fecha >= a && f.fecha <= b);
    const dates = rows.map(f => f.fecha);
    const procs = fp.value === "__all__" ? PROCS : PROCS.filter(pr => pr.key === fp.value);
    const series = [];
    procs.forEach(pr => {
      series.push({ name: pr.label, type: "bar", stack: "ent", color: pr.color,
        data: rows.map(f => f.entradas[pr.key] || 0) });
      series.push({ name: pr.label, type: "bar", stack: "sal", color: pr.color, itemStyle: { opacity: .5 },
        data: rows.map(f => -(f.salidas[pr.key] || 0)) });
    });
    c.setOption({
      tooltip: {
        trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" },
        formatter: (pp) => {
          const d = pp[0].axisValue, f = rows.find(r => r.fecha === d);
          let s = `<b>${d}</b>`;
          procs.forEach(pr => {
            const e = f.entradas[pr.key] || 0, sa = f.salidas[pr.key] || 0;
            if (e || sa) s += `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${pr.color};margin-right:5px"></span>${pr.label}: <b>+${e}</b> / <b>−${sa}</b> &nbsp;(neto ${e - sa >= 0 ? "+" : ""}${e - sa})`;
          });
          return s;
        },
      },
      legend: { type: "scroll", data: procs.map(pr => pr.label), textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
      grid: { left: 8, right: 16, top: 38, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: dates, axisLine: { lineStyle: { color: ax.line } },
        axisLabel: { color: ax.textColor, fontSize: 10, formatter: (v) => v.slice(5) } },
      yAxis: { type: "value", name: "Entradas (+) / Salidas (−)", nameTextStyle: { color: ax.textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
      series,
    }, true);
  }
  fi.onchange = ff.onchange = fp.onchange = apply;
  apply();
}

function drawArea(el, p) {
  const c = mkChart(el), ax = axisBase();
  const dates = p.serie.map(s => s.fecha);
  const series = PROCS.map(pr => ({
    name: pr.label, type: "line", stack: "t", areaStyle: { opacity: .85 },
    lineStyle: { width: 0 }, symbol: "none", smooth: true, color: pr.color,
    data: p.serie.map(s => s[pr.key] ?? 0),
  }));
  c.setOption({
    tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" } },
    legend: { data: PROCS.map(p => p.label), textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
    grid: { left: 8, right: 14, top: 38, bottom: 6, containLabel: true },
    xAxis: { type: "category", data: dates, boundaryGap: false,
      axisLabel: { color: ax.textColor, fontSize: 10 }, axisLine: { lineStyle: { color: ax.line } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } },
      axisLabel: { color: ax.textColor } },
    series,
  });
}

function drawDonut(el, p) {
  const c = mkChart(el), ax = axisBase();
  const data = PROCS.map(pr => ({ name: pr.label, value: p.por_proceso[pr.key] || 0, itemStyle: { color: pr.color } }))
    .filter(d => d.value > 0);
  if (p.sin_proceso > 0) data.push({ name: "Sin homologar", value: p.sin_proceso, itemStyle: { color: "#5d6678" } });
  c.setOption({
    tooltip: { trigger: "item", ...ax.tooltip, formatter: "{b}: <b>{c}</b> ({d}%)" },
    legend: { type: "scroll", bottom: 0, textStyle: { color: ax.textColor, fontSize: 11 }, icon: "circle" },
    series: [{
      type: "pie", radius: ["52%", "74%"], center: ["50%", "44%"], avoidLabelOverlap: true,
      itemStyle: { borderColor: cssv("--card"), borderWidth: 3, borderRadius: 6 },
      label: { show: true, formatter: "{d}%", color: ax.textColor, fontSize: 11, fontWeight: 700 },
      data,
    }],
  });
}

function drawLine(el, p) {
  const c = mkChart(el), ax = axisBase();
  const dates = p.serie.map(s => s.fecha);
  c.setOption({
    tooltip: { trigger: "axis", ...ax.tooltip },
    legend: { data: ["Total HU", "En producción"], textStyle: { color: ax.textColor, fontSize: 11 }, top: 0 },
    grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: ax.textColor, fontSize: 10 }, axisLine: { lineStyle: { color: ax.line } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
    series: [
      { name: "Total HU", type: "line", smooth: true, symbol: "none", color: "#6366f1",
        lineStyle: { width: 2.5 }, data: p.serie.map(s => s.total) },
      { name: "En producción", type: "line", smooth: true, symbol: "none", color: "#10b981",
        areaStyle: { opacity: .18 }, lineStyle: { width: 2.5 }, data: p.serie.map(s => s.prod) },
    ],
  });
}

function drawGauge(el, p, k) {
  const c = mkChart(el), ax = axisBase();
  const act = k.prod_actual || 0, esp = k.prod_esperada;
  const max = Math.max(act, esp || 0, 1) * 1.2;
  const onTrack = esp == null || act >= esp;
  const cReal = esp == null ? "#38bdf8" : (onTrack ? "#10b981" : "#ef4444"); // real: verde cumple / rojo por debajo
  const cEsp = "#a855f7";                                                     // requerida: morado
  // dos arcos concéntricos: externo = real, interno = requerida -> comparación visual directa
  const ring = (val, color, radius) => ({
    type: "gauge", startAngle: 210, endAngle: -30, min: 0, max: +max.toFixed(2),
    radius, center: ["50%", "52%"], silent: true,
    progress: { show: true, width: 15, roundCap: true, itemStyle: { color } },
    axisLine: { lineStyle: { width: 15, color: [[1, cssv("--card2")]] } },
    pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false },
    axisLabel: { show: false }, anchor: { show: false }, title: { show: false }, detail: { show: false },
    data: [{ value: +val.toFixed(2) }],
  });
  const series = [ring(act, cReal, "92%")];
  if (esp != null) series.push(ring(esp, cEsp, "66%"));
  c.setOption({
    series,
    graphic: [
      { type: "text", left: "center", top: "38%", style: { text: act.toFixed(2), fontSize: 30, fontWeight: 800, fill: cReal, textAlign: "center" } },
      { type: "text", left: "center", top: "55%", style: { text: "HU/día reales", fontSize: 11, fill: ax.textColor, textAlign: "center" } },
      esp != null
        ? { type: "text", left: "center", bottom: 26, style: { text: `● Requerida: ${esp.toFixed(2)} HU/día`, fontSize: 12.5, fontWeight: 600, fill: cEsp, textAlign: "center" } }
        : { type: "text", left: "center", bottom: 16, style: { text: "sin meta de cierre QA", fontSize: 11, fill: ax.textColor, textAlign: "center" } },
      esp != null
        ? { type: "text", left: "center", bottom: 8, style: { text: onTrack ? "✓ Al día con lo requerido" : "⚠ Por debajo de lo requerido", fontSize: 12.5, fontWeight: 700, fill: cReal, textAlign: "center" } }
        : null,
    ].filter(Boolean),
  });
}

/* ---------- vista portafolio ---------- */
function renderPortfolio() {
  const allp = DATA.proyectos;
  const [dmin, dmax] = domainFechas(allp);
  if (PORT_INI == null) PORT_INI = dmin;
  if (PORT_FIN == null) PORT_FIN = dmax;
  let a = PORT_INI, b = PORT_FIN;
  if (a > b) { const t = a; a = b; b = t; }
  const full = (a === dmin && b === dmax);

  // estado de cada proyecto "a la fecha b" (último corte <= b); solo los activos a esa fecha
  const rows = allp.map(p => {
    const s = snapAt(p, b);
    if (!s) return null;
    return {
      codigo: p.codigo, nombre: p.nombre,
      hu_total: s.total, prod: s.prod, pendientes: s.total - s.prod,
      removidas: s.removidas || 0,
      pct_prod: s.total ? s.prod / s.total : null,
      pct_avance: (s.avance == null ? null : s.avance),
    };
  }).filter(Boolean);

  const tot = rows.reduce((x, r) => x + r.hu_total, 0);
  const prod = rows.reduce((x, r) => x + r.prod, 0);
  const removidas = rows.reduce((x, r) => x + r.removidas, 0);
  const wsum = rows.reduce((x, r) => x + (r.pct_avance != null ? r.pct_avance * r.hu_total : 0), 0);
  const wden = rows.reduce((x, r) => x + (r.pct_avance != null ? r.hu_total : 0), 0);
  const avAvance = wden ? wsum / wden : null;
  const pctProdG = tot ? prod / tot : null;
  const alFecha = full ? "al corte" : "al " + b;

  const head = `<div class="project-title fade" style="justify-content:space-between;gap:14px">
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
      <h2>Portafolio</h2><span class="tag">${rows.length} proyectos</span>
      <span class="tag">${full ? "todo el periodo" : "estado " + alFecha}</span>
    </div>
    <div class="filterbar" style="margin:0">
      <label>Desde <input type="date" id="fIni"></label>
      <label>Hasta <input type="date" id="fFin"></label>
      <button class="btn" id="fReset" style="padding:8px 12px;font-size:13px;font-weight:600">↺ Todo</button>
    </div>
  </div>`;
  const kpis = `<div class="grid kpis">
    ${kpi("Proyectos activos", "▦", "#6366f1", `<span data-count="${rows.length}">0</span>`, full ? "en medición" : "con datos " + alFecha)}
    ${kpi("HU Totales", "∑", "#38bdf8", `<span data-count="${tot}">0</span>`, "sin removidas")}
    ${kpi("HU Removidas", "✕", "#94a3b8", `<span data-count="${removidas}">0</span>`, "Removido/Cancelado · fuera del conteo")}
    ${kpi("En Producción", "✓", "#10b981", `<span data-count="${prod}">0</span>`, `de ${fmt(tot)} HU`, pctProdG)}
    ${kpi("% Producción global", "◎", "#a855f7", pctProdG == null ? "—" : `<span data-count="${pctProdG * 100}" data-dec="1" data-suf="%">0</span>`, "agregado", pctProdG)}
    ${kpi("% Avance medio", "◔", "#f59e0b", avAvance == null ? "—" : `<span data-count="${avAvance * 100}" data-dec="0" data-suf="%">0</span>`, "ponderado por HU", avAvance)}
  </div>`;

  const charts = `<div class="grid charts-2">
    <div class="card fade"><h3>Avance y producción por proyecto</h3>
      <div class="hint">Comparativa ${alFecha} · clic para ver detalle</div>
      <div id="cCmp" class="chart tall"></div></div>
    <div class="card fade"><h3>Volumen de HU por proyecto</h3>
      <div class="hint">Tamaño relativo ${alFecha}</div>
      <div id="cVol" class="chart tall"></div></div>
  </div>
  <div class="card fade" style="margin-top:16px">
    <h3>Productividad por proyecto en el tiempo</h3>
    <div class="hint">HU a producción / día hábil · recalculada dentro del rango <b>Desde–Hasta</b> de arriba</div>
    <div id="cProd" class="chart tall"></div>
  </div>` + (RECURSOS ? `
  <div class="card fade" style="margin-top:16px">
    <h3>⚙️ Productividad persona-día por proyecto · en el tiempo</h3>
    <div class="hint">Una línea por proyecto · eje X fechas, eje Y productividad (HU gestionadas ÷ personas REQ+DEV+QA) · filtra el rango de fechas</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="pcIni"></label>
      <label>Hasta <input type="date" id="pcFin"></label>
    </div>
    <div id="cProdComp" class="chart tall"></div>
  </div>` : "");
  const recursos = recursosCard(RECURSOS ? RECURSOS.portafolio : null, "Portafolio",
    RECURSOS ? "consolidado (sin doble-conteo de plantas compartidas)" : null);
  $("#content").innerHTML = head + kpis + recursos + charts;
  if (RECURSOS) setupRecursos(RECURSOS.portafolio);

  // filtros (gobiernan todo el portafolio) — el estado vive en PORT_INI/PORT_FIN
  const fi = $("#fIni"), ff = $("#fFin");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = a; ff.value = b;
  fi.onchange = () => { PORT_INI = fi.value || dmin; render("__all__"); };
  ff.onchange = () => { PORT_FIN = ff.value || dmax; render("__all__"); };
  $("#fReset").onclick = () => { PORT_INI = dmin; PORT_FIN = dmax; render("__all__"); };

  countUp();
  drawCompare($("#cCmp"), rows);
  drawVolume($("#cVol"), rows);
  drawProductividad($("#cProd"), allp, a, b);
  if (RECURSOS) setupProdComp();
}

/* estado (punto de serie) vigente a la fecha d: último corte con fecha <= d, o null */
function snapAt(p, d) {
  let best = null;
  for (const s of p.serie) { if (s.fecha <= d) best = s; else break; }
  return best;
}

/* dominio de fechas (min/max) entre todas las series de proyecto */
function domainFechas(ps) {
  let min = null, max = null;
  ps.forEach(p => p.serie.forEach(s => {
    if (min == null || s.fecha < min) min = s.fecha;
    if (max == null || s.fecha > max) max = s.fecha;
  }));
  return [min, max];
}

/* productividad por ventana [a,b]: por cada proyecto, en cada corte d dentro del rango,
   (HU en prod en d − HU en prod en la base) / (días hábiles en d − días hábiles en la base),
   donde la base es el último corte con fecha <= a. Recalcular = "redimensionar la información". */
function calcSerieProd(ps, a, b) {
  const legend = [], series = [];
  ps.forEach((p, i) => {
    const sr = p.serie.filter(s => s.dias_hab != null);
    if (!sr.length) return;
    let base = { prod: 0, dias_hab: 0 };          // si 'a' es anterior al inicio -> desde el arranque
    for (const s of sr) { if (s.fecha <= a) base = s; else break; }
    const data = [];
    for (const s of sr) {
      if (s.fecha < a || s.fecha > b) continue;
      const dw = s.dias_hab - base.dias_hab, pw = s.prod - base.prod;
      data.push([s.fecha, dw > 0 ? +(pw / dw).toFixed(3) : null]);
    }
    if (!data.length) return;
    const name = etiqueta(p);
    legend.push(name);
    series.push({
      name, type: "line", smooth: true, showSymbol: true, symbol: "circle", symbolSize: 6,
      connectNulls: true, lineStyle: { width: 2 }, color: PALETTE[i % PALETTE.length], data,
    });
  });
  return { legend, series };
}

function drawProductividad(el, allp, a, b) {
  const c = mkChart(el), ax = axisBase();
  const { legend, series } = calcSerieProd(allp, a, b);
  c.setOption({
    tooltip: {
      trigger: "axis", ...ax.tooltip,
      valueFormatter: (v) => v == null ? "—" : v.toFixed(2).replace(".", ",") + " HU/día",
    },
    legend: { type: "scroll", data: legend, textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
    grid: { left: 8, right: 18, top: 38, bottom: 6, containLabel: true },
    xAxis: {
      type: "time", axisLine: { lineStyle: { color: ax.line } },
      axisLabel: { color: ax.textColor, fontSize: 10, formatter: (val) => echarts.format.formatTime("dd/MM", val) },
    },
    yAxis: {
      type: "value", name: "HU/día hábil", nameTextStyle: { color: ax.textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor },
    },
    series,
  });
}

function drawCompare(el, rows) {
  const c = mkChart(el), ax = axisBase();
  const names = rows.map(r => r.codigo);
  const lblMap = Object.fromEntries(rows.map(r => [r.codigo, etiqueta2l(r)]));
  c.setOption({
    tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" },
      valueFormatter: (v) => (v == null ? "—" : (v).toFixed(0) + "%") },
    legend: { data: ["% Producción", "% Avance"], textStyle: { color: ax.textColor, fontSize: 11 }, top: 0 },
    grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
    xAxis: { type: "category", data: names,
      axisLabel: { color: ax.textColor, fontSize: 10, interval: 0, lineHeight: 13,
        formatter: (v) => lblMap[v] || v },
      axisLine: { lineStyle: { color: ax.line } } },
    yAxis: { type: "value", max: 100, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, formatter: "{value}%" } },
    series: [
      { name: "% Producción", type: "bar", color: "#10b981", barWidth: 14, itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: rows.map(r => r.pct_prod != null ? +(r.pct_prod * 100).toFixed(0) : 0) },
      { name: "% Avance", type: "bar", color: "#a855f7", barWidth: 14, itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: rows.map(r => r.pct_avance != null ? +(r.pct_avance * 100).toFixed(0) : null) },
    ],
  });
  c.on("click", (e) => { const cod = rows[e.dataIndex].codigo; $("#proySel").value = cod; render(cod); });
}

function drawVolume(el, rows) {
  const c = mkChart(el), ax = axisBase();
  const sorted = [...rows].sort((a, b) => a.hu_total - b.hu_total);
  c.setOption({
    tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" } },
    legend: { data: ["En producción", "Pendientes"], textStyle: { color: ax.textColor, fontSize: 11 }, top: 0 },
    grid: { left: 8, right: 20, top: 34, bottom: 6, containLabel: true },
    xAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
    yAxis: { type: "category", data: sorted.map(r => etiqueta(r)), axisLabel: { color: ax.textColor, fontSize: 11 }, axisLine: { lineStyle: { color: ax.line } } },
    series: [
      { name: "En producción", type: "bar", stack: "h", color: "#10b981", data: sorted.map(r => r.prod) },
      { name: "Pendientes", type: "bar", stack: "h", color: "#6366f1", itemStyle: { borderRadius: [0, 4, 4, 0] }, data: sorted.map(r => r.pendientes) },
    ],
  });
  c.on("click", (e) => { const cod = sorted[e.dataIndex].codigo; $("#proySel").value = cod; render(cod); });
}
