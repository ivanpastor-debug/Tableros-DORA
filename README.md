# Tablero web · Tableros DORA

Dashboard web moderno (estático) que reemplaza la capa de visualización de Power BI.
Lee `data.json` (generado desde los snapshots) y lo pinta con ECharts.

## Archivos
- `index.html` — estructura + estilos (tema claro/oscuro).
- `app.js` — lógica: KPIs animados, charts, selector de proyecto, vista de portafolio.
- `data.json` — **generado**, no se edita a mano (`python scripts/build_dashboard_data.py`).

Es un sitio **100% estático**: no necesita servidor de aplicaciones. Solo requiere internet
en el navegador para cargar ECharts desde CDN.

## Previsualizar en local
```bash
python -m http.server 8000 --directory web
# abrir http://localhost:8000
```

## Actualización diaria
1. Suelta los snapshots del día en `datos/snapshots/<codigo>/` (`HU_<cod>_AAAAMMDD.csv|xlsx`).
2. Ejecuta `python scripts/actualizar.py` (o doble clic en `ACTUALIZAR.bat`).
   - Reconstruye `data.json` y, si hay remoto git + Vercel, publica el link actualizado.

## Publicar en Vercel (una sola vez)
1. Subir el repo a GitHub.
2. En vercel.com → *Add New Project* → importar el repo.
3. **Root Directory = `web`**, Framework Preset = *Other* (sitio estático, sin build).
4. Deploy → queda un link tipo `https://tableros-dora.vercel.app`.
5. Desde entonces, cada `git push` (lo hace `actualizar.py`) redepliega solo.

## Qué muestra
- **Portafolio**: KPIs agregados + comparativa de % producción/avance y volumen por proyecto.
- **Por proyecto**: HU totales/producción/%, % avance, velocidad, días a cierre QA;
  avance por proceso en el tiempo, distribución actual, tendencia de producción y gauge
  de productividad (ritmo actual vs. requerido).

## Datos
`data.json` contiene solo **conteos y métricas agregadas** (sin títulos de HU ni nombres
de personas) → seguro para publicar.

## Pendiente (próxima iteración)
- Burndown **Planeada/Real/Atrasada** y **Días adicionales** por proceso (HU planeadas se
  calculan dinámicamente: HU asignadas a las etapas del área ÷ días hábiles al cierre).
- Vista por **persona** y **costos por rol** cuando llegue la data diaria de recursos.
- Discriminado por **motivo de bloqueo** (Tags).
