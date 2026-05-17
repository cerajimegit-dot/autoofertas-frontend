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

/* ---------- Buscador global ---------- */
function GlobalSearch({ onClose }) {
    const [query, setQuery] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [results, setResults] = React.useState({ sales: [], customers: [], vehicles: [] });
    const history = useHistory();

    React.useEffect(() => {
        if (!query.trim()) {
            setResults({ sales: [], customers: [], vehicles: [] });
            return;
        }
        let cancelled = false;
        setLoading(true);
        const q = query.trim().toLowerCase();
        Promise.all([
            api.get('/sales/',     { params: { page_size: 1000 } }),
            api.get('/customers/', { params: { page_size: 1000 } }),
            api.get('/vehicles/',  { params: { page_size: 1000 } }),
        ]).then(([s, c, v]) => {
            if (cancelled) return;
            const sales = (s.data.results || s.data).filter(x =>
                (x.sale_number || '').toLowerCase().includes(q) ||
                (x.customer_name || '').toLowerCase().includes(q) ||
                (x.vehicle_info || '').toLowerCase().includes(q) ||
                (x.vehicle_vin || '').toLowerCase().includes(q)
            ).slice(0, 5);
            const customers = (c.data.results || c.data).filter(x =>
                `${x.first_name} ${x.last_name}`.toLowerCase().includes(q) ||
                (x.document_number || '').toLowerCase().includes(q)
            ).slice(0, 5);
            const vehicles = (v.data.results || v.data).filter(x =>
                (x.vin || '').toLowerCase().includes(q) ||
                (x.brand_name || '').toLowerCase().includes(q) ||
                (x.model_name || '').toLowerCase().includes(q)
            ).slice(0, 5);
            setResults({ sales, customers, vehicles });
        }).finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [query]);

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
                    placeholder="Buscar ventas, clientes, vehículos..."
                    className="w-full px-4 py-3 border-b text-base focus:outline-none"
                />
                <div className="overflow-y-auto flex-1">
                    {!query && (
                        <div className="p-6 text-center text-gray-500 text-sm">
                            Escribí algo para buscar en ventas, clientes y vehículos.
                            <div className="mt-2 text-xs">
                                Tip: usá <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border">Esc</kbd> para cerrar.
                            </div>
                        </div>
                    )}
                    {loading && <div className="p-4 text-center text-gray-500 text-sm">Buscando...</div>}
                    {!loading && query && (
                        <>
                            <SearchSection title="Ventas" items={results.sales}
                                renderItem={s => `${s.sale_number} — ${s.customer_name || '(sin cliente)'} — ${s.vehicle_info || ''}`}
                                onClick={() => { history.push('/sales'); onClose(); }} />
                            <SearchSection title="Clientes" items={results.customers}
                                renderItem={c => `${c.first_name} ${c.last_name} — ${c.document_number || ''}`}
                                onClick={() => { history.push('/customers'); onClose(); }} />
                            <SearchSection title="Vehículos" items={results.vehicles}
                                renderItem={v => `${v.brand_name} ${v.model_name} ${v.year} — ${v.vin}`}
                                onClick={() => { history.push('/vehicles'); onClose(); }} />
                            {results.sales.length + results.customers.length + results.vehicles.length === 0 && (
                                <div className="p-6 text-center text-gray-500 text-sm">Sin resultados.</div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function SearchSection({ title, items, renderItem, onClick }) {
    if (items.length === 0) return null;
    return (
        <div className="border-b">
            <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">{title}</div>
            {items.map((item, i) => (
                <button key={i} onClick={onClick}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-red-50 truncate">
                    {renderItem(item)}
                </button>
            ))}
        </div>
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
