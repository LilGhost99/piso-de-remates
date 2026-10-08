/* ===== Motor de minería y backtesting =====
   Todo corre en el navegador. Long-only (como opera casi cualquier persona en la BMV).
   Señal al cierre del día i  ->  se ejecuta en la apertura del día i+1 (sin ver el futuro). */
const Motor = (() => {
  const COSTOS = { comision: 0.0025, iva: 0.16, desliz: 0.0005 };
  const costoLado = () => COSTOS.comision * (1 + COSTOS.iva) + COSTOS.desliz;

  const FILTROS = {
    analisis: { minOps: 5, minSharpe: 0.5 },
    riesgos: { maxDD: -0.25, minExpo: 0.08 },
    mesa1: { minSharpe: 0.3, minOps: 2 },
    mesa2: { minRobustez: 0.6, sharpeVecino: 0.3 },
    corte: 0.7
  };

  /* ---------- datos de ejemplo ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function diasHabiles(fin, n) {
    const out = []; const d = new Date(fin + "T12:00:00Z");
    while (out.length < n) {
      const w = d.getUTCDay();
      if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return out.reverse();
  }
  function generarSerie(sp) {
    const r = mulberry32(sp.semilla), n = sp.n || 1260;
    const fechas = diasHabiles(sp.fin || "2026-10-07", n);
    const o = new Float64Array(n), c = new Float64Array(n);
    let p = sp.precio, reg = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      if (r() < sp.cambio) { let x = r(), acc = 0; for (let q = 0; q < sp.regimenes.length; q++) { acc += sp.regimenes[q].peso; if (x <= acc) { reg = q; break; } } }
      const g = sp.regimenes[reg], mu = g.mu / 252, s = g.sigma / Math.sqrt(252);
      const L = mu - (s * s) / 2 + s * gauss(r) + sp.reversion * prev;
      const ab = p * Math.exp(L * (0.15 + 0.3 * r()) + s * 0.2 * gauss(r));
      const ci = p * Math.exp(L);
      o[i] = ab; c[i] = ci;
      p = ci; prev = L;
    }
    // se escala para que el último cierre quede en el nivel indicado
    const esc = sp.precio / c[n - 1], dec = sp.precio > 1000 ? 1 : 100;
    for (let i = 0; i < n; i++) { o[i] = Math.round(o[i] * esc * dec) / dec; c[i] = Math.round(c[i] * esc * dec) / dec; }
    return { id: sp.id, nombre: sp.nombre, sector: sp.sector, fechas, o, c, ejemplo: true };
  }

  /* ---------- CSV reales (del script descargar_bmv.py o de Yahoo) ---------- */
  function leerCSV(texto, id) {
    const filas = texto.trim().split(/\r?\n/);
    const cab = filas[0].split(",").map(s => s.trim().toLowerCase().replace(/"/g, ""));
    const idx = (...ns) => cab.findIndex(h => ns.includes(h));
    const iF = idx("date", "fecha", "datetime"), iO = idx("open", "apertura"), iC = idx("close", "cierre", "adj close");
    if (iF < 0 || iC < 0) throw new Error("El archivo " + id + " no tiene columnas de fecha y cierre.");
    const f = [], o = [], c = [];
    for (let k = 1; k < filas.length; k++) {
      const x = filas[k].split(",");
      const cc = parseFloat(x[iC]); const oo = iO >= 0 ? parseFloat(x[iO]) : cc;
      if (!isFinite(cc) || cc <= 0) continue;
      f.push(x[iF].slice(0, 10)); c.push(cc); o.push(isFinite(oo) && oo > 0 ? oo : cc);
    }
    if (c.length < 300) throw new Error("El archivo " + id + " trae menos de 300 días; baja al menos 2 años.");
    return { id, nombre: id, sector: "Datos reales", fechas: f, o: Float64Array.from(o), c: Float64Array.from(c), ejemplo: false };
  }

  /* ---------- indicadores (con caché por serie) ---------- */
  function cache(S) { return S._cache || (S._cache = new Map()); }
  function memo(S, k, fn) { const m = cache(S); if (!m.has(k)) m.set(k, fn()); return m.get(k); }
  const sma = (S, n) => memo(S, "sma" + n, () => {
    const c = S.c, out = new Float64Array(c.length).fill(NaN); let s = 0;
    for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= n) s -= c[i - n]; if (i >= n - 1) out[i] = s / n; }
    return out;
  });
  const desv = (S, n) => memo(S, "sd" + n, () => {
    const c = S.c, m = sma(S, n), out = new Float64Array(c.length).fill(NaN);
    for (let i = n - 1; i < c.length; i++) { let q = 0; for (let j = i - n + 1; j <= i; j++) q += (c[j] - m[i]) ** 2; out[i] = Math.sqrt(q / n); }
    return out;
  });
  const rsi = (S, n) => memo(S, "rsi" + n, () => {
    const c = S.c, out = new Float64Array(c.length).fill(NaN); let g = 0, l = 0;
    for (let i = 1; i < c.length; i++) {
      const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= n) { g += up / n; l += dn / n; if (i < n) continue; }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  });
  const extremo = (S, n, max) => memo(S, (max ? "mx" : "mn") + n, () => {
    const c = S.c, out = new Float64Array(c.length).fill(NaN);
    for (let i = n; i < c.length; i++) { let v = c[i - n]; for (let j = i - n + 1; j < i; j++) v = max ? Math.max(v, c[j]) : Math.min(v, c[j]); out[i] = v; }
    return out;
  });

  /* ---------- familias de estrategias ---------- */
  const FAMILIAS = {
    cruce: {
      nombre: "Cruce de medias", corto: "Medias",
      idea: "Compra cuando el promedio corto está arriba del largo (sigue la tendencia).",
      params: { rapida: [5, 8, 10, 12, 15, 20, 25, 30], lenta: [30, 40, 50, 60, 80, 100, 120, 150, 200] },
      valida: p => p.rapida * 2 <= p.lenta,
      etiqueta: p => `MA ${p.rapida}/${p.lenta}`,
      señal(S, p) { const f = sma(S, p.rapida), l = sma(S, p.lenta), n = S.c.length, s = new Int8Array(n); for (let i = 0; i < n; i++) s[i] = f[i] > l[i] ? 1 : 0; return s; }
    },
    rsi: {
      nombre: "Rebote RSI", corto: "RSI",
      idea: "Compra cuando el precio cayó demasiado rápido (RSI bajo) y vende cuando se recupera.",
      params: { periodo: [2, 3, 5, 7, 10, 14], entrada: [10, 15, 20, 25, 30, 35], salida: [50, 55, 60, 65, 70, 75], filtro: [0, 1] },
      valida: () => true,
      etiqueta: p => `RSI(${p.periodo}) <${p.entrada} / >${p.salida}${p.filtro ? " +MA200" : ""}`,
      señal(S, p) {
        const r = rsi(S, p.periodo), m = sma(S, 200), c = S.c, n = c.length, s = new Int8Array(n); let h = 0;
        for (let i = 0; i < n; i++) {
          if (!h && r[i] < p.entrada && (!p.filtro || c[i] > m[i])) h = 1;
          else if (h && r[i] > p.salida) h = 0;
          s[i] = h;
        }
        return s;
      }
    },
    canal: {
      nombre: "Ruptura de canal", corto: "Canal",
      idea: "Compra cuando el precio rompe su máximo de N días y sale si rompe el mínimo de M días.",
      params: { entrada: [20, 30, 40, 55, 80, 100], salida: [10, 15, 20, 30, 40] },
      valida: p => p.salida < p.entrada,
      etiqueta: p => `Canal ${p.entrada}/${p.salida}`,
      señal(S, p) {
        const mx = extremo(S, p.entrada, true), mn = extremo(S, p.salida, false), c = S.c, n = c.length, s = new Int8Array(n); let h = 0;
        for (let i = 0; i < n; i++) { if (!h && c[i] > mx[i]) h = 1; else if (h && c[i] < mn[i]) h = 0; s[i] = h; }
        return s;
      }
    },
    momentum: {
      nombre: "Momentum", corto: "Momentum",
      idea: "Se queda comprado mientras el rendimiento de los últimos N días supere un umbral.",
      params: { dias: [20, 40, 60, 90, 120, 180, 250], umbral: [0, 2, 5, 10] },
      valida: () => true,
      etiqueta: p => `Mom ${p.dias}d >${p.umbral}%`,
      señal(S, p) { const c = S.c, n = c.length, s = new Int8Array(n); for (let i = p.dias; i < n; i++) s[i] = c[i] / c[i - p.dias] - 1 > p.umbral / 100 ? 1 : 0; return s; }
    },
    bollinger: {
      nombre: "Rebote Bollinger", corto: "Bollinger",
      idea: "Compra cuando el precio cae por debajo de su banda inferior y vende al volver al promedio.",
      params: { dias: [10, 15, 20, 30, 40], k: [1.5, 2, 2.5] },
      valida: () => true,
      etiqueta: p => `Boll ${p.dias}, ${p.k}σ`,
      señal(S, p) {
        const m = sma(S, p.dias), sd = desv(S, p.dias), c = S.c, n = c.length, s = new Int8Array(n); let h = 0;
        for (let i = 0; i < n; i++) { if (!h && c[i] < m[i] - p.k * sd[i]) h = 1; else if (h && c[i] > m[i]) h = 0; s[i] = h; }
        return s;
      }
    }
  };

  function combinaciones(fam) {
    const F = FAMILIAS[fam], llaves = Object.keys(F.params); let out = [{}];
    for (const k of llaves) { const nx = []; for (const o of out) for (const v of F.params[k]) nx.push({ ...o, [k]: v }); out = nx; }
    return out.filter(F.valida).map(p => ({ fam, p }));
  }
  function todasLasCandidatas() { return Object.keys(FAMILIAS).flatMap(combinaciones); }
  function barajar(arr, semilla) { const r = mulberry32(semilla), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- backtest ---------- */
  function backtest(S, pos, a, b) {
    const c = S.c, o = S.o, k = costoLado(), n = b - a;
    const rets = new Float64Array(n), ops = []; let h = 0, g = 1, ent = 0, dias = 0;
    for (let i = a; i < b; i++) {
      const j = i + 1, quiere = pos[i]; let r = 0, enMercado = false;
      if (h && quiere) { r = c[j] / c[i] - 1; g *= 1 + r; enMercado = true; }
      else if (!h && quiere) { r = (1 - k) * c[j] / o[j] - 1; h = 1; g = 1 + r; ent = j; enMercado = true; }
      else if (h && !quiere) { r = (1 - k) * o[j] / c[i] - 1; g *= 1 + r; h = 0; ops.push({ ent, sal: j, ret: g - 1 }); enMercado = true; }
      rets[i - a] = r;
      if (enMercado) dias++;
    }
    if (h) { rets[n - 1] = (1 + rets[n - 1]) * (1 - k) - 1; g *= 1 - k; ops.push({ ent, sal: b, ret: g - 1, abierta: true }); }
    return { ...metricas(rets, ops, dias / n), rets };
  }
  function metricas(rets, ops, expo) {
    const n = rets.length; let eq = 1, pico = 1, dd = 0, s = 0, q = 0;
    for (let i = 0; i < n; i++) { eq *= 1 + rets[i]; pico = Math.max(pico, eq); dd = Math.min(dd, eq / pico - 1); s += rets[i]; }
    const mu = s / n; for (let i = 0; i < n; i++) q += (rets[i] - mu) ** 2;
    const sd = Math.sqrt(q / Math.max(1, n - 1));
    const gan = ops.filter(t => t.ret > 0), per = ops.filter(t => t.ret <= 0);
    const sg = gan.reduce((a, t) => a + t.ret, 0), sp = -per.reduce((a, t) => a + t.ret, 0);
    return {
      total: eq - 1, cagr: Math.pow(eq, 252 / n) - 1, sharpe: sd > 0 ? (mu / sd) * Math.sqrt(252) : 0,
      dd, ops: ops.length, acierto: ops.length ? gan.length / ops.length : 0,
      factor: sp > 0 ? sg / sp : gan.length ? 99 : 0, expo, operaciones: ops
    };
  }
  function comprarYMantener(S, a, b) {
    const k = costoLado(), rets = new Float64Array(b - a);
    for (let i = a; i < b; i++) rets[i - a] = S.c[i + 1] / S.c[i] - 1;
    rets[0] = (1 + rets[0]) * (1 - k) - 1; rets[rets.length - 1] = (1 + rets[rets.length - 1]) * (1 - k) - 1;
    return { ...metricas(rets, [{ ret: S.c[b] / S.c[a] - 1 }], 1), rets };
  }

  /* ---------- tubería de departamentos ---------- */
  function vecinos(cand) {
    const F = FAMILIAS[cand.fam], out = [];
    for (const k of Object.keys(F.params)) {
      const lista = F.params[k]; if (lista.length < 3) continue;
      const i = lista.indexOf(cand.p[k]);
      for (const d of [-1, 1]) { const v = lista[i + d]; if (v === undefined) continue; const p = { ...cand.p, [k]: v }; if (F.valida(p)) out.push({ fam: cand.fam, p }); }
    }
    return out;
  }
  function señalHoy(pos) {
    const n = pos.length, a = pos[n - 2], b = pos[n - 1];
    if (b && !a) return { txt: "Comprar en la apertura", tipo: "compra" };
    if (b && a) return { txt: "Mantener", tipo: "mantener" };
    if (!b && a) return { txt: "Vender en la apertura", tipo: "venta" };
    return { txt: "Fuera del mercado", tipo: "fuera" };
  }
  const pct = x => (x * 100).toFixed(1) + "%";

  /* Devuelve el expediente completo: hasta qué departamento llegó y por qué. */
  function evaluar(S, cand) {
    const F = FAMILIAS[cand.fam], N = S.c.length, corte = Math.floor(N * FILTROS.corte);
    const pos = F.señal(S, cand.p);
    const exp = { ...cand, emisora: S.id, etiqueta: F.etiqueta(cand.p), familia: F.nombre, corte, pasos: [] };
    const IS = backtest(S, pos, 0, corte); exp.is = IS;
    const fa = FILTROS.analisis;
    if (IS.ops < fa.minOps) return rechazo(exp, "analisis", `Solo ${IS.ops} operaciones en el histórico; muy pocas para confiar`, "Pocas operaciones");
    if (IS.sharpe < fa.minSharpe) return rechazo(exp, "analisis", `Sharpe de ${IS.sharpe.toFixed(2)} en el histórico (mínimo ${fa.minSharpe})`, "Sharpe bajo");
    exp.pasos.push({ depto: "analisis", ok: true, nota: `Sharpe ${IS.sharpe.toFixed(2)}, ${IS.ops} operaciones, acierto ${pct(IS.acierto)}` });
    const fr = FILTROS.riesgos;
    if (IS.dd < fr.maxDD) return rechazo(exp, "riesgos", `Caída máxima de ${pct(IS.dd)}; el límite es ${pct(fr.maxDD)}`, "Caída excesiva");
    if (IS.expo < fr.minExpo) return rechazo(exp, "riesgos", `Solo invierte ${pct(IS.expo)} del tiempo; resultado poco representativo`, "Casi no opera");
    exp.pasos.push({ depto: "riesgos", ok: true, nota: `Caída máxima ${pct(IS.dd)}, invertida ${pct(IS.expo)} del tiempo` });
    const OOS = backtest(S, pos, corte, N - 1); exp.oos = OOS;
    exp.bhIS = comprarYMantener(S, 0, corte); exp.bhOOS = comprarYMantener(S, corte, N - 1);
    const f1 = FILTROS.mesa1;
    if (OOS.ops < f1.minOps) return rechazo(exp, "mesa1", `En datos nuevos solo hizo ${OOS.ops} operación(es)`, "No opera en datos nuevos");
    if (OOS.total <= 0) return rechazo(exp, "mesa1", `Perdió ${pct(OOS.total)} en los datos que no había visto`, "Pierde en datos nuevos");
    if (OOS.sharpe < f1.minSharpe) return rechazo(exp, "mesa1", `Sharpe cae de ${IS.sharpe.toFixed(2)} a ${OOS.sharpe.toFixed(2)} en datos nuevos`, "Se desinfla en datos nuevos");
    exp.pasos.push({ depto: "mesa1", ok: true, nota: `Datos nuevos: ${pct(OOS.total)}, Sharpe ${OOS.sharpe.toFixed(2)}` });
    const vs = vecinos(cand), buenos = vs.filter(v => backtest(S, FAMILIAS[v.fam].señal(S, v.p), 0, corte).sharpe > FILTROS.mesa2.sharpeVecino).length;
    exp.robustez = vs.length ? buenos / vs.length : 1; exp.nVecinos = vs.length;
    if (exp.robustez < FILTROS.mesa2.minRobustez) return rechazo(exp, "mesa2", `Al mover un poco los parámetros solo ${buenos} de ${vs.length} versiones funcionan; parece suerte`, "Frágil (sobreajuste)");
    exp.pasos.push({ depto: "mesa2", ok: true, nota: `${buenos} de ${vs.length} variantes cercanas también funcionan` });
    const degr = IS.sharpe > 0 ? OOS.sharpe / IS.sharpe : 0;
    exp.puntaje = 0.5 * OOS.sharpe + 0.2 * IS.sharpe + 0.3 * exp.robustez * 2;
    exp.notas = [];
    if (degr < 0.5) exp.notas.push("Rinde bastante menos en datos nuevos que en el histórico; vigilar.");
    if (OOS.total < exp.bhOOS.total) exp.notas.push(`No le gana a comprar y mantener en el periodo de prueba (${pct(exp.bhOOS.total)}).`);
    else exp.notas.push(`Le gana a comprar y mantener en el periodo de prueba (${pct(exp.bhOOS.total)}).`);
    if (OOS.dd > exp.bhOOS.dd) exp.notas.push(`Su peor caída (${pct(OOS.dd)}) fue menor que la de comprar y mantener (${pct(exp.bhOOS.dd)}).`);
    exp.pasos.push({ depto: "comite", ok: true, nota: `Aprobada con puntaje ${exp.puntaje.toFixed(2)}` });
    exp.estado = "aprobada"; exp.llego = "comite";
    exp.hoy = señalHoy(pos); exp.pos = pos;
    return exp;
  }
  function rechazo(exp, depto, nota, motivo) {
    exp.pasos.push({ depto, ok: false, nota }); exp.estado = "rechazada"; exp.llego = depto; exp.motivo = motivo; return exp;
  }

  function lecturaMercado(S) {
    const c = S.c, n = c.length, m200 = sma(S, 200)[n - 1], m50 = sma(S, 50)[n - 1];
    const r = []; for (let i = n - 252; i < n; i++) r.push(Math.log(c[i] / c[i - 1]));
    const vol = x => { const m = x.reduce((a, b) => a + b, 0) / x.length; return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length * 252); };
    const v20 = vol(r.slice(-20)), v252 = vol(r);
    let pico = 0; for (let i = n - 252; i < n; i++) pico = Math.max(pico, c[i]);
    return {
      tendencia: c[n - 1] > m200 ? (m50 > m200 ? "Alcista" : "Alcista débil") : (m50 < m200 ? "Bajista" : "Bajista débil"),
      vol20: v20, vol252: v252, volTxt: v20 > v252 * 1.25 ? "Más agitada de lo normal" : v20 < v252 * 0.75 ? "Más tranquila de lo normal" : "Normal",
      caida: c[n - 1] / pico - 1, anio: c[n - 1] / c[n - 252] - 1
    };
  }

  return { COSTOS, costoLado, FILTROS, FAMILIAS, generarSerie, leerCSV, todasLasCandidatas, barajar, evaluar, comprarYMantener, lecturaMercado, sma };
})();
if (typeof module !== "undefined") module.exports = Motor;
