/**
 * Sidebar de navegación.
 *
 * Desktop (>= md): fija a la izquierda, colapsable a 80px de ancho.
 * Mobile  (< md):  oculta por defecto, abre con hamburguesa, overlay de fondo.
 *
 * El estado mobile se controla con un evento global 'sidebar:toggle' que se
 * dispara desde el botón hamburguesa del Navbar.
 */

const { Link, useLocation } = window.ReactRouterDOM;

function Sidebar({ className = '' }) {
    const [collapsed, setCollapsed] = React.useState(false);   // desktop
    const [mobileOpen, setMobileOpen] = React.useState(false); // < md
    const { user } = useAuth();
    const location = useLocation();
    const isAdmin = user && (user.role === 'admin' || user.is_superuser);

    // Escuchar el toggle global desde el Navbar
    React.useEffect(() => {
        const onToggle = () => setMobileOpen(o => !o);
        window.addEventListener('sidebar:toggle', onToggle);
        return () => window.removeEventListener('sidebar:toggle', onToggle);
    }, []);

    // Cerrar mobile al cambiar de ruta
    React.useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const menuItems = [
        { name: 'Dashboard',    path: '/',            icon: '📊' },
        { name: 'Vehículos',    path: '/vehicles',    icon: '🚗' },
        { name: 'Ventas',       path: '/sales',       icon: '💰' },
        { name: 'Clientes',     path: '/customers',   icon: '👥' },
        { name: 'Cuotas',       path: '/quotas',      icon: '📋' },
        { name: 'Flujo de caja',path: '/flujo-caja',  icon: '💵' },
        ...(isAdmin ? [{ name: 'Usuarios', path: '/users', icon: '⚙️', adminOnly: true }] : []),
    ];

    function isActive(path) {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    }

    return (
        <>
            {/* Overlay en móvil */}
            {mobileOpen && (
                <div onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" />
            )}

            {/* Sidebar */}
            <div className={`
                bg-gray-900 text-white fixed left-0 top-16 bottom-0 overflow-y-auto z-40
                transition-all duration-300 ${className}
                ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
                ${collapsed ? 'md:w-20' : 'md:w-64'}
            `}>
                <div className="p-3">
                    {/* Toggle (sólo desktop) */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden md:block w-full text-left p-2 hover:bg-gray-800 rounded-lg mb-2 text-sm"
                        title={collapsed ? 'Expandir' : 'Colapsar'}
                    >
                        {collapsed ? '▶' : '◀'}
                    </button>

                    <nav className="space-y-1">
                        {menuItems.map(item => {
                            const active = isActive(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`
                                        flex items-center gap-3 p-3 rounded-lg transition-colors text-sm font-medium
                                        ${active ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}
                                        ${item.adminOnly ? 'border-t border-gray-700 mt-2 pt-3' : ''}
                                    `}
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    {(!collapsed || mobileOpen) && <span>{item.name}</span>}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Spacer en desktop */}
            <div className={`hidden md:block transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'}`} />
        </>
    );
}
