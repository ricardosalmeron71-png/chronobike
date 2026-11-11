# 📘 Manual de usuario · ChronoBike 2.0

> Este manual tiene **3 partes**. Ve directo a la tuya:
>
> | | Parte | Para |
> |---|---|---|
> | 👀 | [A. Ver resultados](#parte-a--ver-resultados-público) | Corredores, familias, público |
> | ⏱️ | [B. Cronometrar una carrera](#parte-b--cronometrar-registrador) | Registradores en la meta |
> | 🛠️ | [C. Administrar](#parte-c--administrar-administrador) | Organizadores |
>
> Todas las imágenes usan **datos ficticios** del modo demostración.

### Símbolos de este manual
| Símbolo | Significa |
|:-:|---|
| 👆 | Toca o haz clic |
| ✅ | Resultado esperado |
| ⚠️ | Cuidado |
| 💡 | Consejo |

### Colores de estado
| Etiqueta | Significado |
|---|---|
| 🟢 **META** | Completó todas sus vueltas. Tiene tiempo oficial. |
| 🟡 **EN PISTA** | Lleva al menos una vuelta y sigue corriendo. |
| ⚪ **SIN PASO** | Todavía no cruza la meta (o no se presentó). |
| 🟢 `00:17:23` en verde lima | Su **mejor vuelta**. |

---

## PARTE A · Ver resultados (público)

### A1. Abrir la app
Abre en tu celular el enlace que comparte el organizador (ejemplo: `https://tu-serial.netlify.app`). No necesitas cuenta ni descargar nada.

💡 En el celular: menú del navegador → **"Agregar a pantalla de inicio"**. Así queda como una app.

![Pantalla de inicio](img/01-publico-inicio.png)

| # | Zona | Para qué sirve |
|:-:|---|---|
| 1 | **Buscador** (arriba a la derecha) | Encuentra a un corredor por nombre, dorsal o equipo |
| 2 | **Eventos** (tarjetas) | El que dice **EN VIVO** está ocurriendo ahora. Desliza para ver los anteriores y los próximos. |
| 3 | **Resumen** | Corredores inscritos, en meta, en pista, categorías y pasos registrados |
| 4 | **Podios / Clasificación / Últimos pasos** | Tres formas de ver el evento |
| 5 | **Categorías** (chips de colores) | Filtra una sola categoría |

### A2. Ver los podios 🏆
👆 Toca **Podios**. Cada categoría muestra a sus 3 primeros con medalla 🥇🥈🥉, tiempo oficial y diferencia con el ganador.

![Podios en vivo](img/02-publico-podios.png)

✅ Si la carrera sigue en curso, verás *"X corredor(es) en pista. El podio aparecerá cuando crucen la meta"*.

### A3. Ver eventos anteriores 📅
👆 Toca la tarjeta de un evento **Finalizado**. Toda la página cambia a ese evento.

![Podios de un evento anterior](img/03-publico-historial-podios.png)

### A4. Clasificación completa 📊
👆 Toca **Clasificación** y elige una categoría.

![Clasificación](img/04-publico-clasificacion.png)

| Columna | Qué significa |
|---|---|
| **Pos** | Lugar en su categoría (oro, plata y bronce resaltados) |
| **Corredor** | Nombre, dorsal y equipo |
| **Progreso** | Barritas: vueltas hechas contra vueltas requeridas |
| **V1, V2…** | Tiempo de cada vuelta |
| **Tiempo** | Tiempo oficial (desde la salida hasta su última vuelta válida) |
| **Dif.** | Cuánto le falta para alcanzar al primer lugar |

### A5. Ficha de un corredor 👤
👆 Toca a cualquier corredor, en el podio o en la tabla.

![Detalle del corredor](img/05-publico-detalle-corredor.png)

✅ Verás posición, tiempo oficial, mejor vuelta, velocidad promedio y una gráfica de barras de cada vuelta con la hora en que cruzó la meta.

### A6. Buscar 🔎
Escribe en el buscador: un nombre (`Lucía`), un dorsal (`25`) o un equipo (`Halcones`).

![Buscar](img/06-publico-buscar.png)

### A7. Últimos pasos por meta 🏁
👆 Toca **Últimos pasos** para ver quién va cruzando la meta, en tiempo real.

![Últimos pasos](img/07-publico-ultimos-pasos.png)

### A8. Compartir e imprimir
- 👆 **Compartir**: envía el enlace del evento por WhatsApp. Se abre directo en ese evento y esa categoría.
- 👆 **Imprimir**: genera una hoja limpia para imprimir o guardar en PDF.

### A9. En el celular 📱
<img src="img/08-publico-movil.png" width="300">

---

## PARTE B · Cronometrar (registrador)

### B1. Entrar
👆 **Acceso staff** (arriba a la derecha), o abre directamente `.../admin.html`.

![Login](img/10-login.png)

1. Escribe tu **correo** y tu **contraseña** (te los da el administrador).
2. 👆 **Entrar**.

⚠️ Si aparece *"Tu usuario no está dado de alta como staff"*, pide al administrador que te agregue.
💡 En el **modo demo**: `registro@demo.mx` o `admin@demo.mx`, contraseña `demo`.

### B2. La pantalla del cronómetro
![Cronómetro](img/11-crono.png)

| Zona | Qué es |
|---|---|
| Arriba, **selector de evento** | Qué carrera estás cronometrando. ⚠️ Revisa que sea la correcta. |
| Arriba, **reloj** | Hora del teléfono. Todos los pasos usan esta hora. |
| Arriba, **punto de color** | 🟢 Sincronizado · 🟡 Enviando pendientes · 🔴 Sin conexión |
| Izquierda, **pantalla DORSAL + teclado** | Donde registras |
| Derecha, **Salidas por categoría** | Hora de salida de cada categoría |
| Derecha, **Últimos pasos** | Lo último registrado, con su vuelta y tiempo |

### B3. Dar la salida 🏁 (antes de que arranquen)
Cada categoría necesita su **hora de salida**. Hay 3 formas:

| Situación | Qué hacer |
|---|---|
| Todas salen juntas | 👆 **Salida a pendientes** justo en el disparo. Se aplica a todas las categorías que aún no tienen salida. |
| Salen por oleadas | 👆 el botón ▶ naranja de **cada categoría** en el momento de su salida |
| Se te pasó o fue a otra hora | 👆 ✏️ de la categoría y escribe la hora exacta |

![Editar salida](img/16-crono-salida.png)

✅ La categoría muestra ✅ y la hora: `4 V · ✅ 09:24:00`.
💡 Si una categoría no tiene salida propia, se usa la **salida general** del evento.
💡 En ✏️ también puedes cambiar **cuántas vueltas** tiene esa categoría **solo en este evento**.

### B4. Registrar un paso por meta ⏱️ (lo más importante)

**Paso 1.** Cuando el ciclista cruce la meta, teclea su **dorsal**.

![Teclear dorsal](img/12-crono-dorsal.png)

✅ La pantalla se pone **verde** y te muestra **quién es**, su categoría y **qué vuelta va a registrar** (`V2 de 2`).

**Paso 2.** 👆 **REGISTRAR PASO** (o presiona `Enter` en computadora).

![Paso registrado](img/13-crono-registrado.png)

✅ Suena un *bip*, el celular vibra y aparece arriba: `#20 Valeria · V2/2 · 00:24:43`.
✅ Si completó su última vuelta aparece **🏁 TERMINÓ** con su tiempo oficial.
✅ El paso aparece primero en **Últimos pasos** y, en 1 o 2 segundos, en los celulares del público.

💡 **La hora se toma en el momento en que tocas REGISTRAR**, no cuando confirmas un aviso. Si ves llegar a varios juntos, teclea y registra uno por uno sin pausa.

| Botón | Hace |
|---|---|
| `C` | Borra todo el número |
| ⌫ | Borra el último dígito |

### B5. Avisos que puedes ver ⚠️

**Paso duplicado.** El mismo dorsal se registró hace menos de 30 segundos:

![Duplicado](img/14-crono-duplicado.png)

- Si fue un doble toque, 👆 **Cancelar**.
- Si de verdad volvió a pasar, 👆 **Sí, registrar**.

**Dorsal no registrado.** La pantalla se pone **amarilla**:

![No registrado](img/15-crono-no-registrado.png)

Puedes registrar el paso de todos modos; **no se pierde**. Después, da de alta al corredor con ese dorsal (sección B7) y su tiempo aparecerá solo.

**Ya terminó.** El corredor ya completó todas sus vueltas. Un paso extra **no cuenta** para el tiempo oficial.

### B6. Corregir un error 🗑️
En **Últimos pasos**, 👆 el bote de basura del paso equivocado y confirma.
✅ Los tiempos se recalculan solos.

### B7. Inscribir un corredor el día de la carrera
👆 **Corredores** → **Inscribir corredor**.

![Formulario corredor](img/23-corredor-form.png)

1. **Dorsal**: la app sugiere el siguiente libre.
2. **Categoría** y **Nombre completo** (obligatorios).
3. **Equipo**: escribe o elige uno. Si no existe, se crea. Si se escribe distinto (`HALCONES mtb`), se une al equipo existente.
4. **Foto** (opcional): 👆 **Tomar foto** usa la cámara.
5. 👆 **Guardar corredor**.

### B8. En el celular 📱
<img src="img/17-crono-movil.png" width="280"> <img src="img/18-crono-movil-registrado.png" width="280">

Menú inferior: **Cronómetro · Corredores · Resultados · Más**. En **Más** puedes cambiar de evento y cerrar sesión.

### B9. ¿Y si se va el internet? 📶
**Sigue registrando normal.** Cada paso se guarda en el teléfono y el indicador pasa a 🔴 *Sin conexión · 3 pendientes*. Al volver la señal se envían solos (🟡 → 🟢).
⚠️ **No cierres sesión ni borres los datos del navegador** mientras haya pendientes.

---

## PARTE C · Administrar (administrador)

El administrador ve, además: **Eventos, Categorías, Equipos e Importar y ajustes**.

### C1. Eventos 📅
![Eventos](img/20-eventos.png)

- 👆 **Nuevo evento**: nombre, sede, fecha, **hora de salida general**, km por vuelta (para la velocidad) y estado.
- 👆 **Cronometrar**: lo vuelve el evento activo de **este dispositivo**.
- 👁️ abre la vista pública de ese evento.

![Formulario de evento](img/21-evento-form.png)

| Estado | Qué pasa en la vista pública |
|---|---|
| **Próximo** | Aparece como próximo, con su fecha y hora |
| **EN VIVO** | Aparece primero, con el indicador pulsante |
| **Finalizado** | Pasa al historial |

💡 El día de la carrera: en el Cronómetro, 👆 **Marcar evento EN VIVO**. Al terminar: **Resultados → Cerrar evento**.

### C2. Corredores 🚴
![Corredores](img/22-corredores.png)

Busca, filtra por categoría, edita ✏️ o elimina 🗑️. Al eliminar un corredor **se conservan sus pasos**.

### C3. Categorías 🗂️
![Categorías](img/24-categorias.png)

Cada categoría tiene **nombre**, **vueltas por defecto** y **color** (el color se usa en podios, tablas y dorsales).

![Editar categoría](img/25-categoria-form.png)

💡 La **hora de salida no va aquí**: se da en cada evento desde el Cronómetro. Así un mismo catálogo sirve para todo el serial.

### C4. Equipos 👥
![Equipos](img/26-equipos.png)

Renombra o elimina equipos. Al eliminar uno, sus corredores quedan como *Independiente*.

### C5. Resultados y exportación 🏆
![Resultados](img/27-resultados.png)

| Botón | Hace |
|---|---|
| **Exportar Excel (CSV)** | Descarga la clasificación completa: categoría, posición, dorsal, corredor, equipo, vueltas, tiempos por vuelta, tiempo oficial, diferencia y estado |
| **Imprimir / PDF** | Hoja lista para pegar en la meta o publicar |
| **Cerrar evento** | Lo marca como Finalizado |

![Tabla de resultados](img/28-resultados-tabla.png)

### C6. Importar el Excel actual 📥
👆 **Importar y ajustes** → arrastra tu archivo `.xlsx`.

![Importar](img/29-importar.png)

La app lee las hojas **CORREDORES** (`dorsal, name, category, team`), **CATEGORIAS** (`name, laps`) y **Equipos** (`name`), el mismo formato del sistema anterior. Muestra cuántos registros encontró. 👆 **Importar ahora**.

✅ Los dorsales existentes se actualizan. Las filas sin nombre se omiten. Los equipos duplicados se unifican.

### C7. Respaldo 💾
👆 **Descargar respaldo completo (JSON)** después de cada evento. Guarda todo: eventos, corredores, categorías, equipos y todos los pasos.

### C8. Dar de alta al staff 🔐
Se hace en Supabase. Ver [Base de datos y despliegue § 4](BASE_DE_DATOS_Y_DESPLIEGUE.md#4-crear-usuarios-del-staff).

| Rol | Puede |
|---|---|
| **admin** | Todo |
| **registrador** | Cronómetro (salidas y pasos), Corredores (alta y edición), Resultados |

---

## ❓ Preguntas frecuentes

| Pregunta | Respuesta |
|---|---|
| ¿Cómo se calcula el tiempo oficial? | Hora de su última vuelta requerida menos la hora de salida de su categoría. |
| ¿Por qué un corredor no aparece en el podio? | Le faltan vueltas (está EN PISTA) o su categoría no tiene salida. |
| Registré pasos antes de dar la salida, ¿qué pasa? | Esos pasos se ignoran. Si la salida real fue antes, corrígela con ✏️ y los tiempos se recalculan. |
| ¿Pueden registrar 2 personas a la vez? | Sí, en celulares distintos y con el mismo evento activo. |
| ¿Se puede usar en una pantalla grande en la meta? | Sí: abre la vista pública en una laptop conectada a la TV. Se actualiza sola. |
| ¿Qué tan exacta es la hora? | Usa el reloj del teléfono, con milisegundos. 💡 Activa "hora automática" en todos los celulares del staff. |
