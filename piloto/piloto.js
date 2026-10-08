/* Piloto automático de Piso de Remates.
   Corre en GitHub Actions tres veces cada día hábil:
     apertura (9:10 CDMX)  ejecuta las órdenes pendientes con los precios de la apertura
     mediodía (12:10)      actualiza el valor de la cartera
     cierre   (15:40)      jornada de minería, comité, órdenes para mañana y resumen del día
   Todo es dinero ficticio. El estado queda en sitio/datos/estado.json. */
const fs = require("fs");
const path = require("path");
const Motor = require("./motor.js");
const Personal = require("./personal.js");

const RAIZ = path.join(__dirname, "..");
const RUTA_ESTADO = process.env.PILOTO_ESTADO || path.join(RAIZ, "sitio", "datos", "estado.json");
const RUTA_PRECIOS = process.env.PILOTO_PRECIOS || path.join(RAIZ, "sitio", "datos", "precios.json");
const AHORA = process.env.PILOTO_AHORA ? new Date(process.env.PILOTO_AHORA) : new Date();

const REGLAS = {
  jornada: 160,            // expedientes que se revisan cada cierre
  maxActivas: 8,           // estrategias operando al mismo tiempo
  maxPorEmisora: 2,
  nuevasPorDia: 2,         // el comité no mete más de dos estrategias nuevas por día
  capital: { MXN: 100000, USD: 5000 },
  retiroCaida: -0.12,      // se retira si pierde 12% desde que entró
  diasPrueba: 30,          // después de 30 cierres…
  retiroPrueba: -0.04,     // …se retira si va perdiendo más de 4%
  reintentoDias: 45,       // una combinación ya revisada se vuelve a probar después de 45 días
  bibliotecaMax: 60
};

/* ---------- reloj de la Ciudad de México (UTC-6) ---------- */
function mx(d) { const x = new Date(d.getTime() - 6 * 3600e3); return { h: x.getUTCHours() + x.getUTCMinutes() / 60, dia: x.getUTCDay(), fecha: x.toISOString().slice(0, 10) }; }
const T = mx(AHORA);
const TIPO = process.env.PILOTO_TIPO || (T.h < 11.5 ? "apertura" : T.h < 15.4 ? "mediodia" : "cierre");
const horaTxt = h => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
const sello = h => { const d = new Date(Date.UTC(+T.fecha.slice(0, 4), +T.fecha.slice(5, 7) - 1, +T.fecha.slice(8, 10)) + (h + 6) * 3600e3); return d.toISOString(); };
const R = Personal.rng(Personal.semillaDe(T.fecha + TIPO));
const pct = x => (x > 0 ? "+" : "") + (x * 100).toFixed(1) + "%";
const fmt = x => x.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dinero = (x, mon) => "$" + Math.round(x).toLocaleString("es-MX") + " " + mon;

/* ---------- estado ---------- */
function estadoNuevo() {
  return { version: 1, creado: AHORA.toISOString(), ultimaCorrida: null, corridas: [], evaluadas: {}, jornadas: [], biblioteca: [], cartera: [], historial: [], bitacora: [], social: [], agentes: Personal.estadoInicial(), totales: { expedientes: 0, aprobadas: 0, operaciones: 0 } };
}
const E = fs.existsSync(RUTA_ESTADO) ? JSON.parse(fs.readFileSync(RUTA_ESTADO, "utf8")) : estadoNuevo();
if (Array.isArray(E.evaluadas) || typeof E.evaluadas !== "object") E.evaluadas = {};
for (const p of Personal.LISTA) if (!E.agentes[p.id]) E.agentes[p.id] = Personal.estadoInicial()[p.id];

const PRECIOS = JSON.parse(fs.readFileSync(RUTA_PRECIOS, "utf8"));
const SERIES = new Map(PRECIOS.series.map(s => [s.modo + ":" + s.id, { ...s, key: s.modo + ":" + s.id, o: Float64Array.from(s.o), c: Float64Array.from(s.c) }]));
const MERCADOS = PRECIOS.mercados;

const PERSONAL = Personal.POR_ID;
const STAFF = {}; for (const p of Personal.LISTA) (STAFF[p.depto] ??= []).push(p);
const uno = depto => STAFF[depto][Math.floor(R() * STAFF[depto].length)];
const sentir = (id, d) => Personal.sentir(E.agentes[id], PERSONAL[id], d);
function log(quien, txt, tipo = "trabajo", h = T.h) {
  E.bitacora.unshift({ t: sello(h), quien, txt, tipo });
  E.bitacora.length = Math.min(E.bitacora.length, 500);
}

/* ---------- precios ---------- */
function serieConVivo(S) {
  const q = S.cot, n = S.c.length, f = S.fechas[n - 1];
  if (q.fecha === f) { const c = Float64Array.from(S.c); c[n - 1] = q.precio; return { id: S.id, fechas: S.fechas, c, o: S.o }; }
  if (q.fecha > f) return { id: S.id, fechas: [...S.fechas, q.fecha], c: Float64Array.from([...S.c, q.precio]), o: Float64Array.from([...S.o, q.apertura || q.precio]) };
  return { id: S.id, fechas: S.fechas, c: S.c, o: S.o };
}
const senal = (it, S2) => Motor.FAMILIAS[it.fam].señal(S2, it.p);
const operadorDeTurno = () => uno("trd");

/* ---------- operaciones en papel ---------- */
const K = Motor.costoLado();
function comprar(it, precio, h) {
  const n = Math.floor(it.efectivo / (precio * (1 + K))); if (n < 1) return;
  it.efectivo -= n * precio * (1 + K); it.titulos = n; it.entrada = precio;
  it.ops.unshift({ tipo: "compra", precio, titulos: n, fecha: T.fecha }); it.ops.length = Math.min(it.ops.length, 40);
  const op = operadorDeTurno(); E.totales.operaciones++;
  log(op.id, `${op.corto} compró ${n.toLocaleString("es-MX")} ${it.emisora} a ${fmt(precio)} ${it.moneda} siguiendo ${it.etiqueta}.`, "operacion", h);
  sentir(op.id, { estres: 1 });
}
function vender(it, precio, h, motivo = "") {
  const n = it.titulos; if (!n) return 0;
  const res = (precio * (1 - K)) / (it.entrada * (1 + K)) - 1;
  it.efectivo += n * precio * (1 - K); it.titulos = 0;
  it.ops.unshift({ tipo: "venta", precio, titulos: n, resultado: res, fecha: T.fecha }); it.ops.length = Math.min(it.ops.length, 40);
  const op = operadorDeTurno(); E.totales.operaciones++;
  log(op.id, `${op.corto} vendió ${n.toLocaleString("es-MX")} ${it.emisora} a ${fmt(precio)} ${it.moneda} (${pct(res)} en la operación)${motivo}.`, "operacion", h);
  if (res > 0) { sentir(op.id, { animo: 4, confianza: 3 }); sentir("elena", { animo: 1 }); }
  else { sentir(op.id, { animo: -3, estres: 3 }); sentir("chema", { estres: 1 }); }
  return res;
}
function marcar(it) { const S = SERIES.get(it.serie); if (!S) return; it.precio = S.cot.precio; it.valor = it.efectivo + it.titulos * S.cot.precio; it.fechaPrecio = S.cot.fecha; }

/* ---------- vida social ---------- */
function moverMercado() {
  let mejor = null;
  for (const S of SERIES.values()) { const ch = S.cot.precio / S.cot.cierreAnt - 1; if (!mejor || Math.abs(ch) > Math.abs(mejor.cambio)) mejor = { emisora: S.id, cambio: ch }; }
  return mejor;
}
function platicas(n, lugar, h, felicitar = new Set()) {
  const ctx = { h, dia: T.dia, lugar, mercado: moverMercado(), felicitar, horasExtra: false };
  const gente = Personal.LISTA.filter(p => !p.guardia || lugar === "noche");
  for (let i = 0; i < n; i++) {
    const pesos = gente.map(p => p.rasgos.sociable + 0.1); let x = R() * pesos.reduce((s, w) => s + w, 0), a = gente[0];
    for (let j = 0; j < gente.length; j++) { x -= pesos[j]; if (x <= 0) { a = gente[j]; break; } }
    let opciones = lugar === "casa" ? gente.filter(p => p.hogar === a.hogar && p.id !== a.id)
      : lugar === "oficina" && R() < 0.55 ? gente.filter(p => p.depto === a.depto && p.id !== a.id) : gente.filter(p => p.id !== a.id);
    if (!opciones.length) opciones = gente.filter(p => p.id !== a.id);
    const b = opciones[Math.floor(R() * opciones.length)];
    const res = Personal.conversar(a, b, E.agentes[a.id], E.agentes[b.id], ctx, R);
    Personal.aplicarPlatica(E.agentes, a, b, res);
    const hh = h + R() * 0.8;
    E.social.unshift({ t: sello(hh), hora: horaTxt(hh), a: a.id, b: b.id, lugar, tema: res.tema, calidad: +res.calidad.toFixed(2), lineas: res.lineas, resumen: Personal.resumen(a, b, res) });
    if (Math.abs(res.calidad) > 0.55) log(a.id, Personal.resumen(a, b, res), "social", hh);
  }
  E.social.length = Math.min(E.social.length, 300);
}

/* ---------- jornada de minería ---------- */
function jornada() {
  const series = [...SERIES.values()];
  // E.evaluadas[serie] = arreglo con el día (número) en que se revisó cada combinación; 0 = nunca
  const hoyN = Math.floor(AHORA.getTime() / 864e5), CANDS = Motor.todasLasCandidatas();
  const pool = [];
  for (const S of series) {
    const arr = (E.evaluadas[S.key] ||= []);
    CANDS.forEach((c, i) => { if (!arr[i] || hoyN - arr[i] > REGLAS.reintentoDias) pool.push({ S, c, i, k: S.key + "|" + c.fam + JSON.stringify(c.p) }); });
  }
  const elegidas = Motor.barajar(pool, Personal.semillaDe(T.fecha)).slice(0, REGLAS.jornada);
  const motivos = {}, aprobadas = [], felicitar = new Set();
  const vivas = new Map(series.map(S => [S.key, { ...serieConVivo(S), id: S.id }]));
  for (const { S, c, i: ci, k } of elegidas) {
    const exp = Motor.evaluar(vivas.get(S.key), c);
    E.evaluadas[S.key][ci] = hoyN;
    if (exp.estado !== "aprobada") { motivos[exp.motivo] = (motivos[exp.motivo] || 0) + 1; continue; }
    const minero = uno("min");
    const ficha = {
      key: k, serie: S.key, fam: c.fam, p: c.p, etiqueta: exp.etiqueta, familia: exp.familia, emisora: S.id, moneda: S.moneda,
      puntaje: +exp.puntaje.toFixed(3), sIS: +exp.is.sharpe.toFixed(2), sOOS: +exp.oos.sharpe.toFixed(2), rOOS: +exp.oos.total.toFixed(4),
      bhOOS: +exp.bhOOS.total.toFixed(4), dd: +exp.oos.dd.toFixed(4), robustez: +exp.robustez.toFixed(2), fecha: T.fecha, minero: minero.id
    };
    const i = E.biblioteca.findIndex(b => b.key === k);
    if (i >= 0) E.biblioteca[i] = ficha; else E.biblioteca.push(ficha);
    aprobadas.push(ficha); felicitar.add(minero.id);
    sentir(minero.id, { confianza: 4, animo: 3 });
    for (const d of ["ana", "rie", "me1", "me2"]) STAFF[d].forEach(p => sentir(p.id, { confianza: 1 }));
    sentir("elena", { animo: 1 });
    log("elena", `Lic. Cervantes aprobó ${ficha.etiqueta} en ${ficha.emisora}, minada por ${PERSONAL[minero.id].corto}. Sharpe en datos nuevos: ${ficha.sOOS}.`, "comite", 15.2);
  }
  if (!aprobadas.length) STAFF.min.forEach(p => sentir(p.id, { animo: -3, estres: 2 }));
  for (const k in E.evaluadas) E.evaluadas[k] = Array.from({ length: CANDS.length }, (_, i) => E.evaluadas[k][i] || 0);
  E.biblioteca.sort((a, b) => b.puntaje - a.puntaje);
  const enCartera = new Set(E.cartera.filter(i => i.estado === "activa").map(i => i.key));
  E.biblioteca = E.biblioteca.filter((b, i) => i < REGLAS.bibliotecaMax || enCartera.has(b.key));
  E.jornadas.unshift({ fecha: T.fecha, candidatas: elegidas.map(({ S, c }) => [S.key, c.fam, c.p]), revisadas: elegidas.length, aprobadas: aprobadas.map(a => a.key), motivos });
  E.jornadas.length = Math.min(E.jornadas.length, 2);
  E.totales.expedientes += elegidas.length; E.totales.aprobadas += aprobadas.length;
  log("lupita", `Jornada del día: ${elegidas.length} expedientes revisados, ${aprobadas.length} ${aprobadas.length === 1 ? "aprobado" : "aprobados"}.`, "trabajo", 15.1);
  return felicitar;
}

/* ---------- comité: retira y asigna ---------- */
function comite() {
  for (const it of E.cartera.filter(i => i.estado === "activa")) {
    const S = SERIES.get(it.serie); if (!S) continue;
    marcar(it); it.dias = (it.dias || 0) + 1;
    const r = it.valor / it.capital - 1;
    let motivo = null;
    if (r <= REGLAS.retiroCaida) motivo = `perdió ${pct(r)} desde que entró`;
    else if (it.dias >= REGLAS.diasPrueba && r <= REGLAS.retiroPrueba) motivo = `después de ${it.dias} días va ${pct(r)}`;
    if (!motivo) continue;
    vender(it, S.cot.precio, 15.3, ", por retiro");
    marcar(it);
    it.estado = "retirada"; it.retiro = { fecha: T.fecha, motivo, resultado: +(it.valor / it.capital - 1).toFixed(4) };
    log("elena", `El comité retiró ${it.etiqueta} en ${it.emisora}: ${motivo}.`, "comite", 15.3);
    sentir("elena", { estres: 4, animo: -2 }); if (it.minero) sentir(it.minero, { confianza: -4, animo: -3 });
  }
  const activas = E.cartera.filter(i => i.estado === "activa");
  const recientes = new Set(E.cartera.filter(i => i.estado === "activa" || (i.retiro && i.retiro.fecha > new Date(AHORA.getTime() - 30 * 864e5).toISOString().slice(0, 10))).map(i => i.key));
  let libres = Math.min(REGLAS.maxActivas - activas.length, REGLAS.nuevasPorDia);
  for (const b of E.biblioteca) {
    if (libres <= 0) break;
    if (recientes.has(b.key) || !SERIES.has(b.serie)) continue;
    if (activas.filter(i => i.emisora === b.emisora).length >= REGLAS.maxPorEmisora) continue;
    const cap = REGLAS.capital[b.moneda] || 100000;
    const it = { key: b.key, serie: b.serie, fam: b.fam, p: b.p, etiqueta: b.etiqueta, emisora: b.emisora, moneda: b.moneda, minero: b.minero, capital: cap, efectivo: cap, titulos: 0, entrada: 0, ops: [], alta: T.fecha, dias: 0, estado: "activa" };
    E.cartera.push(it); activas.push(it); libres--;
    log("elena", `El comité mandó ${b.etiqueta} en ${b.emisora} a operar en papel con ${dinero(cap, b.moneda)}.`, "comite", 15.4);
    sentir(b.minero, { animo: 5, confianza: 3 });
  }
}

/* ---------- corridas ---------- */
function apertura() {
  let ops = 0, abiertos = 0;
  for (const it of E.cartera.filter(i => i.estado === "activa")) {
    const S = SERIES.get(it.serie); if (!S) continue;
    const m = MERCADOS[S.modo]; if (!m || S.cot.fecha !== m.hoy) { marcar(it); continue; }
    abiertos++;
    const S2 = serieConVivo(S), pos = senal(it, S2), L = pos.length;
    const quiere = S2.fechas[L - 1] === m.hoy ? pos[L - 2] : pos[L - 1];
    if (quiere && !it.titulos) { comprar(it, S.cot.precio, 9.1); ops++; }
    else if (!quiere && it.titulos) { vender(it, S.cot.precio, 9.1); ops++; }
    it.pendiente = null; marcar(it);
  }
  const hayBolsa = Object.values(MERCADOS).some(m => [...SERIES.values()].some(S => S.cot.fecha === m.hoy));
  if (!hayBolsa) log("lucha", "Hoy no abrió la bolsa; la oficina trabaja tranquila.", "trabajo", 9.1);
  else if (!ops) log("renata", "Apertura sin operaciones: las estrategias siguen como ayer.", "operacion", 9.1);
  platicas(3, "oficina", 9);
  return `Apertura: ${ops} ${ops === 1 ? "operación" : "operaciones"}`;
}
function mediodia() {
  E.cartera.filter(i => i.estado === "activa").forEach(marcar);
  platicas(4, "cafeteria", 14);
  return "Revisión de mediodía";
}
function cierre() {
  E.cartera.filter(i => i.estado === "activa").forEach(marcar);
  const felicitar = jornada();
  comite();
  let compras = 0, ventas = 0;
  for (const it of E.cartera.filter(i => i.estado === "activa")) {
    const S = SERIES.get(it.serie); if (!S) continue;
    const pos = senal(it, serieConVivo(S)), quiere = pos[pos.length - 1];
    it.pendiente = quiere && !it.titulos ? "compra" : !quiere && it.titulos ? "venta" : null;
    if (it.pendiente === "compra") compras++; if (it.pendiente === "venta") ventas++;
    marcar(it);
  }
  if (compras + ventas) log("renata", `Órdenes para mañana en la apertura: ${compras} de compra y ${ventas} de venta.`, "operacion", 15.5);
  // valor del fondo: todo lo que se ha puesto a operar, activo o retirado
  const fondo = {};
  for (const it of E.cartera) { const f = (fondo[it.moneda] ??= { cap: 0, val: 0 }); f.cap += it.capital; f.val += it.valor ?? it.capital; }
  const previo = E.historial.at(-1);
  if (previo && previo.fecha === T.fecha) E.historial.pop();
  E.historial.push({ fecha: T.fecha, ...Object.fromEntries(Object.entries(fondo).map(([m, f]) => [m, { cap: Math.round(f.cap), val: Math.round(f.val) }])) });
  E.historial.length = Math.min(E.historial.length, 520);
  if (previo) {
    for (const m of Object.keys(fondo)) {
      if (!previo[m] || !previo[m].val) continue;
      const dia = (fondo[m].val - previo[m].cap * 0) / previo[m].val - 1 - (fondo[m].cap - previo[m].cap) / previo[m].val;
      const d = Math.max(-6, Math.min(6, dia * 300));
      for (const id of ["renata", "hugo", "elena", "robles", "paredes"]) sentir(id, { animo: d, estres: d < 0 ? -d * 0.6 : 0 });
    }
  }
  // un día de trabajo cansa, sobre todo a los nerviosos
  for (const p of Personal.LISTA) if (!p.guardia) sentir(p.id, { estres: 3 });
  platicas(8, "oficina", 11, felicitar);
  platicas(5, "casa", 20.5, felicitar);
  if (R() < 0.6) platicas(1, "noche", 22.5);
  for (const p of Personal.LISTA) {
    const e = E.agentes[p.id];
    e.diario.push({ fecha: T.fecha, animo: Math.round(e.animo), estres: Math.round(e.estres), confianza: Math.round(e.confianza) });
    e.diario = e.diario.slice(-60);
  }
  const act = E.cartera.filter(i => i.estado === "activa").length;
  return `Cierre: ${E.jornadas[0].revisadas} expedientes, ${E.jornadas[0].aprobadas.length} aprobados, ${act} estrategias operando`;
}

/* descanso: entre corridas cada quien se recupera; en la noche y el fin de semana más */
const previa = E.ultimaCorrida ? new Date(E.ultimaCorrida.t) : null;
const horas = previa ? Math.max(0, (AHORA - previa) / 36e5) : 0;
if (horas > 0) for (const p of Personal.LISTA) {
  Personal.volverABase(E.agentes[p.id], p, horas, horas > 10 ? 0.05 : 0.02);
  if (horas > 40) sentir(p.id, { animo: 4, estres: -6 }); // regresan del fin de semana
}

const resumen = TIPO === "apertura" ? apertura() : TIPO === "mediodia" ? mediodia() : cierre();
for (const id in E.agentes) for (const c of ["animo", "estres", "confianza"]) E.agentes[id][c] = Math.round(E.agentes[id][c] * 10) / 10;
E.ultimaCorrida = { t: AHORA.toISOString(), tipo: TIPO, resumen, fecha: T.fecha, hora: horaTxt(T.h) };
E.corridas.unshift(E.ultimaCorrida); E.corridas.length = Math.min(E.corridas.length, 90);
fs.mkdirSync(path.dirname(RUTA_ESTADO), { recursive: true });
fs.writeFileSync(RUTA_ESTADO, JSON.stringify(E));
console.log(`[${T.fecha} ${horaTxt(T.h)}] ${resumen}`);
