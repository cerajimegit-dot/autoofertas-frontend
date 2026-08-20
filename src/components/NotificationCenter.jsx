/**
 * NotificationCenter — bandeja de notificaciones en el Navbar.
 *
 * Auto-notifs al mount (consume endpoints existentes):
 *   - /quotas/overdue/           → "N cuotas vencidas"
 *   - /vehicles/stuck/?days=90   → "N vehículos +90 días en stock"
 *   - /quotas/upcoming/?days=7   → "N cuotas por vencer esta semana"
 *
 * Marca leído/no-leído por notificación (localStorage).
 *
 * Uso: <NotificationBell /> en el Navbar (usa useAuth para gate).
 */

const NOTIF_KEY = 'notifications_read';

function loadReadIds() {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]')); }
    catch { return new Set(); }
}
function saveReadIds(set) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(Array.from(set)));
}

function NotificationBell() {
    const { isAuthenticated } = useAuth();
    const [notifs, setNotifs] = React.useState([]);
    const [open, setOpen] = React.useState(false);
    const [readIds, setReadIds] = React.useState(loadReadIds);
    const dropdownRef = React.useRef(null);

    // Cargar notifs on-demand al abrir el bell (NO al mount) — evita saturar
    // el backend con requests extras junto con el resto de la app al login.
    const [loaded, setLoaded] = React.useState(false);
    async function loadNotifs() {
        if (loaded) return;
        setLoaded(true);
        const all = [];
        try {
            const overdue = await api.get('/quotas/overdue/', { params: { page_size: 100 } }).catch(() => null);
            if (overdue) {
                const items = overdue.data.results || overdue.data || [];
                if (items.length > 0) all.push({
                    id: `overdue-${items.length}`, icon: '⚠',
                    title: `${items.length} cuotas vencidas`,
                    desc: 'Clientes con cuotas pendientes de cobro',
                    link: '/quotas?status=overdue', severity: 'high',
                });
            }
            const stuck = await api.get('/vehicles/stuck/', { params: { days: 90 } }).catch(() => null);
            if (stuck) {
                const items = stuck.data.results || stuck.data || [];
                if (items.length > 0) all.push({
                    id: `stuck-${items.length}`, icon: '🚗',
                    title: `${items.length} vehículos +90 días en stock`,
                    desc: 'Considerar bajar precio o revisar publicación',
                    link: '/vehicles?state=available', severity: 'medium',
                });
            }
            const upcoming = await api.get('/quotas/upcoming/', { params: { days: 7 } }).catch(() => null);
            if (upcoming) {
                const items = upcoming.data.results || upcoming.data || [];
                if (items.length > 0) all.push({
                    id: `upcoming-${items.length}`, icon: '📅',
                    title: `${items.length} cuotas por vencer esta semana`,
                    desc: 'Enviar recordatorio a los clientes',
                    link: '/quotas', severity: 'low',
                });
            }
        } catch { /* ignore */ }
        setNotifs(all);
    }

    React.useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    if (!isAuthenticated) return null;

    const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

    function markRead(id) {
        setReadIds(prev => {
            const next = new Set(prev);
            next.add(id);
            saveReadIds(next);
            return next;
        });
    }
    function markAllRead() {
        const all = new Set(notifs.map(n => n.id));
        setReadIds(all);
        saveReadIds(all);
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => { loadNotifs(); setOpen(o => !o); }}
                className="relative w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
                title="Notificaciones">
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border z-50">
                    <div className="flex justify-between items-center p-3 border-b sticky top-0 bg-white">
                        <span className="font-semibold text-sm">Notificaciones</span>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead}
                                className="text-xs text-red-600 hover:underline">
                                Marcar todas leídas
                            </button>
                        )}
                    </div>
                    {notifs.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">
                            <div className="text-3xl mb-2">✓</div>
                            Sin novedades por ahora.
                        </div>
                    ) : (
                        notifs.map(n => {
                            const read = readIds.has(n.id);
                            const sevColor = {
                                high: 'border-l-red-500',
                                medium: 'border-l-amber-500',
                                low: 'border-l-blue-500',
                            }[n.severity] || 'border-l-gray-300';
                            return (
                                <a key={n.id} href={n.link}
                                    onClick={() => markRead(n.id)}
                                    className={`block p-3 border-b border-l-4 ${sevColor} hover:bg-gray-50 ${
                                        read ? 'opacity-60' : ''
                                    }`}>
                                    <div className="flex items-start gap-2">
                                        <span className="text-lg">{n.icon}</span>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">{n.title}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{n.desc}</div>
                                        </div>
                                        {!read && <span className="w-2 h-2 bg-red-600 rounded-full mt-1.5" />}
                                    </div>
                                </a>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
