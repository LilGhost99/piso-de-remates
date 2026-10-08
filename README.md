# Piso de Remates · piloto automático

Treinta agentes con personalidad buscan estrategias de trading en acciones mexicanas, las prueban, las operan con dinero ficticio y viven su día: llegan a la oficina, comen, platican y se van a dormir. El piloto corre solo en GitHub tres veces cada día hábil, aunque tu compu esté apagada.

| Hora (CDMX) | Qué hace |
|---|---|
| 9:10 | Apertura: ejecuta las compras y ventas pendientes |
| 12:10 | Mediodía: actualiza el valor de la cartera |
| 15:40 | Cierre: jornada de minería, el comité asigna y retira estrategias, órdenes para mañana |

Todo es simulación educativa con dinero ficticio. No es recomendación de inversión.

## Cómo subirlo (una sola vez, sin usar la terminal)

1. **Crea el repositorio.** En github.com toca **+** (arriba a la derecha) → **New repository**. Nombre: `piso-de-remates`. Déjalo en **Public** (GitHub Pages gratis solo funciona con repos públicos; todo es dinero ficticio). No marques ninguna casilla. Toca **Create repository**.
2. **Sube los archivos.** En la página del repo nuevo toca el enlace **uploading an existing file**. Abre esta carpeta en tu compu, selecciona **todo lo que hay adentro** (incluida la carpeta `.github`) y arrástralo a la página. Abajo toca **Commit changes**.
   - Revisa que aparezca la carpeta `.github`. Si no aparece: **Add file → Create new file**, escribe como nombre `.github/workflows/piloto.yml`, pega el contenido del archivo `piloto.yml` y toca **Commit changes**.
3. **Dale permiso de guardar.** **Settings → Actions → General**. Hasta abajo, en *Workflow permissions*, elige **Read and write permissions** y toca **Save**.
4. **Activa la página.** **Settings → Pages**. En *Source* elige **GitHub Actions**.
5. **Arráncalo por primera vez.** Pestaña **Actions**. Si te pide habilitar los flujos, acepta. Elige **Piloto automático** a la izquierda → **Run workflow** → en *tipo* elige `cierre` → **Run workflow**. Tarda 2 o 3 minutos.
6. **Abre tu sala:** `https://lilghost99.github.io/piso-de-remates/` (también aparece en el resumen de la corrida).

Listo. De ahí en adelante corre solo de lunes a viernes. Cuando entres, la sala te muestra lo que pasó **mientras no estabas**.

## La sala en 3D

La página abre la oficina en 3D: las salas, los escritorios, la pizarra de trading, la colonia donde viven los agentes, los autos sobre Reforma y los rascacielos al fondo. La luz sigue la hora real de la Ciudad de México (de noche se prenden los faroles, las ventanas y las salas donde hay gente).

- Arrastra para girar, usa la rueda (o dos dedos) para acercar y clic derecho para mover la cámara.
- Los botones **General**, **Oficina** y **Colonia** llevan la cámara a cada zona.
- Toca a alguien para seguirlo y abrir su ficha; toca el piso para soltarlo.
- **Plano** regresa al dibujo en 2D (también se usa solo si el navegador no puede mostrar 3D).

## ¿Cuánto hemos ganado?

Arriba de la sala hay una sección que explica, sin tecnicismos, cuánto van ganando o perdiendo las estrategias con su dinero de mentiras: el total en pesos (los dólares se convierten con el tipo de cambio del día), el último día, 7 días, 30 días, una gráfica, cómo le va a cada estrategia, la comparación con «comprar y esperar» y un glosario.

## Los agentes evolucionan

Cada agente junta experiencia (XP) revisando expedientes, consiguiendo estrategias aprobadas, operando y platicando, y sube de nivel: Novato, Aprendiz, Competente, Sólido, Senior, Experto, Mentor, Maestro y Leyenda.

- **Al subir de nivel** se estresa menos y se tiene más confianza. En 3D se nota: corbata desde el nivel 3, saco desde el 5, anillo de oro desde el 7 y corona en el 9.
- **Su personalidad cambia poco a poco** con lo que vive: las buenas pláticas lo hacen más sociable y amable, los pleitos menos, los días de mucha presión lo ponen más nervioso y las estrategias aprobadas lo vuelven más optimista. En su ficha, la rayita marca cómo llegó y la barra cómo es ahora.
- **Logros**: primera estrategia, mano caliente, ojo clínico, alma de la oficina, uña y mugre, veterano y más.
- El **Escalafón** muestra a quién le va mejor, y la bitácora avisa cada subida de nivel y cada logro.

La carrera de cada quien se guarda en `sitio/datos/estado.json` junto con sus emociones, así que sigue creciendo día con día aunque nadie tenga la página abierta.

## El trabajo real de cada quien

Cada agente hace una parte de verdad. La página lo muestra en la sección «El trabajo real de cada quien» y en la ficha de cada uno.

| Quién | Qué hace de verdad |
|---|---|
| Mineros (Lupita, Beto, Toño, Karla) | Cada uno busca en su especialidad. Las 160 pruebas del día se reparten según cómo le va **en la operación en papel** a lo que encontró cada quien |
| Análisis, Riesgos, Mesas de pruebas | Los filtros del motor: Sharpe, caída máxima, datos que no vio y variantes cercanas |
| Paco y Alejandra (Macroeconomía) | Leen el IPC real en cada cierre. Con el mercado agitado o a la baja, el comité mete menos estrategias nuevas (o ninguna) y solo las que siguen la tendencia |
| Comité (Lic. Cervantes, Ing. Robles, Dra. Paredes) | Votan cada propuesta; se necesitan 2 de 3 |
| Don Chema y Fernanda (Riesgos) | Vigilan la cartera en cada revisión, avisan qué está cerca del límite y retiran a mediodía lo que pierda 12% |
| Diego y Valeria (Noticias) | Titulares reales de Yahoo Finance y movimientos de 3% o más |
| Memo (Biblioteca) | Vuelve a probar cada semana lo guardado con datos nuevos y saca lo que ya no pasa |
| Lic. Méndez y Andrea (Cumplimiento) | Auditan límites y cuentas, y suman las comisiones pagadas |
| Charly e Ingrid (Sistemas) | Revisan que los precios lleguen completos y al día; lo viejo no se opera |
| Renata y Hugo (Trading) | Operan en la apertura: Renata la Bolsa Mexicana y Hugo Nueva York |
| Don Fermín (Archivo) | Mide qué tipo de estrategia se aprueba; con eso Lupita reparte sus pruebas |
| Don Ramón (Vigilancia) | En la apertura revisa los brincos de precio de la noche en lo que tenemos |
| Doña Lucha (Recepción) | Escribe el resumen del día |

Su experiencia sale de su trabajo y de resultados reales: quien encontró una estrategia gana o pierde experiencia según lo que esa estrategia gana o pierde cada día. Las pláticas y emociones son el ambiente de la sala; no deciden nada.

## Piensan, recuerdan y aprenden

Los que deciden (el comité, Paco, Don Chema, Diego y Doña Lucha) **piensan con IA**: usan GitHub Models, la IA gratuita de GitHub, con el permiso `models: read` del flujo. Cada uno recibe sus datos, su memoria y sus lecciones, razona con su personalidad y deja escrito por qué decidió. En la página, lo que razonaron con IA lleva 🧠.

- **Recuerdan:** cada decisión queda guardada en `estado.json` con su resultado.
- **Aprenden:** dos semanas después revisan cómo salió. Si el comité aprobó algo que perdió, quien votó a favor se vuelve más exigente; si rechazó algo que habría ganado, se afloja. Paco ajusta su prudencia según si se asustó de más o se confió; Don Chema lleva la cuenta de cuántas alertas siguieron cayendo.
- **Escriben lecciones** cada viernes y las usan para decidir después.
- **Sin IA** (si GitHub no responde o se acaba el cupo gratuito) deciden con lo que ya aprendieron. Los límites duros (máximo 8 estrategias, retiro obligatorio al perder 12%) nunca dependen de la IA.
- **Contra las reglas fijas:** las reglas de antes siguen operando «de sombra» con la misma biblioteca. La sección «¿Cuánto hemos ganado?» muestra quién va ganando.

## Qué decide el piloto solo

- **Jornada:** cada cierre revisa 160 combinaciones nuevas de estrategias sobre 16 emisoras (8 en pesos de la BMV y 8 empresas mexicanas que cotizan en EE.UU.).
- **Comité:** propone las mejores de la biblioteca y las vota (2 de 3). Máximo 8 a la vez, 2 por emisora y hasta 2 nuevas por día (menos si Paco ve el mercado agitado o a la baja). Cada una arranca con $100,000 MXN o $5,000 USD ficticios.
- **Retiro:** quita una estrategia si pierde 12% o si después de 30 días va perdiendo más de 4%.
- **Operación:** la señal se decide con el precio de cierre y se ejecuta en la apertura del día siguiente, con 0.25% de comisión más IVA.

Las reglas están al inicio de `piloto/piloto.js` (objeto `REGLAS`) y las emisoras al inicio de `piloto/descargar.py`. Si cambias algo, súbelo igual: **Add file → Upload files** y arrastra el archivo nuevo.

## Archivos

- `sitio/index.html`: la sala que ves en el navegador.
- `sitio/datos/estado.json`: la memoria del piloto (cartera, bitácora, emociones, pláticas). Lo escribe el piloto; no lo edites.
- `piloto/`: el piloto (`descargar.py` baja precios de Yahoo Finance, `piloto.js` hace todo lo demás).
- `.github/workflows/piloto.yml`: los horarios.

## Si algo falla

- En **Actions** cada corrida tiene una palomita verde o una X roja. Toca la X para ver el error.
- Si Yahoo Finance no responde, la corrida falla y el piloto lo intenta en la siguiente hora programada.
- Los días festivos la bolsa no abre; el piloto lo nota y no opera.
- GitHub a veces corre las tareas programadas con unos minutos de retraso.
