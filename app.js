/* Tableros DORA — dashboard web (datos: data.json generado por build_dashboard_data.py) */
/* Los procesos (key/label/color) vienen del JSON -> sin strings de proceso hardcodeados. */
let DATA = null, CURRENT = null, CHARTS = [], PROCS = [], PORT_INI = null, PORT_FIN = null;
/* paleta por proyecto (gráfico de productividad en el tiempo) */
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#38bdf8", "#a855f7", "#ef4444", "#f472b6", "#22d3ee"];

const $ = (s) => document.querySelector(s);
const cssv = (n) => getComputedStyle(document.body).getPropertyValue(n).trim();
const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("es-CO").format(Math.round(n));
const pct = (n) => n == null ? "—" : (n * 100).toFixed(1).replace(".", ",") + "%";
const pct0 = (n) => n == null ? "—" : Math.round(n * 100) + "%";
/* etiqueta homologada de proyecto (igual que el menú desplegable) */
const shorten = (s, n = 16) => (s && s.length > n ? s.slice(0, n - 1) + "…" : (s || ""));
const etiqueta = (p) => `${p.codigo} · ${p.nombre}`;            // largo (ejes horizontales / tooltips)
const etiqueta2l = (p) => `${p.codigo}\n${shorten(p.nombre, 14)}`; // 2 líneas (ejes de barras verticales)

/* ---------- carga ---------- */
fetch("data.json").then(r => r.json()).then(d => {
  DATA = d;
  PROCS = d.procesos; // [{key,label,color}]
  $("#corte").textContent = d.corte;
  $("#gen").textContent = d.generado;
  $("#filas").textContent = fmt(d.total_filas);
  const sel = $("#proySel");
  sel.innerHTML = `<option value="__all__">▦ Portafolio (todos)</option>` +
    d.proyectos.map(p => `<option value="${p.codigo}">${p.codigo} · ${p.nombre}</option>`).join("");
  sel.onchange = () => render(sel.value);
  render("__all__");
}).catch(e => { $("#content").innerHTML = `<div class="card">Error cargando datos: ${e}</div>`; });

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
    <div class="card fade"><h3>Productividad</h3>
      <div class="hint">Ritmo actual vs. requerido para cumplir el cierre</div>
      <div id="cGauge" class="chart"></div></div>
  </div>`;

  $("#content").innerHTML = head + kpis + charts;
  countUp();
  drawArea($("#cArea"), p);
  drawDonut($("#cDonut"), p);
  drawLine($("#cLine"), p);
  drawGauge($("#cGauge"), p, k);
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
  const max = Math.max(act, esp || 0, 1) * 1.25;
  c.setOption({
    tooltip: { ...ax.tooltip, formatter: (x) => `${x.name}: <b>${x.value.toFixed(2)}</b> HU/día` },
    series: [{
      type: "gauge", min: 0, max: +max.toFixed(1), startAngle: 200, endAngle: -20,
      radius: "92%", center: ["50%", "58%"],
      progress: { show: true, width: 14, itemStyle: { color: act >= (esp || 0) ? "#10b981" : "#f59e0b" } },
      axisLine: { lineStyle: { width: 14, color: [[1, cssv("--line")]] } },
      pointer: { width: 5, length: "62%", itemStyle: { color: cssv("--text") } },
      axisTick: { show: false }, splitLine: { length: 10, lineStyle: { color: cssv("--line") } },
      axisLabel: { color: ax.textColor, fontSize: 9, distance: 14 },
      anchor: { show: true, size: 12, itemStyle: { color: cssv("--text") } },
      title: { offsetCenter: [0, "30%"], color: ax.textColor, fontSize: 12 },
      detail: { valueAnimation: true, offsetCenter: [0, "-2%"], fontSize: 26, fontWeight: 800,
        color: cssv("--text"), formatter: (v) => v.toFixed(2) },
      data: [{ value: +act.toFixed(2), name: "HU/día actual" }],
      markLine: esp ? {} : undefined,
    }],
    graphic: esp ? [{
      type: "text", left: "center", bottom: 6,
      style: { text: `Requerido para cumplir: ${esp.toFixed(2)} HU/día`, fill: ax.textColor, fontSize: 11 },
    }] : [],
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
      pct_prod: s.total ? s.prod / s.total : null,
      pct_avance: (s.avance == null ? null : s.avance),
    };
  }).filter(Boolean);

  const tot = rows.reduce((x, r) => x + r.hu_total, 0);
  const prod = rows.reduce((x, r) => x + r.prod, 0);
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
    ${kpi("HU Totales", "∑", "#38bdf8", `<span data-count="${tot}">0</span>`, "en el portafolio")}
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
  </div>`;
  $("#content").innerHTML = head + kpis + charts;

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
