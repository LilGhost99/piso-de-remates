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

## Los agentes evolucionan

Cada agente junta experiencia (XP) revisando expedientes, consiguiendo estrategias aprobadas, operando y platicando, y sube de nivel: Novato, Aprendiz, Competente, Sólido, Senior, Experto, Mentor, Maestro y Leyenda.

- **Al subir de nivel** se estresa menos y se tiene más confianza. En 3D se nota: corbata desde el nivel 3, saco desde el 5, anillo de oro desde el 7 y corona en el 9.
- **Su personalidad cambia poco a poco** con lo que vive: las buenas pláticas lo hacen más sociable y amable, los pleitos menos, los días de mucha presión lo ponen más nervioso y las estrategias aprobadas lo vuelven más optimista. En su ficha, la rayita marca cómo llegó y la barra cómo es ahora.
- **Logros**: primera estrategia, mano caliente, ojo clínico, alma de la oficina, uña y mugre, veterano y más.
- El **Escalafón** muestra a quién le va mejor, y la bitácora avisa cada subida de nivel y cada logro.

La carrera de cada quien se guarda en `sitio/datos/estado.json` junto con sus emociones, así que sigue creciendo día con día aunque nadie tenga la página abierta.

## Qué decide el piloto solo

- **Jornada:** cada cierre revisa 160 combinaciones nuevas de estrategias sobre 16 emisoras (8 en pesos de la BMV y 8 empresas mexicanas que cotizan en EE.UU.).
- **Comité:** manda a operar las mejores de la biblioteca, máximo 8 a la vez, 2 por emisora y 2 nuevas por día. Cada una arranca con $100,000 MXN o $5,000 USD ficticios.
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
