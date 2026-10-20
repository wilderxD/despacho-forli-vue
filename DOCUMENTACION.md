# Forli Despacho — Documentación del Frontend

Documentación funcional y técnica de la aplicación web **Forli Despacho** (`frontend-vue`), un sistema para la preparación, despacho e historial de pedidos de colchones (líneas Resorte "C.R." y Espuma "C. Espuma").

---

## 1. Resumen general

### 1.1 Stack tecnológico

| Tecnología | Uso |
|---|---|
| Vue 3 (Composition API, `<script setup>`) | Framework de UI |
| TypeScript | Tipado estático |
| Vite | Bundler y servidor de desarrollo |
| Pinia | Gestión de estado (3 stores) |
| Vue Router 4 | Enrutamiento SPA (historial HTML5) |
| Tailwind CSS 4 | Estilos utilitarios (con modo oscuro por atributo `data-theme`) |
| Lucide Vue Next | Iconografía |
| SortableJS | Reordenamiento por drag & drop del carrito |
| sass-embedded | Soporte Sass en build |

### 1.2 Conexión con el backend

- La app consume la API de **Google Apps Script** directamente (`src/environments.ts`, `apiUrl` + `apiToken`).
- Todas las respuestas siguen el envoltorio `{ ok: true, data }` / `{ ok: false, error }` (`src/models/api-response.model.ts`).
- El cliente (`src/api/api.service.ts`) aplica: timeout de 180 s, **reintento automático** en GET (2 intentos con esperas de 1 s y 3 s) ante errores de red, 404, 429 o 5xx, errores tipados con `ApiError` y **progreso de descarga real** (`useProgress`, con % para las barras de carga de pedidos e historial).

### 1.3 Rutas de la aplicación

| Ruta | Vista | Descripción |
|---|---|---|
| `/` | — | Redirección a `/preparar` |
| `/preparar` | `views/PrepararView.vue` | Preparación de pedidos (marcar y armar carrito) |
| `/despachar` | `views/DespacharView.vue` | Despacho de pedidos ya preparados |
| `/historial` | `views/HistorialView.vue` | Historial de despachos por fecha |
| `/*` | — | Cualquier ruta desconocida redirige a `/preparar` |

> **Nota:** esta versión está **alineada con la app de escritorio** (`despacho-desktop`, Electron). Se conservan como propias de la web el historial de rutas limpio (`createWebHistory`) y la impresión mediante pestaña del navegador.

### 1.4 Flujo de negocio principal

1. **Preparar**: el usuario filtra pedidos, los marca como "preparados" y agrega los items al carrito ("Preparación").
2. **Despachar**: con el carrito armado, selecciona chofer y placa, guarda el despacho en la API e imprime la hoja de despacho.
3. **Historial**: consulta, reedita, reimprime o elimina despachos ya guardados.

---

## 2. Pantalla `/preparar` — `PrepararView.vue`

Pantalla de trabajo principal para preparar pedidos antes del despacho.

### 2.1 Componentes que la forman

| Componente | Rol |
|---|---|
| `FiltrosBar` (`tab="prep"`) | Barra superior de filtros independiente para la pestaña de preparación |
| `UbigeoTree` (`mode="prepare"`) | Árbol de pedidos agrupados por Ubigeo → Agencia → Cliente → Pedido |
| `CartPanel` | Panel derecho con el carrito de preparación |

### 2.2 Funcionalidades

- **Búsqueda rápida** (`txtBuscarPrep`): campo que filtra en vivo por cliente, número de pedido o producto (además de los filtros de la barra superior).
- **Contador de progreso**: muestra `preparados / total` de pedidos y la hora de la última actualización de datos.
- **Filtro de procesados**: los pedidos ya despachados en la sesión (`processed`) quedan excluidos del árbol.
- **Botón "Ir a Despachar"**: navegación directa a `/despachar`.
- **Estado de error con reintento**: si falla la carga de pedidos, muestra mensaje y botón "Reintentar" (`resourcesStore.loadPedidosAll()`).
- **Panel móvil por pestañas**: en pantallas `< lg` alterna entre "Pedidos" (árbol) y "Preparación" (carrito); en escritorio se muestran ambos en paralelo (50/50).
- **Icono de conteo en el carrito**: la pestaña "Preparación" muestra el badge con la cantidad de pedidos en el carrito.

### 2.3 Datos que calcula

- `grupos`: pedidos filtrados (texto + filtros activos + excluir procesados) agrupados por ubigeo con `agruparPorUbigeo()`, usando el campo de fecha seleccionado (`PEDIDOFECHA` o `FECHAENTREGA`).

---

## 3. Pantalla `/despachar` — `DespacharView.vue`

Pantalla para armar el despacho definitivo a partir de los pedidos preparados.

### 3.1 Componentes que la forman

| Componente | Rol |
|---|---|
| `FiltrosBar` (`tab="desp"`) | Filtros independientes para la pestaña de despacho |
| `UbigeoTree` (`mode="dispatch"`) | Árbol que solo muestra pedidos **preparados** |
| `CartPanel` | Carrito con chofer/placa e impresión |

### 3.2 Funcionalidades

- **Fuente de datos restringida**: el árbol se construye únicamente desde `estadoStore.preparedItems` (pedidos marcados como preparados en la sesión actual).
- **Búsqueda en despacho** (`txtBuscarDespacho`): filtro de texto en vivo sobre los pedidos preparados.
- **Indicadores de estado en el árbol (modo `dispatch`)**:
  - `EN LISTA ✓`: pedido presente en el carrito.
  - `EN RUTA`: pedido ya despachado (procesado) en la sesión.
  - Badge "N en ruta" a nivel de ubigeo.
- **Panel móvil por pestañas**: mismo comportamiento responsive que en Preparar.

---

## 4. Pantalla `/historial` — `HistorialView.vue`

Consulta y gestión de los despachos guardados en el servidor.

### 4.1 Estructura

Tabla dentro de una tarjeta redondeada, con encabezado de filtros, cuerpo paginado y pie de paginación.

### 4.2 Funcionalidades

- **Filtro por fecha**: selector `type="date"` que recarga historial y total al cambiar (resetea a página 1).
- **Paginación**: 50 registros por página (`PAGE_SIZE`), con paginación inteligente (muestra `1 … n-1 n n+1 … última` cuando hay más de 5 páginas) y botones Anterior/Siguiente.
- **Polling automático**: consulta `historial_count` cada 30 s; si el total cambia, **no recarga solo**: muestra el indicador ámbar "Hay datos nuevos — pulsa Recargar". Se detiene al salir de la pantalla (`onUnmounted`). Muestra "Actualizado hace Xs/Xm/Xh".
- **Botón "Recargar" (acotado al historial)**: ejecuta `reloadHistorial()`, que fuerza la recarga de historial + conteo desde el servidor, los persiste en `localStorage` y limpia el indicador "Hay datos nuevos". **No toca meta ni pedidos** (a diferencia del "Recargar" global de `FiltrosBar` en Preparar/Despachar).
- **Alta local de despachos**: cada hoja guardada desde el panel de Preparación se añade de inmediato al historial (`addHistorialRecord`) con los datos reales devueltos por el servidor (ID `C-…`, fecha, chofer, placa, items), incrementando también el contador/badge del nav, sin esperar a servidor ni polling. El guardado real en el Google Sheet lo sigue haciendo el backend (acción `guardar` → pestaña `HOJASCARGA`).
- **Caché local persistente**: cada carga por red se guarda en `localStorage` (`forli_historial_last_v1`); al cambiar de pestaña o reiniciar la app, los datos ya cargados se visualizan de inmediato (sin spinner) y el polling actualiza en segundo plano.
- **Filas expandibles**: al hacer click en una fila se despliega el detalle con dos columnas:
  - **Preparados**: artículos preparados del despacho (ícono ✓ verde).
  - **No Preparados**: artículos faltantes (✕ rojo) o mensaje "Todos los artículos preparados".
- **Columna "Prep."**: porcentaje de artículos preparados del despacho (verde 100 %, ámbar parcial, gris 0 %), basado en `dispatchPrepared` de la sesión.
- **Acciones por registro** (con detención de propagación del click):
  - **Reimprimir** (🖨): regenera la hoja de despacho imprimible con `reimprimir()`.
  - **Editar** (✏): confirma con modal → carga los items del despacho al carrito (`setCartOrder` + `persistCart`), restaura chofer/placa en el store de estado y navega a `/despachar`.
  - **Eliminar** (🗑): confirma con modal → llama a la acción API `eliminar` (borra la fila en el Sheet), quita el registro del despacho en la sesión y recarga **solo el historial** (`reloadHistorial`).
- **Columnas de la tabla**: chevron de expansión, ID, Fecha, Chofer, Placa, C.E. (colchones de espuma, violeta), C.R. (resortes, cian), Prep. y Acciones.
- **Estados de carga y vacío**: spinner con barra de progreso (`LoadingSpinner` + `ProgressLine`) mientras carga, caja roja con el error, e ícono de reloj con "No hay despachos para esta fecha" si el resultado está vacío.

---

## 5. Componentes compartidos

### 5.1 `App.vue` — Shell de la aplicación

- **Barra de navegación superior** (52 px):
  - Marca "Forli Despacho" con ícono de camión (enlaza a `/preparar`).
  - Links a Preparar (badge con conteo de preparados), Despachar e Historial (badge con total de registros del día).
  - Botón de **modo oscuro/claro**: alterna atributo `data-theme` + `colorScheme`, persiste en `localStorage` (`forli_theme`) y respeta `prefers-color-scheme` al iniciar.
- **Atajo de teclado `/`**: fuera de inputs, enfoca el buscador de la pantalla activa (`txtBuscarDespacho` o `txtBuscarPrep`).
- **Carga inicial de datos**: `resourcesStore.loadAll()` (meta + pedidos) al montar.
- **Hosts globales**: monta `ToastHost` y `ModalHost` (teleportados al body).
- **Responsive**: en pantallas ≤480 px oculta el texto de la marca y reduce el padding de los links.

### 5.2 `FiltrosBar.vue` — Barra de filtros

Recibe `tab: 'prep' | 'desp'` y opera sobre el bloque de filtros correspondiente del store (filtros independientes por pestaña). Controles:

- **Fecha desde / Fecha hasta** (inputs `type="date"`).
- **Conmutador de campo de fecha**: `F.Pedido` (`PEDIDOFECHA`) vs `F.Entrega` (`FECHAENTREGA`); la selección se persiste en `localStorage` (`forli_campo_fecha_prep/desp`).
- **Línea / tipo de colchón**: `Todos` | `C.R. (Resorte)` | `C. Espuma`.
- **Supervisores** (dropdown multiselección con checkboxes): lista cargada desde `meta.supervisores`; badge con la cantidad de opciones **excluidas**; botón "Aplicar" para cerrar.
- **Estados** (dropdown multiselección): ídem con `meta.estados`.
- **Limpiar Filtros**: resetea el bloque de filtros de la pestaña.
- **Recargar**: `resourcesStore.refresh()` (invalida caché del servidor y recarga todo).
- Layout en grilla responsive (2/3/6 columnas según breakpoint).

### 5.3 `UbigeoTree.vue` — Árbol de pedidos

Árbol jerárquico de 4 niveles con `role="tree"` y estados de carga/vacío:

**Niveles y encabezados:**

1. **Ubigeo** (header indigo con ícono 📍): total de pedidos; en modo `prepare` muestra `preparados/total` y cantidad en carrito; en modo `dispatch` total, en carrito y "N en ruta". Al expandir, en modo `prepare` aparece el botón **"Preparar todos"** (marca todos los pedidos no preparados del ubigeo).
2. **Agencia** (header gris con ícono 🏬): contador de pedidos (`preparados/total` en prepare, `N ped.` en dispatch).
3. **Cliente** (borde izquierdo indigo, ícono 👤): cantidad de pedidos y ✓ verde si todos están preparados.
4. **Pedido** (fila con badges): número de pedido, estado (`✓ LISTA` en carrito / `EN RUTA` procesado / tachado si procesado), fecha (según campo de fecha activo), estado del pedido, contadores de unidades `E:n` (colchones de espuma) y `R:n` (resortes), cantidad de ítems, y botones:
   - 🏠 **Dirección de llegada** (modal informativo si existe; opaco si está vacía).
   - 👁 **Observación** (rojo si hay observación → modal informativo; opaco `EyeOff` si no hay).

**Tabla de ítems del pedido**: lista producto + cantidad de cada línea.

**Acciones por pedido:**

- Modo `prepare`: botón **"Preparar" / "✓ Preparado"** (alterna el estado) y botón **"AGREGAR (+)"** para pasarlo al carrito (deshabilitado si ya está en carrito `EN LISTA ✓` o si ya fue despachado `EN RUTA`).
- Modo `dispatch`: solo el botón AGREGAR / EN LISTA / EN RUTA.

**Pintura por estado:** borde/ fondo verde esmeralda si está en carrito; gris si ya fue procesado.

### 5.4 `CartPanel.vue` — Panel de preparación/despacho

Panel lateral derecho con el carrito de pedidos:

- **Header indigo**: ícono 🛒 "Preparación" + badges de totales `N Esp` (colchones de espuma) y `N Res` (resortes) + botón **Reiniciar sesión** 🔄 (confirmación → limpia carrito, procesados, preparados, chofer, placa y `localStorage`).
- **Selección de Chofer y Placa**: dos `<select>` alimentados por `meta.choferes` y `meta.placas`.
- **Barra de progreso**: `pedidos en carrito / total del día` con porcentaje.
- **Lista del carrito agrupada**: Agencia → Cliente → Pedido, **reordenable con drag & drop** (SortableJS):
  - Arrastre de agencias (handle en el header) y de clientes dentro de cada agencia.
  - Tras soltar, se reconstruye el orden leyendo el DOM y se persiste (`setCartOrder` + `persistCart`).
  - Headers de agencia y cliente plegables/contraíbles.
  - Cada item muestra cantidad + producto con botón ✕ para **quitar del carrito**.
- **Estado vacío**: ícono de bandeja + "Selecciona pedidos del panel izquierdo".
- **Footer**: total de pedidos y botón **"IMPRIMIR HOJA"** 🖨:
  - Validaciones previas (toast de advertencia): chofer requerido, placa requerida, carrito no vacío.
  - `guardar`: envía `{ chofer, placa, items }` a la API (**el backend escribe la fila en la hoja `HOJASCARGA` del Google Sheet**), añade el registro al historial local (`addHistorialRecord`), marca los pedidos como despachados (`markDispatched`), registra el conteo de preparación del despacho y **genera la hoja imprimible** (`print.service.generar`).
  - Toast de éxito, o toast de error con botón **"Reintentar"**.

### 5.5 `ModalHost.vue` + `modal.service.ts`

- Servicio con estado global para modales tipo **confirm** (promise-based: Cancelar/Aceptar, variante peligrosa en rojo) e **info** (solo "Cerrar").
- `ModalHost` se teletransporta al `body`, se cierra con `Escape`, click en el backdrop o el botón ✕; accesibilidad con `role="dialog"` y `aria-modal`.

### 5.6 `ToastHost.vue` + `useToast.ts`

- Sistema de notificaciones flotantes (esquina inferior derecha, `aria-live="polite"`).
- Tipos: `success` (verde), `danger` (rojo), `warning` (ámbar).
- Auto-cierre a los 4 s **salvo** que lleve acción adjunta (p. ej. "Reintentar"), que se ejecuta al hacer click y cierra el toast.

---

## 6. Capa técnica

### 6.1 Stores Pinia

| Store (`src/stores/`) | Responsabilidad |
|---|---|
| `resources.store.ts` | Datos remotos: `meta` (totales, estados, supervisores, choferes, placas), `pedidosAll` (pedidos agrupados por ubigeo), historial paginado + conteo, loading/errores por recurso, polling del historial (30 s con indicador `historialHasNew`), `refresh()` global con toasts de diagnóstico y **acciones acotadas al historial**: `reloadHistorial()` (fuerza historial + conteo, persiste y limpia el indicador) y `addHistorialRecord()` (alta local de un despacho guardado). Caché del historial en memoria (fecha\|página, máx. 50 entradas) **persistida en `localStorage`** (`forli_historial_last_v1`) y restaurada al inicio para visualización instantánea. `historialFecha` inicia con la fecha de hoy. |
| `filtros.store.ts` | Bloques de filtros **independientes** para preparación (`prep`) y despacho (`desp`): texto, estados[], supervisores[], rango de fechas, campo de fecha y línea. Persiste el campo de fecha en `localStorage`. Expone `isoFieldPrep/Desp` para elegir `fechaISO` o `fechaEntregaISO`. |
| `estado.store.ts` | Estado de la **sesión de trabajo** con persistencia automática en `localStorage` (sobrevive al cerrar la app): items preparados, carrito, pedidos procesados (despachados), conteo de preparación por despacho (`dispatchPrepared`), chofer y placa. Acciones clave: `togglePrepare`, `addToCart/removeFromCart`, `isInCart/isProcessed`, `setCartOrder`, `markDispatched` (calcula preparados/no preparados, marca procesados y vacía el carrito), `resetSession`, `persistCart`. Contadores computados: pedidos preparados, pedidos en carrito, totales de espuma y resorte. |

**Claves de persistencia (localStorage):** `forli_prepared_items`, `forli_cart`, `forli_processed`, `forli_dispatch_prep_<id>`, `forli_historial_last_v1`.
**Claves de preferencia (localStorage):** `forli_theme`, `forli_campo_fecha_prep`, `forli_campo_fecha_desp`.

### 6.2 Servicios

- **`api/api.service.ts`**: `apiGet(action, params)` y `apiPost(action, body)` con token, timeout de 180 s, reintentos en GET y desempaque del envoltorio `{ ok, data, error }` → lanza `ApiError` con código y mensaje. El POST usa `Content-Type: text/plain` (compatibilidad con Apps Script). Expone `useProgress(scope)`: seguimiento del **progreso de descarga** (lectura del `body` con `ReadableStream` + `content-length`, throttle 100 ms) por ámbito (`pedidos` | `historial`), que alimenta las barras `ProgressLine`.
- **`services/print.service.ts`**:
  - `generar(GuardarResult)`: construye (función auxiliar `buildHtml`) un documento HTML completo de **"HOJA DE DESPACHO"** (paisaje, márgenes 5 mm) y lo abre en una pestaña nueva que **auto-imprime** (`window.onload = window.print()`). Es `async` y usaría `window.api.printHtml` si existiera (en la web no existe → fallback a la pestaña del navegador). Incluye: encabezado con ID/fecha, tabla de info (chofer, placa, pedidos, items), tabla de items editable (`contenteditable` en #, agencia, código, producto y cantidad) con separadores de grupo y filas alternas, celdas de verificación ☐☐, firmas (Supervisor, Ayudante 1, Ayudante 2) y sección de **Observaciones por pedido**.
  - La barra superior de la hoja (oculta al imprimir) tiene **"Guardar cambios"** que recolecta las ediciones de la tabla y las envía a la acción API `actualizar`.
  - `reimprimir(HistorialRecord)`: adapta un registro del historial y reutiliza `generar()`.
- **`services/modal.service.ts`** y **`composables/useToast.ts`**: descritos en §5.5 y §5.6.

### 6.3 Utilidades (`utils/pedido-utils.ts`)

- `aplicaFiltros` / `filtrarPedidos`: aplica texto (cliente/pedido/producto), estados, supervisores, rango de fechas ISO y línea (RESORTE, o ESPUMA + producto que contenga "COLCHON").
- `agruparPorUbigeo`: agrupa `Pedido[]` en `UbigeoGroup → AgenciaGroup → ClienteGroup → PedidoItems`, ordenando por fecha descendente dentro de cliente y alfabéticamente el resto.
- `contarPreparadosPorUbigeo`: conteo de pedidos preparados por ubigeo.

### 6.4 Modelos (`src/models/`)

- `pedido.model.ts` — `Pedido`: unidad atómica (`idUnico`, pedido, cliente, producto, cantidad, supervisor, estado, ubigeo, agencia, dirección, código de venta, línea, observación, fecha/fechaEntrega con sus versiones ISO).
- `meta.model.ts` — `MetaData`: catálogos y totales servidos por la acción `meta`.
- `despacho.model.ts` — `PedidosAll`, `GuardarPayload/Result`, `ActualizarResult`, `HistorialRecord`, `DispatchPrep`, `ProcessedEntry`.
- `api-response.model.ts` — envoltorio de la API.

### 6.5 Endpoints usados (acciones de la API)

`meta`, `pedidos_all`, `refresh`, `historial`, `historial_count`, `guardar`, `actualizar` y `eliminar`.

---

## 7. Observaciones

### 7.1 Correcciones incorporadas (alineación con la app de escritorio)

- **"Editar" del historial**: corregido. Antes llamaba a un método inexistente (`resourcesStore.loadToCart(r.id)`) y fallaba en tiempo de ejecución; ahora usa `estadoStore.setCartOrder(r.items)` + `persistCart()` y restaura chofer/placa en el store de estado.
- **`UploadExcel.vue` eliminada**: no estaba registrada en el router (no accesible desde la interfaz) e importaba una función `apiUpload` inexistente en el servicio de API.

### 7.2 Otras notas menores

- `CartPanel.vue` declara imports no utilizados (`Store`, `User`; `watch` sí se usa).
- El borrado de despachos desde el historial no repone los pedidos en el árbol de despacho: los pedidos "EN RUTA" permanecen tachados en la sesión hasta usar "Reiniciar sesión" en el carrito.
- La edición de la hoja impresa ("Guardar cambios") llama a `actualizar` directamente desde el HTML generado, sin pasar por el store de la SPA; los cambios no se reflejan automáticamente en la tabla del historial abierta (vuelven con la siguiente recarga).
- Las columnas "C.E." y "C.R." de la tabla del historial muestran los totales de **colchones de espuma** (`espumas`) y **resortes** (`resortes`) calculados por el backend. Antes referenciaban campos inexistentes (`cargaEntregada`/`cargaRecibida`) y salían vacías; corregido en la web y en la app de escritorio.
