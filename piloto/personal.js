/* ===== Personal de la sala: personalidad, emociones, relaciones y pláticas =====
   Se usa igual en el navegador y en el piloto automático (Node). */
const Personal = (() => {
  // rasgos de 0 a 1: sociable, nervioso, optimista, competitivo, amable
  const P = (id, nombre, corto, depto, puesto, g, r, equipo, gusto, descripcion, frase, extra = {}) =>
    ({ id, nombre, corto, depto, puesto, g, rasgos: { sociable: r[0], nervioso: r[1], optimista: r[2], competitivo: r[3], amable: r[4] }, equipo, gusto, descripcion, frase, ...extra });
  const LISTA = [
    P("lupita", "Lupita Reyes", "Lupita", "min", "Minera de estrategias", "f", [.8, .4, .8, .5, .8], "Pumas", "café de olla", "Platicadora y entusiasta; se emociona con cada estrategia nueva.", "¡Esta sí va a pasar!"),
    P("beto", "Beto Salgado", "Beto", "min", "Minero de estrategias", "m", [.6, .3, .6, .75, .45], "América", "tacos al pastor", "Desvelado y competitivo; presume cuando le aprueban algo.", "Dormí cuatro horas y aquí ando.", { desvelado: true }),
    P("tono", "Toño Cárdenas", "Toño", "min", "Minero de estrategias", "m", [.4, .5, .4, .4, .7], "Cruz Azul", "torta de tamal", "Callado y paciente; sufre con su equipo cada torneo.", "Este torneo sí, ya verás."),
    P("karla", "Karla Medina", "Karla", "min", "Minera de estrategias", "f", [.7, .6, .5, .85, .45], "Chivas", "chilaquiles verdes", "Muy competitiva; lleva la cuenta de quién mina más.", "Voy arriba en la tabla, ¿eh?"),
    P("mariana", "Mariana Ochoa", "Mariana", "ana", "Analista líder", "f", [.6, .5, .6, .6, .7], "Tigres", "café americano", "Líder de análisis; exigente pero justa.", "Los números no mienten."),
    P("rodrigo", "Rodrigo Pineda", "Rodrigo", "ana", "Analista", "m", [.5, .4, .5, .65, .45], "Rayados", "carne asada", "Regio de corazón; directo y sin rodeos.", "Así no, compa."),
    P("ximena", "Ximena Vázquez", "Ximena", "ana", "Analista junior", "f", [.7, .75, .7, .4, .8], "Pachuca", "pastes", "Analista junior de Pachuca; nerviosa pero muy trabajadora.", "¿Lo reviso otra vez?"),
    P("chema", "José Ma. Ibarra", "Don Chema", "rie", "Jefe de riesgos", "m", [.4, .7, .3, .5, .6], "Toluca", "café negro", "Jefe de riesgos; desconfía de todo lo que sube rápido.", "Lo que sube como espuma, baja igual."),
    P("fer", "Fernanda Luna", "Fernanda", "rie", "Analista de riesgos", "f", [.6, .5, .6, .5, .7], "Pumas", "molletes", "Analista de riesgos; ordenada y tranquila.", "Primero el riesgo, luego la ganancia."),
    P("paco", "Paco Ruiz", "Paco", "mac", "Economista", "m", [.85, .3, .75, .4, .7], "Cruz Azul", "pozole", "Economista bromista; explica todo con ejemplos de futbol.", "La economía es como el futbol."),
    P("ale", "Alejandra Ríos", "Alejandra", "mac", "Economista", "f", [.5, .5, .5, .6, .6], "América", "sushi", "Economista analítica; lee los comunicados de Banxico como novela.", "Banxico ya lo había avisado."),
    P("diego", "Diego Herrera", "Diego", "not", "Editor de noticias", "m", [.7, .6, .5, .5, .6], "Chivas", "café con pan dulce", "Madrugador; se entera de todo antes que nadie.", "¿Ya vieron las noticias?", { madrugador: true }),
    P("vale", "Valeria Campos", "Valeria", "not", "Monitorista de noticias", "f", [.9, .4, .8, .3, .8], "Pumas", "elotes", "La más sociable de la oficina; conoce a todos.", "¡Les tengo un chismecito!"),
    P("ivan", "Iván Treviño", "Iván", "me1", "Pruebas con datos nuevos", "m", [.5, .5, .5, .75, .45], "Tigres", "hamburguesa", "Estricto con las pruebas; no le gusta que le discutan.", "Datos nuevos o nada."),
    P("dani", "Daniela Ortiz", "Daniela", "me1", "Pruebas con datos nuevos", "f", [.6, .4, .6, .5, .75], "Pachuca", "quesadillas", "Tranquila; siempre tiene botana en el escritorio.", "¿Quieren unas papitas?"),
    P("sofia", "Sofía Garza", "Sofía", "me2", "Pruebas de robustez", "f", [.6, .55, .6, .65, .6], "América", "café frío", "Perfeccionista; odia las estrategias de pura suerte.", "Si mueves un número y se cae, no sirve."),
    P("emilio", "Emilio Navarro", "Emilio", "me2", "Pruebas de robustez", "m", [.55, .25, .75, .35, .85], "Toluca", "tamales", "Relajado y buena onda; el que calma los pleitos.", "Tranqui, todo tiene arreglo."),
    P("elena", "Elena Cervantes", "Lic. Cervantes", "com", "Directora del comité", "f", [.5, .6, .5, .8, .5], "Chivas", "café de especialidad", "Directora del comité; seria, exigente y protectora de su equipo.", "Quiero ver la evidencia."),
    P("robles", "Arturo Robles", "Ing. Robles", "com", "Consejero", "m", [.4, .4, .4, .6, .5], "Rayados", "comida corrida", "Ingeniero veterano; escéptico de todo lo nuevo.", "En mis tiempos esto se hacía a mano."),
    P("paredes", "Inés Paredes", "Dra. Paredes", "com", "Consejera", "f", [.6, .3, .6, .5, .75], "Pumas", "té verde", "Doctora en finanzas; calmada y buena para explicar.", "Veámoslo con calma."),
    P("mendez", "Jorge Méndez", "Lic. Méndez", "cum", "Oficial de cumplimiento", "m", [.4, .6, .4, .5, .5], "Cruz Azul", "torta ahogada", "Oficial de cumplimiento; cuida las reglas al pie de la letra.", "¿Eso está en el reglamento?"),
    P("andrea", "Andrea Solano", "Andrea", "cum", "Analista de cumplimiento", "f", [.7, .5, .6, .4, .8], "América", "licuado de fresa", "Analista de cumplimiento; amable y detallista.", "Lo anoto para que no se nos olvide."),
    P("memo", "Memo Aguilar", "Memo", "bib", "Bibliotecario", "m", [.5, .3, .6, .2, .8], "Pachuca", "café de olla", "Bibliotecario; habla de libros de inversión a quien se deje.", "¿Ya leíste a Graham?"),
    P("renata", "Renata Solís", "Renata", "trd", "Operadora en papel", "f", [.6, .6, .6, .7, .5], "Tigres", "chilaquiles rojos", "Operadora; vive pegada a la pantalla de precios.", "Ojo con la apertura."),
    P("hugo", "Hugo Castañeda", "Hugo", "trd", "Operador en papel", "m", [.7, .5, .75, .6, .6], "América", "tacos de canasta", "Operador optimista y un poco impulsivo.", "Hoy se ve verde."),
    P("charly", "Charly Domínguez", "Charly", "sis", "Sistemas", "m", [.5, .4, .6, .4, .6], "Pumas", "pizza fría", "De sistemas; desvelado y fan de los videojuegos.", "¿Ya probaron reiniciarlo?", { desvelado: true }),
    P("ingrid", "Ingrid Bauer", "Ingrid", "sis", "Infraestructura", "f", [.4, .5, .5, .5, .6], "Tigres", "pan de muerto", "Infraestructura; súper puntual y ordenada.", "El servidor está perfecto."),
    P("fermin", "Fermín Olvera", "Don Fermín", "arc", "Archivista", "m", [.6, .2, .7, .2, .9], "Cruz Azul", "café con canela", "Archivista veterano; se sabe la historia de toda la oficina.", "Eso ya lo vi en el 2008."),
    P("lucha", "Lucía Pérez", "Doña Lucha", "rec", "Recepcionista", "f", [.9, .3, .8, .2, .9], "América", "atole", "Recepcionista; trata a todos como si fueran sus hijos.", "¿Ya comiste, mijo?"),
    P("ramon", "Ramón Téllez", "Don Ramón", "rec", "Vigilante nocturno", "m", [.5, .3, .6, .2, .8], "Pachuca", "café de la máquina", "Vigilante nocturno; platica con quien se quede tarde.", "Aquí todo tranquilo.", { guardia: true })
  ];
  const POR_ID = Object.fromEntries(LISTA.map((p, i) => [p.id, { ...p, i, hogar: Math.floor(i / 3) }]));
  LISTA.forEach((p, i) => { p.i = i; p.hogar = Math.floor(i / 3); });
  const RIVALES = [["América", "Chivas"], ["América", "Pumas"], ["América", "Cruz Azul"], ["Tigres", "Rayados"], ["Pachuca", "América"]];
  const sonRivales = (x, y) => RIVALES.some(([a, b]) => (a === x && b === y) || (a === y && b === x));

  /* ---------- números ---------- */
  const lim = x => Math.max(0, Math.min(100, x));
  function semillaDe(txt) { let h = 2166136261; for (const ch of txt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(semilla) { let a = semilla >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const base = p => ({ animo: 50 + p.rasgos.optimista * 22, estres: 20 + p.rasgos.nervioso * 28, confianza: 52 + p.rasgos.competitivo * 8 });

  function estadoInicial() {
    const agentes = {};
    for (const p of LISTA) {
      const r = rng(semillaDe("inicio" + p.id)), b = base(p);
      agentes[p.id] = { animo: lim(b.animo + (r() - 0.5) * 26), estres: lim(b.estres + (r() - 0.5) * 22), confianza: lim(b.confianza + (r() - 0.5) * 16), rel: {}, diario: [] };
    }
    for (const a of LISTA) for (const b of LISTA) {
      if (a.id >= b.id) continue;
      const r = rng(semillaDe(a.id + b.id));
      let v = (a.depto === b.depto ? 12 : 0) + (a.hogar === b.hogar ? 15 : 0) + (a.equipo === b.equipo ? 8 : 0) - (sonRivales(a.equipo, b.equipo) ? 5 : 0)
        + Math.round(10 * (1 - Math.abs(a.rasgos.sociable - b.rasgos.sociable))) - 6 + Math.round((r() - 0.5) * 20);
      v = Math.max(-100, Math.min(100, v));
      agentes[a.id].rel[b.id] = v; agentes[b.id].rel[a.id] = v;
    }
    return agentes;
  }

  /* Cambia emociones respetando la personalidad: a los nerviosos el estrés les pega más, a los optimistas lo malo menos */
  // cerca de los extremos cuesta más moverse (nadie vive en 100 de felicidad)
  const freno = (x, d) => d > 0 ? Math.max(0.15, Math.min(1.3, (108 - x) / 55)) : Math.max(0.15, Math.min(1.3, (x + 8) / 55));
  function sentir(e, p, d) {
    if (d.animo) { const v = d.animo > 0 ? d.animo * (0.8 + p.rasgos.optimista * 0.4) : d.animo * (1.2 - p.rasgos.optimista * 0.4); e.animo = lim(e.animo + v * freno(e.animo, v)); }
    if (d.estres) { const v = d.estres > 0 ? d.estres * (0.6 + p.rasgos.nervioso * 0.8) : d.estres; e.estres = lim(e.estres + v * freno(e.estres, v)); }
    if (d.confianza) e.confianza = lim(e.confianza + d.confianza * freno(e.confianza, d.confianza));
  }
  /* Con el tiempo cada quien regresa a su forma de ser */
  function volverABase(e, p, horas, tasa = 0.03) {
    const b = base(p), k = 1 - Math.pow(1 - tasa, horas);
    for (const c of ["animo", "estres", "confianza"]) e[c] += (b[c] - e[c]) * k;
  }
  function humor(e, p) {
    const o = p.g === "f" ? "a" : "o";
    if (e.estres > 78) return { txt: `Bajo mucha presión`, tono: "tenso" };
    if (e.animo < 28) return { txt: `De malas`, tono: "mal" };
    if (e.estres > 62 && e.animo < 45) return { txt: `Preocupad${o}`, tono: "tenso" };
    if (e.animo > 78 && e.estres < 45) return { txt: `Feliz`, tono: "bien" };
    if (e.animo > 68) return { txt: `De buenas`, tono: "bien" };
    if (e.confianza > 75) return { txt: `Muy segur${o}`, tono: "bien" };
    if (e.confianza < 30) return { txt: `Insegur${o}`, tono: "mal" };
    return { txt: "Tranquil" + o, tono: "neutral" };
  }

  /* ---------- pláticas ----------
     Cada tema: frase de quien empieza, respuesta si la plática sale bien, respuesta si sale mal. */
  const TEMAS = {
    saludo: [["¡Buenos días, {B}!", "¡Buenos días! Con todas las ganas.", "Mmm… no me hables antes del café."], ["¿Cómo amaneciste, {B}?", "Bien, ¿y tú?", "Con sueño, ni me digas."]],
    cafe: [["¿Vamos por un {gustoA}?", "¡Va, yo invito!", "Ahorita no puedo, estoy hasta el cuello."], ["Ya me hacía falta un café.", "Igual yo, este día está pesado.", "Tú siempre con tu café."]],
    trafico: [["Reforma estaba imposible hoy.", "Ni me digas, el Metrobús venía a reventar.", "Pues sal más temprano."], ["Me tardé hora y media en llegar.", "Uff, te entiendo.", "Ya, no te quejes."]],
    futbolMismo: [["¿Viste a {equipoA}? ¡Así sí!", "¡Ya era hora, carnal!", "Ni lo menciones, sufrí todo el partido."], ["Este torneo es de {equipoA}.", "¡Eso! Vamos a la final.", "Lo mismo dijimos el año pasado."]],
    futbolRival: [["El {equipoA} le gana al {equipoB}, ya verás.", "Ja, eso dices cada torneo.", "Ni en tus sueños."], ["¿Y tu {equipoB}? Muy calladito.", "Ya nos tocará, no te emociones.", "No empieces, que me enojo."]],
    mercado: [["¿Viste {emisora}? {movimiento} {cambio} hoy.", "Sí, lo estuve siguiendo toda la mañana.", "Ya ni le veo, me estresa."], ["Hoy el mercado anda {humorMercado}.", "Así es esto, hay que tener paciencia.", "Pues a mí ya me tiene harto."]],
    felicitar: [["¡Felicidades por la estrategia aprobada!", "¡Gracias! Costó trabajo.", "Bah, seguro la retiran en una semana."], ["Vi que pasó tu expediente. ¡Bien!", "¡Gracias! Ahora a ver cómo le va.", "Fue suerte, no te creas."]],
    apoyo: [["Te veo estresad{oB}, ¿todo bien?", "Gracias por preguntar, ya me siento mejor.", "Es mucho trabajo, no me alcanza el día."], ["Tómatelo con calma, {B}.", "Tienes razón, voy por aire.", "Fácil decirlo."]],
    pleito: [["Tu última estrategia nos hizo perder.", "Puede ser; la revisamos juntos, ¿va?", "¿Y las tuyas qué? Ni pasan análisis."], ["Otra vez archivaron todo lo tuyo, ¿eh?", "Sí, pero aprendo de cada una.", "Mejor ocúpate de lo tuyo."]],
    chisme: [["Dicen que la Lic. Cervantes va a retirar otra estrategia.", "¿Neta? No me sorprende.", "No me gusta el chisme, la verdad."], ["¿Ya supiste quién llegó tarde hoy?", "¡Cuéntamelo todo!", "Ni me interesa."]],
    comida: [["¿Qué trajiste de comer?", "{gustoB}, ¿quieres probar?", "Nada, se me olvidó el tóper."], ["¿Vamos por unos tacos aquí en la esquina?", "¡Va! Ya tengo hambre.", "Hoy traje mi comida, otro día."]],
    horasExtra: [["¿Otra vez horas extra?", "Ni modo, a darle.", "Ya no aguanto, quiero dormir."], ["Ojalá esta jornada termine pronto.", "Ya casi, ánimo.", "Esto no es vida."]],
    casa: [["¿Quién lava los trastes hoy?", "Yo, tú lavaste ayer.", "A mí no me toca, ¿eh?"], ["¿Vemos una serie?", "¡Va, escoge tú!", "Me voy a dormir, mañana hay jornada."], ["¿Cómo te fue hoy?", "Bien, aprobaron algo en la oficina.", "Pesado, mejor no pregunto."]],
    viernes: [["¡Ya es viernes! ¿Qué planes?", "Ir a comer tacos a la Roma.", "Dormir todo el fin de semana."]],
    noche: [["¿Tan tarde y sigue aquí?", "Ya me voy, ya me voy.", "Es que no termino, déjeme."]],
    frase: [["{fraseA}", "Ja, siempre dices eso.", "Otra vez con eso…"]]
  };
  const llenar = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

  /* ctx: { h, dia, lugar: "oficina" | "cafeteria" | "casa" | "noche", mercado: {emisora, cambio} | null, felicitar: Set(ids), horasExtra } */
  function elegirTema(a, b, ea, eb, ctx, r) {
    const af = ea.rel[b.id] || 0, op = [];
    const add = (t, w) => { if (w > 0) op.push([t, w]); };
    if (ctx.lugar === "casa") add("casa", 5);
    if (ctx.lugar === "noche") add("noche", 4);
    if (ctx.h < 10 && ctx.lugar !== "casa") { add("saludo", 3); add("trafico", 2); add("cafe", 2); }
    if (ctx.lugar === "cafeteria" || (ctx.h >= 13.5 && ctx.h < 16.5)) add("comida", 3);
    add("cafe", 1);
    if (a.equipo === b.equipo) add("futbolMismo", 2.5);
    else if (sonRivales(a.equipo, b.equipo)) add("futbolRival", 2);
    if (ctx.mercado && ctx.lugar !== "casa") add("mercado", 2.5);
    if (ctx.felicitar && ctx.felicitar.has(b.id)) add("felicitar", 5);
    if (eb.estres > 65) add("apoyo", 4 * a.rasgos.amable);
    if (ea.estres > 60 && af < 5) add("pleito", 3 * a.rasgos.competitivo * (1 - a.rasgos.amable));
    if (b.id !== "elena" && a.id !== "elena") add("chisme", 1.5 * a.rasgos.sociable);
    if (ctx.horasExtra) add("horasExtra", 4);
    if (ctx.dia === 5) add("viernes", 2);
    add("frase", 0.8);
    let tot = op.reduce((s, x) => s + x[1], 0), x = r() * tot;
    for (const [t, w] of op) { x -= w; if (x <= 0) return t; }
    return "cafe";
  }

  /* Devuelve la plática completa y sus efectos (no los aplica) */
  function conversar(a, b, ea, eb, ctx, r = Math.random) {
    const tema = elegirTema(a, b, ea, eb, ctx, r);
    const opciones = TEMAS[tema], [t1, ok, mal] = opciones[Math.floor(r() * opciones.length)];
    const af = (ea.rel[b.id] || 0) / 100;
    let q = af * 0.5 + (a.rasgos.sociable + b.rasgos.sociable - 1) * 0.25
      + ((ea.animo + eb.animo) / 2 - 50) / 120 - ((ea.estres + eb.estres) / 2 - 45) / 110
      + (b.rasgos.amable - 0.5) * 0.3 + (r() - 0.5) * 0.9 - 0.22;
    if (tema === "apoyo" || tema === "felicitar") q += 0.45;
    if (tema === "pleito") q -= 0.55 - b.rasgos.amable * 0.4;
    if (tema === "futbolRival") q += (r() - 0.5) * 0.6;
    q = Math.max(-1, Math.min(1, q));
    const m = ctx.mercado || {};
    const v = {
      B: b.corto, gustoA: a.gusto, gustoB: b.gusto.charAt(0).toUpperCase() + b.gusto.slice(1), equipoA: a.equipo, equipoB: b.equipo, fraseA: a.frase,
      oB: b.g === "f" ? "a" : "o", emisora: m.emisora || "el IPC", movimiento: (m.cambio || 0) >= 0 ? "Subió" : "Bajó",
      cambio: m.cambio != null ? Math.abs(m.cambio * 100).toFixed(1) + "%" : "", humorMercado: (m.cambio || 0) >= 0 ? "de buenas" : "nervioso"
    };
    const lineas = [[a.id, llenar(t1, v)], [b.id, llenar(q >= 0 ? ok : mal, v)]];
    const k = Math.round(q * 6);
    return {
      tema, calidad: q, lineas,
      efecto: { rel: k, a: { animo: q * 3.5, estres: q < 0 ? -q * 6 : -q * 2.5 }, b: { animo: q * 3.5 + (tema === "apoyo" && q > 0 ? 3 : 0), estres: q < 0 ? -q * 6 : -q * 2.5 - (tema === "apoyo" && q > 0 ? 6 : 0) } }
    };
  }
  function aplicarPlatica(est, a, b, res) {
    const ea = est[a.id], eb = est[b.id];
    sentir(ea, a, res.efecto.a); sentir(eb, b, res.efecto.b);
    const v = Math.max(-100, Math.min(100, (ea.rel[b.id] || 0) + res.efecto.rel));
    ea.rel[b.id] = v; eb.rel[a.id] = v;
  }
  const NOMBRE_TEMA = { saludo: "se saludaron", cafe: "fueron por café", trafico: "se quejaron del tráfico", futbolMismo: "platicaron de su equipo", futbolRival: "se picaron con el futbol", mercado: "comentaron el mercado", felicitar: "hubo felicitaciones", apoyo: "se echaron la mano", pleito: "discutieron", chisme: "chismearon", comida: "platicaron de la comida", horasExtra: "se quejaron de las horas extra", casa: "platicaron en casa", viernes: "hicieron planes de fin de semana", noche: "platicaron de noche", frase: "bromearon" };
  function resumen(a, b, res) {
    const como = res.calidad > 0.35 ? "y se cayeron mejor" : res.calidad < -0.35 ? "y acabaron molestos" : res.calidad < 0 ? "y quedaron medio incómodos" : "";
    return `${a.corto} y ${b.corto} ${NOMBRE_TEMA[res.tema]}${como ? " " + como : ""}.`;
  }

  return { LISTA, POR_ID, estadoInicial, sentir, volverABase, humor, conversar, aplicarPlatica, resumen, rng, semillaDe, base, sonRivales };
})();
if (typeof module !== "undefined") module.exports = Personal;
