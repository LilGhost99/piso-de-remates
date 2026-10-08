/* Piloto automático de Piso de Remates.
   Corre en GitHub Actions tres veces cada día hábil:
     apertura (9:10 CDMX)  ejecuta las órdenes pendientes con los precios de la apertura
     mediodía (12:10)      actualiza el valor de la cartera y Riesgos retira lo que rebasó el límite
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
  bibliotecaMax: 60,
  revalidarDias: 7,        // Memo vuelve a probar cada estrategia de la biblioteca cada 7 días…
  revalidarPorDia: 15,     // …hasta 15 por cierre
  // votos del comité (se necesitan 2 de 3)
  votoElena: 0.5,          // Sharpe en datos nuevos de 0.5 o más
  votoRobles: 0.7,         // 70% o más de variantes cercanas que funcionan
  votoParedes: -0.15,      // caída en datos nuevos no peor que 15%
  alertaRiesgo: -0.08,     // Don Chema avisa cuando una estrategia pierde 8%
  movimientoFuerte: 0.03,  // Valeria avisa de movimientos de 3% o más en el día
  brinco: 0.02             // Don Ramón avisa de brincos de 2% entre el cierre y la apertura
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
for (const p of Personal.LISTA) {
  if (!E.agentes[p.id]) E.agentes[p.id] = Personal.estadoInicial()[p.id];
  Personal.asegurar(E.agentes[p.id]); Personal.evolucionar(p, E.agentes[p.id]);
}
// lo que produce cada departamento (la página lo muestra en «El trabajo real de cada quien»)
E.trabajo ||= {}; E.noticias ||= []; E.comite ||= []; E.resumenes ||= []; E.archivo ||= { porFamilia: {} };

const PRECIOS = JSON.parse(fs.readFileSync(RUTA_PRECIOS, "utf8"));
const SERIES = new Map(PRECIOS.series.map(s => [s.modo + ":" + s.id, { ...s, key: s.modo + ":" + s.id, o: Float64Array.from(s.o), c: Float64Array.from(s.c) }]));
const MERCADOS = PRECIOS.mercados;
const TC = PRECIOS.tipoCambio && PRECIOS.tipoCambio.usdmxn;
const aPesos = (mon, x) => (mon === "USD" ? (TC ? x * TC : null) : x);

const PERSONAL = Personal.POR_ID;
const STAFF = {}; for (const p of Personal.LISTA) (STAFF[p.depto] ??= []).push(p);
const uno = depto => STAFF[depto][Math.floor(R() * STAFF[depto].length)];
const sentir = (id, d) => Personal.sentir(E.agentes[id], PERSONAL[id], d);
function log(quien, txt, tipo = "trabajo", h = T.h) {
  E.bitacora.unshift({ t: sello(h), quien, txt, tipo });
  E.bitacora.length = Math.min(E.bitacora.length, 500);
}
/* experiencia: anota en la bitácora cada subida de nivel y cada logro nuevo */
function xp(id, n, cuenta = {}, h = T.h) {
  for (const ev of Personal.ganar(E.agentes[id], PERSONAL[id], n, cuenta, T.fecha)) log(id, Personal.textoEvento(ev, PERSONAL[id]), "carrera", h);
}
const derivar = (id, rasgo, d) => { Personal.derivar(E.agentes[id], rasgo, d); Personal.evolucionar(PERSONAL[id], E.agentes[id]); };
/* lo último que hizo cada quien, en sus palabras (la sala lo muestra en su ficha y en 3D) */
const trabajo = (id, txt, datos) => { E.trabajo[id] = { t: sello(T.h), fecha: T.fecha, txt, ...(datos ? { datos } : {}) }; };
const fechaDM = f => `${+f.slice(8, 10)}/${+f.slice(5, 7)}`;
const pesosTxt = x => (x < 0 ? "−" : "") + "$" + Math.round(Math.abs(x)).toLocaleString("es-MX");

/* ---------- precios ---------- */
function serieConVivo(S) {
  const q = S.cot, n = S.c.length, f = S.fechas[n - 1];
  if (q.fecha === f) { const c = Float64Array.from(S.c); c[n - 1] = q.precio; return { id: S.id, fechas: S.fechas, c, o: S.o }; }
  if (q.fecha > f) return { id: S.id, fechas: [...S.fechas, q.fecha], c: Float64Array.from([...S.c, q.precio]), o: Float64Array.from([...S.o, q.apertura || q.precio]) };
  return { id: S.id, fechas: S.fechas, c: S.c, o: S.o };
}
const senal = (it, S2) => Motor.FAMILIAS[it.fam].señal(S2, it.p);
// Renata opera la Bolsa Mexicana (pesos) y Hugo la de Nueva York (dólares)
const operadorDe = it => PERSONAL[it.moneda === "USD" ? "hugo" : "renata"];

/* ---------- operaciones en papel ---------- */
const K = Motor.costoLado();
const HOY = { ops: 0, comisiones: { MXN: 0, USD: 0 }, porOperador: { renata: [], hugo: [] } };
function comprar(it, precio, h) {
  const n = Math.floor(it.efectivo / (precio * (1 + K))); if (n < 1) return;
  it.efectivo -= n * precio * (1 + K); it.titulos = n; it.entrada = precio;
  it.ops.unshift({ tipo: "compra", precio, titulos: n, fecha: T.fecha }); it.ops.length = Math.min(it.ops.length, 40);
  const op = operadorDe(it); E.totales.operaciones++; HOY.ops++; HOY.comisiones[it.moneda] += n * precio * K;
  HOY.porOperador[op.id].push(`compró ${it.emisora}`);
  log(op.id, `${op.corto} compró ${n.toLocaleString("es-MX")} ${it.emisora} a ${fmt(precio)} ${it.moneda} siguiendo ${it.etiqueta}.`, "operacion", h);
  sentir(op.id, { estres: 1 }); xp(op.id, 3, { operaciones: 1 }, h);
}
function vender(it, precio, h, motivo = "") {
  const n = it.titulos; if (!n) return 0;
  const res = (precio * (1 - K)) / (it.entrada * (1 + K)) - 1;
  it.efectivo += n * precio * (1 - K); it.titulos = 0;
  it.ops.unshift({ tipo: "venta", precio, titulos: n, resultado: res, fecha: T.fecha }); it.ops.length = Math.min(it.ops.length, 40);
  const op = operadorDe(it); E.totales.operaciones++; HOY.ops++; HOY.comisiones[it.moneda] += n * precio * K;
  HOY.porOperador[op.id].push(`vendió ${it.emisora} (${pct(res)})`);
  log(op.id, `${op.corto} vendió ${n.toLocaleString("es-MX")} ${it.emisora} a ${fmt(precio)} ${it.moneda} (${pct(res)} en la operación)${motivo}.`, "operacion", h);
  // la experiencia del operador depende de lo que de verdad ganó o perdió la operación
  const exp = Math.max(-15, Math.min(25, 3 + res * 300));
  if (res > 0) { sentir(op.id, { animo: 4, confianza: 3 }); sentir("elena", { animo: 1 }); xp(op.id, exp, { operaciones: 1, ganadoras: 1 }, h); derivar(op.id, "optimista", 0.004); }
  else { sentir(op.id, { animo: -3, estres: 3 }); sentir("chema", { estres: 1 }); xp(op.id, exp, { operaciones: 1 }, h); derivar(op.id, "nervioso", 0.003); }
  return res;
}
function marcar(it) { const S = SERIES.get(it.serie); if (!S) return; it.precio = S.cot.precio; it.valor = it.efectivo + it.titulos * S.cot.precio; it.fechaPrecio = S.cot.fecha; }
function retirar(it, motivo, quien, h) {
  const S = SERIES.get(it.serie);
  if (S) vender(it, S.cot.precio, h, ", por retiro");
  marcar(it);
  it.estado = "retirada"; it.retiro = { fecha: T.fecha, motivo, resultado: +(it.valor / it.capital - 1).toFixed(4), quien };
  if (it.minero) { sentir(it.minero, { confianza: -4, animo: -3 }); xp(it.minero, 0, { retiradas: 1 }, h); derivar(it.minero, "optimista", -0.006); derivar(it.minero, "nervioso", 0.004); }
}

/* ---------- Sistemas (Charly e Ingrid): ¿llegaron bien los precios? ---------- */
function sistemas(h) {
  const fallas = PRECIOS.fallas || [], esperadas = SERIES.size + fallas.length;
  // precios viejos: si la última cotización tiene más de 4 días, no se opera con ella
  const viejas = [...SERIES.values()].filter(S => (Date.parse(T.fecha) - Date.parse(S.cot.fecha)) / 864e5 > 4);
  for (const S of SERIES.values()) S.vieja = viejas.includes(S);
  const txt = `Llegaron ${SERIES.size} de ${esperadas} emisoras${fallas.length ? `; fallaron ${fallas.join(", ")}` : ""}${TC ? ` y el dólar a $${TC.toFixed(2)}` : "; el precio del dólar no llegó"}.`;
  const txtI = viejas.length ? `Precios viejos en ${viejas.map(S => S.id).join(", ")}: no se opera con ellos hasta que se actualicen.` : "Todos los precios están al día.";
  E.sistemas = { t: sello(h), fecha: T.fecha, llegaron: SERIES.size, esperadas, fallas, viejas: viejas.map(S => S.id), tc: TC || null };
  trabajo("charly", txt); trabajo("ingrid", txtI);
  if (fallas.length || !TC) log("charly", `Charly: ${txt}`, "sistemas", h);
  if (viejas.length) log("ingrid", `Ingrid: ${txtI}`, "sistemas", h);
  xp("charly", 2, {}, h); xp("ingrid", 2, {}, h);
}

/* ---------- Noticias (Diego y Valeria): titulares reales y movimientos fuertes ---------- */
function noticias(h) {
  const llegadas = PRECIOS.noticias || [];
  const vistas = new Set(E.noticias.map(n => n.link || n.titulo));
  const frescas = llegadas.filter(n => n.titulo && !vistas.has(n.link || n.titulo));
  E.noticias = [...frescas, ...E.noticias].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 40);
  const enCartera = new Set(E.cartera.filter(i => i.estado === "activa").map(i => i.emisora));
  if (frescas.length) {
    const top = frescas.find(n => enCartera.has(n.id)) || frescas[0];
    log("diego", `Diego trajo ${frescas.length} ${frescas.length === 1 ? "titular nuevo" : "titulares nuevos"}. De ${top.id}: «${top.titulo}»${top.fuente ? ` (${top.fuente})` : ""}.`, "noticias", h);
    trabajo("diego", `Trajo ${frescas.length} titulares reales; el más relevante, de ${top.id}: «${top.titulo}».`);
    xp("diego", Math.min(8, frescas.length), {}, h);
  } else trabajo("diego", llegadas.length ? "Revisó los titulares; no hay nada nuevo desde la última vez." : "Yahoo no mandó titulares en esta revisión.");
  const fuertes = [...SERIES.values()].map(S => ({ id: S.id, ch: S.cot.precio / S.cot.cierreAnt - 1 }))
    .filter(x => Math.abs(x.ch) >= REGLAS.movimientoFuerte).sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch));
  const antes = E.movimientos && E.movimientos.fecha === T.fecha ? E.movimientos.lista.map(x => x.id).join() : "";
  E.movimientos = { t: sello(h), fecha: T.fecha, lista: fuertes.map(x => ({ id: x.id, ch: +x.ch.toFixed(4) })) };
  const txt = fuertes.length ? `Movimientos fuertes hoy: ${fuertes.map(x => `${x.id} ${pct(x.ch)}`).join(", ")}.` : "Hoy ninguna emisora se ha movido 3% o más.";
  trabajo("vale", txt);
  if (fuertes.length && fuertes.map(x => x.id).join() !== antes) { log("vale", `Valeria: ${txt}`, "noticias", h); xp("vale", 3, {}, h); }
}

/* ---------- Macroeconomía (Paco y Alejandra): ¿cómo está el mercado? ---------- */
const TENDENCIA = new Set(["cruce", "canal", "momentum"]); // estrategias que solo compran cuando el precio ya va hacia arriba
const sigueTendencia = b => TENDENCIA.has(b.fam) || (b.fam === "rsi" && b.p && b.p.filtro);
function macro(h) {
  const S = SERIES.get("bmv:IPC") || [...SERIES.values()].find(x => x.id === "EWW");
  if (!S) return null;
  const L = Motor.lecturaMercado({ ...serieConVivo(S), id: S.id });
  const agitado = L.vol20 > L.vol252 * 1.25 || L.caida < -0.12, bajista = L.tendencia.startsWith("Bajista");
  const regimen = bajista && agitado ? "tormenta" : bajista ? "bajista" : agitado ? "agitado" : "normal";
  const nuevas = { normal: REGLAS.nuevasPorDia, agitado: 1, bajista: 1, tormenta: 0 }[regimen];
  const decision = {
    normal: `El comité puede meter hasta ${REGLAS.nuevasPorDia} estrategias nuevas.`,
    agitado: "Con el mercado agitado, el comité mete solo 1 estrategia nueva.",
    bajista: "Con el mercado a la baja, solo entran estrategias que siguen la tendencia (nada de comprar rebotes sin filtro), máximo 1.",
    tormenta: "Mercado a la baja y agitado: hoy no entra ninguna estrategia nueva."
  }[regimen];
  E.macro = { t: sello(h), fecha: T.fecha, indice: S.id, tendencia: L.tendencia, anio: +L.anio.toFixed(4), caida: +L.caida.toFixed(4), vol20: +L.vol20.toFixed(4), vol252: +L.vol252.toFixed(4), regimen, nuevas, soloTendencia: bajista, decision };
  const txtP = `Leyó el ${S.id}: tendencia ${L.tendencia.toLowerCase()}, ${pct(L.anio)} en 12 meses y ${pct(L.caida)} desde su máximo del año. ${decision}`;
  const txtA = `Volatilidad de 20 días: ${(L.vol20 * 100).toFixed(0)}% anual, contra ${(L.vol252 * 100).toFixed(0)}% del año: ${agitado ? "el mercado está agitado" : "movimiento normal"}.`;
  log("paco", `Paco ${txtP.charAt(0).toLowerCase() + txtP.slice(1)}`, "macro", h); log("ale", `Alejandra: ${txtA}`, "macro", h);
  trabajo("paco", txtP); trabajo("ale", txtA);
  xp("paco", 6, {}, h); xp("ale", 6, {}, h);
  return E.macro;
}

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
    const eventos = Personal.aplicarPlatica(E.agentes, a, b, res, T.fecha);
    const hh = h + R() * 0.8;
    for (const ev of eventos) log(ev.quien.id, Personal.textoEvento(ev, ev.quien), "carrera", hh);
    E.social.unshift({ t: sello(hh), hora: horaTxt(hh), a: a.id, b: b.id, lugar, tema: res.tema, calidad: +res.calidad.toFixed(2), lineas: res.lineas, resumen: Personal.resumen(a, b, res) });
    if (Math.abs(res.calidad) > 0.55) log(a.id, Personal.resumen(a, b, res), "social", hh);
  }
  E.social.length = Math.min(E.social.length, 300);
}

/* ---------- Mineros: cada quien busca en su especialidad y recibe pruebas según sus resultados reales ---------- */
function resultadosMinero(id) {
  const suyas = E.cartera.filter(i => i.minero === id);
  const rs = suyas.map(i => (i.valor ?? i.capital) / i.capital - 1);
  return { n: suyas.length, prom: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0, ganancia: suyas.reduce((s, i) => s + (aPesos(i.moneda, (i.valor ?? i.capital) - i.capital) ?? 0), 0) };
}
/* Don Fermín: cuántas veces se aprueba cada tipo de estrategia (con un poco de colchón para las que casi no se han probado) */
const tasaFamilia = fam => { const [rev, apr] = E.archivo.porFamilia[fam] || [0, 0]; return (apr + 1) / (rev + 40); };
function repartoMineros() {
  const mineros = STAFF.min;
  const pesos = mineros.map(p => {
    const r = resultadosMinero(p.id), nivel = E.agentes[p.id].carrera.nivel;
    // a quien le funciona lo que encuentra, más pruebas; con poca historia casi no cambia
    const confianza = Math.min(1, r.n / 3);
    return Math.max(0.5, Math.min(2, 1 + r.prom * 12 * confianza)) * (1 + (nivel - 1) * 0.04);
  });
  const total = pesos.reduce((a, b) => a + b, 0);
  return mineros.map((p, i) => ({ p, cupo: Math.round(REGLAS.jornada * pesos[i] / total), ...resultadosMinero(p.id) }));
}
function jornada() {
  const series = [...SERIES.values()];
  // E.evaluadas[serie] = arreglo con el día (número) en que se revisó cada combinación; 0 = nunca
  const hoyN = Math.floor(AHORA.getTime() / 864e5), CANDS = Motor.todasLasCandidatas();
  const pool = [];
  for (const S of series) {
    const arr = (E.evaluadas[S.key] ||= []);
    CANDS.forEach((c, i) => { if (!arr[i] || hoyN - arr[i] > REGLAS.reintentoDias) pool.push({ S, c, i, k: S.key + "|" + c.fam + JSON.stringify(c.p) }); });
  }
  const barajado = Motor.barajar(pool, Personal.semillaDe(T.fecha)), usadas = new Set();
  const reparto = repartoMineros(), elegidas = [];
  const tomar = (filtro, n, minero) => { for (const x of barajado) { if (n <= 0) break; if (usadas.has(x) || !filtro(x)) continue; usadas.add(x); elegidas.push({ ...x, minero }); n--; } return n; };
  let sobra = 0;
  for (const r of reparto) {
    const fams = Personal.ESPECIALIDAD[r.p.id] || Object.keys(Motor.FAMILIAS);
    // si busca en dos familias, reparte según lo que Don Fermín ve que se aprueba (mínimo 30% a cada una)
    const tasas = fams.map(tasaFamilia), sum = tasas.reduce((a, b) => a + b, 0);
    let falta = 0;
    fams.forEach((f, i) => { const parte = fams.length === 1 ? r.cupo : Math.round(r.cupo * Math.max(0.3, Math.min(0.7, tasas[i] / sum))); falta += tomar(x => x.c.fam === f, parte, r.p.id); });
    r.familias = fams;
    sobra += falta;
  }
  // si a alguien se le acabaron las combinaciones de su especialidad, lo que sobra se reparte parejo (de cualquier tipo)
  for (let vuelta = 0; sobra > 0 && vuelta < 400; vuelta++) { const r = reparto[vuelta % reparto.length]; if (tomar(() => true, 1, r.p.id) === 0) sobra--; else break; }
  const motivos = {}, aprobadas = [], felicitar = new Set();
  const llegaron = { min: elegidas.length, ana: 0, rie: 0, me1: 0, me2: 0, com: 0 }, SALA = { analisis: "ana", riesgos: "rie", mesa1: "me1", mesa2: "me2", comite: "com" };
  const vivas = new Map(series.map(S => [S.key, { ...serieConVivo(S), id: S.id }]));
  const porMinero = Object.fromEntries(reparto.map(r => [r.p.id, { pruebas: 0, aprobadas: 0, propias: 0 }]));
  for (const { S, c, i: ci, k, minero: mid } of elegidas) {
    const exp = Motor.evaluar(vivas.get(S.key), c);
    E.evaluadas[S.key][ci] = hoyN;
    porMinero[mid].pruebas++; if ((Personal.ESPECIALIDAD[mid] || []).includes(c.fam)) porMinero[mid].propias++;
    const fam = (E.archivo.porFamilia[c.fam] ||= [0, 0]); fam[0]++;
    for (const p of exp.pasos || []) if (SALA[p.depto]) llegaron[SALA[p.depto]]++;
    if (exp.estado !== "aprobada") { motivos[exp.motivo] = (motivos[exp.motivo] || 0) + 1; continue; }
    fam[1]++; porMinero[mid].aprobadas++;
    const minero = PERSONAL[mid];
    const ficha = {
      key: k, serie: S.key, fam: c.fam, p: c.p, etiqueta: exp.etiqueta, familia: exp.familia, emisora: S.id, moneda: S.moneda,
      puntaje: +exp.puntaje.toFixed(3), sIS: +exp.is.sharpe.toFixed(2), sOOS: +exp.oos.sharpe.toFixed(2), rOOS: +exp.oos.total.toFixed(4),
      bhOOS: +exp.bhOOS.total.toFixed(4), dd: +exp.oos.dd.toFixed(4), robustez: +exp.robustez.toFixed(2), fecha: T.fecha, minero: minero.id, revisada: T.fecha
    };
    const i = E.biblioteca.findIndex(b => b.key === k);
    if (i >= 0) E.biblioteca[i] = ficha; else E.biblioteca.push(ficha);
    aprobadas.push(ficha); felicitar.add(minero.id);
    sentir(minero.id, { confianza: 4, animo: 3 });
    xp(minero.id, 20, { aprobadas: 1 }, 15.2); derivar(minero.id, "competitivo", 0.004); derivar(minero.id, "optimista", 0.004);
    for (const d of ["ana", "rie", "me1", "me2"]) STAFF[d].forEach(p => sentir(p.id, { confianza: 1 }));
    sentir("elena", { animo: 1 });
    log("elena", `Lic. Cervantes aprobó ${ficha.etiqueta} en ${ficha.emisora}, minada por ${minero.corto}. Sharpe en datos nuevos: ${ficha.sOOS}.`, "comite", 15.2);
  }
  if (!aprobadas.length) STAFF.min.forEach(p => sentir(p.id, { animo: -3, estres: 2 }));
  // cada departamento gana experiencia por lo que revisó
  for (const [d, n] of Object.entries(llegaron)) if (d !== "min") for (const p of STAFF[d]) { const mio = Math.round(n / STAFF[d].length); if (mio) xp(p.id, Math.min(20, mio * 0.25), { revisados: mio }, 15.1); }
  for (const r of reparto) {
    const m = porMinero[r.p.id];
    xp(r.p.id, Math.min(10, m.pruebas * 0.1), { revisados: m.pruebas }, 15.1);
    const deSuyas = m.propias === m.pruebas ? `de ${r.familias.map(f => Motor.FAMILIAS[f].nombre.toLowerCase()).join(" y ")}` : `(${m.propias} de ${r.familias.map(f => Motor.FAMILIAS[f].nombre.toLowerCase()).join(" y ")}; ya casi no quedan combinaciones nuevas de su especialidad, así que ayudó con otras)`;
    trabajo(r.p.id, `Probó ${m.pruebas} estrategias ${deSuyas}; le aprobaron ${m.aprobadas}.${r.n ? ` Lo que ha encontrado va ${pct(r.prom)} en promedio en la operación en papel.` : ""}`,
      { pruebas: m.pruebas, aprobadas: m.aprobadas, cupo: r.cupo, enCartera: r.n, promedio: +r.prom.toFixed(4), ganancia: Math.round(r.ganancia) });
  }
  for (const d of ["ana", "rie", "me1", "me2"]) {
    const sig = { ana: "rie", rie: "me1", me1: "me2", me2: "com" }[d], txt = `Revisó ${llegaron[d]} estrategias y pasaron ${llegaron[sig]} a la siguiente sala.`;
    STAFF[d].forEach(p => trabajo(p.id, txt));
  }
  log("lupita", `Reparto de la jornada: ${reparto.map(r => `${r.p.corto} ${porMinero[r.p.id].pruebas}`).join(", ")} pruebas. Gana más pruebas quien encuentra estrategias que sí ganan dinero.`, "trabajo", 15.05);
  // Don Fermín: estadística del archivo
  const fams = Object.entries(E.archivo.porFamilia).filter(([, v]) => v[0] >= 20).map(([f, [rev, apr]]) => ({ f, tasa: apr / rev, rev }));
  const mot = Object.entries(motivos).sort((a, b) => b[1] - a[1])[0];
  if (fams.length) {
    fams.sort((a, b) => b.tasa - a.tasa);
    const txt = `En el archivo, ${Motor.FAMILIAS[fams[0].f].nombre.toLowerCase()} se aprueba ${(fams[0].tasa * 100).toFixed(1)}% de las veces y ${Motor.FAMILIAS[fams[fams.length - 1].f].nombre.toLowerCase()} ${(fams[fams.length - 1].tasa * 100).toFixed(1)}%.${mot ? ` Hoy el motivo de rechazo más común fue «${mot[0].toLowerCase()}» (${mot[1]}).` : ""}`;
    trabajo("fermin", txt, { familias: Object.fromEntries(fams.map(x => [x.f, +x.tasa.toFixed(4)])) }); log("fermin", `Don Fermín: ${txt}`, "trabajo", 15.25); xp("fermin", 4, {}, 15.25);
  }
  E.biblioteca.sort((a, b) => b.puntaje - a.puntaje);
  const enCartera = new Set(E.cartera.filter(i => i.estado === "activa").map(i => i.key));
  E.biblioteca = E.biblioteca.filter((b, i) => i < REGLAS.bibliotecaMax || enCartera.has(b.key));
  E.jornadas.unshift({ fecha: T.fecha, candidatas: elegidas.map(({ S, c, minero }) => [S.key, c.fam, c.p, minero]), revisadas: elegidas.length, aprobadas: aprobadas.map(a => a.key), motivos, llegaron, reparto: reparto.map(r => ({ id: r.p.id, cupo: r.cupo, ...porMinero[r.p.id] })) });
  E.jornadas.length = Math.min(E.jornadas.length, 2);
  E.totales.expedientes += elegidas.length; E.totales.aprobadas += aprobadas.length;
  log("lupita", `Jornada del día: ${elegidas.length} expedientes revisados, ${aprobadas.length} ${aprobadas.length === 1 ? "aprobado" : "aprobados"}.`, "trabajo", 15.1);
  return { felicitar, vivas };
}

/* ---------- Biblioteca (Memo): vuelve a probar lo guardado con los datos más nuevos ---------- */
function revalidar(vivas) {
  const pendientes = E.biblioteca.filter(b => !b.revisada || (Date.parse(T.fecha) - Date.parse(b.revisada)) / 864e5 >= REGLAS.revalidarDias)
    .sort((a, b) => (a.revisada || "").localeCompare(b.revisada || "")).slice(0, REGLAS.revalidarPorDia);
  if (!pendientes.length) { trabajo("memo", `Las ${E.biblioteca.length} estrategias de la biblioteca están revisadas de esta semana.`); return; }
  const salen = [];
  for (const b of pendientes) {
    const S = vivas.get(b.serie); if (!S) continue;
    const exp = Motor.evaluar(S, { fam: b.fam, p: b.p });
    b.revisada = T.fecha;
    if (exp.estado === "aprobada") Object.assign(b, { puntaje: +exp.puntaje.toFixed(3), sIS: +exp.is.sharpe.toFixed(2), sOOS: +exp.oos.sharpe.toFixed(2), rOOS: +exp.oos.total.toFixed(4), bhOOS: +exp.bhOOS.total.toFixed(4), dd: +exp.oos.dd.toFixed(4), robustez: +exp.robustez.toFixed(2) });
    else { b.vencida = { fecha: T.fecha, motivo: exp.motivo }; salen.push(b); }
  }
  // lo que ya no pasa sale de la biblioteca; si está operando y va perdiendo, el comité la retira
  for (const b of salen) {
    const it = E.cartera.find(i => i.key === b.key && i.estado === "activa");
    if (it) { marcar(it); if (it.valor < it.capital) { retirar(it, `ya no pasa la revisión de la biblioteca (${b.vencida.motivo.toLowerCase()})`, "memo", 15.15); log("elena", `El comité retiró ${it.etiqueta} en ${it.emisora}: Memo la volvió a probar y ya no pasa (${b.vencida.motivo.toLowerCase()}).`, "comite", 15.15); } else continue; }
    E.biblioteca = E.biblioteca.filter(x => x !== b);
  }
  const txt = `Volvió a probar ${pendientes.length} estrategias de la biblioteca con los datos de hoy: ${pendientes.length - salen.length} siguen bien${salen.length ? ` y ${salen.length} ya no pasan (${salen.slice(0, 3).map(b => `${b.etiqueta} en ${b.emisora}`).join("; ")})` : ""}.`;
  trabajo("memo", txt, { revisadas: pendientes.length, salen: salen.map(b => ({ etiqueta: b.etiqueta, emisora: b.emisora, motivo: b.vencida.motivo })) });
  log("memo", `Memo ${txt.charAt(0).toLowerCase() + txt.slice(1)}`, "biblioteca", 15.15);
  xp("memo", Math.min(10, pendientes.length * 0.6), {}, 15.15);
}

/* ---------- Riesgos (Don Chema y Fernanda): vigilan la cartera en cada revisión ---------- */
function riesgos(h, puedeRetirar) {
  const alertas = [];
  for (const it of E.cartera.filter(i => i.estado === "activa")) {
    marcar(it); const r = it.valor / it.capital - 1;
    if (puedeRetirar && r <= REGLAS.retiroCaida) {
      retirar(it, `Don Chema la retiró a mediodía: ya perdía ${pct(r)}`, "chema", h);
      log("chema", `Don Chema retiró ${it.etiqueta} en ${it.emisora} a mediodía: ya perdía ${pct(r)} y el límite es ${pct(REGLAS.retiroCaida)}.`, "riesgo", h);
      xp("chema", 8, {}, h); sentir("chema", { estres: 3 });
    } else if (r <= REGLAS.alertaRiesgo) alertas.push(`${it.etiqueta} en ${it.emisora} va ${pct(r)} (se retira en ${pct(REGLAS.retiroCaida)})`);
  }
  const activas = E.cartera.filter(i => i.estado === "activa");
  let invertido = 0, total = 0; const porEmisora = {};
  for (const it of activas) {
    const v = aPesos(it.moneda, it.valor ?? it.capital), acc = aPesos(it.moneda, it.titulos * (it.precio || 0));
    if (v == null) continue;
    total += v; invertido += acc; if (acc > 0) porEmisora[it.emisora] = (porEmisora[it.emisora] || 0) + acc;
  }
  const mayor = Object.entries(porEmisora).sort((a, b) => b[1] - a[1])[0];
  const pctInv = total ? invertido / total : 0, pctMayor = total && mayor ? mayor[1] / total : 0;
  if (mayor && pctMayor > 0.35) alertas.push(`${mayor[0]} pesa ${(pctMayor * 100).toFixed(0)}% del fondo; es mucha concentración`);
  E.riesgo = { t: sello(h), fecha: T.fecha, invertido: +pctInv.toFixed(4), mayor: mayor ? { id: mayor[0], peso: +pctMayor.toFixed(4) } : null, alertas };
  const txtC = alertas.length ? `Alertas: ${alertas.join("; ")}.` : `Ninguna estrategia está cerca del límite de pérdida (${pct(REGLAS.retiroCaida)}).`;
  const txtF = total ? `El fondo tiene ${(pctInv * 100).toFixed(0)}% invertido en acciones y ${(100 - pctInv * 100).toFixed(0)}% en efectivo${mayor ? `; la empresa con más peso es ${mayor[0]} (${(pctMayor * 100).toFixed(0)}%)` : ""}.` : "Todavía no hay dinero en acciones.";
  trabajo("chema", txtC); trabajo("fer", txtF);
  if (alertas.length) log("chema", `Don Chema: ${txtC}`, "riesgo", h);
  if (TIPO === "cierre") log("fer", `Fernanda: ${txtF}`, "riesgo", h);
  xp("chema", 2 + alertas.length, {}, h); xp("fer", 2, {}, h);
}

/* ---------- Cumplimiento (Lic. Méndez y Andrea): auditoría de cada corrida ---------- */
function auditoria(h) {
  const obs = [], activas = E.cartera.filter(i => i.estado === "activa");
  if (activas.length > REGLAS.maxActivas) obs.push(`hay ${activas.length} estrategias operando y el límite es ${REGLAS.maxActivas}`);
  const porEm = {}; activas.forEach(i => { porEm[i.emisora] = (porEm[i.emisora] || 0) + 1; });
  for (const [em, n] of Object.entries(porEm)) if (n > REGLAS.maxPorEmisora) obs.push(`${em} tiene ${n} estrategias y el límite es ${REGLAS.maxPorEmisora}`);
  for (const it of E.cartera) {
    if (it.efectivo < -0.01) obs.push(`${it.etiqueta} en ${it.emisora} tiene efectivo negativo`);
    if (!Number.isInteger(it.titulos) || it.titulos < 0) obs.push(`${it.etiqueta} en ${it.emisora} tiene un número de títulos inválido`);
    if (it.precio && it.valor != null && Math.abs(it.valor - (it.efectivo + it.titulos * it.precio)) > 0.5) obs.push(`las cuentas de ${it.etiqueta} en ${it.emisora} no cuadran`);
  }
  const com = Object.entries(HOY.comisiones).filter(([, v]) => v > 0).map(([m, v]) => `${pesosTxt(v)} ${m}`).join(" y ");
  E.auditoria = { t: sello(h), fecha: T.fecha, revisadas: E.cartera.length, operaciones: HOY.ops, obs, comisiones: { MXN: Math.round(HOY.comisiones.MXN), USD: Math.round(HOY.comisiones.USD) } };
  const txtM = obs.length ? `Encontró ${obs.length} ${obs.length === 1 ? "observación" : "observaciones"}: ${obs.join("; ")}.` : `Revisó ${E.cartera.length} estrategias y ${HOY.ops} ${HOY.ops === 1 ? "operación" : "operaciones"} de esta revisión: todo dentro de las reglas.`;
  const txtA = HOY.ops ? `En esta revisión se pagaron ${com} de comisiones (0.25% más IVA, más 0.05% de deslizamiento).` : "En esta revisión no hubo operaciones, así que no se pagaron comisiones.";
  trabajo("mendez", txtM); trabajo("andrea", txtA);
  if (obs.length || HOY.ops) log("mendez", `Lic. Méndez: ${txtM}`, "auditoria", h);
  if (HOY.ops) log("andrea", `Andrea: ${txtA}`, "auditoria", h);
  xp("mendez", 3, {}, h); xp("andrea", HOY.ops ? 3 : 1, {}, h);
}

/* ---------- comité: retira, vota y asigna ---------- */
function comite() {
  for (const it of E.cartera.filter(i => i.estado === "activa")) {
    const S = SERIES.get(it.serie); if (!S) continue;
    marcar(it); it.dias = (it.dias || 0) + 1;
    const r = it.valor / it.capital - 1;
    let motivo = null;
    if (r <= REGLAS.retiroCaida) motivo = `perdió ${pct(r)} desde que entró`;
    else if (it.dias >= REGLAS.diasPrueba && r <= REGLAS.retiroPrueba) motivo = `después de ${it.dias} días va ${pct(r)}`;
    if (!motivo) continue;
    retirar(it, motivo, "elena", 15.3);
    log("elena", `El comité retiró ${it.etiqueta} en ${it.emisora}: ${motivo}.`, "comite", 15.3);
    sentir("elena", { estres: 4, animo: -2 });
  }
  const M = E.macro || { nuevas: REGLAS.nuevasPorDia, soloTendencia: false, regimen: "normal" };
  const activas = E.cartera.filter(i => i.estado === "activa");
  const recientes = new Set(E.cartera.filter(i => i.estado === "activa" || (i.retiro && i.retiro.fecha > new Date(AHORA.getTime() - 30 * 864e5).toISOString().slice(0, 10))).map(i => i.key));
  let libres = Math.min(REGLAS.maxActivas - activas.length, M.nuevas), porMacro = 0, rechazos = 0;
  const decisiones = [];
  for (const b of E.biblioteca) {
    if (libres <= 0) break;
    if (recientes.has(b.key) || !SERIES.has(b.serie) || SERIES.get(b.serie).vieja) continue;
    if (activas.filter(i => i.emisora === b.emisora).length >= REGLAS.maxPorEmisora) continue;
    if (M.soloTendencia && !sigueTendencia(b)) { porMacro++; continue; }
    // votación: cada miembro del comité revisa lo suyo
    const votos = { elena: b.sOOS >= REGLAS.votoElena, robles: b.robustez >= REGLAS.votoRobles, paredes: b.dd > REGLAS.votoParedes };
    const si = Object.values(votos).filter(Boolean).length;
    const porque = [!votos.elena && `Lic. Cervantes: Sharpe en datos nuevos de ${b.sOOS}`, !votos.robles && `Ing. Robles: solo ${Math.round(b.robustez * 100)}% de variantes funcionan`, !votos.paredes && `Dra. Paredes: cayó ${pct(b.dd)} en datos nuevos`].filter(Boolean);
    if (si < 2) {
      rechazos++;
      decisiones.push({ fecha: T.fecha, etiqueta: b.etiqueta, emisora: b.emisora, votos, decision: "no", porque });
      if (rechazos <= 2) log("elena", `El comité votó ${si} a ${3 - si} y no mandó ${b.etiqueta} en ${b.emisora} a operar (${porque.join("; ")}).`, "comite", 15.35);
      continue;
    }
    const cap = REGLAS.capital[b.moneda] || 100000;
    const it = { key: b.key, serie: b.serie, fam: b.fam, p: b.p, etiqueta: b.etiqueta, emisora: b.emisora, moneda: b.moneda, minero: b.minero, capital: cap, efectivo: cap, titulos: 0, entrada: 0, ops: [], alta: T.fecha, dias: 0, estado: "activa", valorAyer: cap, votos };
    E.cartera.push(it); activas.push(it); libres--;
    decisiones.push({ fecha: T.fecha, etiqueta: b.etiqueta, emisora: b.emisora, votos, decision: "si", porque });
    log("elena", `El comité votó ${si} a ${3 - si} y mandó ${b.etiqueta} en ${b.emisora} a operar en papel con ${dinero(cap, b.moneda)}.${porque.length ? ` En contra: ${porque[0]}.` : ""}`, "comite", 15.4);
    sentir(b.minero, { animo: 5, confianza: 3 }); xp(b.minero, 10, {}, 15.4);
  }
  for (const id of ["elena", "robles", "paredes"]) xp(id, Math.min(8, 2 + decisiones.length), {}, 15.4);
  E.comite = [...decisiones, ...E.comite].slice(0, 20);
  const si = decisiones.filter(d => d.decision === "si").length;
  const txt = `${si ? `Mandó ${si} ${si === 1 ? "estrategia nueva" : "estrategias nuevas"} a operar` : "No mandó estrategias nuevas"}${rechazos ? `; rechazó ${rechazos} en votación` : ""}${porMacro ? `; ${porMacro} no entraron porque Paco ve el mercado a la baja` : ""}. Hay ${activas.length} operando.`;
  trabajo("elena", txt); trabajo("robles", decisiones.length ? `Votó ${decisiones.filter(d => d.votos.robles).length} a favor de ${decisiones.length} propuestas (pide 70% de variantes que funcionen).` : "Hoy no hubo propuestas que votar.");
  trabajo("paredes", decisiones.length ? `Votó ${decisiones.filter(d => d.votos.paredes).length} a favor de ${decisiones.length} propuestas (no acepta caídas de más de 15%).` : "Hoy no hubo propuestas que votar.");
}

/* ---------- experiencia por resultados reales: lo que ganó o perdió cada estrategia hoy ---------- */
function resultadosDelDia() {
  for (const it of E.cartera.filter(i => i.estado === "activa")) {
    const antes = it.valorAyer ?? it.capital, d = ((it.valor ?? it.capital) - antes) / it.capital;
    it.valorAyer = it.valor ?? it.capital;
    if (Math.abs(d) < 1e-5) continue;
    if (it.minero) xp(it.minero, Math.max(-30, Math.min(30, d * 1500)), {}, 15.45);   // 1% en un día = 15 XP para quien la encontró
    xp(operadorDe(it).id, Math.max(-10, Math.min(10, d * 500)), {}, 15.45);
  }
}

/* ---------- corridas ---------- */
function apertura() {
  let ops = 0;
  const brincos = [];
  for (const it of E.cartera.filter(i => i.estado === "activa")) {
    const S = SERIES.get(it.serie); if (!S) continue;
    // Don Ramón: brincos de precio de la noche a la mañana en lo que tenemos
    if (it.titulos && S.cot.apertura && S.cot.cierreAnt) { const g = S.cot.apertura / S.cot.cierreAnt - 1; if (Math.abs(g) >= REGLAS.brinco) brincos.push(`${it.emisora} abrió ${pct(g)} contra su cierre de ayer`); }
    const m = MERCADOS[S.modo]; if (!m || S.cot.fecha !== m.hoy || S.vieja) { marcar(it); continue; }
    const S2 = serieConVivo(S), pos = senal(it, S2), L = pos.length;
    const quiere = S2.fechas[L - 1] === m.hoy ? pos[L - 2] : pos[L - 1];
    if (quiere && !it.titulos) { comprar(it, S.cot.precio, 9.1); ops++; }
    else if (!quiere && it.titulos) { vender(it, S.cot.precio, 9.1); ops++; }
    it.pendiente = null; marcar(it);
  }
  const conAcciones = E.cartera.filter(i => i.estado === "activa" && i.titulos).length;
  const txtR = brincos.length ? `Brincos de la noche: ${[...new Set(brincos)].join("; ")}.` : conAcciones ? "Revisó la noche: ninguna de nuestras empresas brincó 2% o más al abrir." : "Revisó la noche: todavía no tenemos acciones que vigilar.";
  trabajo("ramon", txtR); if (brincos.length) log("ramon", `Don Ramón: ${txtR}`, "riesgo", 8.9); xp("ramon", 2 + brincos.length, {}, 8.9);
  const hayBolsa = Object.values(MERCADOS).some(m => [...SERIES.values()].some(S => S.cot.fecha === m.hoy));
  if (!hayBolsa) log("lucha", "Hoy no abrió la bolsa; la oficina trabaja tranquila.", "trabajo", 9.1);
  else if (!ops) log("renata", "Apertura sin operaciones: las estrategias siguen como ayer.", "operacion", 9.1);
  for (const id of ["renata", "hugo"]) trabajo(id, HOY.porOperador[id].length ? `En la apertura ${HOY.porOperador[id].join(", ")}.` : `En la apertura no hubo órdenes para ${id === "renata" ? "la Bolsa Mexicana" : "Nueva York"}.`);
  riesgos(9.2, false); auditoria(9.3);
  platicas(3, "oficina", 9);
  return `Apertura: ${ops} ${ops === 1 ? "operación" : "operaciones"}`;
}
function mediodia() {
  E.cartera.filter(i => i.estado === "activa").forEach(marcar);
  riesgos(12.2, true); auditoria(12.3);
  platicas(4, "cafeteria", 14);
  return "Revisión de mediodía";
}
function cierre() {
  E.cartera.filter(i => i.estado === "activa").forEach(marcar);
  macro(15.0);
  const { felicitar, vivas } = jornada();
  revalidar(vivas);
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
  riesgos(15.5, false); auditoria(15.55);
  resultadosDelDia();
  // valor del fondo: todo lo que se ha puesto a operar, activo o retirado
  const fondo = {};
  for (const it of E.cartera) { const f = (fondo[it.moneda] ??= { cap: 0, val: 0 }); f.cap += it.capital; f.val += it.valor ?? it.capital; }
  const previo = E.historial.at(-1);
  if (previo && previo.fecha === T.fecha) E.historial.pop();
  const anterior = E.historial.at(-1);
  E.historial.push({ fecha: T.fecha, ...(TC ? { tc: TC } : {}), ...Object.fromEntries(Object.entries(fondo).map(([m, f]) => [m, { cap: Math.round(f.cap), val: Math.round(f.val) }])) });
  if (E.historial.length > 520) E.historial.splice(0, E.historial.length - 520); // se guardan los últimos ~2 años
  let gananciaDia = null;
  if (anterior) {
    gananciaDia = 0;
    for (const m of Object.keys(fondo)) {
      const a = anterior[m] || { cap: 0, val: 0 }, hoy = { cap: Math.round(fondo[m].cap), val: Math.round(fondo[m].val) };
      const g = aPesos(m, (hoy.val - hoy.cap) - (a.val - a.cap)); gananciaDia = g == null || gananciaDia == null ? null : gananciaDia + g;
      if (!a.val) continue;
      const dia = ((hoy.val - hoy.cap) - (a.val - a.cap)) / a.val, d = Math.max(-6, Math.min(6, dia * 300));
      for (const id of ["renata", "hugo", "elena", "robles", "paredes"]) sentir(id, { animo: d, estres: d < 0 ? -d * 0.6 : 0 });
      xp("elena", Math.max(-10, Math.min(10, dia * 1000)), {}, 15.6);
    }
  }
  // un día de trabajo cansa, sobre todo a los nerviosos
  for (const p of Personal.LISTA) if (!p.guardia) sentir(p.id, { estres: 3 });
  platicas(8, "oficina", 11, felicitar);
  platicas(5, "casa", 20.5, felicitar);
  if (R() < 0.6) platicas(1, "noche", 22.5);
  // un día más en la sala; la presión del día deja huella en los nervios
  for (const p of Personal.LISTA) {
    const e = E.agentes[p.id];
    xp(p.id, 2, { dias: 1 }, 15.6);
    if (e.estres > 70) derivar(p.id, "nervioso", 0.003); else if (e.estres < 30) derivar(p.id, "nervioso", -0.003);
    if (e.animo > 70) derivar(p.id, "optimista", 0.002); else if (e.animo < 30) derivar(p.id, "optimista", -0.002);
  }
  for (const p of Personal.LISTA) {
    const e = E.agentes[p.id];
    e.diario.push({ fecha: T.fecha, animo: Math.round(e.animo), estres: Math.round(e.estres), confianza: Math.round(e.confianza), xp: Math.round(e.carrera.xp), nivel: e.carrera.nivel });
    e.diario = e.diario.slice(-60);
  }
  // Doña Lucha: el resumen del día con lo que de verdad pasó
  const j = E.jornadas[0], act = E.cartera.filter(i => i.estado === "activa").length;
  const opsHoy = E.cartera.reduce((s, i) => s + (i.ops || []).filter(o => o.fecha === T.fecha).length, 0);
  const partes = [
    `se probaron ${j.revisadas} estrategias y se aprobaron ${j.aprobadas.length}`,
    opsHoy ? `hubo ${opsHoy} ${opsHoy === 1 ? "operación" : "operaciones"}` : "no hubo operaciones",
    gananciaDia == null ? null : Math.abs(gananciaDia) < 1 ? "el fondo quedó igual que ayer" : `el fondo ${gananciaDia > 0 ? "ganó" : "perdió"} ${pesosTxt(Math.abs(gananciaDia))} pesos`,
    E.macro ? `Paco ve el mercado ${{ normal: "normal", agitado: "agitado", bajista: "a la baja", tormenta: "a la baja y agitado" }[E.macro.regimen]}` : null,
    E.riesgo && E.riesgo.alertas.length ? `Don Chema tiene ${E.riesgo.alertas.length} ${E.riesgo.alertas.length === 1 ? "alerta" : "alertas"}` : null
  ].filter(Boolean);
  const resumen = `Hoy ${fechaDM(T.fecha)} ${partes.slice(0, -1).join(", ")}${partes.length > 1 ? " y " : ""}${partes.at(-1)}. Quedan ${act} estrategias operando.`;
  E.resumenes = [{ fecha: T.fecha, txt: resumen }, ...E.resumenes.filter(r => r.fecha !== T.fecha)].slice(0, 30);
  trabajo("lucha", `Escribió el resumen del día: ${resumen}`); log("lucha", `Doña Lucha: ${resumen}`, "resumen", 15.7); xp("lucha", 4, {}, 15.7);
  return `Cierre: ${j.revisadas} expedientes, ${j.aprobadas.length} aprobados, ${act} estrategias operando`;
}

/* descanso: entre corridas cada quien se recupera; en la noche y el fin de semana más */
const previa = E.ultimaCorrida ? new Date(E.ultimaCorrida.t) : null;
const horas = previa ? Math.max(0, (AHORA - previa) / 36e5) : 0;
if (horas > 0) for (const p of Personal.LISTA) {
  Personal.volverABase(E.agentes[p.id], p, horas, horas > 10 ? 0.05 : 0.02);
  if (horas > 40) sentir(p.id, { animo: 4, estres: -6 }); // regresan del fin de semana
}

sistemas(T.h); noticias(T.h);
const resumen = TIPO === "apertura" ? apertura() : TIPO === "mediodia" ? mediodia() : cierre();
for (const id in E.agentes) for (const c of ["animo", "estres", "confianza"]) E.agentes[id][c] = Math.round(E.agentes[id][c] * 10) / 10;
E.ultimaCorrida = { t: AHORA.toISOString(), tipo: TIPO, resumen, fecha: T.fecha, hora: horaTxt(T.h) };
E.corridas.unshift(E.ultimaCorrida); E.corridas.length = Math.min(E.corridas.length, 90);
fs.mkdirSync(path.dirname(RUTA_ESTADO), { recursive: true });
fs.writeFileSync(RUTA_ESTADO, JSON.stringify(E));
console.log(`[${T.fecha} ${horaTxt(T.h)}] ${resumen}`);
