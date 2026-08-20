/**
 * Navbar — barra superior fija.
 *
 * En mobile (< md): muestra botón hamburguesa que dispara 'sidebar:toggle'.
 * En desktop: muestra logo + selector de sucursal + nombre + menú de usuario.
 */

function Navbar({ onLogout }) {
    const { user } = useAuth();
    const { rate: usdRate, source: usdSource, date: usdDate, loading: usdLoading, refresh: refreshUsd } = useExchangeRate();
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [usdModalOpen, setUsdModalOpen] = React.useState(false);
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        function onClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        }
        if (menuOpen) document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [menuOpen]);

    function toggleSidebar() {
        window.dispatchEvent(new Event('sidebar:toggle'));
    }

    const initial = (user?.first_name || user?.username || '?').charAt(0).toUpperCase();

    return (
        <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
            <div className="px-3 sm:px-4 lg:px-6">
                <div className="flex items-center justify-between h-16 gap-3">
                    {/* Izquierda: hamburguesa (mobile) + logo */}
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar}
                            className="md:hidden p-2 rounded hover:bg-gray-100 text-gray-700"
                            aria-label="Abrir menú">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {/* Logo de la empresa — siempre visible.
                            Si el usuario tiene `enterprise` cargado en el AuthContext y la
                            enterprise tiene `logo_url` configurada (a futuro), la usamos;
                            como fallback, asset/logo.jpg de AUTO OFERTAS. */}
                        <a href="/" className="flex items-center gap-2 min-w-0">
                            <img
                                src={user?.enterprise_logo_url || '/assets/logo.jpg'}
                                alt={user?.enterprise_name || 'AUTO OFERTAS'}
                                className="h-10 w-10 rounded object-contain bg-white border border-gray-200 flex-shrink-0"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <h1 className="text-lg sm:text-xl font-bold text-red-600 truncate">
                                <span className="hidden sm:inline">
                                    {user?.enterprise_name || 'AUTO OFERTAS'}
                                </span>
                            </h1>
                        </a>
                    </div>

                    {/* Centro: selector de sucursal + chip USD */}
                    <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
                        <BranchSelector />
                        {/* Chip cotización USD — visible siempre. Click abre modal con detalle. */}
                        <button type="button"
                            onClick={() => setUsdModalOpen(true)}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full text-sm text-emerald-900 transition"
                            title={usdSource ? `Fuente: ${usdSource} · ${usdDate || ''}` : 'Cotización USD del día'}>
                            <span className="text-xs">💱 USD</span>
                            <span className="font-semibold">
                                {usdLoading ? '...' : (usdRate ? formatMoney(usdRate) : '—')}
                            </span>
                        </button>
                    </div>

                    {/* Modal simple con detalle del USD */}
                    {usdModalOpen && (
                        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
                             onClick={() => setUsdModalOpen(false)}>
                            <div className="bg-white rounded-lg max-w-sm w-full p-5"
                                 onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">Cotización del día</h3>
                                    <button onClick={() => setUsdModalOpen(false)}
                                        className="text-gray-400 hover:text-gray-700 text-2xl">×</button>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">USD 1:</span>
                                        <strong>Gs. {usdRate ? formatMoney(usdRate) : '—'}</strong>
                                    </div>
                                    {usdSource && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Fuente:</span>
                                            <span>{usdSource}</span>
                                        </div>
                                    )}
                                    {usdDate && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Fecha:</span>
                                            <span>{formatDate(usdDate)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 pt-3 border-t flex justify-between gap-2">
                                    <button onClick={refreshUsd}
                                        className="text-sm text-red-600 hover:underline">
                                        ↻ Actualizar
                                    </button>
                                    <button onClick={() => setUsdModalOpen(false)}
                                        className="text-sm text-gray-600 hover:underline">
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Derecha: notificaciones + ayuda + usuario */}
                    <div className="flex items-center gap-2" ref={menuRef}>
                        <NotificationBell />
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new Event('shortcuts:open'))}
                            className="hidden sm:flex w-8 h-8 rounded-full border border-gray-300 text-gray-600 items-center justify-center hover:bg-gray-100"
                            aria-label="Atajos de teclado"
                            title="Atajos de teclado">
                            ?
                        </button>
                        <span className="hidden sm:inline text-sm text-gray-600 max-w-[120px] truncate">
                            {user?.first_name} {user?.last_name}
                        </span>
                        <button onClick={() => setMenuOpen(!menuOpen)}
                            className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition"
                            aria-label="Menú de usuario">
                            {initial}
                        </button>

                        {menuOpen && (
                            <div className="absolute right-3 top-14 w-56 bg-white rounded-lg shadow-lg py-2 border">
                                <div className="px-4 py-2 border-b">
                                    <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email || user?.username}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{user?.role_display || user?.role}</p>
                                </div>
                                <button onClick={onLogout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                    Cerrar sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
