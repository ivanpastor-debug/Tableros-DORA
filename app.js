/* Tableros DORA — dashboard web (datos: data.json generado por build_dashboard_data.py) */
/* Los procesos (key/label/color) vienen del JSON -> sin strings de proceso hardcodeados. */
let DATA = null, CURRENT = null, CHARTS = [], PROCS = [], prodChart = null;
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
  const ps = DATA.proyectos;
  const tot = ps.reduce((a, p) => a + p.kpis.hu_total, 0);
  const prod = ps.reduce((a, p) => a + p.kpis.hu_prod, 0);
  const wsum = ps.reduce((a, p) => a + (p.kpis.pct_avance != null ? p.kpis.pct_avance * p.kpis.hu_total : 0), 0);
  const wden = ps.reduce((a, p) => a + (p.kpis.pct_avance != null ? p.kpis.hu_total : 0), 0);
  const avAvance = wden ? wsum / wden : null;

  const head = `<div class="project-title fade">
    <h2>Portafolio</h2><span class="tag">${ps.length} proyectos</span></div>`;
  const kpis = `<div class="grid kpis">
    ${kpi("Proyectos activos", "▦", "#6366f1", `<span data-count="${ps.length}">0</span>`, "en medición")}
    ${kpi("HU Totales", "∑", "#38bdf8", `<span data-count="${tot}">0</span>`, "en todo el portafolio")}
    ${kpi("En Producción", "✓", "#10b981", `<span data-count="${prod}">0</span>`, `de ${fmt(tot)} HU`, prod / tot)}
    ${kpi("% Producción global", "◎", "#a855f7", `<span data-count="${(prod / tot) * 100}" data-dec="1" data-suf="%">0</span>`, "agregado", prod / tot)}
    ${kpi("% Avance medio", "◔", "#f59e0b", avAvance == null ? "—" : `<span data-count="${avAvance * 100}" data-dec="0" data-suf="%">0</span>`, "ponderado por HU", avAvance)}
  </div>`;

  const charts = `<div class="grid charts-2">
    <div class="card fade"><h3>Avance y producción por proyecto</h3>
      <div class="hint">Comparativa del portafolio · clic para ver detalle</div>
      <div id="cCmp" class="chart tall"></div></div>
    <div class="card fade"><h3>Volumen de HU por proyecto</h3>
      <div class="hint">Tamaño relativo de cada proyecto</div>
      <div id="cVol" class="chart tall"></div></div>
  </div>
  <div class="card fade" style="margin-top:16px">
    <h3>Productividad por proyecto en el tiempo</h3>
    <div class="hint">HU puestas en producción por día hábil · se <b>recalcula</b> dentro del rango de fechas elegido</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="fIni"></label>
      <label>Hasta <input type="date" id="fFin"></label>
      <button class="btn" id="fReset" style="padding:8px 12px;font-size:13px;font-weight:600">↺ Todo el periodo</button>
    </div>
    <div id="cProd" class="chart tall"></div>
  </div>`;
  $("#content").innerHTML = head + kpis + charts;
  countUp();
  drawCompare($("#cCmp"), ps);
  drawVolume($("#cVol"), ps);
  drawProductividad($("#cProd"), ps);
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

function drawProductividad(el, ps) {
  prodChart = mkChart(el);
  const ax = axisBase();
  const [dmin, dmax] = domainFechas(ps);
  const fi = $("#fIni"), ff = $("#fFin");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;

  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax;
    if (a > b) { const t = a; a = b; b = t; }       // tolera rango invertido
    const { legend, series } = calcSerieProd(ps, a, b);
    prodChart.setOption({
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
    }, true);  // notMerge: refleja el cambio de nº de series al filtrar
  }
  fi.onchange = apply; ff.onchange = apply;
  $("#fReset").onclick = () => { fi.value = dmin; ff.value = dmax; apply(); };
  apply();
}

function drawCompare(el, ps) {
  const c = mkChart(el), ax = axisBase();
  const names = ps.map(p => p.codigo);
  const lblMap = Object.fromEntries(ps.map(p => [p.codigo, etiqueta2l(p)]));
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
        data: ps.map(p => p.kpis.pct_prod != null ? +(p.kpis.pct_prod * 100).toFixed(0) : 0) },
      { name: "% Avance", type: "bar", color: "#a855f7", barWidth: 14, itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: ps.map(p => p.kpis.pct_avance != null ? +(p.kpis.pct_avance * 100).toFixed(0) : null) },
    ],
  });
  c.on("click", (e) => { $("#proySel").value = ps[e.dataIndex].codigo; render(ps[e.dataIndex].codigo); });
}

function drawVolume(el, ps) {
  const c = mkChart(el), ax = axisBase();
  const sorted = [...ps].sort((a, b) => a.kpis.hu_total - b.kpis.hu_total);
  c.setOption({
    tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" } },
    legend: { data: ["En producción", "Pendientes"], textStyle: { color: ax.textColor, fontSize: 11 }, top: 0 },
    grid: { left: 8, right: 20, top: 34, bottom: 6, containLabel: true },
    xAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
    yAxis: { type: "category", data: sorted.map(p => etiqueta(p)), axisLabel: { color: ax.textColor, fontSize: 11 }, axisLine: { lineStyle: { color: ax.line } } },
    series: [
      { name: "En producción", type: "bar", stack: "h", color: "#10b981", data: sorted.map(p => p.kpis.hu_prod) },
      { name: "Pendientes", type: "bar", stack: "h", color: "#6366f1", itemStyle: { borderRadius: [0, 4, 4, 0] }, data: sorted.map(p => p.kpis.hu_pendientes) },
    ],
  });
  c.on("click", (e) => { const cod = sorted[e.dataIndex].codigo; $("#proySel").value = cod; render(cod); });
}
