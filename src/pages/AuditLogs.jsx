/**
 * Página /audit-logs — visor de auditoría.
 *
 * Sólo accesible para admins (el backend ya rechaza con 403 a los
 * demás roles vía la permission IsAdmin). El frontend no esconde el
 * link del sidebar a no-admins porque cualquier intento de ingreso
 * directo a /audit-logs ya queda bloqueado por el backend; mostrarlo
 * en el sidebar deja visible la funcionalidad existente sin sorpresas.
 *
 * Filtros que mandamos al server:
 *   - action: tipo de acción (create/update/delete/login/logout/...)
 *   - model:  nombre del modelo (Sale, Customer, Vehicle...)
 *   - user:   id del usuario
 *   - date_from / date_to: rango
 *   - q:      substring contra object_str
 *
 * No mostramos `old_values` ni `new_values` en la lista; sí en un
 * panel desplegable por fila para evitar saturar la tabla.
 */

const { useState: useStateAudit, useEffect: useEffectAudit } = React;

function AuditLogs() {
    const [logs, setLogs] = useStateAudit([]);
    const [loading, setLoading] = useStateAudit(true);
    const [users, setUsers] = useStateAudit([]);

    const [action, setAction] = useStateAudit('');
    const [modelName, setModelName] = useStateAudit('');
    const [userId, setUserId] = useStateAudit('');
    const [dateFrom, setDateFrom] = useStateAudit('');
    const [dateTo, setDateTo] = useStateAudit('');
    const [q, setQ] = useStateAudit('');
    const [expanded, setExpanded] = useStateAudit(null);   // log.id

    // Cargamos los usuarios una sola vez para el dropdown.
    useEffectAudit(() => {
        api.get('/users/', { params: { page_size: 200 } })
            .then(r => setUsers(r.data.results || r.data))
            .catch(() => setUsers([]));
    }, []);

    useEffectAudit(() => {
        let cancelled = false;
        setLoading(true);
        const params = { page_size: 200 };
        if (action)    params.action = action;
        if (modelName) params.model = modelName;
        if (userId)    params.user = userId;
        if (dateFrom)  params.date_from = dateFrom;
        if (dateTo)    params.date_to = dateTo;
        if (q.trim())  params.q = q.trim();

        api.get('/audit-logs/', { params })
            .then(r => { if (!cancelled) setLogs(r.data.results || r.data); })
            .catch(() => { if (!cancelled) setLogs([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [action, modelName, userId, dateFrom, dateTo, q]);

    // Modelos comunes — extraídos de los logs cargados para alimentar el
    // dropdown. No usamos un endpoint dedicado porque la lista es chica.
    const knownModels = React.useMemo(() => {
        const set = new Set();
        logs.forEach(l => l.model_name && set.add(l.model_name));
        return Array.from(set).sort();
    }, [logs]);

    const actionLabels = {
        create: 'Crear', update: 'Actualizar', delete: 'Eliminar',
        view: 'Ver', login: 'Login', logout: 'Logout',
        export: 'Exportar', import: 'Importar',
    };
    const actionColors = {
        create: 'bg-green-100 text-green-800',
        update: 'bg-blue-100 text-blue-800',
        delete: 'bg-red-100 text-red-800',
        login:  'bg-emerald-100 text-emerald-800',
        logout: 'bg-gray-200 text-gray-700',
        export: 'bg-purple-100 text-purple-800',
        import: 'bg-amber-100 text-amber-800',
    };

    function clearAll() {
        setAction(''); setModelName(''); setUserId('');
        setDateFrom(''); setDateTo(''); setQ('');
    }

    function formatChanges(values) {
        if (!values || (typeof values === 'object' && Object.keys(values).length === 0)) return '—';
        try {
            return JSON.stringify(values, null, 2);
        } catch (_) {
            return String(values);
        }
    }

    return (
        <div className="max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Auditoría</h1>
                <p className="text-gray-600">
                    Registro de acciones de los usuarios sobre el sistema. Sólo lectura.
                </p>
            </div>

            <Card className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Acción</label>
                        <select value={action} onChange={e => setAction(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm">
                            <option value="">Todas</option>
                            {Object.entries(actionLabels).map(([k, v]) =>
                                <option key={k} value={k}>{v}</option>
                            )}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Modelo</label>
                        <select value={modelName} onChange={e => setModelName(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm">
                            <option value="">Todos</option>
                            {knownModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Usuario</label>
                        <select value={userId} onChange={e => setUserId(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm">
                            <option value="">Todos</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.username} ({u.first_name || ''} {u.last_name || ''})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Desde</label>
                        <input type="date" value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                        <input type="date" value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Buscar</label>
                        <input type="text" value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="N° venta, nombre..."
                            className="w-full px-2 py-1.5 border rounded text-sm" />
                    </div>
                </div>
                <div className="flex justify-between items-center mt-3 text-xs text-gray-600">
                    <span>{logs.length} registro(s)</span>
                    <Button size="sm" variant="secondary" onClick={clearAll}>Limpiar filtros</Button>
                </div>
            </Card>

            <Card>
                {loading
                    ? <div className="text-center py-4"><div className="loading"></div></div>
                    : logs.length === 0
                        ? <EmptyState
                            emoji="📜"
                            title="Sin registros con esos filtros"
                            description="Probá ampliando el rango de fechas o quitando algún filtro."
                        />
                        : <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Usuario</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Acción</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Modelo</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Objeto</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">IP</th>
                                        <th className="px-3 py-2 text-right text-xs uppercase">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(l => {
                                        const isOpen = expanded === l.id;
                                        return (
                                            <React.Fragment key={l.id}>
                                                <tr className="border-b hover:bg-gray-50">
                                                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                                                        {new Date(l.timestamp).toLocaleString('es-PY')}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs">
                                                        {l.user
                                                            ? (l.user.username || l.user)
                                                            : <span className="text-gray-400 italic">(sin user)</span>}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                            actionColors[l.action] || 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {actionLabels[l.action] || l.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono">{l.model_name}</td>
                                                    <td className="px-3 py-2 text-xs">
                                                        <span className="font-mono">{l.object_str}</span>
                                                        {' '}
                                                        <span className="text-gray-400">#{l.object_id}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                                                        {l.ip_address}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <button type="button"
                                                            onClick={() => setExpanded(isOpen ? null : l.id)}
                                                            className="text-xs text-red-700 hover:underline">
                                                            {isOpen ? 'Ocultar' : 'Ver cambios'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr className="bg-gray-50">
                                                        <td colSpan={7} className="px-3 py-2">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                                <div>
                                                                    <div className="font-semibold text-gray-600 mb-1">Antes</div>
                                                                    <pre className="bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap font-mono">
{formatChanges(l.old_values)}
                                                                    </pre>
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-gray-600 mb-1">Después</div>
                                                                    <pre className="bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap font-mono">
{formatChanges(l.new_values)}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                }
            </Card>
        </div>
    );
}
