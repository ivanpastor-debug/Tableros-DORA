/* Tableros DORA — dashboard web (datos: data.json generado por build_dashboard_data.py) */
/* Los procesos (key/label/color) vienen del JSON -> sin strings de proceso hardcodeados. */
let DATA = null, CURRENT = null, CHARTS = [], PROCS = [], PORT_INI = null, PORT_FIN = null, RECURSOS = null, CARGA = null, CRONO = null, RQC = null, PRODUCTIV = null, COSTOS = null, CONTROLES = null;
/* paleta por proyecto (gráfico de productividad en el tiempo) */
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#38bdf8", "#a855f7", "#ef4444", "#f472b6", "#22d3ee"];

const $ = (s) => document.querySelector(s);
const cssv = (n) => getComputedStyle(document.body).getPropertyValue(n).trim();
const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("es-CO").format(Math.round(n));
const pct = (n) => n == null ? "—" : (n * 100).toFixed(1).replace(".", ",") + "%";
const pct0 = (n) => n == null ? "—" : Math.round(n * 100) + "%";
/* moneda COP compacta (millones) para los cuadros de costo internos */
const fmtMoney = (n) => n == null ? "—" : (Math.abs(n) >= 1e6
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
  // carga por responsable + alertas = archivo INTERNO (gitignored, con nombres); ausente en público -> oculto
  try { const cc = await fetch("data_carga.json"); CARGA = cc.ok ? await cc.json() : null; }
  catch (_) { CARGA = null; }
  // tablero consolidado de cronograma (Positiva Core 416+355); ausente -> no aparece la opción
  try { const cr = await fetch("data_cronograma.json"); CRONO = cr.ok ? await cr.json() : null; }
  catch (_) { CRONO = null; }
  // cumplimiento RQC del 421 (sección en perfiles Directivo/Gerencial); ausente -> no se muestra
  try { const rq = await fetch("data_rqc.json"); RQC = rq.ok ? await rq.json() : null; }
  catch (_) { RQC = null; }
  // productividad diaria por proceso (meta vs real, variación); ausente -> no se muestra
  try { const pr = await fetch("data_productividad.json"); PRODUCTIV = pr.ok ? await pr.json() : null; }
  catch (_) { PRODUCTIV = null; }
  // costos vs salidas por proyecto (nómina vs ejecutado vs variación; perfiles Directivo/Gerencial)
  try { const co = await fetch("data_costos.json"); COSTOS = co.ok ? await co.json() : null; }
  catch (_) { COSTOS = null; }
  // controles de cambio (vista general replicada sobre las HU CC; pestaña solo donde haya datos)
  try { const cc = await fetch("data_controles.json"); CONTROLES = cc.ok ? await cc.json() : null; }
  catch (_) { CONTROLES = null; }
  const sel = $("#proySel");
  const cronoOpt = CRONO ? `<option value="__crono__">📅 ${CRONO.nombre}</option>` : "";
  sel.innerHTML = `<option value="__all__">▦ Portafolio (todos)</option>` + cronoOpt +
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
  const sel = (areaSel && pa[areaSel]) ? pa[areaSel] : null;
  const n = sel ? sel.n : totalN;
  const chip = (k) => (pa[k] && pa[k].n) ? `<span class="rchip${areaSel === k ? " on" : ""}" onclick="recSelArea('${k}')"><span class="rdot" style="background:${AREA_COL[k]}"></span>${AREA_LBL[k]} <b>${pa[k].n}</b></span>` : "";
  // Visual financiera RETIRADA (se proyectará en otra iteración) -> solo cantidad de recursos + por área.
  return `<div class="rrow">
      <div class="rbig"><div class="rbign">${n}</div><div class="rbigl">${sel ? AREA_LBL[areaSel] : "personas"}</div></div>
      <div class="rchips">${AREA_ORDER.map(chip).join("")}${areaSel ? `<span class="rchip rclear" onclick="recSelArea('${areaSel}')">✕ ver todas</span>` : ""}</div>
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
    <div class="hint">${nota ? nota + " · " : ""}equipo activo a la fecha · <b>clic en un área</b> para ver su nº de personas</div>
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

/* ---------- carga por responsable + panel de alertas (INTERNO, data_carga.json) ---------- */
const esc = (s) => s == null ? "" : String(s).replace(/[<>&]/g, m => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]));
function cargaObj(cod) { return CARGA && CARGA.proyectos ? CARGA.proyectos[cod] : null; }
function diasBadge(d) {
  if (d == null) return '<span class="muted">—</span>';
  const c = d > 20 ? "#ef4444" : d > 8 ? "#f59e0b" : "#38bdf8";   // severidad por antigüedad
  return `<span class="abadge" style="background:${c}">${d}d</span>`;
}
/* contador de HU por estado (proceso homologado) para las tablas de HU con más tiempo.
   Una casilla por proceso presente, en el orden canónico de PROCS, con color y conteo.
   Cada casilla es un FILTRO (clic): filtra la tabla del mismo card por ese proceso. */
function contadorEstado(items) {
  if (!items || !items.length) return "";
  const colOf = {}, lblOf = {}, order = PROCS.map(p => p.key);
  PROCS.forEach(p => { colOf[p.key] = p.color; lblOf[p.key] = p.label; });
  const cnt = {};
  items.forEach(it => { const k = it.proceso || "—"; cnt[k] = (cnt[k] || 0) + 1; });
  const rank = k => { const i = order.indexOf(k); return i < 0 ? 99 : i; };
  const chips = Object.keys(cnt).sort((a, b) => rank(a) - rank(b)).map(k =>
    `<span class="rchip" style="cursor:pointer" data-fkey="proc" data-fval="${esc(k)}" onclick="chipFilter(this)">
       <span class="rdot" style="background:${colOf[k] || "#5d6678"}"></span>${esc(lblOf[k] || (k === "—" ? "Sin proceso" : k))} <b>${cnt[k]}</b>
     </span>`).join("");
  return `<div class="rchips" style="margin:4px 0 10px">${chips}<span class="hint" style="margin:0 0 0 2px;align-self:center">filtra la tabla ↓</span></div>`;
}

/* filtro genérico de tabla por casilla-contador. Muestra/oculta filas según data-<key> de cada
   fila (o data-<key>s con lista separada por '|'). Clic en la casilla activa alterna el filtro. */
function chipFilter(el) {
  let card = el.parentElement;
  while (card && !card.querySelector("table.dtbl")) card = card.parentElement;
  if (!card) return;
  const key = el.dataset.fkey, val = el.dataset.fval, wasOn = el.classList.contains("fon");
  card.querySelectorAll("[data-fkey='" + key + "']").forEach(g => { g.classList.remove("fon"); chipSel(g, false); });
  const active = wasOn ? null : val;
  if (active != null) { el.classList.add("fon"); chipSel(el, true); }
  const tb = card.querySelector("table.dtbl tbody"); if (!tb) return;
  [...tb.rows].forEach(r => {
    if (r.classList.contains("rdetail")) { r.style.display = "none"; return; }  // detalle siempre colapsado al filtrar
    if (active == null) { r.style.display = ""; return; }
    const single = r.dataset[key], multi = r.dataset[key + "s"];
    const ok = single === active || (multi && multi.split("|").includes(active));
    r.style.display = ok ? "" : "none";
  });
}
function chipSel(el, on) {
  if (el.classList.contains("rchip")) el.classList.toggle("on", on);
  else el.style.boxShadow = on ? "0 0 0 2px var(--accent)" : "";   // casilla KPI (planta por área)
}
function toggleResp(cod, i) {
  document.querySelectorAll(`.det-${cod}-${i}`).forEach(tr => { tr.style.display = tr.style.display === "none" ? "" : "none"; });
  const car = document.getElementById(`car-${cod}-${i}`); if (car) car.textContent = car.textContent === "▸" ? "▾" : "▸";
}
/* renderiza la tabla de carga a partir de una lista de responsables (reusable: un proyecto o el
   combinado de varios). idp = prefijo único de ids para el colapso de detalle. */
function cargaTable(responsables, idp, titulo, nota) {
  if (!responsables || !responsables.length) return "";
  let body = "";
  responsables.forEach((r, i) => {
    const av = r.avance;
    const procs = [...new Set((r.hus || []).map(h => h.proceso || "—"))].join("|");
    body += `<tr class="rclk" data-procs="${esc(procs)}" onclick="toggleResp('${idp}',${i})">
        <td><span class="caret" id="car-${idp}-${i}">▸</span> ${esc(r.nombre)}</td>
        <td><span class="chip2">${esc(r.cargo)}</span></td>
        <td class="muted">${esc(AREA_LBL[r.area] || r.area || "")}</td>
        <td class="num">${r.hu_total}</td>
        <td class="num">${r.pendientes}</td>
        <td class="num">${av == null ? "—" : `<span class="tbar"><i style="width:${Math.round(av * 100)}%"></i></span>${pct0(av)}`}</td>
      </tr>`;
    (r.hus || []).forEach(h => {
      body += `<tr class="rdetail det-${idp}-${i}" style="display:none">
        <td>↳ HU ${h.id}</td><td colspan="2" title="${esc(h.titulo)}">${esc((h.titulo || h.state || "").slice(0, 60))}</td>
        <td class="num">${h.pct == null ? "—" : h.pct + "%"}</td>
        <td class="num">${diasBadge(h.dias_sin_mov)}</td>
        <td class="muted">${esc(h.state)}</td></tr>`;
    });
  });
  const todasHus = responsables.flatMap(r => r.hus || []);
  return `<div class="card fade" style="margin-top:16px">
    <h3>👤 Carga por responsable${titulo ? " · " + titulo : ""}</h3>
    <div class="hint">${nota}</div>
    ${contadorEstado(todasHus)}
    <div class="dwrap"><table class="dtbl"><thead><tr>
      <th>Responsable</th><th>Cargo</th><th>Área</th><th class="num">HU</th><th class="num">Pend.</th><th class="num">Avance</th>
    </tr></thead><tbody>${body}</tbody></table></div>
  </div>`;
}
function cargaCard(cod, src) {
  const c = src || cargaObj(cod);   // src permite reusar la tarjeta con otra fuente (p.ej. controles)
  if (!c || !(c.responsables || []).length) return "";
  return cargaTable(c.responsables, cod, null,
    "HU asignadas al responsable actual · avance ponderado por homologación · <b>clic en una fila</b> para ver sus HU");
}
/* carga combinada de varios proyectos (p.ej. Positiva Core 416+355): fusiona por persona (suma HU
   y pendientes, concatena sus HU, avance ponderado por HU) y ordena de MAYOR a menor nº de HU. */
function cargaCardMulti(cods, titulo) {
  if (!CARGA || !CARGA.proyectos) return "";
  const byKey = {};
  cods.forEach(cod => {
    const c = cargaObj(cod); if (!c) return;
    (c.responsables || []).forEach(r => {
      const k = (r.nombre || "") + "§" + (r.cargo || "");
      const o = byKey[k] || (byKey[k] = { nombre: r.nombre, cargo: r.cargo, area: r.area, hus: [], hu_total: 0, pendientes: 0, _avs: 0, _avw: 0 });
      o.hus.push(...(r.hus || []));
      o.hu_total += r.hu_total || 0;
      o.pendientes += r.pendientes || 0;
      if (r.avance != null && r.hu_total) { o._avs += r.avance * r.hu_total; o._avw += r.hu_total; }
    });
  });
  const responsables = Object.values(byKey)
    .map(o => ({ nombre: o.nombre, cargo: o.cargo, area: o.area, hus: o.hus, hu_total: o.hu_total, pendientes: o.pendientes, avance: o._avw ? o._avs / o._avw : null }))
    .sort((a, b) => b.hu_total - a.hu_total);
  return cargaTable(responsables, "cargamulti", titulo,
    "HU asignadas al responsable actual (combinado) · ordenado de mayor a menor nº de HU · avance ponderado · <b>clic en una fila</b> para ver sus HU · usa los chips para filtrar por proceso");
}
function alertasCard(cod, src) {
  const c = src || cargaObj(cod);   // src permite reusar la tarjeta con otra fuente (p.ej. controles)
  if (!c || !(c.alertas || []).length) return "";
  const A = c.alertas, cap = 150;
  const crit = A.filter(a => a.dias_sin_mov != null && a.dias_sin_mov > 20).length;
  const rows = A.slice(0, cap).map(a => `<tr data-proc="${esc(a.proceso || "—")}">
      <td class="num">${diasBadge(a.dias_sin_mov)}</td>
      <td>HU ${a.id}</td>
      <td title="${esc(a.titulo)}">${esc((a.titulo || "").slice(0, 60)) || "<span class='muted'>—</span>"}</td>
      <td>${esc(a.state)}</td>
      <td class="muted">${esc(a.responsable)}</td>
      <td><span class="chip2">${esc(a.cargo)}</span></td>
      <td class="muted">desde ${a.desde || "—"}</td>
    </tr>`).join("");
  return `<div class="card fade" style="margin-top:16px">
    <h3>🚨 Alertas · HU sin movimiento</h3>
    <div class="hint">Días en el estado actual sin cambios · de la más antigua a la más reciente · <b>${crit}</b> con +20 días${A.length > cap ? ` · mostrando ${cap} de ${A.length}` : ""}</div>
    ${contadorEstado(A)}
    <div class="dwrap"><table class="dtbl"><thead><tr>
      <th class="num">Días</th><th>HU</th><th>Título</th><th>Estado</th><th>Responsable</th><th>Cargo</th><th>Desde</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
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

/* evolución de la planta POR DÍA (dispersión lineal): nº de personas activas por día desde el
   primer archivo de planta (la foto histórica más antigua, 10-abr-2026). Total + una línea por
   área. Usa el histórico híbrido de data_recursos.json (snapRec resuelve la foto vigente a cada
   día; el export 'Planta proyectos_histórico' aporta abr-may, los diarios de jun en adelante). */
function dayRange(d0, d1) {            // días calendario inclusive, ISO YYYY-MM-DD
  const out = [], end = Date.parse(d1 + "T00:00:00Z");
  for (let t = Date.parse(d0 + "T00:00:00Z"); t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
function setupPlantaEvol(resObj, ids) {
  const id = ids || { el: "#cPlanta", ini: "#plIni", fin: "#plFin" };
  const el = $(id.el); if (!el || !RECURSOS || !resObj) return;
  const P = RECURSOS.plantas || [];
  if (!P.length) return;                 // sin archivos de planta no hay serie diaria
  const d0 = P[0].fecha, d1 = P[P.length - 1].fecha;   // desde el 1er archivo hasta el más reciente
  const c = mkChart(el), ax = axisBase();
  const fi = $(id.ini), ff = $(id.fin);
  fi.min = ff.min = d0; fi.max = ff.max = d1; fi.value = d0; ff.value = d1;
  function apply() {
    let a = fi.value || d0, b = ff.value || d1; if (a > b) { const t = a; a = b; b = t; }
    const days = dayRange(a, b);
    const snaps = days.map(d => snapRec(resObj, RECURSOS.fechas, d) || { por_area: {} });
    const tot = (s) => AREA_ORDER.reduce((acc, k) => acc + ((s.por_area[k] && s.por_area[k].n) || 0), 0);
    const presentes = AREA_ORDER.filter(k => snaps.some(s => s.por_area[k] && s.por_area[k].n > 0));
    const series = [{
      name: "Total", type: "line", smooth: false, showSymbol: true, symbol: "circle", symbolSize: 7,
      lineStyle: { width: 3 }, color: "#22d3ee", data: snaps.map(tot),
    }].concat(presentes.map(k => ({
      name: AREA_LBL[k], type: "line", smooth: false, showSymbol: true, symbol: "circle", symbolSize: 5,
      color: AREA_COL[k], data: snaps.map(s => (s.por_area[k] && s.por_area[k].n) || 0),
    })));
    c.setOption({
      tooltip: { trigger: "axis", ...ax.tooltip, valueFormatter: (v) => v == null ? "—" : v + " pers." },
      legend: { type: "scroll", data: series.map(s => s.name), textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "circle" },
      grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: days, axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 10, formatter: (v) => v.slice(5) } },
      yAxis: { type: "value", name: "personas", nameTextStyle: { color: ax.textColor, fontSize: 10 }, minInterval: 1, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
      series,
    }, true);
  }
  fi.onchange = ff.onchange = apply;
  apply();
}

/* costos vs salidas: recalcula el modelo para la ventana [a,b]. La planta se paga todos los días
   hábiles del periodo (Nómina = costo/día × días) y solo está justificada hasta su última salida
   dentro de la ventana (Ejecutado); Variación = Ejecutado − Nómina. Días hábiles = diferencia de
   dias_hab acumulados (festivos CO ya excluidos al generarlos). */
function costosWindow(C, a, b) {
  const F = C.fechas, DH = C.dias_hab, KS = ["REQ", "DEV", "QA"];
  const res = { areas: {}, total: { nomina: 0, ejecutado: 0, variacion: 0, salidas_tot: 0, personas: 0, dias_periodo: 0 } };
  const idx = F.map((f, i) => i).filter(i => F[i] >= a && F[i] <= b);
  const base = (k) => { const ar = C.areas[k]; return { proceso: ar.proceso, area: ar.area, personas: ar.personas, costo_dia: ar.costo_dia }; };
  if (!idx.length) {
    KS.forEach(k => { if (!C.areas[k]) return; res.areas[k] = { ...base(k), salidas_tot: 0, ultima_salida: null, dias_periodo: 0, dias_hasta_ultima: 0, dias_ociosos: 0, nomina: 0, ejecutado: 0, variacion: 0 }; res.total.personas += C.areas[k].personas; });
    return res;
  }
  const first = idx[0], last = idx[idx.length - 1];
  const diasPeriodo = DH[last] - DH[first] + 1;
  res.total.dias_periodo = diasPeriodo;
  KS.forEach(k => {
    const ar = C.areas[k]; if (!ar) return;
    let salTot = 0, uIdx = -1;
    idx.forEach(i => { const s = ar.salidas[i] || 0; if (s > 0) { salTot += s; uIdx = i; } });
    const diasHasta = uIdx >= 0 ? DH[uIdx] - DH[first] + 1 : 0;
    const nomina = ar.costo_dia * diasPeriodo, ejecutado = ar.costo_dia * diasHasta;
    res.areas[k] = { ...base(k), salidas_tot: salTot, ultima_salida: uIdx >= 0 ? F[uIdx] : null, dias_periodo: diasPeriodo, dias_hasta_ultima: diasHasta, dias_ociosos: diasPeriodo - diasHasta, nomina, ejecutado, variacion: ejecutado - nomina };
    res.total.nomina += nomina; res.total.ejecutado += ejecutado; res.total.variacion += (ejecutado - nomina);
    res.total.salidas_tot += salTot; res.total.personas += ar.personas;
  });
  return res;
}
function costosTable(C, w) {
  const row = (a) => `<tr>
    <td><span class="sw-i" style="background:${AREA_COL[a.area]}"></span>${a.proceso}</td>
    <td class="num">${fmt(a.personas)}</td><td class="num">${fmtMoney(a.costo_dia)}</td>
    <td class="num">${fmt(a.salidas_tot)}</td><td class="num">${a.ultima_salida || "—"}</td>
    <td class="num">${a.dias_ociosos}</td><td class="num">${fmtMoney(a.nomina)}</td>
    <td class="num">${fmtMoney(a.ejecutado)}</td>
    <td class="num" style="color:${a.variacion < 0 ? "#ef4444" : "#10b981"};font-weight:600">${fmtMoney(a.variacion)}</td></tr>`;
  const ar = ["REQ", "DEV", "QA"].map(k => w.areas[k]).filter(Boolean), t = w.total;
  return `<div class="hint" style="margin:0 0 6px">Periodo seleccionado: <b>${t.dias_periodo}</b> días hábiles · costo CTC medio ÷ ${COSTOS.dias_mes}</div>
  <div class="dwrap"><table class="dtbl"><thead><tr>
    <th>Proceso</th><th class="num">Personas</th><th class="num">Costo/día</th><th class="num">Salidas</th><th class="num">Última salida</th><th class="num">Días ociosos</th><th class="num">Nómina</th><th class="num">Ejecutado</th><th class="num">Variación</th>
  </tr></thead><tbody>${ar.map(row).join("")}
    <tr class="tot"><th>Total</th><td class="num">${fmt(t.personas)}</td><td class="num">—</td><td class="num">${fmt(t.salidas_tot)}</td><td class="num">—</td><td class="num">—</td><td class="num">${fmtMoney(t.nomina)}</td><td class="num">${fmtMoney(t.ejecutado)}</td><td class="num" style="color:${t.variacion < 0 ? "#ef4444" : "#10b981"};font-weight:700">${fmtMoney(t.variacion)}</td></tr>
  </tbody></table></div>`;
}
function drawCostosBar(c, w) {
  const ax = axisBase();
  const ar = ["REQ", "DEV", "QA"].map(k => w.areas[k]).filter(Boolean);
  c.setOption({
    tooltip: {
      trigger: "axis", ...ax.tooltip, formatter: (ps) => {
        const a = ar[ps[0].dataIndex];
        return `<b>${a.proceso}</b><br>Nómina: ${fmtMoney(a.nomina)}<br>Ejecutado: ${fmtMoney(a.ejecutado)}`
          + `<br>Variación: <b>${fmtMoney(a.variacion)}</b><br><span style="color:${ax.textColor}">${a.dias_ociosos} días hábiles ociosos · última salida ${a.ultima_salida || "—"}</span>`;
      }
    },
    grid: { left: 8, right: 16, top: 16, bottom: 6, containLabel: true },
    xAxis: { type: "category", data: ar.map(a => a.proceso), axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
    yAxis: { type: "value", name: "Variación (COP)", nameTextStyle: { color: ax.textColor, fontSize: 10 }, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, formatter: (v) => v === 0 ? "0" : "$" + (v / 1e6).toFixed(0) + "M" } },
    series: [{
      type: "bar", barWidth: "46%",
      data: ar.map(a => ({ value: Math.round(a.variacion), itemStyle: { color: a.variacion < 0 ? "#ef4444" : "#10b981", borderRadius: [0, 0, 4, 4] } })),
      label: { show: true, position: "bottom", color: ax.textColor, fontSize: 11, formatter: (d) => fmtMoney(d.value) },
    }],
  }, true);
}
/* tarjeta Costos vs Salidas (parametrizable por sufijo para reusarla varias veces en una vista) */
function costosCard(cod, sfx = "", titulo, srcC) {
  const C = srcC || (COSTOS && COSTOS.proyectos ? COSTOS.proyectos[cod] : null);
  if (!C) return "";
  return `<div class="card fade" style="margin-top:16px">
    <h3>💸 Costos vs Salidas · planta por proceso${titulo ? " · " + titulo : ""}</h3>
    <div class="hint">Costo operativo = <b>solo roles que generan valor</b> (analistas, desarrolladores, QA); excluye Scrum/Head/Coordinador/Líder. La planta se paga todos los días hábiles del periodo (<b>Nómina</b>), pero solo está justificada hasta su <b>última salida</b> de HU (<b>Ejecutado</b>); los días sin producción al final = <b>Variación</b> (sobrecosto). Filtra el rango de fechas para redimensionar el periodo.</div>
    <div class="filterbar"><label>Desde <input type="date" id="coIni${sfx}"></label><label>Hasta <input type="date" id="coFin${sfx}"></label></div>
    <div id="cCostosTbl${sfx}"></div>
    <div id="cCostosBar${sfx}" class="chart"></div></div>`;
}
/* filtro Desde/Hasta que redimensiona la tabla + las barras de Costos vs Salidas */
function setupCostos(cod, sfx = "", srcC) {
  const C = srcC || (COSTOS && COSTOS.proyectos ? COSTOS.proyectos[cod] : null);
  if (!C || !C.fechas || !C.fechas.length) return;
  const F = C.fechas, dmin = F[0], dmax = F[F.length - 1];
  const fi = $("#coIni" + sfx), ff = $("#coFin" + sfx); if (!fi || !ff) return;
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;
  const c = mkChart($("#cCostosBar" + sfx));
  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax; if (a > b) { const t = a; a = b; b = t; }
    const w = costosWindow(C, a, b);
    $("#cCostosTbl" + sfx).innerHTML = costosTable(C, w);
    drawCostosBar(c, w);
  }
  fi.onchange = ff.onchange = apply; apply();
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
  else if (CURRENT === "__crono__") renderCronograma();
  else renderProject(DATA.proyectos.find(p => p.codigo === CURRENT));
  animateBars();
}

/* ---------- vista proyecto (con pestañas por perfil de control) ---------- */
/* Cada pestaña reordena los MISMOS widgets según lo que necesita ese rol. La hoja
   Portafolio NO se toca. "General" conserva la vista completa para no perder nada. */
const PROFILES = [
  { id: "general", label: "General", icon: "▦", color: "#6366f1" },
  { id: "seguimiento", label: "Seguimiento", icon: "🔎", color: "#10b981" },  // recursos + HU/etapa + costos
  { id: "directivo", label: "Directivo", icon: "🎯", color: "#a855f7" },      // antes Director de Operaciones
  { id: "gerencial", label: "Gerencial", icon: "📋", color: "#38bdf8" },      // antes Gerente de Proyecto
  { id: "operativo", label: "Operativo", icon: "🛠", color: "#f59e0b" },      // unifica Head/Líder + Scrum
  { id: "controles", label: "Controles de Cambios", icon: "🔧", color: "#e11d48" },  // solo proyectos con datos CC
];
// objeto-proyecto de controles de cambio (misma forma que un proyecto); null si el proyecto no tiene CC
function controlesObj(cod) { return CONTROLES && CONTROLES.proyectos ? CONTROLES.proyectos[cod] : null; }
let PROJ = null, PROFILE_TAB = "general";

function renderProject(p) {
  PROJ = p;
  PROFILE_TAB = "general";        // al abrir un proyecto, arranca en General
  paintProject();
}
function selectProfile(id) {
  if (id === PROFILE_TAB) return;
  PROFILE_TAB = id;
  disposeCharts();                // limpia ECharts de la pestaña anterior
  paintProject();
}
function paintProject() {
  const p = PROJ, k = p.kpis;
  const restQA = k.dias_restantes?.QA;
  const recObj = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos[p.codigo] : null;
  const ccObj = controlesObj(p.codigo);   // controles de cambio (si el proyecto tiene datos CC)
  if (PROFILE_TAB === "controles" && !ccObj) PROFILE_TAB = "general";   // proyecto sin CC -> General

  const head = `<div class="project-title fade">
    <h2>${p.nombre}</h2>
    <span class="tag">${p.codigo}</span>
    ${p.producto ? `<span class="tag">${p.producto}</span>` : ""}
    ${p.estado ? `<span class="tag">${p.estado}</span>` : ""}
  </div>`;
  const tabbar = `<div class="tabbar">${PROFILES.filter(pr => pr.id !== "controles" || ccObj).map(pr =>
    `<button class="tab${pr.id === PROFILE_TAB ? " on" : ""}" style="--tc:${pr.color}" onclick="selectProfile('${pr.id}')">${pr.icon} ${pr.label}</button>`).join("")}</div>`;

  // ---- fragmentos reutilizables (mismas fuentes, distinta curaduría por perfil) ----
  // ---- tarjetas KPI individuales (se eligen por perfil) ----
  const kHU = kpi("HU Totales", "▦", "#6366f1", `<span data-count="${k.hu_total}">0</span>`, `${fmt(k.hu_pendientes)} pendientes de producción`);
  const kRem = kpi("HU Removidas", "✕", "#94a3b8", `<span data-count="${k.removidas || 0}">0</span>`, "Removido/Cancelado · fuera del conteo");
  const kProd = kpi("En Producción", "✓", "#10b981", `<span data-count="${k.hu_prod}">0</span>`, `de ${fmt(k.hu_total)} HU`, k.pct_prod);
  const kPctProd = kpi("% Puesta en Producción", "◎", "#38bdf8", `<span data-count="${(k.pct_prod || 0) * 100}" data-dec="1" data-suf="%">0</span>`, "HU en producción / totales", k.pct_prod);
  const kAvance = kpi("% Avance ponderado", "◔", "#a855f7", k.pct_avance == null ? "—" : `<span data-count="${k.pct_avance * 100}" data-dec="0" data-suf="%">0</span>`, k.pct_avance == null ? "sin homologación de avance" : "promedio por etapa", k.pct_avance);
  const kVel = kpi("Velocidad", "⚡", "#f59e0b", `<span data-count="${k.velocidad || 0}" data-dec="2">0</span> <small>HU/día</small>`, `${fmt(k.dias_transcurridos)} días hábiles transcurridos`);
  const kCierre = kpi("Días hábiles a cierre QA", "⏳", restQA != null && restQA <= 10 ? "#ef4444" : "#38bdf8", restQA == null ? "—" : `<span data-count="${restQA}">0</span>`, p.cierre?.QA ? `cierre QA ${p.cierre.QA}` : "sin fecha de cierre");
  // HU con +10 días en el mismo estado (del panel de alertas; requiere data_carga)
  const _cObj = cargaObj(p.codigo);
  const _estanc10 = _cObj && _cObj.alertas ? _cObj.alertas.filter(a => a.dias_sin_mov != null && a.dias_sin_mov > 10).length : null;
  const kEstanc = kpi("HU +10 días sin avanzar", "⚠", "#ef4444", _estanc10 == null ? "—" : `<span data-count="${_estanc10}">0</span>`, "mismo estado · más de 10 días");
  const wrapKpis = (cards) => `<div class="grid kpis">${cards.join("")}</div>`;
  const cArea = `<div class="card fade"><h3>Avance por proceso en el tiempo</h3>
      <div class="hint">HU en cada etapa por fecha de corte (apilado)</div><div id="cArea" class="chart tall"></div></div>`;
  const cDonut = `<div class="card fade"><h3>Distribución actual</h3>
      <div class="hint">HU por proceso al ${DATA.corte}</div><div id="cDonut" class="chart tall"></div></div>`;
  const cLine = `<div class="card fade"><h3>Tendencia de producción</h3>
      <div class="hint">Total de HU vs. puestas en producción</div><div id="cLine" class="chart"></div></div>`;
  const cGauge = `<div class="card fade"><h3>Productividad · real vs. requerida</h3>
      <div class="hint">Arco externo = real (verde si cumple / rojo si va por debajo) · arco interno = requerida (cierre QA)</div><div id="cGauge" class="chart"></div></div>`;
  const cPivot = pivotCard(p);
  const cCostoHu = costoHuCard(p, p.codigo, "");   // costo unitario por HU gestionada (junto a la pivote)
  const cFlujo = `<div class="card fade" style="margin-top:16px">
    <h3>Variación de HU por etapa en el tiempo</h3>
    <div class="hint">Por día y etapa: <b>entradas hacia arriba (+)</b> y <b>salidas hacia abajo (−)</b>. Filtra por rango de fechas y por etapa.</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="flIni"></label>
      <label>Hasta <input type="date" id="flFin"></label>
      <label>Etapa <select id="flProc">${"<option value='__all__'>Todas las etapas</option>" + PROCS.map(pr => `<option value="${pr.key}">${pr.label}</option>`).join("")}</select></label>
    </div>
    <div id="cFlujo" class="chart tall"></div></div>`;
  const cRecursos = recursosCard(recObj, null, RECURSOS ? "Planta " + RECURSOS.planta_archivo : null);
  const cProdPD = recObj ? `<div class="card fade" style="margin-top:16px">
    <h3>⚙️ Productividad persona-día por proceso · en el tiempo</h3>
    <div class="hint">HU gestionadas (salidas del proceso) ÷ personas del área, por día · filtra el rango de fechas</div>
    <div class="filterbar"><label>Desde <input type="date" id="pdIni"></label><label>Hasta <input type="date" id="pdFin"></label></div>
    <div id="cProdPD" class="chart"></div></div>` : "";
  const _pl0 = RECURSOS && RECURSOS.plantas && RECURSOS.plantas.length ? RECURSOS.plantas[0].fecha : null;
  const cPlanta = (recObj && _pl0) ? `<div class="card fade" style="margin-top:16px">
    <h3>👥 Evolución de la planta · por día</h3>
    <div class="hint">Nº de personas activas por día desde el primer archivo de planta (${_pl0}) · línea Total y por área · filtra el rango de fechas</div>
    <div class="filterbar"><label>Desde <input type="date" id="plIni"></label><label>Hasta <input type="date" id="plFin"></label></div>
    <div id="cPlanta" class="chart"></div></div>` : "";
  const cCarga = cargaCard(p.codigo);
  const cAlertas = alertasCard(p.codigo);
  // sección compacta de cumplimiento RQC (solo 421; perfiles General, Directivo y Gerencial)
  const cRqc = (p.codigo === RQC?.codigo && RQC) ? `<div class="card fade" style="margin-top:16px">
    <h3>📋 Cumplimiento RQC · contrato</h3>
    <div class="hint">RQC del contrato · corte ${RQC.corte} · cumplimiento = cumplidos ÷ (totales − removidos)</div>
    <div class="grid kpis">
      ${kpi("RQC totales", "▦", "#6366f1", `<span data-count="${RQC.activos}">0</span>`, `descontando ${RQC.removidos} removidos (${RQC.total} brutos)`)}
      ${kpi("Cumplidas", "✓", "#10b981", `<span data-count="${RQC.cumplidos}">0</span>`, `de ${fmt(RQC.activos)} RQC`, RQC.activos ? RQC.cumplidos / RQC.activos : null)}
      ${kpi("% Cumplimiento", "◎", "#a855f7", RQC.cumplimiento == null ? "—" : `<span data-count="${RQC.cumplimiento * 100}" data-dec="1" data-suf="%">0</span>`, "cumplidos / activos", RQC.cumplimiento)}
    </div>
    <div id="cRqcDonut" class="chart"></div></div>` : "";
  // productividad por proceso: variación diaria gestionado − esperado (solo proyectos con config, p.ej. 397)
  const prodObj = PRODUCTIV && PRODUCTIV.proyectos ? PRODUCTIV.proyectos[p.codigo] : null;
  const cProd = prodObj ? `<div class="card fade" style="margin-top:16px">
    <h3>📈 Productividad diaria por proceso · meta vs. ejecutado</h3>
    <div class="hint">Por área: <b>meta</b> (esperada acumulada = tasa requerida por día hábil) · <b>ejecutado</b> (salidas acumuladas) · <b>diferencia</b> = ejecutado − meta (eje derecho; negativa los días sin salidas) · referencia ${prodObj.ref}${prodObj.auto ? "" : " · dimensionado dado"}</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="pvIni"></label>
      <label>Hasta <input type="date" id="pvFin"></label>
      <label>Proceso <select id="pvProc"><option value="__all__">Todas las áreas</option>${prodObj.procesos.map(x => `<option value="${x.key}">${x.label}</option>`).join("")}</select></label>
    </div>
    ${prodObj.procesos.map(x => `<div class="prodarea" data-key="${x.key}">
      <div class="hint" style="color:var(--text);font-weight:600;margin:10px 0 0"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${x.color};margin-right:6px"></span>${x.label} · meta ${x.tasa.toFixed(2)}/día hábil · base ${x.base} · cierre ${x.cierre}</div>
      <div id="cPV_${x.key}" class="chart"></div></div>`).join("")}
    </div>` : "";
  // costos vs salidas: planta de cada proceso (REQ/DEV/QA) vs HU entregadas (solo vista Seguimiento)
  const cCostos = costosCard(p.codigo);
  // planta del proceso (REQ/DEV/QA) sin HU asignada en Azure (referencia: cronograma Positiva)
  const cSinHu = projPlantaSinHu(p.codigo);

  const split = (a, b) => `<div class="grid charts" style="margin-top:16px">${a}${b}</div>`;   // 1.2 / .8
  const two = (a, b) => `<div class="grid charts-2" style="margin-top:16px">${a}${b}</div>`;    // 1 / 1
  const note = (t) => `<div class="tabnote">${t}</div>`;

  let body;
  switch (PROFILE_TAB) {
    case "seguimiento":  // control: recursos + tabla HU por etapa + costos vs salidas (exclusivas aquí)
      body = note("Seguimiento · recursos del equipo, HU por etapa y costos vs salidas") +
        cRecursos + cPivot + cCostoHu + cCostos; break;
    case "directivo":   // estratégico: resultado, cumplimiento y riesgo
      body = note("Vista estratégica · salud del proyecto y cumplimiento de cierre") +
        wrapKpis([kPctProd, kAvance, kCierre, kEstanc]) +
        two(cLine, cGauge) + cRqc + cRecursos + cPlanta + cProd + cProdPD + cAlertas; break;
    case "gerencial":   // integral del proyecto
      body = note("Vista integral del proyecto") +
        wrapKpis([kHU, kProd, kPctProd, kAvance, kVel, kCierre, kEstanc]) +
        cRecursos + cPlanta + cProd + split(cArea, cDonut) + two(cLine, cGauge) + cRqc + cCarga + cAlertas; break;
    case "operativo":   // ejecución y día a día (unifica Head/Líder + Scrum)
      body = note("Vista operativa · ejecución por área y día a día del equipo") +
        wrapKpis([kHU, kProd, kEstanc, kAvance, kVel]) +
        split(cArea, cDonut) + cProdPD + cCarga + cAlertas + cFlujo + cPivot + cCostoHu; break;
    case "controles": {  // réplica de la vista general SOLO sobre las HU de control de cambio (Tags CC)
      const ck = ccObj.kpis, restQAc = ck.dias_restantes?.QA;
      const cc10 = (ccObj.alertas || []).filter(a => a.dias_sin_mov != null && a.dias_sin_mov > 10).length;
      const kkHU = kpi("HU de control de cambio", "🔧", "#e11d48", `<span data-count="${ck.hu_total}">0</span>`, `${fmt(ck.hu_pendientes)} pendientes de producción`);
      const kkProd = kpi("En Producción", "✓", "#10b981", `<span data-count="${ck.hu_prod}">0</span>`, `de ${fmt(ck.hu_total)} HU CC`, ck.pct_prod);
      const kkPct = kpi("% Puesta en Producción", "◎", "#38bdf8", `<span data-count="${(ck.pct_prod || 0) * 100}" data-dec="1" data-suf="%">0</span>`, "HU CC en producción / totales", ck.pct_prod);
      const kkAv = kpi("% Avance ponderado", "◔", "#a855f7", ck.pct_avance == null ? "—" : `<span data-count="${ck.pct_avance * 100}" data-dec="0" data-suf="%">0</span>`, ck.pct_avance == null ? "sin homologación" : "promedio por etapa", ck.pct_avance);
      const kkVel = kpi("Velocidad", "⚡", "#f59e0b", `<span data-count="${ck.velocidad || 0}" data-dec="2">0</span> <small>HU/día</small>`, `${fmt(ck.dias_transcurridos)} días hábiles transcurridos`);
      const kkCierre = kpi("Días hábiles a cierre QA", "⏳", restQAc != null && restQAc <= 10 ? "#ef4444" : "#38bdf8", restQAc == null ? "—" : `<span data-count="${restQAc}">0</span>`, ccObj.cierre?.QA ? `cierre QA ${ccObj.cierre.QA}` : "sin fecha de cierre");
      const kkEst = kpi("HU +10 días sin avanzar", "⚠", "#ef4444", `<span data-count="${cc10}">0</span>`, "mismo estado · más de 10 días");
      body = note("Controles de Cambios · réplica de la vista general sobre las HU de control de cambio (Tags CC) del proyecto") +
        wrapKpis([kkHU, kkProd, kkPct, kkAv, kkVel, kkCierre, kkEst]) +
        split(cArea, cDonut) + two(cLine, cGauge) + cFlujo + cPivot + costoHuCard(ccObj, p.codigo, "") +
        cargaCard(p.codigo, ccObj) + alertasCard(p.codigo, ccObj);
      break;
    }
    default:            // General: vista completa (nada se pierde) · productividad bajo la planta
      body = wrapKpis([kHU, kRem, kProd, kPctProd, kAvance, kVel, kCierre]) +
        cRecursos + cPlanta + cProd + split(cArea, cDonut) + two(cLine, cGauge) + cRqc + cFlujo + cPivot + cCostoHu + cProdPD + cCarga + cAlertas + cSinHu;
  }

  $("#content").innerHTML = head + tabbar + body;
  countUp();
  // dibuja/cablea SOLO lo que está presente en la pestaña activa
  // fuente de datos HU: en la pestaña Controles de Cambios se usa el objeto CC (misma forma)
  const dsrc = (PROFILE_TAB === "controles" && ccObj) ? ccObj : p;
  if ($("#recFecha")) setupRecursos(recObj);
  if ($("#cArea")) drawArea($("#cArea"), dsrc);
  if ($("#cDonut")) drawDonut($("#cDonut"), dsrc);
  if ($("#cLine")) drawLine($("#cLine"), dsrc);
  if ($("#cGauge")) drawGauge($("#cGauge"), dsrc, dsrc.kpis);
  if ($("#tblMode")) setupPivot(dsrc);
  if ($("#chWrap")) setupCostoHu(dsrc, p.codigo, "");   // costo unitario por HU (CC usa ccObj vía dsrc; planta = p.codigo)
  if ($("#cFlujo")) drawFlujo($("#cFlujo"), dsrc);
  if ($("#cProdPD")) setupProdPersona(p.codigo);
  if ($("#cPlanta")) setupPlantaEvol(recObj);
  if ($("#cRqcDonut")) drawRqcDonut($("#cRqcDonut"));
  if ($(".prodarea")) setupProdVar(p.codigo);
  if ($("#coIni")) setupCostos(p.codigo);
  animateBars();
}

/* productividad diaria por proceso: 3 líneas por área (Meta, Ejecutado, Diferencia).
   X = fechas (diario). Meta/Ejecutado en eje izq (HU acumuladas), Diferencia en eje der (centrado
   en 0; negativa los días sin salidas). Filtros Desde/Hasta + selector de área. */
function setupProdVar(cod) {
  const P = PRODUCTIV && PRODUCTIV.proyectos ? PRODUCTIV.proyectos[cod] : null; if (!P) return;
  const allF = P.procesos[0].serie.map(s => s.f);
  const dmin = allF[0], dmax = allF[allF.length - 1];
  const fi = $("#pvIni"), ff = $("#pvFin"), fp = $("#pvProc");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;
  const charts = P.procesos.map(pr => { const el = $("#cPV_" + pr.key); return { pr, el, c: el ? mkChart(el) : null }; });
  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax; if (a > b) { const t = a; a = b; b = t; }
    const sel = fp.value;
    charts.forEach(({ pr, el, c }) => {
      const block = el ? el.closest(".prodarea") : null;
      const show = sel === "__all__" || sel === pr.key;
      if (block) block.style.display = show ? "" : "none";
      if (!show || !c) return;
      const idx = pr.serie.map((s, i) => [s.f, i]).filter(([f]) => f >= a && f <= b);
      c.resize();
      drawProdArea(c, pr, idx);
    });
  }
  fi.onchange = ff.onchange = fp.onchange = apply; apply();
}
function drawProdArea(c, pr, idx) {
  const ax = axisBase();
  const dts = idx.map(([f]) => f);
  const nf = (v) => (v > 0 ? "+" : "") + (+v).toFixed(1).replace(".", ",");
  c.setOption({
    tooltip: {
      trigger: "axis", ...ax.tooltip, formatter: (ps) => {
        if (!ps.length) return "";
        let s = `<b>${ps[0].axisValue}</b>`;
        ps.forEach(pt => { const v = pt.value; s += `<br>${pt.marker}${pt.seriesName}: <b>${pt.seriesName === "Diferencia" ? nf(v) : (+v).toFixed(1).replace(".", ",")}</b>`; });
        return s;
      }
    },
    legend: { data: ["Meta", "Ejecutado", "Diferencia"], textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
    grid: { left: 6, right: 8, top: 34, bottom: 6, containLabel: true },
    xAxis: { type: "category", data: dts, axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 10, formatter: v => v.slice(5) } },
    yAxis: [
      { type: "value", name: "HU acum.", nameTextStyle: { color: ax.textColor, fontSize: 9 }, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
      { type: "value", name: "dif.", position: "right", nameTextStyle: { color: ax.textColor, fontSize: 9 }, splitLine: { show: false }, axisLabel: { color: ax.textColor } },
    ],
    series: [
      { name: "Meta", type: "line", smooth: true, showSymbol: false, yAxisIndex: 0, color: "#94a3b8", lineStyle: { width: 2, type: "dashed" }, data: idx.map(([, i]) => pr.serie[i].meta) },
      { name: "Ejecutado", type: "line", smooth: false, showSymbol: false, yAxisIndex: 0, color: pr.color, lineStyle: { width: 2.5 }, data: idx.map(([, i]) => pr.serie[i].real) },
      {
        name: "Diferencia", type: "line", smooth: false, showSymbol: false, yAxisIndex: 1, color: "#f43f5e", lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.06 },
        markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: ax.textColor, type: "dashed", opacity: 0.4 }, data: [{ yAxis: 0 }] },
        data: idx.map(([, i]) => pr.serie[i].var)
      },
    ],
  }, true);
}

/* tabla dinámica: filas = etapas, columnas = fechas, métrica seleccionable */
/* tarjeta de la tabla consolidada HU por etapa (parametrizable por sufijo de id para reusarla
   varias veces en una misma vista, p.ej. cronograma con 416 y 355). */
function pivotCard(p, sfx = "", titulo) {
  return `<div class="card fade" style="margin-top:16px">
    <h3>Tabla consolidada · HU por etapa y fecha${titulo ? " · " + titulo : ""}</h3>
    <div class="hint">Conteo de HU en cada etapa por día (tipo tabla dinámica). Cambia la métrica para ver variaciones o gestiones.</div>
    <div class="filterbar"><label>Métrica
        <select id="tblMode${sfx}">
          <option value="count">Conteo (HU en la etapa)</option>
          <option value="delta">Δ Variación día a día</option>
          <option value="ent">Entradas (gestión)</option>
          <option value="sal">Salidas (gestión)</option>
        </select></label>
      <span class="hint" style="margin:0">▸ filas = etapas · columnas = fechas (desliza →)</span>
    </div>
    <div id="pivWrap${sfx}" class="pivwrap"></div></div>`;
}
function setupPivot(p, sfx = "") {
  const sel = $("#tblMode" + sfx), wrap = $("#pivWrap" + sfx); if (!sel || !wrap) return;
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

  // agrupación de columnas por mes (encabezado de 2 niveles) + separador en el inicio de cada mes
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const groups = [];
  dates.forEach((d, i) => {
    const m = d.slice(0, 7);
    if (!groups.length || groups[groups.length - 1].m !== m)
      groups.push({ m, start: i, n: 0, label: `${MES[+d.slice(5, 7) - 1]} '${d.slice(2, 4)}` });
    groups[groups.length - 1].n++;
  });
  const monStart = new Set(groups.map(g => g.start));   // índices que abren mes (borde izq)

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
  const cell = (v, i) => {
    const ms = monStart.has(i) ? " monstart" : "";
    if (v == null) return `<td class="czero${ms}">·</td>`;
    if (mode === "count") return `<td class="cnt${ms}">${v}</td>`;
    // colorimetría por GESTIÓN del equipo: SALIDAS (el equipo saca HU de la etapa) = verde;
    // ENTRADAS (la etapa acumula HU) = rojo. En delta: el conteo baja (−) = salida neta = verde;
    // sube (+) = entrada neta = rojo.
    let cls = "czero";
    if (mode === "sal") cls = v > 0 ? "cpos" : "czero";
    else if (mode === "ent") cls = v > 0 ? "cneg" : "czero";
    else cls = v > 0 ? "cneg" : v < 0 ? "cpos" : "czero";   // delta (invertido)
    return `<td class="${cls}${ms}">${v > 0 ? "+" + v : v}</td>`;
  };
  const row = (label, sw, valfn) =>
    `<tr><th><span class="sw-i" style="background:${sw}"></span>${label}</th>` +
    dates.map((d, i) => cell(valfn(i), i)).join("") + `</tr>`;

  // encabezado de 2 niveles: fila 1 = mes (agrupado), fila 2 = día
  let h = `<table class="piv"><thead><tr><th class="corner" rowspan="2">Etapa</th>` +
    groups.map(g => `<th class="mongrp" colspan="${g.n}">${g.label}</th>`).join("") + `</tr><tr>` +
    dates.map((d, i) => `<th class="${monStart.has(i) ? "monstart" : ""}">${d.slice(8)}</th>`).join("") +
    `</tr></thead><tbody>`;
  for (const pr of PROCS) h += row(pr.label, pr.color, i => val(pr.key, i));
  if (hasSH) h += row("Sin homologar", "#5d6678", shVal);
  if (hasRem) h += row("Removidas", "#94a3b8", remVal);
  h += `<tr class="tot"><th>Total HU<br><span style="font-weight:400;font-size:10px;color:var(--muted)">(sin removidas)</span></th>` +
    dates.map((d, i) => cell(totVal(i), i)).join("") + `</tr>`;
  return h + `</tbody></table>`;
}

/* ===== Costo unitario por HU gestionada (salidas) · por proceso y fecha =====
   Misma forma que la tabla consolidada, pero SOLO salidas y cada celda muestra el COSTO UNITARIO:
     costo = (nómina mensual del área en esa fecha ÷ 20) × días hábiles desde la salida anterior ÷ HU.
   Se EXCLUYE la primera salida de cada proceso (artefacto de inicialización) usándola como inicio del
   conteo de días. La nómina del área a cada fecha sale de RECURSOS (planta productiva, la más cercana
   si la fecha es anterior al histórico). `recCod` = código de planta a usar (proyecto; CC usa 397). */
const COSTO_HU_PROCS = [
  { key: "REQUERIMIENTOS", area: "REQUERIMIENTOS" },
  { key: "DESARROLLO", area: "DESARROLLO" },
  { key: "QA", area: "PRUEBAS QA Y TESTER" },
];
const DIAS_MES_HU = 20;   // días hábiles/mes para pasar nómina mensual -> costo/día
function costoHuCells(src, recCod) {
  const rec = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos[recCod] : null;
  const flujo = (src && src.flujo) || [];
  const dh = {}; ((src && src.serie) || []).forEach(s => { dh[s.fecha] = s.dias_hab; });
  const out = {};
  COSTO_HU_PROCS.forEach(pp => {
    out[pp.key] = {};
    let prevDh = null;                                   // días hábiles acum. de la salida anterior
    for (const f of flujo) {
      const hu = (f.salidas || {})[pp.key] || 0;
      if (hu <= 0) continue;
      const cur = dh[f.fecha];
      if (prevDh == null) { prevDh = cur; continue; }    // 1ª salida = artefacto: solo marca el inicio
      const dias = (cur - prevDh) + 1;                   // incluye el día de la salida anterior
      let costo = null;
      if (rec && dias > 0) {
        const pa = (snapRec(rec, RECURSOS.fechas, f.fecha) || { por_area: {} }).por_area[pp.area];
        const cmes = pa ? (pa.c_prod ? pa.c_prod[1] : pa.c) : 0;
        costo = cmes ? (cmes / DIAS_MES_HU) * dias / hu : 0;
      }
      out[pp.key][f.fecha] = { hu, costo };
      prevDh = cur;
    }
  });
  return out;
}
/* formato: <1M -> 0.1/0.2/...  ·  >=1M -> 1.2M/2M/10M/250M */
function fmtCostoHu(v) {
  if (v == null) return null;
  const m = v / 1e6;
  if (m < 1) return m.toFixed(1);
  const r = Math.round(m * 10) / 10;
  return (Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)) + "M";
}
let COSTOHU = {};   // sfx -> {draw, area}; estado del selector de área de Mín/Máx
function costoHuSelArea(sfx, a) {
  const st = COSTOHU[sfx]; if (!st) return;
  st.area = (a === "__all__") ? null : a;
  st.draw();
}
function costoHuCard(src, recCod, sfx = "") {
  if (!RECURSOS || !RECURSOS.proyectos || !RECURSOS.proyectos[recCod]) return "";
  const cells = costoHuCells(src, recCod);
  if (!COSTO_HU_PROCS.some(pp => Object.keys(cells[pp.key]).length)) return "";
  const chip = (a, lbl) => `<span class="rchip" id="chSel${sfx}_${a}" onclick="costoHuSelArea('${sfx}','${a}')">${a === "__all__" ? "" : `<span class="rdot" style="background:${AREA_COL[a]}"></span>`}${lbl}</span>`;
  const chips = chip("__all__", "Todas") + COSTO_HU_PROCS.map(pp => chip(pp.area, AREA_LBL[pp.area])).join("");
  return `<div class="card fade" style="margin-top:16px">
    <h3>💲 Costo unitario por HU gestionada · por proceso y fecha</h3>
    <div class="hint">Por celda: (nómina mensual del área ÷ 20) × días hábiles desde la salida anterior ÷ HU que salieron · <b>solo salidas</b> (gestión del equipo) · REQ/DEV/QA · <b>&lt;1M</b> en decimales (0,2) y <b>≥1M</b> con M (1,2M)</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="chIni${sfx}"></label>
      <label>Hasta <input type="date" id="chFin${sfx}"></label>
      <span class="hint" style="margin:0">▸ por defecto, últimos 10 días hábiles · ajusta el rango</span>
    </div>
    <div class="hint" style="margin:2px 0 0">Mín/Máx por área:</div>
    <div class="rchips" style="margin:4px 0">${chips}</div>
    <div class="grid kpis" style="margin:2px 0">
      <div class="card kpi fade"><div class="label"><span class="ic" style="background:#10b98120;color:#10b981">▼</span>Mínimo del rango <span id="chMinA${sfx}" class="muted"></span></div><div class="val" id="chMin${sfx}">—</div><div class="foot">menor costo/HU visible</div></div>
      <div class="card kpi fade"><div class="label"><span class="ic" style="background:#ef444420;color:#ef4444">▲</span>Máximo del rango <span id="chMaxA${sfx}" class="muted"></span></div><div class="val" id="chMax${sfx}">—</div><div class="foot">mayor costo/HU visible</div></div>
    </div>
    <div id="chWrap${sfx}" class="pivwrap"></div></div>`;
}
function setupCostoHu(src, recCod, sfx = "") {
  const wrap = $("#chWrap" + sfx); if (!wrap) return;
  const cells = costoHuCells(src, recCod);
  const fechas = (src.flujo || []).map(f => f.fecha);
  if (!fechas.length) return;
  const ini = $("#chIni" + sfx), fin = $("#chFin" + sfx), elMin = $("#chMin" + sfx), elMax = $("#chMax" + sfx);
  const dmin = fechas[0], dmax = fechas[fechas.length - 1];
  const def = fechas.length > 10 ? fechas[fechas.length - 10] : dmin;   // últimos ~10 días hábiles
  ini.min = fin.min = dmin; ini.max = fin.max = dmax; ini.value = def; fin.value = dmax;
  const st = COSTOHU[sfx] || (COSTOHU[sfx] = { area: null });
  st.draw = () => {
    const a = ini.value, b = fin.value, areaSel = st.area;   // areaSel = clave de área (o null = todas)
    const cols = fechas.filter(f => f >= a && f <= b);
    const vals = [];   // costos visibles para el Mín/Máx (filtrados por área seleccionada)
    let h = `<table class="piv"><thead><tr><th class="corner">Proceso</th>` +
      cols.map(d => `<th>${d.slice(5)}</th>`).join("") + `</tr></thead><tbody>`;
    for (const pp of COSTO_HU_PROCS) {
      h += `<tr><th><span class="sw-i" style="background:${AREA_COL[pp.area]}"></span>${AREA_LBL[pp.area]}</th>` +
        cols.map(d => {
          const c = cells[pp.key][d];
          if (!c || c.costo == null) return `<td class="czero">·</td>`;
          if (!areaSel || areaSel === pp.area) vals.push(c.costo);
          return `<td title="${c.hu} HU gestionadas">${fmtCostoHu(c.costo)}</td>`;
        }).join("") + `</tr>`;
    }
    h += `</tbody></table>`;
    wrap.innerHTML = h; wrap.scrollLeft = wrap.scrollWidth;
    elMin.textContent = vals.length ? fmtCostoHu(Math.min(...vals)) : "—";
    elMax.textContent = vals.length ? fmtCostoHu(Math.max(...vals)) : "—";
    const aLbl = areaSel ? "· " + AREA_LBL[areaSel] : "· todas";
    $("#chMinA" + sfx).textContent = aLbl; $("#chMaxA" + sfx).textContent = aLbl;
    // resalta el chip activo
    ["__all__", ...COSTO_HU_PROCS.map(pp => pp.area)].forEach(k => {
      const el = $("#chSel" + sfx + "_" + k);
      if (el) el.classList.toggle("on", (areaSel || "__all__") === k);
    });
  };
  ini.onchange = fin.onchange = st.draw;
  st.draw();
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

/* torta de RQC (421): distribución de lo activo -> cumplido / en gestión / pendiente (sin removidos) */
function drawRqcDonut(el) {
  const C = RQC, c = mkChart(el), ax = axisBase();
  const data = [
    { name: "Cumplido", value: C.resumen["CUMPLIDO"] || 0, itemStyle: { color: "#10b981" } },
    { name: "En gestión", value: C.resumen["EN PROCESO"] || 0, itemStyle: { color: "#f59e0b" } },
    { name: "Pendiente", value: C.resumen["PENDIENTE INICIO"] || 0, itemStyle: { color: "#94a3b8" } },
  ];
  c.setOption({
    tooltip: { trigger: "item", ...ax.tooltip, formatter: p => `${p.name}: <b>${p.value}</b> (${p.percent}%)` },
    legend: { bottom: 0, textStyle: { color: ax.textColor, fontSize: 11 }, icon: "circle" },
    series: [{
      type: "pie", radius: ["45%", "70%"], center: ["50%", "44%"], avoidLabelOverlap: true,
      itemStyle: { borderColor: cssv("--card"), borderWidth: 2 },
      label: { show: true, formatter: "{b}\n{c}", color: ax.textColor, fontSize: 11 },
      data,
    }],
  }, true);
}

/* ---------- vista TABLERO CONSOLIDADO DE CRONOGRAMA (Positiva Core 416+355) ---------- */
/* No toca 416 ni 355: es una vista propia que lee data_cronograma.json. */
let CRONO_TAB = "cronograma";
let CRONO_SEG_PROY = "__all__";   // filtro de enfoque en Seguimiento: __all__ (combinado) | 416 | 355
function cronoSegSelProy(id) { if (id === CRONO_SEG_PROY) return; CRONO_SEG_PROY = id; disposeCharts(); paintCronograma(); }
/* objeto-proyecto COMBINADO (suma serie + flujo de varios enfoques) para reusar pivote y costo/HU */
function mergeProy(cods) {
  const ps = cods.map(c => DATA.proyectos.find(x => x.codigo === c)).filter(Boolean);
  if (!ps.length) return null;
  const byF = {};
  ps.forEach(p => (p.serie || []).forEach(s => {
    const o = byF[s.fecha] || (byF[s.fecha] = { fecha: s.fecha, total: 0, removidas: 0, prod: 0, dias_hab: s.dias_hab || 0, _avs: 0, _avw: 0 });
    PROCS.forEach(pr => { o[pr.key] = (o[pr.key] || 0) + (s[pr.key] || 0); });
    o.total += s.total || 0; o.removidas += s.removidas || 0; o.prod += s.prod || 0;
    o.dias_hab = Math.max(o.dias_hab, s.dias_hab || 0);
    if (s.avance != null && s.total) { o._avs += s.avance * s.total; o._avw += s.total; }
  }));
  const serie = Object.values(byF).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  serie.forEach(o => { o.avance = o._avw ? o._avs / o._avw : null; delete o._avs; delete o._avw; });
  const byFl = {};
  ps.forEach(p => (p.flujo || []).forEach(f => {
    const o = byFl[f.fecha] || (byFl[f.fecha] = { fecha: f.fecha, entradas: {}, salidas: {} });
    Object.entries(f.entradas || {}).forEach(([k, v]) => { o.entradas[k] = (o.entradas[k] || 0) + v; });
    Object.entries(f.salidas || {}).forEach(([k, v]) => { o.salidas[k] = (o.salidas[k] || 0) + v; });
  }));
  const flujo = Object.values(byFl).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  return { codigo: cods.join("+"), nombre: "Positiva Core (416+355)", serie, flujo };
}
/* costos vs salidas COMBINADO: 416 y 355 comparten planta 416 -> costo de planta UNA vez (del 416) y
   salidas SUMADAS (mismo modelo que build_costos_salidas, recalculado sobre el flujo combinado). */
function costosCombinado(cods) {
  const base = COSTOS && COSTOS.proyectos ? COSTOS.proyectos[cods[0]] : null;
  const merged = mergeProy(cods);
  if (!base || !merged) return null;
  const dh = {}; merged.serie.forEach(s => { dh[s.fecha] = s.dias_hab; });
  const fechas = merged.flujo.map(f => f.fecha);
  const dias_hab = fechas.map(f => dh[f] || 0);
  const dias_periodo = merged.serie.length ? merged.serie[merged.serie.length - 1].dias_hab : 0;
  const areas = {}, tot = { nomina: 0, ejecutado: 0, variacion: 0, salidas_tot: 0, personas: 0 };
  Object.keys(base.areas).forEach(key => {
    const b = base.areas[key], proc = b.proceso, costo_dia = b.costo_dia;
    const salidas = merged.flujo.map(f => (f.salidas[proc] || 0));
    const salidas_tot = salidas.reduce((a, x) => a + x, 0);
    let ultima = null; for (let i = fechas.length - 1; i >= 0; i--) { if (salidas[i] > 0) { ultima = fechas[i]; break; } }
    const dias_hasta = ultima ? (dh[ultima] || 0) : 0;
    const nomina = costo_dia * dias_periodo, ejecutado = costo_dia * dias_hasta;
    areas[key] = { proceso: proc, area: b.area, personas: b.personas, costo_mes: b.costo_mes, costo_dia,
      salidas_tot, ultima_salida: ultima, dias_periodo, dias_hasta_ultima: dias_hasta,
      dias_ociosos: dias_periodo - dias_hasta, nomina: Math.round(nomina), ejecutado: Math.round(ejecutado),
      variacion: Math.round(ejecutado - nomina), costo_por_hu: salidas_tot ? Math.round(nomina / salidas_tot) : null, salidas };
    tot.nomina += nomina; tot.ejecutado += ejecutado; tot.variacion += (ejecutado - nomina);
    tot.salidas_tot += salidas_tot; tot.personas += b.personas;
  });
  ["nomina", "ejecutado", "variacion"].forEach(k => { tot[k] = Math.round(tot[k]); });
  return { dias_periodo, fechas, dias_hab, areas, total: tot };
}
const CRONO_TABS = [
  { id: "cronograma", label: "Cronograma", icon: "📅", color: "#6366f1" },
  { id: "seguimiento", label: "Seguimiento", icon: "🔎", color: "#10b981" },
];
function renderCronograma() { CRONO_TAB = "cronograma"; paintCronograma(); }
function selectCronoTab(id) { if (id === CRONO_TAB) return; CRONO_TAB = id; disposeCharts(); paintCronograma(); }
function paintCronograma() {
  const C = CRONO;
  if (!C) { $("#content").innerHTML = `<div class="card">No hay datos de cronograma (data_cronograma.json).</div>`; return; }
  const r = C.semaforo_resumen, last = C.serie[C.serie.length - 1] || { avance: null };
  const head = `<div class="project-title fade">
    <h2>${C.nombre}</h2>
    <span class="tag">${C.total_hu} HU</span>
    <span class="tag">416 + 355</span>
    <span class="tag">inicio medición ${C.inicio_medicion}</span>
    <span class="tag">corte ${C.corte}</span>
  </div>`;
  const tabbar = `<div class="tabbar">${CRONO_TABS.map(t =>
    `<button class="tab${t.id === CRONO_TAB ? " on" : ""}" style="--tc:${t.color}" onclick="selectCronoTab('${t.id}')">${t.icon} ${t.label}</button>`).join("")}</div>`;
  const note = (t) => `<div class="tabnote">${t}</div>`;

  let body;
  // estado de las tablas unificadas de Seguimiento (combinado por defecto; chips 416/355)
  let segSrc = null, segRec = "416", segCos = null, segCod = "416";
  if (CRONO_TAB === "seguimiento") {
    // Positiva Core = 416 + 355 (comparten planta 416): planta una vez + tablas UNIFICADAS con filtro
    const rec416 = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos["416"] : null;
    const e416 = DATA.proyectos.find(x => x.codigo === "416"), e355 = DATA.proyectos.find(x => x.codigo === "355");
    let scopeLbl;
    if (CRONO_SEG_PROY === "416" || CRONO_SEG_PROY === "355") {
      segCod = CRONO_SEG_PROY;
      segSrc = DATA.proyectos.find(x => x.codigo === segCod);
      segRec = segCod; segCos = null;             // costos directos de COSTOS[cod]
      scopeLbl = segSrc ? etiqueta(segSrc) : segCod;
    } else {
      segCod = "416"; segSrc = mergeProy(["416", "355"]); segRec = "416";
      segCos = costosCombinado(["416", "355"]);    // costos combinados (planta única + salidas sumadas)
      scopeLbl = "Positiva Core (416 + 355)";
    }
    const chip = (id, lbl) => `<span class="rchip${CRONO_SEG_PROY === id ? " on" : ""}" onclick="cronoSegSelProy('${id}')">${lbl}</span>`;
    const filtro = `<div class="card fade" style="margin-top:16px">
      <div class="hint">Filtra las tablas por enfoque · por defecto, combinado (Positiva Core)</div>
      <div class="rchips" style="margin:6px 0">${chip("__all__", "Positiva Core (416 + 355)")}${chip("416", e416 ? etiqueta(e416) : "416")}${chip("355", e355 ? etiqueta(e355) : "355")}</div></div>`;
    const _pl0 = RECURSOS && RECURSOS.plantas && RECURSOS.plantas.length ? RECURSOS.plantas[0].fecha : null;
    const cPlanta = (rec416 && _pl0) ? `<div class="card fade" style="margin-top:16px">
      <h3>👥 Evolución de la planta · por día</h3>
      <div class="hint">Nº de personas activas por día desde el primer archivo de planta (${_pl0}) · planta 416 (compartida 416 y 355) · filtra el rango</div>
      <div class="filterbar"><label>Desde <input type="date" id="plIni"></label><label>Hasta <input type="date" id="plFin"></label></div>
      <div id="cPlanta" class="chart"></div></div>` : "";
    const tablas = segSrc ? (pivotCard(segSrc, "pc", scopeLbl) + costoHuCard(segSrc, segRec, "pc") +
      (segCos ? costosCard(segCod, "pc", scopeLbl, segCos) : costosCard(segCod, "pc", scopeLbl))) : "";
    body = note("Seguimiento de Positiva Core · planta del equipo y, unificadas con filtro por enfoque, HU por etapa · costo unitario · costos vs salidas") +
      recursosCard(rec416, "Positiva Core", RECURSOS ? "Planta " + RECURSOS.planta_archivo : null) +
      cPlanta + cargaCardMulti(["416", "355"], "Positiva Core 416 + 355") +
      filtro + tablas;
  } else {
    const kpis = `<div class="grid kpis">
      ${kpi("HU del cronograma", "▦", "#6366f1", `<span data-count="${C.total_hu}">0</span>`, `416: ${C.por_proyecto["416"] || 0} · 355: ${C.por_proyecto["355"] || 0}`)}
      ${kpi("% Avance ponderado", "◔", "#a855f7", last.avance == null ? "—" : `<span data-count="${last.avance * 100}" data-dec="1" data-suf="%">0</span>`, "promedio por etapa", last.avance)}
      ${kpi("Entregadas", "✓", "#10b981", `<span data-count="${r.verde}">0</span>`, `de ${C.total_hu} · objetivo ${C.objetivo}`, C.total_hu ? r.verde / C.total_hu : null)}
      ${kpi("En plazo", "◷", "#f59e0b", `<span data-count="${r.amarillo}">0</span>`, "pendientes dentro de fecha")}
      ${kpi("Vencidas", "⚠", "#ef4444", `<span data-count="${r.rojo}">0</span>`, "sin entregar y vencidas")}
      ${kpi("Sin fecha", "∅", "#94a3b8", `<span data-count="${r.sin_fecha}">0</span>`, "sin fecha comprometida")}
    </div>`;
    const c1 = `<div class="card fade" style="margin-top:16px"><h3>📈 Avance del cronograma · a diario</h3>
      <div class="hint">% avance ponderado por etapa (promedio de las ${C.total_hu} HU) por fecha de corte · medición desde ${C.inicio_medicion} · filtra el rango</div>
      <div class="filterbar"><label>Desde <input type="date" id="cavIni"></label><label>Hasta <input type="date" id="cavFin"></label></div>
      <div id="cCronoAv" class="chart"></div></div>`;
    const c2 = `<div class="card fade" style="margin-top:16px"><h3>📊 Avance por ramo · a diario</h3>
      <div class="hint">% avance ponderado por ramo · una línea por ramo · filtra el rango de fechas</div>
      <div class="filterbar"><label>Desde <input type="date" id="crIni"></label><label>Hasta <input type="date" id="crFin"></label></div>
      <div id="cCronoRamo" class="chart tall"></div></div>`;
    const c3 = `<div class="card fade" style="margin-top:16px"><h3>🚦 Fechas comprometidas de entrega y semáforo</h3>
      <div class="hint">Cada punto = HU por ramo y fecha comprometida · 🟢 entregada · 🟡 pendiente en plazo · 🔴 vencida sin entregar · tamaño = nº de HU</div>
      <div id="cCronoSem" class="chart tall"></div></div>`;
    body = kpis + c1 + c2 + c3 + cronoPlantaSinHu() +
      cargaCardMulti(["416", "355"], "Positiva Core 416 + 355") + cronoEstancadas();
  }
  $("#content").innerHTML = head + tabbar + body;
  countUp();
  if (CRONO_TAB === "seguimiento") {
    const rec416 = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos["416"] : null;
    if ($("#recFecha")) setupRecursos(rec416);
    if ($("#cPlanta")) setupPlantaEvol(rec416);
    if (segSrc && $("#tblModepc")) setupPivot(segSrc, "pc");
    if (segSrc && $("#chWrappc")) setupCostoHu(segSrc, segRec, "pc");
    if ($("#coInipc")) setupCostos(segCod, "pc", segCos);
  } else {
    setupCronoAvance();
    setupCronoRamos();
    drawCronoSemaforo($("#cCronoSem"));
  }
  animateBars();
}

/* etiqueta de área con punto de color (reusa AREA_LBL/AREA_COL) */
function areaTag(a) {
  if (!a) return '<span class="muted">—</span>';
  return `<span class="rdot" style="background:${AREA_COL[a] || "#5d6678"};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px"></span>${AREA_LBL[a] || a}`;
}

/* sección final 1: planta del proceso SIN HU asignada en Azure al corte (con cargo y área) */
function cronoPlantaSinHu() {
  const pp = CRONO && CRONO.planta_proceso;
  if (!pp || !(pp.sin_hu || []).length) return "";
  const rows = pp.sin_hu.map(p => `<tr data-area="${esc(p.area)}">
      <td>${areaTag(p.area)}</td>
      <td><span class="chip2">${esc(p.cargo) || "—"}</span></td>
      <td>${esc(p.nombre)}</td>
    </tr>`).join("");
  // contador de sin asignación por área (REQ / DEV / QA) — cada casilla es un FILTRO (clic)
  const AREAS3 = ["REQUERIMIENTOS", "DESARROLLO", "PRUEBAS QA Y TESTER"];
  const cnt = {}; AREAS3.forEach(a => cnt[a] = 0);
  pp.sin_hu.forEach(p => { if (p.area in cnt) cnt[p.area]++; });
  const casilla = (a) => `<div class="card kpi fade" style="cursor:pointer" data-fkey="area" data-fval="${esc(a)}" onclick="chipFilter(this)">
      <div class="label"><span class="ic" style="background:${AREA_COL[a]}20;color:${AREA_COL[a]}">○</span>${AREA_LBL[a]}</div>
      <div class="val"><span data-count="${cnt[a]}">0</span></div>
      <div class="foot">sin HU asignada</div>
      <div class="bar-mini"><i style="width:0" data-w="${pp.sin_hu.length ? Math.min(100, cnt[a] / pp.sin_hu.length * 100) : 0}"></i></div>
    </div>`;
  const counter = `<div class="grid kpis" style="margin:4px 0 2px">${AREAS3.map(casilla).join("")}</div>`;
  return `<div class="card fade" style="margin-top:16px">
    <h3>🪑 Planta del proceso sin HU asignada</h3>
    <div class="hint">Personal de <b>Requerimientos, Desarrollo y QA</b> de Positiva Core (cód. ${pp.cod_planta} · ${esc(pp.archivo)}) que <b>no tiene ninguna HU en Azure</b> al corte ${CRONO.corte} · <b>${pp.sin_hu.length}</b> sin HU de ${pp.total} (con HU: ${pp.con_hu})</div>
    ${counter}
    <div class="dwrap"><table class="dtbl"><thead><tr>
      <th>Área</th><th>Cargo</th><th>Persona</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/* planta del proceso (REQ/DEV/QA) SIN HU asignada en Azure, en la vista General de cada proyecto.
   Modelado igual que cronoPlantaSinHu (referencia: cronograma de Positiva), pero por proyecto vía
   data_carga.planta_sin_hu. Proyectos que comparten planta (419-DEP/RAMA, 416/355) ven la misma
   lista (con HU = unión de los que comparten planta). */
function projPlantaSinHu(cod) {
  const C = cargaObj(cod), pp = C && C.planta_sin_hu;
  if (!pp || !(pp.sin_hu || []).length) return "";
  const rows = pp.sin_hu.map(p => `<tr data-area="${esc(p.area)}">
      <td>${areaTag(p.area)}</td>
      <td><span class="chip2">${esc(p.cargo) || "—"}</span></td>
      <td>${esc(p.nombre)}</td>
    </tr>`).join("");
  const AREAS3 = ["REQUERIMIENTOS", "DESARROLLO", "PRUEBAS QA Y TESTER"];
  const cnt = {}; AREAS3.forEach(a => cnt[a] = 0);
  pp.sin_hu.forEach(p => { if (p.area in cnt) cnt[p.area]++; });
  const casilla = (a) => `<div class="card kpi fade" style="cursor:pointer" data-fkey="area" data-fval="${esc(a)}" onclick="chipFilter(this)">
      <div class="label"><span class="ic" style="background:${AREA_COL[a]}20;color:${AREA_COL[a]}">○</span>${AREA_LBL[a]}</div>
      <div class="val"><span data-count="${cnt[a]}">0</span></div>
      <div class="foot">sin HU asignada</div>
      <div class="bar-mini"><i style="width:0" data-w="${pp.sin_hu.length ? Math.min(100, cnt[a] / pp.sin_hu.length * 100) : 0}"></i></div>
    </div>`;
  const counter = `<div class="grid kpis" style="margin:4px 0 2px">${AREAS3.map(casilla).join("")}</div>`;
  const corte = (CARGA && CARGA.corte) || DATA.corte;
  const compart = (pp.cod_planta && cod !== pp.cod_planta) ? ` · planta compartida (cód. ${pp.cod_planta})` : "";
  return `<div class="card fade" style="margin-top:16px">
    <h3>🪑 Planta del proceso sin HU asignada</h3>
    <div class="hint">Personal de <b>Requerimientos, Desarrollo y QA</b> (planta cód. ${pp.cod_planta} · ${esc(pp.archivo)})${compart} que <b>no tiene ninguna HU en Azure</b> al corte ${corte} · <b>${pp.sin_hu.length}</b> sin HU de ${pp.total} (con HU: ${pp.con_hu})</div>
    ${counter}
    <div class="dwrap"><table class="dtbl"><thead><tr>
      <th>Área</th><th>Cargo</th><th>Persona</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/* sección final 2: HU del cronograma con más tiempo en su etapa actual */
function cronoEstancadas() {
  const E = CRONO && CRONO.estancadas;
  if (!E || !E.length) return "";
  const crit = E.filter(e => e.dias != null && e.dias > 20).length;
  const rows = E.map(e => `<tr data-proc="${esc(e.proceso || "—")}">
      <td class="num">${diasBadge(e.dias)}</td>
      <td>HU ${e.id}</td>
      <td class="muted">${esc(e.ramo) || "—"}</td>
      <td>${esc(e.etapa)}</td>
      <td class="muted">${esc(e.responsable)}</td>
      <td>${areaTag(e.area)}</td>
      <td class="muted">desde ${e.desde || "—"}</td>
    </tr>`).join("");
  return `<div class="card fade" style="margin-top:16px">
    <h3>⏳ HU más estancadas por etapa</h3>
    <div class="hint">HU del cronograma con más tiempo en su etapa actual (excluye entregadas y removidas) · responsable, área y fecha desde que están en esa etapa · <b>${crit}</b> con +20 días · top ${E.length}</div>
    ${contadorEstado(E)}
    <div class="dwrap"><table class="dtbl"><thead><tr>
      <th class="num">Días</th><th>HU</th><th>Ramo</th><th>Etapa</th><th>Responsable</th><th>Área</th><th>Desde</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/* gráfico 1: avance global del cronograma por día (dispersión lineal) con filtro Desde/Hasta.
   Eje Y dinámico (acotado a la ventana visible) para que se aprecie la variación diaria. */
function setupCronoAvance() {
  const el = $("#cCronoAv"); if (!el) return;
  const C = CRONO, c = mkChart(el), ax = axisBase();
  const dates = C.serie.map(s => s.fecha);
  const dmin = dates[0], dmax = dates[dates.length - 1];
  const fi = $("#cavIni"), ff = $("#cavFin");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;
  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax; if (a > b) { const t = a; a = b; b = t; }
    const rows = C.serie.filter(s => s.fecha >= a && s.fecha <= b);
    const dts = rows.map(s => s.fecha);
    const data = rows.map(s => s.avance == null ? null : +(s.avance * 100).toFixed(1));
    const vals = data.filter(v => v != null);
    // eje Y ajustado a la ventana (margen del 25% del rango, redondeado a 5, acotado 0-100)
    let ymin = 0, ymax = 100;
    if (vals.length) {
      const lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max(2, (hi - lo) * 0.25);
      ymin = Math.max(0, Math.floor((lo - pad) / 5) * 5);
      ymax = Math.min(100, Math.ceil((hi + pad) / 5) * 5);
      if (ymax - ymin < 5) { ymin = Math.max(0, ymin - 5); ymax = Math.min(100, ymax + 5); }
    }
    c.setOption({
      tooltip: { trigger: "axis", ...ax.tooltip, valueFormatter: v => v == null ? "—" : v.toFixed(1).replace(".", ",") + "%" },
      grid: { left: 8, right: 16, top: 20, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: dts, axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 10, formatter: v => v.slice(5) } },
      yAxis: { type: "value", name: "% avance", min: ymin, max: ymax, nameTextStyle: { color: ax.textColor, fontSize: 10 }, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, formatter: "{value}%" } },
      series: [{ name: "Avance", type: "line", smooth: true, showSymbol: true, symbol: "circle", symbolSize: 8, lineStyle: { width: 3 }, color: "#a855f7", areaStyle: { opacity: 0.08 }, data }],
    }, true);
  }
  fi.onchange = ff.onchange = apply; apply();
}

/* gráfico 2: avance por ramo por día (una línea por ramo) con filtro Desde/Hasta */
function setupCronoRamos() {
  const el = $("#cCronoRamo"); if (!el) return;
  const C = CRONO, c = mkChart(el), ax = axisBase();
  const dates = C.serie.map(s => s.fecha);
  const dmin = dates[0], dmax = dates[dates.length - 1];
  const fi = $("#crIni"), ff = $("#crFin");
  fi.min = ff.min = dmin; fi.max = ff.max = dmax; fi.value = dmin; ff.value = dmax;
  function apply() {
    let a = fi.value || dmin, b = ff.value || dmax; if (a > b) { const t = a; a = b; b = t; }
    const rows = C.serie.filter(s => s.fecha >= a && s.fecha <= b);
    const dts = rows.map(s => s.fecha);
    const series = C.ramos.map((rm, i) => ({
      name: rm, type: "line", smooth: true, showSymbol: true, symbol: "circle", symbolSize: 5, connectNulls: true,
      color: PALETTE[i % PALETTE.length],
      data: rows.map(s => { const v = s.por_ramo[rm]; return v == null ? null : +(v * 100).toFixed(1); }),
    }));
    c.setOption({
      tooltip: { trigger: "axis", ...ax.tooltip, valueFormatter: v => v == null ? "—" : v.toFixed(1).replace(".", ",") + "%" },
      legend: { type: "scroll", data: C.ramos, textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "circle" },
      grid: { left: 8, right: 16, top: 54, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: dts, axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 10, formatter: v => v.slice(5) } },
      yAxis: { type: "value", name: "% avance", min: 0, max: 100, nameTextStyle: { color: ax.textColor, fontSize: 10 }, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, formatter: "{value}%" } },
      series,
    }, true);
  }
  fi.onchange = ff.onchange = apply; apply();
}

/* gráfico 3: dispersión X=fecha comprometida, Y=ramo, color=semáforo, tamaño=nº de HU */
function drawCronoSemaforo(el) {
  const C = CRONO, c = mkChart(el), ax = axisBase();
  const SEM = { verde: ["Entregada", "#10b981"], amarillo: ["En plazo", "#f59e0b"], rojo: ["Vencida", "#ef4444"] };
  const agg = {};
  C.hus.forEach(h => { if (!h.fecha_entrega) return; const k = h.ramo + "|" + h.fecha_entrega + "|" + h.semaforo; agg[k] = (agg[k] || 0) + 1; });
  const series = Object.keys(SEM).map(sem => ({
    name: SEM[sem][0], type: "scatter", color: SEM[sem][1],
    symbolSize: (val) => Math.min(38, 8 + Math.sqrt(val[2]) * 5),
    data: Object.entries(agg).filter(([k]) => k.split("|")[2] === sem)
      .map(([k, n]) => { const p = k.split("|"); return [p[1], p[0], n]; }),  // [fecha, ramo, conteo]
  }));
  c.setOption({
    tooltip: { ...ax.tooltip, formatter: p => `<b>${p.seriesName}</b><br/>${p.value[1]}<br/>${p.value[0]} · <b>${p.value[2]}</b> HU` },
    legend: { data: Object.values(SEM).map(s => s[0]), textStyle: { color: ax.textColor, fontSize: 11 }, top: 0 },
    grid: { left: 8, right: 22, top: 34, bottom: 6, containLabel: true },
    xAxis: { type: "time", axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 10, formatter: v => echarts.format.formatTime("dd/MM", v) } },
    yAxis: { type: "category", data: C.ramos, axisLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, fontSize: 11 } },
    series,
  }, true);
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
  // evolución de la planta consolidada por día — va JUSTO debajo de "Recursos del equipo"
  const plantaPort = RECURSOS ? `
  <div class="card fade" style="margin-top:16px">
    <h3>👥 Evolución de la planta consolidada · por día</h3>
    <div class="hint">Total de personas de todo el portafolio por día (sin doble-conteo de plantas compartidas) · línea Total y por área · desde el primer archivo de planta${RECURSOS.plantas && RECURSOS.plantas.length ? " (" + RECURSOS.plantas[0].fecha + ")" : ""}</div>
    <div class="filterbar">
      <label>Desde <input type="date" id="ppIni"></label>
      <label>Hasta <input type="date" id="ppFin"></label>
    </div>
    <div id="cPlantaPort" class="chart tall"></div>
  </div>` : "";
  $("#content").innerHTML = head + kpis + recursos + plantaPort + charts;
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
  if ($("#cPlantaPort")) setupPlantaEvol(RECURSOS.portafolio, { el: "#cPlantaPort", ini: "#ppIni", fin: "#ppFin" });
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
