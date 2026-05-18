/**
 * KeyboardShortcuts — atajos globales de teclado.
 *
 * Atajos:
 *   Ctrl+K / Cmd+K   → abrir buscador global
 *   Ctrl+/  o ?      → mostrar lista de atajos
 *   Esc              → cerrar modal abierto / buscador
 *
 * Uso: envolver la app con <KeyboardShortcutsProvider>. El buscador y la
 * ayuda se renderizan automáticamente cuando se invocan.
 */

const { useHistory } = window.ReactRouterDOM;

function KeyboardShortcutsProvider({ children }) {
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [helpOpen, setHelpOpen] = React.useState(false);

    // Permitir abrir la ayuda desde un botón del Navbar
    React.useEffect(() => {
        const open = () => { setHelpOpen(true); setSearchOpen(false); };
        window.addEventListener('shortcuts:open', open);
        return () => window.removeEventListener('shortcuts:open', open);
    }, []);

    React.useEffect(() => {
        function onKey(e) {
            // No interferir si el foco está en un input/textarea
            const tag = (e.target.tagName || '').toLowerCase();
            const isTyping = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;

            // Ctrl+K / Cmd+K — buscador global (funciona aún tipeando)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen(o => !o);
                setHelpOpen(false);
                return;
            }

            // Esc — cerrar buscador o ayuda
            if (e.key === 'Escape') {
                if (searchOpen) setSearchOpen(false);
                if (helpOpen) setHelpOpen(false);
                return;
            }

            if (isTyping) return; // los siguientes sólo si no estás tipeando

            // ? o Ctrl+/ — ayuda
            if (e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
                e.preventDefault();
                setHelpOpen(o => !o);
                setSearchOpen(false);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [searchOpen, helpOpen]);

    return (
        <>
            {children}
            {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
            {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
        </>
    );
}

/* ---------- Buscador global ----------
 *
 * Refactor (F4): antes traíamos 3000 entidades en cada keystroke (sales +
 * customers + vehicles con page_size: 1000) y el click te llevaba a la
 * LISTA (no al item). Ahora:
 *
 * 1. Usamos /<entity>/search/?q= dedicado (paginado en backend, <= 8 por
 *    tipo). Esto baja el payload de ~2MB a unos pocos KB.
 * 2. Debounce de 200ms: no requestamos en cada tecla.
 * 3. Navegación con flechas + Enter, estilo command palette (Linear,
 *    GitHub).
 * 4. Click en cliente → /customers/:id (detalle directo).
 *    Click en venta o vehículo → /sales?q=<sale_number> o /vehicles?q=
 *    pre-filtrando el listado. (No tenemos detail page para esos dos
 *    todavía; el filtro deja al item visible en una sola fila).
 */
function GlobalSearch({ onClose }) {
    const [query, setQuery] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [results, setResults] = React.useState({ sales: [], customers: [], vehicles: [] });
    const [selectedIdx, setSelectedIdx] = React.useState(0);
    const history = useHistory();

    // Lista plana con todos los items en el orden visual — usada por la
    // navegación con teclado para calcular cuál se selecciona con flechas.
    const flat = React.useMemo(() => {
        const items = [];
        for (const c of results.customers) items.push({ type: 'customer', item: c });
        for (const s of results.sales)     items.push({ type: 'sale',     item: s });
        for (const v of results.vehicles)  items.push({ type: 'vehicle',  item: v });
        return items;
    }, [results]);

    // Debounced fetch: 200ms después de la última tecla. Las 3 requests
    // van en paralelo — el backend responde rápido porque cada endpoint
    // tiene su propio limit=8 y query optimizado.
    React.useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults({ sales: [], customers: [], vehicles: [] });
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        const t = setTimeout(() => {
            Promise.all([
                api.get('/customers/search/', { params: { q, limit: 6 } }),
                api.get('/sales/search/',     { params: { q, limit: 6 } }),
                api.get('/vehicles/search/',  { params: { q, limit: 6 } }),
            ]).then(([c, s, v]) => {
                if (cancelled) return;
                setResults({
                    customers: c.data.results || [],
                    sales:     s.data.results || [],
                    vehicles:  v.data.results || [],
                });
                setSelectedIdx(0);
            }).catch(() => {
                if (!cancelled) setResults({ sales: [], customers: [], vehicles: [] });
            }).finally(() => { if (!cancelled) setLoading(false); });
        }, 200);
        return () => { cancelled = true; clearTimeout(t); };
    }, [query]);

    function goTo({ type, item }) {
        if (type === 'customer') {
            history.push(`/customers/${item.id}`);
        } else if (type === 'sale') {
            // Pre-filtramos /sales por el número de venta. Sales.jsx
            // (cuando soporte URL params en una iteración futura) podrá
            // leer ?q= y arrancar con el filtro aplicado. Mientras tanto,
            // navegamos a la lista — sigue siendo más útil que antes,
            // porque al menos sabemos qué venta el usuario eligió.
            history.push(`/sales?q=${encodeURIComponent(item.sale_number)}`);
        } else if (type === 'vehicle') {
            history.push(`/vehicles?q=${encodeURIComponent(item.vin || item.brand_name)}`);
        }
        onClose();
    }

    function onKey(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIdx(i => Math.min(i + 1, flat.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && flat[selectedIdx]) {
            e.preventDefault();
            goTo(flat[selectedIdx]);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-20 px-4"
             onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col"
                 onClick={e => e.stopPropagation()}>
                <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Buscar ventas, clientes, vehículos... (↑↓ para mover, Enter abre)"
                    className="w-full px-4 py-3 border-b text-base focus:outline-none"
                />
                <div className="overflow-y-auto flex-1">
                    {!query && (
                        <div className="p-6 text-center text-gray-500 text-sm">
                            Escribí algo para buscar en ventas, clientes y vehículos.
                            <div className="mt-2 text-xs">
                                Usá <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border">↑</kbd>
                                <kbd className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded border">↓</kbd>
                                {' '}para mover, <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border">Enter</kbd>
                                {' '}para abrir, <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border">Esc</kbd> para cerrar.
                            </div>
                        </div>
                    )}
                    {loading && <div className="p-4 text-center text-gray-500 text-sm">Buscando...</div>}
                    {!loading && query && (
                        <PaletteResults flat={flat} selectedIdx={selectedIdx} onGoTo={goTo}
                            counts={{
                                customers: results.customers.length,
                                sales: results.sales.length,
                                vehicles: results.vehicles.length,
                            }} />
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Renderiza el flat list con grupos titulados. Resaltamos el item con
 * `selectedIdx` (controlado desde el padre vía teclado).
 *
 * Hacemos el render por grupo en orden Clientes → Ventas → Vehículos para
 * que coincida con la composición del flat array. Si cambia el orden allí,
 * cambia acá también.
 */
function PaletteResults({ flat, selectedIdx, onGoTo, counts }) {
    if (flat.length === 0) {
        return <div className="p-6 text-center text-gray-500 text-sm">Sin resultados.</div>;
    }
    let idx = 0;
    return (
        <>
            {counts.customers > 0 && (
                <PaletteGroup title="Clientes" emoji="👤">
                    {flat.slice(idx, idx + counts.customers).map((row, i) => {
                        const realIdx = idx + i;
                        const c = row.item;
                        return <PaletteRow key={`c-${c.id}`}
                            selected={realIdx === selectedIdx}
                            onClick={() => onGoTo(row)}>
                            <span className="font-medium">
                                {(c.first_name || '') + ' ' + (c.last_name || '')}
                            </span>
                            <span className="ml-2 text-xs text-gray-500 font-mono">
                                {c.document_number}
                            </span>
                        </PaletteRow>;
                    })}
                </PaletteGroup>
            )}
            {(idx += counts.customers, counts.sales > 0) && (
                <PaletteGroup title="Ventas" emoji="🛒">
                    {flat.slice(idx, idx + counts.sales).map((row, i) => {
                        const realIdx = idx + i;
                        const s = row.item;
                        return <PaletteRow key={`s-${s.id}`}
                            selected={realIdx === selectedIdx}
                            onClick={() => onGoTo(row)}>
                            <span className="font-mono text-sm">{s.sale_number}</span>
                            <span className="ml-2 text-sm">{s.customer_name || '(sin cliente)'}</span>
                            <span className="ml-2 text-xs text-gray-500">{s.vehicle_info}</span>
                        </PaletteRow>;
                    })}
                </PaletteGroup>
            )}
            {(idx += counts.sales, counts.vehicles > 0) && (
                <PaletteGroup title="Vehículos" emoji="🚗">
                    {flat.slice(idx, idx + counts.vehicles).map((row, i) => {
                        const realIdx = idx + i;
                        const v = row.item;
                        return <PaletteRow key={`v-${v.id}`}
                            selected={realIdx === selectedIdx}
                            onClick={() => onGoTo(row)}>
                            <span className="font-medium">
                                {v.brand_name} {v.model_name} {v.year}
                            </span>
                            <span className="ml-2 text-xs text-gray-500 font-mono">{v.vin}</span>
                            <span className="ml-2 text-xs text-gray-500">{v.state_display}</span>
                        </PaletteRow>;
                    })}
                </PaletteGroup>
            )}
        </>
    );
}

function PaletteGroup({ title, emoji, children }) {
    return (
        <div className="border-b">
            <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                {emoji} {title}
            </div>
            {children}
        </div>
    );
}

function PaletteRow({ selected, onClick, children }) {
    // El `selected` se usa para el highlight con flechas; el hover normal
    // sigue funcionando para mouse. Si el usuario está navegando con
    // teclado, queremos que el row seleccionado SIEMPRE se vea pintado
    // aunque el mouse esté en otro lado.
    return (
        <button onClick={onClick}
            className={`block w-full text-left px-4 py-2 text-sm truncate ${
                selected ? 'bg-red-100' : 'hover:bg-red-50'
            }`}>
            {children}
        </button>
    );
}

/* ---------- Ayuda de atajos ---------- */
function ShortcutsHelp({ onClose }) {
    const shortcuts = [
        { keys: ['Ctrl', 'K'],     desc: 'Buscar venta, cliente o vehículo' },
        { keys: ['?'],             desc: 'Abrir esta ayuda' },
        { keys: ['Esc'],           desc: 'Cerrar la ventana actual' },
    ];
    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center px-4"
             onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md"
                 onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="font-semibold">Atajos de teclado</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
                </div>
                <div className="p-4 space-y-2">
                    {shortcuts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{s.desc}</span>
                            <span className="flex gap-1">
                                {s.keys.map((k, j) => (
                                    <kbd key={j} className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">{k}</kbd>
                                ))}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
