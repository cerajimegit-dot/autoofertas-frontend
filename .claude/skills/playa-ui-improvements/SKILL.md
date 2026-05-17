---
name: playa-ui-improvements
description: Aplicar mejoras de UI/UX al frontend de Playas Autos (React+Tailwind, sin build). Triggea cuando el usuario pide pulir, mejorar la apariencia, hacer mobile-friendly, agregar quick wins de experiencia de usuario, reemplazar alerts feos, agregar toasts, loading skeletons, empty states, atajos de teclado, branding, badges consistentes, o "venderlo mejor". Usar SIEMPRE cuando se mencione UI, UX, mobile, responsive, accesibilidad, look & feel, diseño, polish, o cuando el usuario quiera que el sistema "se vea más profesional" en este proyecto.
---

# Mejoras de UI/UX para Playas Autos

Este skill captura las convenciones y patrones para mejorar la experiencia de usuario del frontend de Playas Autos sin romper su arquitectura no-build.

## Contexto del proyecto

**Stack:**
- React 18 cargado por CDN (sin npm, sin build).
- Babel standalone compilando JSX en el navegador.
- Tailwind CSS via CDN (clases utility, sin compilador local).
- React Router v5 (importante: NO v6 — no exporta UMD).
- Servido por `server.py` (HTTP estático Python) en `localhost:3000`.
- Backend Django en `localhost:8001` (CORS configurado).

**Implicancias importantes:**
- **No se puede `npm install`** ninguna librería nueva. Todo lo que se sume tiene que venir por CDN (`<script>` en `index.html`) o estar implementado a mano.
- Cada `.jsx` se carga independientemente y comparte scope global vía `eval` de Babel — los componentes definidos en un archivo son visibles desde cualquier otro siempre que se carguen antes en el orden de `<script>` de `index.html`.
- No hay TypeScript, no hay módulos ES (los `import`/`export` no funcionan).

**Componentes ya construidos (reutilizar antes de crear nuevos):**

| Componente | Ubicación | Uso |
|---|---|---|
| `Card` | `src/components/Card.jsx` | Contenedor con padding, sombra ligera, bordes redondeados. Acepta `title` y `className`. |
| `Button` | `src/components/Button.jsx` | Variantes: `primary` (azul), `secondary` (gris), `success` (verde), `danger` (rojo). Tamaños `sm`/`md`/`lg`. |
| `Navbar` | `src/components/Navbar.jsx` | Barra superior con logo, sucursal, usuario, logout. |
| `Sidebar` | `src/components/Sidebar.jsx` | Menú lateral colapsable. El item "Usuarios" sólo se muestra para `user.role === 'admin'`. |
| `Modal` (en `Sales.jsx`) | inline | Overlay + caja centrada con título y botón cerrar. Acepta `wide` para más ancho. |
| `SearchSelect` (en `Sales.jsx`) | inline | Dropdown con buscador, click-outside-to-close, máximo 50 resultados. |
| `BranchSelector` (en `BranchContext.jsx`) | global | Dropdown que filtra todas las páginas por sucursal seleccionada. |

**Helpers de formato (en `src/utils/format.js` — globales):**

- `formatMoney(value)` → `"1.234.567,50"` (locale es-PY, separador `.` para miles)
- `formatInt(value)` → `"1.234.567"` (sin decimales)
- `formatGs(value)` → `"Gs. 1.234.567"` (con prefijo de moneda)
- `formatDate(value)` → `"05/01/2026"` (sin sufrir bug de timezone)

**Convenciones de moneda:**
- Todos los montos del sistema son en Guaraníes (PYG). Siempre usar `formatGs` con prefijo `Gs.` — **nunca** concatenar `$` con `formatMoney()`.
- Los Guaraníes en la práctica no llevan decimales — `formatGs` ya redondea.

**Convención de fechas:**
- Backend manda fechas en ISO `YYYY-MM-DD` o `YYYY-MM-DDTHH:MM:SS`.
- En el frontend, **NUNCA** hacer `new Date(iso).toLocaleDateString()` porque corre la fecha un día por timezone (UTC midnight → local previo). Usar `formatDate(iso)` que parsea con regex y reordena a `DD/MM/YYYY`.

## Quick wins disponibles

Cuando el usuario pide "mejorar la UI" o "aplicar quick wins", priorizar en este orden (de mayor impacto visual con menor esfuerzo a más profundo):

### 1. Toasts en lugar de `alert()` y `confirm()`

**Problema actual:** Hay muchos `alert('Error: ...')` y `confirm()` en el código (especialmente en `Sales.jsx`, `Quotas.jsx`). Son nativos del browser, feos, bloqueantes y no se pueden estilar.

**Solución:** Sistema de toasts simple basado en estado React + portal:
- Crear `src/components/Toast.jsx` con un `ToastProvider` que mantiene un array de toasts.
- Hook `useToast()` que devuelve `{ toast, success, error, warning, confirm }`.
- Toasts aparecen en esquina inferior derecha con auto-dismiss después de 4 segundos.
- Para confirmaciones: toast con dos botones (Sí/Cancelar) que devuelve una Promise.

**Patrón de uso:**
```jsx
const { toast } = useToast();
try {
    await api.post(...);
    toast.success('Guardado correctamente');
} catch (err) {
    toast.error('Error al guardar', err.response?.data);
}
```

Para reemplazar `confirm()`:
```jsx
if (await toast.confirm('¿Eliminar esta cuota?')) {
    await api.delete(...);
}
```

### 2. Loading skeletons en lugar de spinner

**Problema actual:** Un spinner genérico centrado mientras carga. Se ve "vacío" y los usuarios no saben qué van a recibir.

**Solución:** Componente `<Skeleton />` con barras grises animadas que imitan la estructura final.

**Patrón:**
```jsx
{loading ? <TableSkeleton rows={10} cols={6} /> : <RealTable data={...} />}
```

Skeleton para tablas: array de `<div className="h-8 bg-gray-200 rounded animate-pulse mb-2" />` con widths variados.

### 3. Empty states con call-to-action

**Problema actual:** Cuando una lista está vacía dice "No hay X" sin más info.

**Solución:** Mostrar:
- Icono grande relevante (emoji está bien por ahora — `🚗`, `💰`, `📋`, `👥`).
- Título: "Aún no tenés ventas registradas".
- Descripción breve explicando qué se puede hacer.
- Botón primario con la acción más común (ej: "+ Nueva venta").

**Componente:** `<EmptyState icon emoji title description action />`.

### 4. Mobile-responsive

**Problema actual:** Las tablas se desbordan horizontalmente en celular. El sidebar fijo ocupa demasiado espacio.

**Estrategia:**

**Tablas en móvil:** En pantallas < `md` (768px), las tablas colapsan a tarjetas verticales. Cada fila se renderiza como un `<Card>` con label/value.

```jsx
<div className="hidden md:block">
    <table>...</table>
</div>
<div className="md:hidden space-y-2">
    {items.map(item => (
        <Card key={item.id}>
            <div className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-gray-500">Cliente:</span>
                <span>{item.customer_name}</span>
                ...
            </div>
        </Card>
    ))}
</div>
```

**Sidebar en móvil:** En `< md`, sidebar fijo se transforma en menú hamburguesa con overlay. Tocar un link cierra el sidebar.

**Modales en móvil:** En `< sm`, los modales ocupan toda la pantalla (`max-w-full max-h-screen`) en lugar de centrarse con margen.

**Tap targets:** Botones mínimo 44px de alto en móvil (`py-3` en vez de `py-2` para inputs interactivos).

**Viewport meta:** Verificar que `<meta name="viewport" content="width=device-width, initial-scale=1.0">` esté en `index.html`.

### 5. Atajos de teclado

**Solución:** Hook global `useKeyboardShortcuts` que escucha `keydown` en `window`:

- `Ctrl+K` o `Cmd+K` → abre buscador global (modal con búsqueda en ventas/clientes/vehículos al mismo tiempo).
- `Ctrl+N` → nueva venta (en página Ventas).
- `Esc` → cerrar el modal abierto.
- `?` → mostrar lista de atajos disponibles.

### 6. Branding configurable

**Problema actual:** Logo es `🚗 Playas de Autos` hardcoded en Navbar. La empresa AUTO OFERTAS no aparece en ningún lado branded.

**Solución:**
- Agregar campo `logo_url` a `Enterprise` model + UI para subirlo.
- Color primario configurable (CSS variable `--primary` ya existe en `index.html`).
- En el Navbar, mostrar logo de la empresa + nombre.
- Login: mostrar logo grande de la empresa.

### 7. Badges consistentes

**Problema actual:** Cada página define sus propios estilos de badge (estado de venta, estado de cuota, forma de pago, etc.) con clases duplicadas.

**Solución:** Componente `<Badge variant intent>` con variantes pre-definidas:

```jsx
<Badge intent="success">Activo</Badge>
<Badge intent="warning">Pendiente</Badge>
<Badge intent="danger">Vencida</Badge>
<Badge intent="info">Crédito</Badge>
<Badge intent="neutral">Cancelada</Badge>
```

Mapeo de status → intent en helper `statusBadge(status)`:
- `paid` / `available` / `completed` → `success`
- `pending` → `warning`
- `overdue` / `cancelled` → `danger`
- `reserved` → `info`

### 8. Confirmaciones de guardado

**Problema actual:** Después de guardar algo, el modal se cierra y no hay feedback visual claro de éxito.

**Solución:** Toast `success` con detalle (ej: "Venta CM01/26 actualizada"). Si la acción tiene undo posible (ej: marcar cuota pagada), agregar botón "Deshacer" en el toast con ventana de 5 segundos.

### 9. Inline form validation

**Problema actual:** Los formularios validan al submit y muestran un textarea con el JSON del backend. Funciona pero no es rápido.

**Solución:**
- Validación en blur de cada campo con mensaje rojo debajo.
- Para campos requeridos vacíos, ring rojo + texto "Requerido".
- Para formatos (email, número), validar mientras se escribe.

### 10. Search global

Un input en el Navbar (o accesible con `Ctrl+K`) que busca simultáneamente en ventas, clientes, vehículos y muestra resultados agrupados.

## Cómo aplicar mejoras

Cuando el usuario pida mejorar la UI:

1. **Preguntar el alcance** si es ambiguo: "¿querés que arranque por toasts y empty states o por mobile responsive?"
2. **Aplicar de a poco** — un quick win por turno es ideal. Cambios masivos riesgan romper cosas.
3. **Probar siempre** que el cambio funcione en al menos:
   - Pantalla normal (desktop)
   - Pantalla angosta (móvil)
   - Con el listado vacío y con el listado lleno
4. **Reusar componentes existentes** antes de crear nuevos. Si un componente está duplicado en 2+ páginas, extraerlo.
5. **Mantener Tailwind utility-first** — evitar CSS custom salvo casos puntuales (que ya están en `<style>` de `index.html`).

## Errores comunes a evitar

- ❌ Concatenar `$` con `formatMoney()`. Siempre usar `formatGs()` que ya tiene el prefijo correcto.
- ❌ Usar `new Date(iso).toLocaleDateString()`. Usar `formatDate(iso)` para evitar el bug de timezone.
- ❌ Usar `import`/`export` ES modules — no funcionan, todo es global.
- ❌ Usar React Router v6 — sólo v5 tiene UMD.
- ❌ Asumir que hay build step — no hay, todo se sirve estático.
- ❌ Romper la "altura ideal" de filas de tabla (`py-2.5` o `py-3`) — el usuario tiene tablas largas que escanea visualmente.
- ❌ Reemplazar `alert()` con un `console.error()` — hay que dar feedback visible al usuario.

## Pequeño glosario del dominio

Para que los textos de UI usen vocabulario consistente:
- **Sucursal** — branch (CASA CENTRAL, SUCURSAL 1).
- **Vehículo** — vehicle. Atributos clave: VIN/chasis, marca, modelo, año, color.
- **Venta** — sale. Tiene `sale_number` (código interno tipo `CM01/25` o `MC56/25`).
- **Cuota** — quotum (en plural: quotas). Tiene status (pendiente/pagada/vencida/cancelada).
- **Entrega inicial** — down payment, lo que se paga al firmar.
- **Forma de pago** — payment form: CONTADO, CRÉDITO, MIXTO.
- **Cliente** — customer. Identificado por nombre completo + número de documento (CI, RUC, pasaporte).

Cuando aparezca texto en la UI, usar siempre estas palabras (no "ítem", no "registro", no "elemento" — usar el nombre concreto).
