/* Tableros DORA — dashboard web (datos: data.json generado por build_dashboard_data.py) */
/* Los procesos (key/label/color) vienen del JSON -> sin strings de proceso hardcodeados. */
let DATA = null, CURRENT = null, CHARTS = [], PROCS = [], PORT_INI = null, PORT_FIN = null, RECURSOS = null, CARGA = null, CRONO = null, RQC = null, PRODUCTIV = null, COSTOS = null, CONTROLES = null, FLUJO = null, SPRINTS = null, SPRINTS_COSTO = null, BURNDOWN = null, SPRINT_REF = null;
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
  // flujo & tiempos (lead time, WIP por etapa, aging); agregados sin identificadores -> se publica
  try { const fl = await fetch("data_flujo.json"); FLUJO = fl.ok ? await fl.json() : null; }
  catch (_) { FLUJO = null; }
  // sprints: velocidad/completitud (público) + costo por sprint (INTERNO, gitignored -> ausente en público)
  try { const sp = await fetch("data_sprints.json"); SPRINTS = sp.ok ? await sp.json() : null; }
  catch (_) { SPRINTS = null; }
  try { const sc = await fetch("data_sprints_costo.json"); SPRINTS_COSTO = sc.ok ? await sc.json() : null; }
  catch (_) { SPRINTS_COSTO = null; }
  // burndown/burnup predictivo por sprint (esperado vs ejecutado); público sin identificadores
  try { const bd = await fetch("data_sprint_burndown.json"); BURNDOWN = bd.ok ? await bd.json() : null; }
  catch (_) { BURNDOWN = null; }
  // cumplimiento de sprint vs referencia (comprometido fijo vs ejecutado); público sin identificadores
  try { const sr = await fetch("data_sprint_ref.json"); SPRINT_REF = sr.ok ? await sr.json() : null; }
  catch (_) { SPRINT_REF = null; }
  const sel = $("#proySel");
  const cronoOpt = CRONO ? `<option value="__crono__">📅 ${CRONO.nombre}</option>` : "";
  // 419 consolidado (DEP + RAMA) si ambos enfoques existen en data.json
  const has419 = d.proyectos.some(p => p.codigo === "419-DEP") && d.proyectos.some(p => p.codigo === "419-RAMA");
  const cons419Opt = has419 ? `<option value="__419__">⚖️ 419 · Consolidado (Depósitos + Rama Judicial)</option>` : "";
  // controles de cambio (una entrada por proyecto con datos CC)
  const ccOpts = CONTROLES && CONTROLES.proyectos
    ? Object.keys(CONTROLES.proyectos).map(c => `<option value="__cc_${c}__">🔧 ${c} · Controles de Cambios</option>`).join("") : "";
  sel.innerHTML = `<option value="__all__">▦ Portafolio (todos)</option>` + cronoOpt + cons419Opt + ccOpts +
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
  else if (CURRENT === "__419__") render419();
  else if (CURRENT.startsWith("__cc_")) renderCC(CURRENT.slice(5, -2));
  else renderProject(DATA.proyectos.find(p => p.codigo === CURRENT));
  animateBars();
}

/* ---------- vista proyecto (con pestañas por perfil de control) ---------- */
/* Cada pestaña reordena los MISMOS widgets según lo que necesita ese rol. La hoja
   Portafolio NO se toca. "General" conserva la vista completa para no perder nada. */
const PROFILES = [
  // 3 ventanas por ALTITUD de decisión (propuesta por rol)
  { id: "directivo", label: "Directivo", icon: "🎯", color: "#a855f7" },   // estratégico: Presidente/VP/CTO/Dir.Ops
  { id: "gerencial", label: "Gerencial", icon: "📋", color: "#38bdf8" },   // táctico: Gerentes + Aseguramiento
  { id: "operativo", label: "Operativo", icon: "🛠", color: "#f59e0b" },   // ejecución: Head de fábrica + Scrum
];
// objeto-proyecto de controles de cambio (misma forma que un proyecto); null si el proyecto no tiene CC
function controlesObj(cod) { return CONTROLES && CONTROLES.proyectos ? CONTROLES.proyectos[cod] : null; }

/* ===== Visuales gerenciales (propuesta por rol) ===== */
/* Proyección de cierre: a la velocidad actual, ¿cuántos días hábiles faltan vs el cierre QA? */
function proyeccionCierre(p) {
  const k = p.kpis || {}, vel = k.velocidad || 0, pend = k.hu_pendientes || 0;
  const rest = k.dias_restantes ? k.dias_restantes.QA : null;
  if (!vel) return { sev: 2, dias_nec: null, rest, estado: "sin ritmo medible", accion: `${fmt(pend)} HU pendientes sin producción medible — definir arranque/medición` };
  const dias_nec = Math.ceil(pend / vel);
  let sev = 1, estado = "🟢 en plazo";
  if (rest == null) { sev = 1; estado = "sin fecha de cierre"; }
  else if (dias_nec > rest * 1.15) { sev = 3; estado = "🔴 desviado"; }
  else if (dias_nec > rest) { sev = 2; estado = "🟡 en riesgo"; }
  const exceso = rest != null ? Math.max(0, dias_nec - rest) : 0;
  return { sev, dias_nec, rest, estado, accion: sev >= 2 && exceso ? `Cierre proyectado supera el plazo por ~${fmt(exceso)} días hábiles — replanificar o sumar capacidad` : null };
}
/* Eficiencia: costo unitario PROMEDIO por HU gestionada (reusa la tabla de costo/HU) */
function eficienciaHu(p, recCod) {
  const cells = costoHuCells(p, recCod || p.codigo);
  const vals = [];
  COSTO_HU_PROCS.forEach(pp => Object.values(cells[pp.key] || {}).forEach(c => { if (c.costo != null) vals.push(c.costo); }));
  return vals.length ? { avg: vals.reduce((a, x) => a + x, 0) / vals.length, n: vals.length } : null;
}
/* Top 3 decisiones: alertas accionables priorizadas por severidad (estancamiento, cierre, costo, foco) */
function topDecisiones(p, recCod) {
  const acc = [];
  const c = cargaObj(p.codigo);
  const e10 = c && c.alertas ? c.alertas.filter(a => a.dias_sin_mov != null && a.dias_sin_mov > 10).length : 0;
  if (e10 > 0) acc.push({ sev: e10 > 20 ? 3 : 2, icon: "⚠", txt: `<b>${e10} HU</b> llevan +10 días sin avanzar — priorizar desbloqueo` });
  const proy = proyeccionCierre(p);
  if (proy.accion) acc.push({ sev: proy.sev, icon: "⏳", txt: proy.accion });
  const C = COSTOS && COSTOS.proyectos ? COSTOS.proyectos[recCod || p.codigo] : null;
  if (C && C.total && C.total.variacion < 0) { const m = Math.abs(C.total.variacion); if (m > 5e6) acc.push({ sev: m > 50e6 ? 3 : 2, icon: "💸", txt: `Sobrecosto de planta <b>${fmtMoney(m)}</b> por días sin producción — revisar capacidad` }); }
  const pend = {}; PROCS.forEach(pr => { if (pr.key !== "EN PRODUCCIÓN" && (p.por_proceso || {})[pr.key]) pend[pr.key] = p.por_proceso[pr.key]; });
  const top = Object.entries(pend).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 0) { const lbl = (PROCS.find(x => x.key === top[0]) || {}).label || top[0]; acc.push({ sev: 1, icon: "📌", txt: `Mayor acumulación de HU en <b>${lbl}</b> (${top[1]}) — foco de gestión` }); }
  return acc.sort((a, b) => b.sev - a.sev).slice(0, 3);
}
function cTop3Html(p, recCod) {
  const ds = topDecisiones(p, recCod);
  if (!ds.length) return "";
  return `<div class="card fade" style="border-left:3px solid #6366f1">
    <h3>🎯 Top 3 · decisiones sugeridas</h3>
    <div class="hint">Acciones priorizadas con los datos al ${DATA.corte}</div>
    <div style="display:flex;flex-direction:column;gap:9px;margin-top:8px">
      ${ds.map(d => `<div style="display:flex;gap:10px;align-items:flex-start"><span style="font-size:16px;line-height:1.2">${d.icon}</span><span style="color:var(--text)">${d.txt}</span></div>`).join("")}
    </div></div>`;
}
let PROJ = null, PROFILE_TAB = "directivo";

function renderProject(p) {
  PROJ = p;
  if (!["directivo", "gerencial", "operativo"].includes(PROFILE_TAB)) PROFILE_TAB = "directivo";
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

  const head = `<div class="project-title fade">
    <h2>${p.nombre}</h2>
    <span class="tag">${p.codigo}</span>
    ${p.producto ? `<span class="tag">${p.producto}</span>` : ""}
    ${p.estado ? `<span class="tag">${p.estado}</span>` : ""}
  </div>`;
  const tabbar = `<div class="tabbar">${PROFILES.map(pr =>
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
  // Flujo & Tiempos (Nivel 1): Lead Time + WIP por etapa + Aging (Seguimiento y Operativo)
  const cFlujoTiempos = flujoTiemposCard(p.codigo);
  // Espacio dedicado a Sprints (solo en Operativo, y solo si el proyecto tiene calendario cargado)
  const cSprintSpace = sprintSpace(p.codigo);
  // visuales gerenciales nuevos: proyección de cierre, eficiencia costo/HU, Top-3 decisiones
  const _proy = proyeccionCierre(p);
  const kProy = kpi("Proyección de cierre", "🗓", _proy.sev >= 3 ? "#ef4444" : _proy.sev >= 2 ? "#f59e0b" : "#10b981",
    _proy.dias_nec == null ? "—" : `<span data-count="${_proy.dias_nec}">0</span> <small>días háb.</small>`,
    `${_proy.estado}${_proy.rest != null ? " · faltan " + fmt(_proy.rest) + " al cierre QA" : ""}`);
  const _efic = eficienciaHu(p);
  const kEfic = kpi("Costo unitario por HU", "💲", "#10b981", _efic ? fmtCostoHu(_efic.avg) : "—", "promedio gestionado · REQ/DEV/QA");
  const cTop3 = cTop3Html(p);

  const split = (a, b) => `<div class="grid charts" style="margin-top:16px">${a}${b}</div>`;   // 1.2 / .8
  const two = (a, b) => `<div class="grid charts-2" style="margin-top:16px">${a}${b}</div>`;    // 1 / 1
  const note = (t) => `<div class="tabnote">${t}</div>`;

  let body;
  switch (PROFILE_TAB) {
    case "gerencial":   // TÁCTICO: Gerentes de Proyecto / Integral / Aseguramiento
      body = note("Gerencial · gestión del proyecto: avance vs plan, carga del equipo, calidad y cumplimiento") +
        cTop3 + wrapKpis([kHU, kProd, kPctProd, kAvance, kVel, kCierre, kEstanc]) +
        cRecursos + split(cArea, cDonut) + cFlujoTiempos + cProd + two(cLine, cGauge) + cRqc + cCarga + cAlertas; break;
    case "operativo":   // EJECUCIÓN: Head de fábrica + Scrum
      body = note("Operativo · ejecución y día a día: flujo, capacidad, carga y costos de fábrica") +
        cTop3 + wrapKpis([kHU, kProd, kEstanc, kAvance, kVel]) +
        split(cArea, cDonut) + cFlujoTiempos + cSprintSpace + cFlujo + cPivot + cCostoHu + cCostos + cProdPD + cRecursos + cPlanta + cCarga + cAlertas + cSinHu; break;
    default:            // DIRECTIVO (estratégico): Presidente / VP / CTO / Director de Operaciones
      body = note("Directivo · ¿vamos a cumplir? ¿cuánto cuesta? ¿dónde está el riesgo?") +
        cTop3 + wrapKpis([kPctProd, kAvance, kProy, kEfic, kCierre, kEstanc]) +
        two(cLine, cGauge) + cProd + cCostos + cRqc;
  }

  $("#content").innerHTML = head + tabbar + body;
  countUp();
  // dibuja/cablea SOLO lo que está presente en la ventana activa
  if ($("#recFecha")) setupRecursos(recObj);
  if ($("#cArea")) drawArea($("#cArea"), p);
  if ($("#cDonut")) drawDonut($("#cDonut"), p);
  if ($("#cLine")) drawLine($("#cLine"), p);
  if ($("#cGauge")) drawGauge($("#cGauge"), p, k);
  if ($("#tblMode")) setupPivot(p);
  if ($("#chWrap")) setupCostoHu(p, p.codigo, "");
  if ($("#cFlujo")) drawFlujo($("#cFlujo"), p);
  if ($("#cProdPD")) setupProdPersona(p.codigo);
  if ($("#cPlanta")) setupPlantaEvol(recObj);
  if ($("#cRqcDonut")) drawRqcDonut($("#cRqcDonut"));
  if ($(".prodarea")) setupProdVar(p.codigo);
  if ($("#coIni")) setupCostos(p.codigo);
  if ($("#ftLead") || $("#ftWip") || $("#ftAge")) setupFlujoTiempos(p.codigo);
  if ($("#srChart")) setupSprintRef(p.codigo);    // espacio de Sprints (solo Operativo)
  if ($("#spChart")) setupSprints(p.codigo);
  if ($("#bdChart")) setupBurndown(p.codigo);
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

/* ===== FLUJO & TIEMPOS (Nivel 1): Lead Time, WIP por etapa, Aging =====
   Fuente: data_flujo.json (agregados sin identificadores). Cada tarjeta trae su filtro
   dinámico (sprint o proceso) que recalcula KPIs + gráfico en cliente. */
const ftColor = (k) => (PROCS.find(p => p.key === k) || {}).color || "#5d6678";
const ftLabel = (k) => (PROCS.find(p => p.key === k) || {}).label || (k || "Sin homologar");
function ftStatBox(id, color, icon, label, foot) {
  return `<div class="card kpi fade"><div class="label"><span class="ic" style="background:${color}20;color:${color}">${icon}</span>${label}</div><div class="val" id="${id}">—</div><div class="foot">${foot}</div></div>`;
}
function flujoTiemposCard(cod) {
  const F = FLUJO && FLUJO.proyectos ? FLUJO.proyectos[cod] : null;
  if (!F) return "";
  let out = "";
  // --- Lead Time de entrega (Creación -> Resolución) ---
  if (F.lead_time && F.lead_time.items.length) {
    const sprOpts = `<option value="__all__">Todos los sprints</option>` +
      (F.sprints || []).map(s => `<option value="${s}">${s}</option>`).join("");
    out += `<div class="card fade" style="margin-top:16px">
      <h3>⏱️ Lead Time de entrega · Creación → Resolución</h3>
      <div class="hint">Días calendario desde que se crea la HU hasta que se resuelve. <b>Mediana</b> = tiempo típico · <b>p85</b> = plazo confiable (85% entrega en ≤ ese tiempo). Filtra por sprint (Iteration Path).</div>
      <div class="filterbar"><label>Sprint <select id="ftLtSpr">${sprOpts}</select></label></div>
      <div class="grid kpis" style="margin:2px 0">
        ${ftStatBox("ftLtMed", "#6366f1", "◐", "Mediana", "días (p50)")}
        ${ftStatBox("ftLtP85", "#a855f7", "◔", "p85", "días (85% en ≤)")}
        ${ftStatBox("ftLtN", "#38bdf8", "▦", "HU resueltas", "con fecha de cierre")}
        ${ftStatBox("ftLtMax", "#ef4444", "▲", "Máximo", "días (peor caso)")}
      </div>
      <div id="ftLead" class="chart"></div></div>`;
  }
  // --- WIP por etapa (cuellos de botella) ---
  if (F.wip && F.wip.etapas.length) {
    const procs = [...new Set(F.wip.etapas.map(e => e.proceso))];
    const opts = `<option value="__all__">Todos los procesos</option>` +
      procs.map(k => `<option value="${k}">${ftLabel(k)}</option>`).join("");
    out += `<div class="card fade" style="margin-top:16px">
      <h3>🚧 WIP por etapa · cuellos de botella</h3>
      <div class="hint">HU detenidas en cada etapa al corte ${F.corte} (excluye producción y removidas). Barras más largas = colas / cuellos de botella. Filtra por proceso.</div>
      <div class="filterbar"><label>Proceso <select id="ftWipProc">${opts}</select></label></div>
      <div id="ftWip" class="chart tall"></div></div>`;
  }
  // --- Aging (HU estancadas) ---
  if (F.aging && F.aging.items.length) {
    const procs = [...new Set(F.aging.items.map(i => i.proc))];
    const opts = `<option value="__all__">Todos los procesos</option>` +
      procs.map(k => `<option value="${k}">${ftLabel(k)}</option>`).join("");
    out += `<div class="card fade" style="margin-top:16px">
      <h3>⏳ HU estancadas · antigüedad sin movimiento</h3>
      <div class="hint">Días desde el último cambio de estado (corte − <i>Changed Date</i>) en las HU activas. Más antiguas = riesgo de no cerrar. Filtra por proceso.</div>
      <div class="filterbar"><label>Proceso <select id="ftAgeProc">${opts}</select></label></div>
      <div class="grid kpis" style="margin:2px 0">
        ${ftStatBox("ftAgeN", "#38bdf8", "▦", "HU activas", "sin prod / removidas")}
        ${ftStatBox("ftAge30", "#ef4444", "▲", "+30 días", "sin moverse")}
        ${ftStatBox("ftAgeMax", "#f59e0b", "◔", "Máximo", "días detenida")}
      </div>
      <div id="ftAge" class="chart"></div></div>`;
  }
  return out;
}
function setupFlujoTiempos(cod) {
  const F = FLUJO && FLUJO.proyectos ? FLUJO.proyectos[cod] : null; if (!F) return;
  // --- Lead Time: histograma + KPIs, recalculado por sprint ---
  if ($("#ftLead") && F.lead_time) {
    const items = F.lead_time.items, sel = $("#ftLtSpr"), c = mkChart($("#ftLead")), ax = axisBase();
    const EDGES = [30, 60, 90, 180, 365, Infinity], LBL = ["0–30", "31–60", "61–90", "91–180", "181–365", ">365"];
    const apply = () => {
      const s = sel.value;
      const arr = (s === "__all__" ? items : items.filter(i => i.sprint === s)).map(i => i.lt).sort((a, b) => a - b);
      const q = (p) => arr.length ? arr[Math.min(arr.length - 1, Math.round(p * (arr.length - 1)))] : null;
      $("#ftLtMed").textContent = arr.length ? q(.5) : "—";
      $("#ftLtP85").textContent = arr.length ? q(.85) : "—";
      $("#ftLtN").textContent = fmt(arr.length);
      $("#ftLtMax").textContent = arr.length ? arr[arr.length - 1] : "—";
      const counts = LBL.map(() => 0);
      arr.forEach(v => { for (let i = 0; i < LBL.length; i++) { if (v <= EDGES[i]) { counts[i]++; break; } } });
      c.setOption({
        tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" }, formatter: ps => `${ps[0].name} días<br/><b>${ps[0].value}</b> HU` },
        grid: { left: 8, right: 14, top: 16, bottom: 6, containLabel: true },
        xAxis: { type: "category", data: LBL, axisLabel: { color: ax.textColor, fontSize: 10 }, axisLine: { lineStyle: { color: ax.line } } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
        series: [{ type: "bar", data: counts, barWidth: "55%", itemStyle: { color: "#6366f1", borderRadius: [4, 4, 0, 0] }, label: { show: true, position: "top", color: ax.textColor, fontSize: 11, fontWeight: 600 } }],
      });
    };
    sel.onchange = apply; apply();
  }
  // --- WIP por etapa: barras horizontales ordenadas (cuello arriba), filtro por proceso ---
  if ($("#ftWip") && F.wip) {
    const sel = $("#ftWipProc"), c = mkChart($("#ftWip")), ax = axisBase();
    const apply = () => {
      const s = sel.value;
      const e = (s === "__all__" ? F.wip.etapas : F.wip.etapas.filter(x => x.proceso === s)).slice().sort((a, b) => a.n - b.n);
      c.setOption({
        tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" }, formatter: ps => `${ps[0].name}<br/><b>${ps[0].value}</b> HU detenidas` },
        grid: { left: 8, right: 28, top: 8, bottom: 6, containLabel: true },
        xAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
        yAxis: { type: "category", data: e.map(x => x.estado), axisLabel: { color: ax.textColor, fontSize: 10 }, axisLine: { lineStyle: { color: ax.line } } },
        series: [{ type: "bar", barWidth: "62%", data: e.map(x => ({ value: x.n, itemStyle: { color: x.color, borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: ax.textColor, fontSize: 11, fontWeight: 600 } }],
      });
    };
    sel.onchange = apply; apply();
  }
  // --- Aging: histograma por buckets + KPIs, filtro por proceso ---
  if ($("#ftAge") && F.aging) {
    const items = F.aging.items, sel = $("#ftAgeProc"), c = mkChart($("#ftAge")), ax = axisBase();
    const EDGES = [3, 7, 14, 30, Infinity], LBL = ["0–3", "4–7", "8–14", "15–30", ">30"];
    const COLS = ["#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444"];
    const apply = () => {
      const s = sel.value;
      const arr = s === "__all__" ? items : items.filter(i => i.proc === s);
      $("#ftAgeN").textContent = fmt(arr.length);
      $("#ftAge30").textContent = arr.filter(i => i.dias > 30).length;
      $("#ftAgeMax").textContent = arr.length ? Math.max(...arr.map(i => i.dias)) : "—";
      const counts = LBL.map(() => 0);
      arr.forEach(i => { for (let k = 0; k < LBL.length; k++) { if (i.dias <= EDGES[k]) { counts[k]++; break; } } });
      c.setOption({
        tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" }, formatter: ps => `${ps[0].name} días<br/><b>${ps[0].value}</b> HU` },
        grid: { left: 8, right: 14, top: 16, bottom: 6, containLabel: true },
        xAxis: { type: "category", data: LBL, axisLabel: { color: ax.textColor, fontSize: 10 }, axisLine: { lineStyle: { color: ax.line } } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } },
        series: [{ type: "bar", barWidth: "55%", data: counts.map((v, i) => ({ value: v, itemStyle: { color: COLS[i], borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: "top", color: ax.textColor, fontSize: 11, fontWeight: 600 } }],
      });
    };
    sel.onchange = apply; apply();
  }
}

/* ===== SPRINTS (Etapa 2): alcance vs entregado por sprint + costo (Cargos.xlsx, interno) =====
   Fuentes: data_sprints.json (velocidad/completitud, pública) + data_sprints_costo.json (costo,
   INTERNO/gitignored → ausente en la versión pública, la línea de costo simplemente no aparece).
   Mide completitud ACTUAL por sprint (alcance vs entregado a hoy), no velocidad por timebox. */
function sprintsCard(cod) {
  const S = SPRINTS && SPRINTS.proyectos ? SPRINTS.proyectos[cod] : null;
  if (!S || !S.sprints.length) return "";
  const C = SPRINTS_COSTO && SPRINTS_COSTO.proyectos ? SPRINTS_COSTO.proyectos[cod] : null;
  const r = S.resumen, sinSpr = S.sprints.find(s => s.num == null);
  const kpis = [
    ftStatBox("spVelSp", "#6366f1", "⚡", "Velocidad media", "SP entregados/sprint (últ. 6)"),
    ftStatBox("spVelHu", "#38bdf8", "▦", "Velocidad media", "HU entregadas/sprint (últ. 6)"),
    ftStatBox("spDone", "#10b981", "✓", "SP entregados", "de " + fmt(r.sp_total) + " del alcance"),
  ];
  if (C) {
    kpis.push(ftStatBox("spCostoDia", "#f59e0b", "💲", "Costo equipo/día", fmt(C.n_personas) + " personas · nómina"));
    kpis.push(ftStatBox("spCostoUlt", "#ef4444", "🗓", "Costo último sprint", "días háb. × nómina/día"));
  }
  const costoNota = C ? " · <b>línea de costo</b> (nómina interna)" : "";
  const backlog = sinSpr ? `<div class="hint" style="margin:2px 0 0">📥 Backlog sin sprint asignado: <b>${fmt(sinSpr.n_hu)}</b> HU · ${fmt(sinSpr.sp_total)} SP (${fmt(sinSpr.n_done)} en producción)</div>` : "";
  return `<div class="card fade" style="margin-top:16px">
    <h3>🏃 Sprints · alcance vs entregado${C ? " y costo" : ""}</h3>
    <div class="hint">Por sprint (Iteration Path): barras = <b>entregado</b> (en producción) vs <b>alcance</b>; completitud a hoy${costoNota}. <i>Mide completitud actual por sprint, no velocidad por timebox (eso exige el historial de revisiones de ADO).</i></div>
    <div class="filterbar">
      <label>Métrica <select id="spMetric"><option value="sp">Story Points</option><option value="hu">HU</option></select></label>
      <label>Mostrar <select id="spLast"><option value="6">Últimos 6</option><option value="10">Últimos 10</option><option value="20">Últimos 20</option><option value="999">Todos</option></select></label>
    </div>
    <div class="grid kpis" style="margin:2px 0">${kpis.join("")}</div>
    ${backlog}
    <div id="spChart" class="chart tall"></div></div>`;
}
function setupSprints(cod) {
  const S = SPRINTS && SPRINTS.proyectos ? SPRINTS.proyectos[cod] : null; if (!S) return;
  const C = SPRINTS_COSTO && SPRINTS_COSTO.proyectos ? SPRINTS_COSTO.proyectos[cod] : null;
  const costMap = {}; if (C) C.sprints.forEach(s => costMap[s.num] = s);
  const conNum = S.sprints.filter(s => s.num != null), r = S.resumen, last = conNum[conNum.length - 1];
  const setT = (id, v) => { const e = $("#" + id); if (e) e.textContent = v; };
  setT("spVelSp", r.vel_prom_sp != null ? fmt(r.vel_prom_sp) : "—");
  setT("spVelHu", r.vel_prom_hu != null ? fmt(r.vel_prom_hu) : "—");
  setT("spDone", fmt(r.sp_done_total));
  if (C) {
    setT("spCostoDia", fmtMoney(C.costo_dia));
    // "último sprint" = el de mayor número con alcance real (ignora sprints recién abiertos sin SP)
    const lastReal = [...conNum].reverse().find(s => s.sp_total > 0) || last;
    const cl = lastReal ? costMap[lastReal.num] : null;
    setT("spCostoUlt", cl ? fmtMoney(cl.costo) : "—");
    const foot = document.querySelector("#spCostoUlt")?.parentElement?.querySelector(".foot");
    if (foot && lastReal) foot.textContent = `Sprint ${lastReal.num} · ${cl ? cl.dias : "—"} días háb.`;
  }
  const elc = $("#spChart"); if (!elc) return;
  const c = mkChart(elc), ax = axisBase(), metric = $("#spMetric"), lastSel = $("#spLast");
  const apply = () => {
    const m = metric.value, n = +lastSel.value, arr = conNum.slice(-n);
    const cats = arr.map(s => "S" + s.num);
    const done = arr.map(s => m === "sp" ? s.sp_done : s.n_done);
    const tot = arr.map(s => m === "sp" ? s.sp_total : s.n_hu);
    const pend = tot.map((t, i) => Math.max(0, +(t - done[i]).toFixed(1)));
    const series = [
      { name: "Entregado", type: "bar", stack: "a", color: "#10b981", data: done },
      { name: "Pendiente", type: "bar", stack: "a", color: "#3a4256", data: pend },
    ];
    const yAxes = [{ type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor } }];
    const legend = ["Entregado", "Pendiente"];
    if (C) {
      const costo = arr.map(s => { const cc = costMap[s.num]; return cc ? +(cc.costo / 1e6).toFixed(1) : null; });
      yAxes.push({ type: "value", name: "M$", position: "right", splitLine: { show: false }, axisLabel: { color: "#f59e0b" }, nameTextStyle: { color: "#f59e0b" } });
      series.push({ name: "Costo (M$)", type: "line", yAxisIndex: 1, color: "#f59e0b", smooth: true, symbol: "circle", symbolSize: 6, lineStyle: { width: 2.5 }, data: costo });
      legend.push("Costo (M$)");
    }
    c.setOption({
      tooltip: {
        trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" }, formatter: ps => {
          const i = ps[0].dataIndex, s = arr[i], cc = costMap[s.num];
          const u = m === "sp" ? "SP" : "HU", t = m === "sp" ? s.sp_total : s.n_hu, dn = m === "sp" ? s.sp_done : s.n_done;
          let h = `<b>Sprint ${s.num}</b><br/>Entregado: ${fmt(dn)} / ${fmt(t)} ${u} (${t ? Math.round(100 * dn / t) : 0}%)`;
          if (cc) h += `<br/>Costo: ${fmtMoney(cc.costo)} · ${cc.dias} días háb.<br/>Costo/${u}: ${fmtMoney(u === "SP" ? cc.costo_sp : cc.costo_hu)}`;
          return h;
        }
      },
      legend: { data: legend, textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
      grid: { left: 8, right: C ? 40 : 14, top: 30, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: cats, axisLabel: { color: ax.textColor, fontSize: 10 }, axisLine: { lineStyle: { color: ax.line } } },
      yAxis: yAxes, series,
    });
  };
  metric.onchange = lastSel.onchange = apply; apply();
}

/* ===== BURNDOWN/BURNUP PREDICTIVO por sprint (esperado vs ejecutado) =====
   Fuente: data_sprint_burndown.json (% avance ponderado de las HU comprometidas, por día).
   Dibuja la recta ideal (inicio->fin), el ejecutado real y una proyección al ritmo actual. */
function busDaysBetween(a, b) {       // nº de días hábiles entre dos fechas ISO (aprox, sin festivos)
  let d = new Date(a + "T00:00:00"), end = new Date(b + "T00:00:00"), n = 0;
  while (d < end) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) n++; }
  return n;
}
function addBusDays(dateStr, nDays) {  // suma nDays hábiles a una fecha ISO -> ISO
  let d = new Date(dateStr + "T00:00:00"), added = 0;
  while (added < nDays) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) added++; }
  return d.toISOString().slice(0, 10);
}
function burndownCard(cod) {
  const B = BURNDOWN && BURNDOWN.proyectos ? BURNDOWN.proyectos[cod] : null;
  if (!B || !B.sprints.length) return "";
  const opts = B.sprints.map(s => `<option value="${s.num}">Sprint ${s.num} · ${s.inicio} → ${s.fin}</option>`).join("");
  return `<div class="card fade" style="margin-top:16px">
    <h3>📉 Predictivo de sprint · avance esperado vs ejecutado</h3>
    <div class="hint">% avance ponderado por etapa de las HU comprometidas: <b>recta ideal</b> (inicio→fin) vs <b>ejecutado real</b> día a día, con <b>proyección</b> de cierre al ritmo actual. Las fechas y el presupuesto por proceso (Desarrollo/QA) de cada sprint se definen en <code>datos/maestros/sprints_calendario.xlsx</code> (hoja Calendario).</div>
    <div class="filterbar"><label>Sprint <select id="bdSprint">${opts}</select></label></div>
    <div class="grid kpis" style="margin:2px 0">
      ${ftStatBox("bdReal", "#10b981", "▶", "Avance real", "% ponderado hoy")}
      ${ftStatBox("bdEsp", "#a855f7", "◎", "Avance esperado", "% ideal hoy")}
      ${ftStatBox("bdGap", "#f59e0b", "Δ", "Brecha", "real − esperado")}
      ${ftStatBox("bdProj", "#38bdf8", "🗓", "Cierre proyectado", "al ritmo actual")}
    </div>
    <div id="bdNota" class="hint" style="margin:2px 0 0"></div>
    <div id="bdPlanWrap"></div>
    <div id="bdChart" class="chart tall"></div></div>`;
}
function setupBurndown(cod) {
  const B = BURNDOWN && BURNDOWN.proyectos ? BURNDOWN.proyectos[cod] : null; if (!B) return;
  const sel = $("#bdSprint"); if (!sel) return;
  const c = mkChart($("#bdChart")), ax = axisBase();
  const byNum = Object.fromEntries(B.sprints.map(s => [String(s.num), s]));
  const apply = () => {
    const s = byNum[sel.value]; if (!s) return;
    const esp = s.esperado, real = s.real;
    const lastReal = real.length ? real[real.length - 1] : null;
    // esperado "hoy" = % ideal a la fecha del último corte real (100 si ya pasó el fin del plan)
    let espHoy = null;
    if (lastReal) {
      const e = esp.filter(x => x.f <= lastReal.f);
      espHoy = e.length ? e[e.length - 1].pct : esp[0].pct;
      if (lastReal.f > esp[esp.length - 1].f) espHoy = 100;
    }
    // proyección: pendiente de %avance por día hábil entre el 1er y el último corte real
    let projDate = null;
    if (real.length >= 2 && lastReal.pct < 100) {
      const bdays = busDaysBetween(real[0].f, lastReal.f) || (real.length - 1);
      const slopeDay = (lastReal.pct - real[0].pct) / Math.max(1, bdays);
      if (slopeDay > 0.05) projDate = addBusDays(lastReal.f, Math.ceil((100 - lastReal.pct) / slopeDay));
    }
    // eje X = fechas de esperado ∪ real ∪ proyección
    const allD = new Set([...esp.map(e => e.f), ...real.map(r => r.f)]); if (projDate) allD.add(projDate);
    const dates = [...allD].sort();
    const espMap = Object.fromEntries(esp.map(e => [e.f, e.pct]));
    const realMap = Object.fromEntries(real.map(r => [r.f, r.pct]));
    const espData = dates.map(d => espMap[d] ?? null);
    const realData = dates.map(d => realMap[d] ?? null);
    const projData = dates.map(d => (projDate && lastReal && d === lastReal.f) ? lastReal.pct : (d === projDate ? 100 : null));
    // KPIs
    const setT = (id, v) => { const e = $("#" + id); if (e) e.textContent = v; };
    setT("bdReal", lastReal ? lastReal.pct.toFixed(0) + "%" : "—");
    setT("bdEsp", espHoy != null ? espHoy.toFixed(0) + "%" : "—");
    const gap = (lastReal && espHoy != null) ? (lastReal.pct - espHoy) : null;
    setT("bdGap", gap == null ? "—" : (gap >= 0 ? "+" : "") + gap.toFixed(0) + " pts");
    const gEl = $("#bdGap"); if (gEl) gEl.style.color = gap == null ? "" : (gap >= -2 ? "#10b981" : gap >= -10 ? "#f59e0b" : "#ef4444");
    setT("bdProj", projDate || (lastReal && lastReal.pct >= 100 ? "completado" : "sin ritmo"));
    const pEl = $("#bdProj"); if (pEl) pEl.style.color = projDate ? (projDate <= s.fin ? "#10b981" : "#ef4444") : "";
    const nota = $("#bdNota");
    if (nota) nota.innerHTML = `Comprometido <b>${s.baseline.n_hu}</b> HU · ${fmt(s.baseline.sp)} SP · base ${s.baseline.pct.toFixed(0)}% (foto ${s.baseline_fecha})`
      + (s.baseline_parcial ? " · ⚠️ foto inicial parcial (el sprint arrancó antes del 1er snapshot)" : "")
      + (projDate ? ` · proyección 100%: <b>${projDate}</b> vs fin plan ${s.fin}` : "");
    // ── Ejecutado vs presupuestado POR PROCESO + alerta de cambio de alcance ──
    // Presupuesto: SP Desarrollo / Effort QA (ambos estimados, del xlsx). Ejecutado: SP de las HU
    // comprometidas que ya pasaron cada proceso (crédito al ENTRAR al siguiente: Desarrollo cumple
    // al pasar a QA; QA al pasar a Cliente/posterior). Viene por día en real[].sp_dev / real[].sp_qa.
    const pw = $("#bdPlanWrap");
    if (pw) {
      const pl = s.plan || {}, dev = pl.sp_dev, qa = pl.effort_qa;
      let html = "";
      if (dev != null || qa != null) {
        const lr = lastReal || {}, ejDev = lr.sp_dev, ejQa = lr.sp_qa;
        const totP = (dev || 0) + (qa || 0), totE = (ejDev || 0) + (ejQa || 0);
        const pctOf = (e, p) => (p ? Math.round((e || 0) / p * 100) : null);
        const colOf = (pc) => pc == null ? "#64748b" : pc >= 100 ? "#10b981" : pc >= 50 ? "#0ea5e9" : "#f59e0b";
        const pbox = (bc, ic, lb, ej, pr) => {
          const pc = pctOf(ej, pr), pcol = colOf(pc);
          return `<div class="card kpi fade"><div class="label"><span class="ic" style="background:${bc}20;color:${bc}">${ic}</span>${lb}</div>`
            + `<div class="val" style="color:${pcol}">${pc == null ? "—" : pc + "%"}</div>`
            + `<div class="foot">${ej != null ? fmt(ej) : "—"} / ${pr != null ? fmt(pr) : "—"} SP ejecutado</div></div>`;
        };
        html += `<div class="hint" style="margin-top:8px"><b>Ejecutado vs presupuestado por proceso</b> · SP acreditados cuando la HU entra al siguiente proceso (Desarrollo cumple al pasar a QA · QA al pasar a Cliente)</div>
          <div class="grid kpis" style="margin:2px 0">
            ${pbox("#3b82f6", "💻", "Desarrollo", ejDev, dev)}
            ${pbox("#f59e0b", "🔍", "QA", ejQa, qa)}
            ${pbox("#8b5cf6", "Σ", "Total", totE, totP)}
          </div>`;
      }
      if (s.scope.agregadas || s.scope.retiradas) {
        html += `<div class="hint" style="margin:6px 0 0;padding:8px 12px;border-radius:8px;background:#f59e0b18;border:1px solid #f59e0b55;color:var(--fg)">
          ⚠️ <b>Cambio de alcance:</b> ${s.scope.agregadas} HU adicionada${s.scope.agregadas === 1 ? "" : "s"} · ${s.scope.retiradas} HU removida${s.scope.retiradas === 1 ? "" : "s"} respecto al comprometido (${s.scope.comprometido} → ${s.scope.actual} actual).</div>`;
      }
      pw.innerHTML = html;
    }
    c.setOption({
      tooltip: { trigger: "axis", ...ax.tooltip, valueFormatter: v => v == null ? "—" : v.toFixed(0) + "%" },
      legend: { data: ["Esperado (ideal)", "Ejecutado", "Proyección"], textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
      grid: { left: 8, right: 16, top: 30, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: dates, axisLabel: { color: ax.textColor, fontSize: 10 }, axisLine: { lineStyle: { color: ax.line } } },
      yAxis: { type: "value", max: 100, splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, formatter: "{value}%" } },
      series: [
        { name: "Esperado (ideal)", type: "line", color: "#a855f7", symbol: "none", lineStyle: { width: 2, type: "dashed" }, connectNulls: true, data: espData },
        { name: "Ejecutado", type: "line", color: "#10b981", smooth: true, symbol: "circle", symbolSize: 6, lineStyle: { width: 3 }, areaStyle: { opacity: .12 }, connectNulls: true, data: realData },
        { name: "Proyección", type: "line", color: "#38bdf8", symbol: "none", lineStyle: { width: 2, type: "dotted" }, connectNulls: true, data: projData },
      ],
    });
  };
  sel.onchange = apply; apply();
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
function mergeProy(cods, meta) {
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
  // objeto-proyecto completo (kpis/por_proceso/sin_proceso) para reusar también las gráficas generales
  const lastS = serie[serie.length - 1] || {};
  const por_proceso = {}; PROCS.forEach(pr => { por_proceso[pr.key] = lastS[pr.key] || 0; });
  const sum6 = PROCS.reduce((a, pr) => a + (por_proceso[pr.key] || 0), 0);
  const tot = lastS.total || 0, prod = lastS.prod || 0, dt = lastS.dias_hab || 0;
  const kpis = {
    hu_total: tot, hu_prod: prod, pct_prod: tot ? prod / tot : null, pct_avance: lastS.avance ?? null,
    hu_pendientes: tot - prod, removidas: lastS.removidas || 0, dias_transcurridos: dt,
    velocidad: dt ? prod / dt : 0, prod_actual: dt ? prod / dt : 0,
    dias_restantes: (meta && meta.dias_restantes) || {}, prod_esperada: null,
  };
  return {
    codigo: cods.join("+"), nombre: (meta && meta.nombre) || cods.join("+"),
    producto: meta && meta.producto, estado: meta && meta.estado,
    cierre: (meta && meta.cierre) || {}, fecha_inicio: null,
    serie, flujo, por_proceso, sin_proceso: Math.max(0, tot - sum6), kpis,
  };
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

/* ===== Vista consolidada 419 (Depósitos + Rama Judicial) — comparten planta 419 =====
   Réplica de lo hecho en Positiva: gráficas e info combinadas (DEP+RAMA) + tablas unificadas con
   filtro por enfoque + planta del equipo (419, compartida) como en los demás proyectos. */
let CONS419_PROY = "__all__";   // filtro de enfoque: __all__ (consolidado) | 419-DEP | 419-RAMA
function cons419SelProy(id) { if (id === CONS419_PROY) return; CONS419_PROY = id; disposeCharts(); paint419(); }
function render419() { paint419(); }
function paint419() {
  const dep = DATA.proyectos.find(x => x.codigo === "419-DEP"), rama = DATA.proyectos.find(x => x.codigo === "419-RAMA");
  if (!dep || !rama) { $("#content").innerHTML = `<div class="card">Faltan datos de 419-DEP / 419-RAMA.</div>`; return; }
  const meta = { nombre: "419 · Consolidado (Depósitos + Rama Judicial)", producto: dep.producto, estado: dep.estado, cierre: dep.cierre };
  const m = mergeProy(["419-DEP", "419-RAMA"], meta);   // objeto combinado (gráficas + KPIs)
  const k = m.kpis;
  const head = `<div class="project-title fade"><h2>${meta.nombre}</h2><span class="tag">DEP + RAMA</span>${meta.producto ? `<span class="tag">${meta.producto}</span>` : ""}<span class="tag">${fmt(k.hu_total)} HU</span></div>`;
  // KPIs combinados (419 está en etapa temprana: 0 en producción)
  const kHU = kpi("HU Totales", "▦", "#6366f1", `<span data-count="${k.hu_total}">0</span>`, `${fmt(k.hu_pendientes)} pendientes de producción`);
  const kRem = kpi("HU Removidas", "✕", "#94a3b8", `<span data-count="${k.removidas || 0}">0</span>`, "Removido/Cancelado · fuera del conteo");
  const kProd = kpi("En Producción", "✓", "#10b981", `<span data-count="${k.hu_prod}">0</span>`, `de ${fmt(k.hu_total)} HU`, k.pct_prod);
  const kAv = kpi("% Avance ponderado", "◔", "#a855f7", k.pct_avance == null ? "—" : `<span data-count="${k.pct_avance * 100}" data-dec="0" data-suf="%">0</span>`, "promedio por etapa", k.pct_avance);
  const _c10 = (cargaObj("419-DEP")?.alertas || []).concat(cargaObj("419-RAMA")?.alertas || []).filter(a => a.dias_sin_mov != null && a.dias_sin_mov > 10).length;
  const kEst = kpi("HU +10 días sin avanzar", "⚠", "#ef4444", `<span data-count="${_c10}">0</span>`, "mismo estado · más de 10 días");
  const wrapKpis = (cards) => `<div class="grid kpis">${cards.join("")}</div>`;
  // gráficas COMBINADAS (siempre DEP+RAMA)
  const cArea = `<div class="card fade"><h3>Avance por proceso en el tiempo</h3><div class="hint">HU en cada etapa por fecha de corte (apilado) · DEP + RAMA</div><div id="cArea" class="chart tall"></div></div>`;
  const cDonut = `<div class="card fade"><h3>Distribución actual</h3><div class="hint">HU por proceso al ${DATA.corte} · DEP + RAMA</div><div id="cDonut" class="chart tall"></div></div>`;
  const cFlujo = `<div class="card fade" style="margin-top:16px"><h3>Variación de HU por etapa en el tiempo</h3>
    <div class="hint">Por día y etapa: <b>entradas (+)</b> y <b>salidas (−)</b> · DEP + RAMA · filtra por rango y etapa</div>
    <div class="filterbar"><label>Desde <input type="date" id="flIni"></label><label>Hasta <input type="date" id="flFin"></label>
      <label>Etapa <select id="flProc"><option value="__all__">Todas las etapas</option>${PROCS.map(pr => `<option value="${pr.key}">${pr.label}</option>`).join("")}</select></label></div>
    <div id="cFlujo" class="chart tall"></div></div>`;
  // planta del equipo (419, compartida) — como en los demás proyectos
  const rec419 = RECURSOS && RECURSOS.proyectos ? RECURSOS.proyectos["419-DEP"] : null;
  const _pl0 = RECURSOS && RECURSOS.plantas && RECURSOS.plantas.length ? RECURSOS.plantas[0].fecha : null;
  const cPlanta = (rec419 && _pl0) ? `<div class="card fade" style="margin-top:16px"><h3>👥 Evolución de la planta · por día</h3>
    <div class="hint">Nº de personas activas por día desde el primer archivo de planta (${_pl0}) · planta 419 (compartida DEP y RAMA) · filtra el rango</div>
    <div class="filterbar"><label>Desde <input type="date" id="plIni"></label><label>Hasta <input type="date" id="plFin"></label></div>
    <div id="cPlanta" class="chart"></div></div>` : "";
  // tablas UNIFICADAS con filtro de enfoque
  let src, recCod, cos, cod, scopeLbl;
  if (CONS419_PROY === "419-DEP" || CONS419_PROY === "419-RAMA") {
    cod = CONS419_PROY; src = DATA.proyectos.find(x => x.codigo === cod); recCod = cod; cos = null;
    scopeLbl = src ? etiqueta(src) : cod;
  } else {
    cod = "419-DEP"; src = m; recCod = "419-DEP"; cos = costosCombinado(["419-DEP", "419-RAMA"]);
    scopeLbl = "419 Consolidado (DEP + RAMA)";
  }
  const chip = (id, l) => `<span class="rchip${CONS419_PROY === id ? " on" : ""}" onclick="cons419SelProy('${id}')">${l}</span>`;
  const filtro = `<div class="card fade" style="margin-top:16px">
    <div class="hint">Filtra las tablas por enfoque · por defecto, consolidado (DEP + RAMA)</div>
    <div class="rchips" style="margin:6px 0">${chip("__all__", "Consolidado (DEP + RAMA)")}${chip("419-DEP", etiqueta(dep))}${chip("419-RAMA", etiqueta(rama))}</div></div>`;
  const tablas = src ? (pivotCard(src, "419", scopeLbl) + costoHuCard(src, recCod, "419") +
    (cos ? costosCard(cod, "419", scopeLbl, cos) : costosCard(cod, "419", scopeLbl))) : "";

  const body = wrapKpis([kHU, kRem, kProd, kAv, kEst]) +
    `<div class="grid charts" style="margin-top:16px">${cArea}${cDonut}</div>` + cFlujo +
    recursosCard(rec419, "419 (planta compartida)", RECURSOS ? "Planta " + RECURSOS.planta_archivo : null) +
    cPlanta + cargaCardMulti(["419-DEP", "419-RAMA"], "419 · DEP + RAMA") +
    projPlantaSinHu("419-DEP") + filtro + tablas;

  $("#content").innerHTML = head + body;
  countUp();
  if ($("#cArea")) drawArea($("#cArea"), m);
  if ($("#cDonut")) drawDonut($("#cDonut"), m);
  if ($("#cFlujo")) drawFlujo($("#cFlujo"), m);
  if ($("#recFecha")) setupRecursos(rec419);
  if ($("#cPlanta")) setupPlantaEvol(rec419);
  if (src && $("#tblMode419")) setupPivot(src, "419");
  if (src && $("#chWrap419")) setupCostoHu(src, recCod, "419");
  if ($("#coIni419")) setupCostos(cod, "419", cos);
  animateBars();
}

/* ===== Vista Controles de Cambios (HU con Tags=CC) — réplica de la vista general sobre ese subconjunto ===== */
function renderCC(cod) {
  const cc = controlesObj(cod);
  if (!cc) { $("#content").innerHTML = `<div class="card">Sin datos de controles de cambio para ${cod}.</div>`; return; }
  const ck = cc.kpis, cc10 = (cc.alertas || []).filter(a => a.dias_sin_mov != null && a.dias_sin_mov > 10).length;
  const head = `<div class="project-title fade"><h2>🔧 ${cod} · Controles de Cambios</h2><span class="tag">Tags CC</span><span class="tag">${fmt(ck.hu_total)} HU CC</span></div>`;
  const K = [
    kpi("HU de control de cambio", "🔧", "#e11d48", `<span data-count="${ck.hu_total}">0</span>`, `${fmt(ck.hu_pendientes)} pendientes de producción`),
    kpi("En Producción", "✓", "#10b981", `<span data-count="${ck.hu_prod}">0</span>`, `de ${fmt(ck.hu_total)} HU CC`, ck.pct_prod),
    kpi("% Puesta en Producción", "◎", "#38bdf8", `<span data-count="${(ck.pct_prod || 0) * 100}" data-dec="1" data-suf="%">0</span>`, "en producción / totales", ck.pct_prod),
    kpi("% Avance ponderado", "◔", "#a855f7", ck.pct_avance == null ? "—" : `<span data-count="${ck.pct_avance * 100}" data-dec="0" data-suf="%">0</span>`, "promedio por etapa", ck.pct_avance),
    kpi("HU +10 días sin avanzar", "⚠", "#ef4444", `<span data-count="${cc10}">0</span>`, "mismo estado · más de 10 días"),
  ];
  const cArea = `<div class="card fade"><h3>Avance por proceso en el tiempo</h3><div class="hint">HU CC en cada etapa por fecha de corte (apilado)</div><div id="cArea" class="chart tall"></div></div>`;
  const cDonut = `<div class="card fade"><h3>Distribución actual</h3><div class="hint">HU CC por proceso al ${DATA.corte}</div><div id="cDonut" class="chart tall"></div></div>`;
  const cFlujo = `<div class="card fade" style="margin-top:16px"><h3>Variación de HU por etapa en el tiempo</h3>
    <div class="hint">entradas (+) / salidas (−) por día y etapa · HU CC · filtra rango y etapa</div>
    <div class="filterbar"><label>Desde <input type="date" id="flIni"></label><label>Hasta <input type="date" id="flFin"></label>
      <label>Etapa <select id="flProc"><option value="__all__">Todas las etapas</option>${PROCS.map(pr => `<option value="${pr.key}">${pr.label}</option>`).join("")}</select></label></div>
    <div id="cFlujo" class="chart tall"></div></div>`;
  const body = `<div class="grid kpis">${K.join("")}</div>` +
    `<div class="grid charts" style="margin-top:16px">${cArea}${cDonut}</div>` + cFlujo +
    pivotCard(cc, "", "Control de cambio") + costoHuCard(cc, cod, "") +
    cargaCard(cod, cc) + alertasCard(cod, cc);
  $("#content").innerHTML = head + body;
  countUp();
  if ($("#cArea")) drawArea($("#cArea"), cc);
  if ($("#cDonut")) drawDonut($("#cDonut"), cc);
  if ($("#cFlujo")) drawFlujo($("#cFlujo"), cc);
  if ($("#tblMode")) setupPivot(cc, "");
  if ($("#chWrap")) setupCostoHu(cc, cod, "");
  animateBars();
}

/* ===== ESPACIO DEDICADO A SPRINTS dentro de la pestaña OPERATIVO del proyecto =====
   Bloque propio (encabezado "🏃 Sprints") con 🏃 alcance vs entregado (+costo) y 📉 predictivo
   (esperado vs ejecutado + ejecutado vs presupuestado por proceso). CONDICIÓN: solo se activa para
   proyectos con el CALENDARIO de sprints cargado (data_sprint_burndown — el "archivo de Sprint" que
   llena el usuario). Hoy únicamente 421 (Balú); devuelve "" para el resto. */
function sprintSpace(cod) {
  const B = BURNDOWN && BURNDOWN.proyectos ? BURNDOWN.proyectos[cod] : null;
  if (!B || !(B.sprints || []).length) return "";
  const cRef = sprintRefCard(cod), cSprints = sprintsCard(cod), cBurndown = burndownCard(cod);
  if (!cRef && !cSprints && !cBurndown) return "";
  return `<div class="sprint-space" style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--card2,rgba(99,102,241,.05))">
      <h3 style="margin:0 0 4px;display:flex;align-items:center;gap:8px">🏃 Sprints<span class="tag" style="font-weight:500">${B.sprints.length} calendarizado${B.sprints.length === 1 ? "" : "s"}</span></h3>
      <div class="hint" style="margin:0 0 6px">Espacio dedicado al seguimiento de sprints: cumplimiento comprometido vs ejecutado, alcance vs entregado, costo del equipo y predictivo de avance.</div>
      ${cRef}${cSprints}${cBurndown}
    </div>`;
}

/* ===== CUMPLIMIENTO DE SPRINT vs REFERENCIA (comprometido FIJO vs ejecutado) =====
   Fuente: data_sprint_ref.json. Comprometido = foto fija del sprint (HU + presupuesto SP DEV/QA);
   Ejecutado = avance a hoy escalado por avance de HU (DEV≥6.1, QA≥8, destino por HU). Dos cuadros
   (cumplimiento HU y SP) + comparación presupuestado vs ejecutado por proceso + alcance (+/−). */
const SR_AREA_COL = { "REQ": "#64748b", "DEV": "#3b82f6", "QA": "#f59e0b", "QA-UAT": "#a855f7", "PROD": "#10b981" };
let SR_STATE = {};   // cod -> {idx sprint, view 'cierre'|'hoy'}
function sprintRefList(cod) {
  const R = SPRINT_REF && SPRINT_REF.proyectos ? SPRINT_REF.proyectos[cod] : null;
  return R && R.sprints ? R.sprints : [];
}
function sprintRefCard(cod) {
  const list = sprintRefList(cod); if (!list.length) return "";
  const opts = list.map((s, i) => `<option value="${i}">Sprint ${s.num}${s.cerrado ? " · cerrado" : " · en curso"}</option>`).join("");
  return `<div class="card fade" style="margin-top:16px">
    <h3>🎯 Tablero de sprint · comprometido vs ejecutado</h3>
    <div class="filterbar"><label>Sprint <select id="srSprint">${opts}</select></label><span id="srFin" class="hint" style="margin-left:10px"></span></div>
    <div id="srBoxes" class="grid kpis" style="margin:6px 0"></div>
    <div id="srScope"></div>
    <div style="margin:12px 0 4px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
      <div class="hint" style="margin:0"><b>Tablero</b> · HU comprometidas por estado</div>
      <div id="srBoardTgl"></div>
    </div>
    <div id="srBoard" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:6px;padding:6px 2px"></div>
    <div id="srLegend" class="hint" style="margin:4px 0 0"></div>
    <div id="srPost"></div>
    <div id="srChart" class="chart" style="height:230px;margin-top:14px"></div>
  </div>`;
}
function setupSprintRef(cod) {
  const list = sprintRefList(cod); if (!list.length) return;
  const sel = $("#srSprint"); if (!sel) return;
  if (!SR_STATE[cod]) SR_STATE[cod] = { idx: 0, view: "cierre" };
  const ch = mkChart($("#srChart")), ax = axisBase();
  const box = (bc, ic, lb, big, sub) => `<div class="card kpi fade"><div class="label"><span class="ic" style="background:${bc}20;color:${bc}">${ic}</span>${lb}</div><div class="val" style="color:${bc}">${big}</div><div class="foot">${sub}</div></div>`;
  const pcol = (p) => p >= 90 ? "#10b981" : p >= 60 ? "#0ea5e9" : "#f59e0b";

  function paint() {
    const st = SR_STATE[cod], s = list[st.idx]; if (!s) return;
    const c = s.comprometido, e = s.ejecutado, sc = s.scope;
    // encabezado fin/cierre
    $("#srFin").innerHTML = s.fin ? (s.cerrado
      ? `🔒 Cerrado ${s.fin} · resultado <b>congelado</b>`
      : `⏳ En curso · cierra ${s.fin} (el resultado se congela ese día)`) : "";
    // casillas: total comprometidas + comprometido HU/SP por DEV y QA + ejecutado HU y SP
    const totalHu = c.hu_ref != null ? c.hu_ref : c.hu;
    $("#srBoxes").innerHTML =
      box("#6366f1", "🎯", "HU comprometidas", `${totalHu}`, c.dup ? `${c.hu} únicas · ${c.dup} ID duplicado` : `en el Sprint ${s.num}`) +
      box("#3b82f6", "💻", "Comprometido DEV", `${c.hu_dev} HU`, `${fmt(c.sp_dev)} SP presupuestados`) +
      box("#a855f7", "🔍", "Comprometido QA", `${c.hu_qa} HU`, `${fmt(c.sp_qa)} SP presupuestados`) +
      box(pcol(e.pct_hu), "▦", "Ejecutado HU", `${e.pct_hu.toFixed(0)}%`, `${e.hu_cump} / ${c.hu} comprometidas${e.es_cierre ? " · al cierre" : ""}`) +
      box(pcol(e.pct_sp), "◈", "Ejecutado SP", `${e.pct_sp.toFixed(0)}%`, `${fmt(e.sp_total)} / ${fmt(c.sp_total)} SP`);
    // alcance
    $("#srScope").innerHTML = (sc.agregadas || sc.removidas)
      ? `<div class="hint" style="margin:6px 0 0;padding:8px 12px;border-radius:8px;background:#f59e0b18;border:1px solid #f59e0b55;color:var(--fg)">
          🔀 <b>Cambios de alcance:</b> +${sc.agregadas} adicionada${sc.agregadas === 1 ? "" : "s"} · −${sc.removidas} removida${sc.removidas === 1 ? "" : "s"} · atadas hoy ${sc.actual_hu} HU (comprometidas ${c.hu}).</div>` : "";
    // toggle cierre/hoy (solo si el sprint ya cerró)
    $("#srBoardTgl").innerHTML = s.cerrado
      ? `<div class="segmented" style="display:inline-flex;gap:4px">
          <button class="chip2 srtgl" data-v="cierre" style="cursor:pointer;${st.view === "cierre" ? "outline:2px solid #6366f1" : ""}">Cierre ${s.fin}</button>
          <button class="chip2 srtgl" data-v="hoy" style="cursor:pointer;${st.view === "hoy" ? "outline:2px solid #6366f1" : ""}">Hoy</button></div>` : "";
    // tablero por estados
    const dist = (s.cerrado && st.view === "cierre" && s.cierre) ? s.cierre.dist : s.tablero_actual;
    const maxN = Math.max(1, ...s.estados.map(col => dist[col.estado] || 0));
    $("#srBoard").innerHTML = s.estados.map(col => {
      const n = dist[col.estado] || 0, ac = SR_AREA_COL[col.area] || "#64748b";
      return `<div style="text-align:center;border-radius:10px;border:1px solid var(--border);border-top:3px solid ${ac};background:${ac}0e;padding:7px 4px">
        <div style="font-size:9.5px;line-height:1.15;color:var(--muted);min-height:30px;display:flex;align-items:center;justify-content:center">${col.estado}</div>
        <div style="font-size:22px;font-weight:800;color:${n ? ac : "var(--muted)"}">${n}</div>
        <div class="bar-mini" style="margin-top:4px"><i style="width:${Math.round(n / maxN * 100)}%;background:${ac}"></i></div>
      </div>`;
    }).join("");
    $("#srLegend").innerHTML = ["DEV", "QA", "QA-UAT", "PROD"].map(a =>
      `<span style="margin-right:12px"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${SR_AREA_COL[a]};margin-right:4px"></span>${a} (avance ${a === "DEV" ? "≥6.1" : a === "QA" ? "≥7" : a === "QA-UAT" ? "≥8" : "≥9"})</span>`).join("");
    // avance posterior (solo si cerró)
    $("#srPost").innerHTML = (s.cerrado && s.posterior)
      ? `<div class="hint" style="margin:8px 0 0;padding:8px 12px;border-radius:8px;background:#10b98115;border:1px solid #10b98150;color:var(--fg)">
          📈 <b>Avance posterior al cierre</b> (corte ${s.posterior.corte}): de las <b>${s.posterior.pendientes_al_cierre}</b> HU que quedaron pendientes al cierre, <b>${s.posterior.completadas_despues}</b> ya alcanzaron su destino después — sin mover el resultado del cierre.</div>` : "";
    // barras presupuestado vs ejecutado
    ch.setOption({
      tooltip: { trigger: "axis", ...ax.tooltip, axisPointer: { type: "shadow" }, valueFormatter: v => v == null ? "—" : fmt(v) + " SP" },
      legend: { data: ["Presupuestado", "Ejecutado"], textStyle: { color: ax.textColor, fontSize: 11 }, top: 0, icon: "roundRect" },
      grid: { left: 8, right: 16, top: 30, bottom: 6, containLabel: true },
      xAxis: { type: "category", data: ["Desarrollo", "QA", "Total"], axisLabel: { color: ax.textColor }, axisLine: { lineStyle: { color: ax.line } } },
      yAxis: { type: "value", splitLine: { lineStyle: { color: ax.line } }, axisLabel: { color: ax.textColor, formatter: "{value} SP" } },
      series: [
        { name: "Presupuestado", type: "bar", color: "#8b5cf6", barGap: "10%", data: [c.sp_dev, c.sp_qa, c.sp_total],
          label: { show: true, position: "top", color: ax.textColor, fontSize: 10, formatter: p => fmt(p.value) } },
        { name: "Ejecutado", type: "bar", color: "#10b981", data: [e.sp_dev, e.sp_qa, e.sp_total],
          label: { show: true, position: "top", color: ax.textColor, fontSize: 10,
            formatter: p => { const b = [c.sp_dev, c.sp_qa, c.sp_total][p.dataIndex]; return fmt(p.value) + (b ? ` (${Math.round(p.value / b * 100)}%)` : ""); } } },
      ],
    });
    // wiring del toggle
    document.querySelectorAll(".srtgl").forEach(b => b.onclick = () => { SR_STATE[cod].view = b.dataset.v; paint(); });
  }
  sel.onchange = () => { SR_STATE[cod].idx = +sel.value; paint(); };
  paint();
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
/* Scorecard RAG del portafolio (resumen ejecutivo): semáforo por proyecto = max(cierre, costo, riesgo) */
function scorecardRAGCard(allp) {
  const sem = (s) => s >= 3 ? "🔴" : s >= 2 ? "🟡" : "🟢";
  const rows = allp.map(p => {
    const k = p.kpis, proy = proyeccionCierre(p);
    const C = COSTOS && COSTOS.proyectos ? COSTOS.proyectos[p.codigo] : null;
    const sobre = C && C.total ? C.total.variacion : 0;
    const costoSev = sobre < -50e6 ? 3 : sobre < -5e6 ? 2 : 1;
    const c10 = (cargaObj(p.codigo)?.alertas || []).filter(a => a.dias_sin_mov != null && a.dias_sin_mov > 10).length;
    const riesgoSev = c10 > 20 ? 3 : c10 > 5 ? 2 : 1;
    return { p, k, proy, sobre, costoSev, c10, riesgoSev, overall: Math.max(proy.sev || 1, costoSev, riesgoSev) };
  }).sort((a, b) => b.overall - a.overall);
  const tr = rows.map(r => `<tr>
    <td style="font-size:15px">${sem(r.overall)}</td>
    <td><a href="#" onclick="render('${r.p.codigo}');return false" style="color:var(--text);font-weight:700">${r.p.codigo}</a> <span class="muted">${esc(r.p.nombre)}</span></td>
    <td>${sem(r.proy.sev)} <span class="muted">${r.proy.estado}</span></td>
    <td class="num">${r.k.pct_avance == null ? "—" : Math.round(r.k.pct_avance * 100) + "%"}</td>
    <td class="num">${fmt(r.k.hu_pendientes)}</td>
    <td class="num" style="color:${r.sobre < 0 ? "#ef4444" : "var(--muted)"}">${r.sobre ? fmtMoney(r.sobre) : "—"}</td>
    <td class="num">${sem(r.riesgoSev)} ${r.c10}</td>
  </tr>`).join("");
  return `<div class="card fade" style="margin-top:16px">
    <h3>🚦 Scorecard del portafolio · resumen ejecutivo</h3>
    <div class="hint">Semáforo por proyecto = peor de: cumplimiento de cierre (proyección a ritmo actual), sobrecosto de planta, riesgo de estancamiento (HU +10 días) · ordenado por mayor riesgo · <b>clic en el código</b> para el detalle</div>
    <div class="dwrap"><table class="dtbl"><thead><tr>
      <th>Estado</th><th>Proyecto</th><th>Cierre (proyección)</th><th class="num">% Avance</th><th class="num">HU pend.</th><th class="num">Sobrecosto</th><th class="num">HU +10d</th>
    </tr></thead><tbody>${tr}</tbody></table></div></div>`;
}

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
  $("#content").innerHTML = head + kpis + scorecardRAGCard(allp) + recursos + plantaPort + charts;
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
