/**
 * Página Gestión de Clientes — listar, crear, editar, ver inconsistencias.
 */

const { useState, useEffect, useMemo } = React;
const { useLocation, Link } = window.ReactRouterDOM;

function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState(null);
    // Filtros de calidad: all | doc_auto | sin_telefono | email_sintetico | reales
    const [quality, setQuality] = useState('all');

    const { toast } = useToast();
    const location = useLocation();

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Deep-link desde el panel de inconsistencias (?q=auto, ?q=sin_tel).
    useEffect(() => {
        const sp = new URLSearchParams(location.search);
        const q = sp.get('q');
        if (q === 'auto') setQuality('doc_auto');
        if (q === 'sin_tel') setQuality('sin_telefono');
    }, [location.search]);

    async function fetchCustomers() {
        setLoading(true);
        try {
            const response = await api.get('/customers/', { params: { page_size: 1000 } });
            setCustomers(response.data.results || response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar clientes');
        } finally {
            setLoading(false);
        }
    }

    function isDocAuto(c) {
        const d = (c.document_number || '').toUpperCase();
        return d.startsWith('DRV026-') || d.startsWith('SUC026-') || d.startsWith('CUOTA');
    }
    function isEmailSintetico(c) {
        return (c.email || '').endsWith('@import.local');
    }
    function isSinTelefono(c) {
        return !c.phone || !c.phone.trim();
    }
    function isReal(c) {
        return !isDocAuto(c) && !isEmailSintetico(c);
    }

    const counts = useMemo(() => ({
        all: customers.length,
        reales: customers.filter(isReal).length,
        doc_auto: customers.filter(isDocAuto).length,
        sin_telefono: customers.filter(isSinTelefono).length,
        email_sintetico: customers.filter(isEmailSintetico).length,
    }), [customers]);

    const filtered = useMemo(() => {
        let list = customers;
        if (quality === 'reales')          list = list.filter(isReal);
        if (quality === 'doc_auto')        list = list.filter(isDocAuto);
        if (quality === 'sin_telefono')    list = list.filter(isSinTelefono);
        if (quality === 'email_sintetico') list = list.filter(isEmailSintetico);
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter(c => {
            const full = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
            return full.includes(q)
                || (c.document_number || '').toLowerCase().includes(q)
                || (c.email || '').toLowerCase().includes(q)
                || (c.phone || '').toLowerCase().includes(q);
        });
    }, [customers, search, quality]);

    if (loading) {
        return (
            <div className="max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
                    <p className="text-gray-600">Cargando...</p>
                </div>
                <TableSkeleton rows={10} cols={7} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
                    <p className="text-gray-600">
                        Mostrando <strong>{filtered.length}</strong> de <strong>{customers.length}</strong> clientes
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setShowCreate(true)}>+ Nuevo cliente</Button>
                    <Button variant="secondary" onClick={fetchCustomers}>↻ Refrescar</Button>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}

            {/* Chips de calidad de datos */}
            <div className="flex flex-wrap gap-2 mb-3">
                {[
                    ['all',             `Todos (${counts.all})`,                          'gray'],
                    ['reales',          `Solo reales (${counts.reales})`,                 'blue'],
                    ['doc_auto',        `⚠ Doc autogenerado (${counts.doc_auto})`,         'yellow'],
                    ['sin_telefono',    `⚠ Sin teléfono (${counts.sin_telefono})`,         'orange'],
                    ['email_sintetico', `⚠ Email @import.local (${counts.email_sintetico})`,'gray'],
                ].map(([key, label, color]) => (
                    <button key={key} type="button"
                        onClick={() => setQuality(key)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition ${
                            quality === key
                                ? `bg-${color}-600 text-white border-${color}-600`
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}>
                        {label}
                    </button>
                ))}
            </div>

            <div className="mb-4">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, documento, email o teléfono..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nombre</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Doc</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Teléfono</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Ciudad</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Ventas</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(customer => {
                                const nombre = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || '(sin nombre)';
                                const auto = isDocAuto(customer);
                                const sintetico = isEmailSintetico(customer);
                                return (
                                    <tr key={customer.id} className={`border-b hover:bg-gray-50 ${auto ? 'bg-yellow-50/30' : ''}`}>
                                        <td className="px-4 py-3 font-medium">
                                            <Link to={`/customers/${customer.id}`}
                                                className="text-blue-700 hover:underline">
                                                {nombre}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm">
                                            <div className="flex items-center gap-2">
                                                <span>{customer.document_number}</span>
                                                {auto && (
                                                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-yellow-200 text-yellow-900"
                                                          title="Documento generado por migración — corregir cuando rocio tenga el real">
                                                        AUTO
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">{customer.document_type_display || customer.document_type}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {sintetico
                                                ? <span className="text-gray-400 italic">(sin email real)</span>
                                                : customer.email}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {customer.phone
                                                ? customer.phone
                                                : <span className="text-red-600 font-medium">⚠ Sin teléfono</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{customer.city}</td>
                                        <td className="px-4 py-3 text-sm text-center">{customer.sales_count ?? '-'}</td>
                                        <td className="px-4 py-3">
                                            <Button size="sm" variant="secondary" onClick={() => setEditing(customer)}>
                                                ✏ Editar
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    search || quality !== 'all'
                        ? <EmptyState filtered onClear={() => { setSearch(''); setQuality('all'); }} />
                        : <EmptyState
                            emoji="👥"
                            title="No hay clientes registrados"
                            description="Creá el primero con el botón de arriba o asigná uno al cargar una venta."
                            action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Nuevo cliente</Button>}
                        />
                )}
            </Card>

            {showCreate && (
                <CustomerEditModal
                    onClose={() => setShowCreate(false)}
                    onSaved={() => { setShowCreate(false); fetchCustomers(); toast.success('Cliente creado'); }}
                />
            )}

            {editing && (
                <CustomerEditModal
                    customer={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); fetchCustomers(); toast.success('Cliente actualizado'); }}
                />
            )}
        </div>
    );
}

/* ---------- Modal: crear o editar cliente ---------- */
function CustomerEditModal({ customer, onClose, onSaved }) {
    const { toast } = useToast();
    const isEdit = !!customer;
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const [form, setForm] = React.useState({
        first_name: customer?.first_name || '',
        last_name:  customer?.last_name  || '',
        document_type: customer?.document_type || 'ci',
        document_number: customer?.document_number || '',
        email: (customer?.email || '').endsWith('@import.local') ? '' : (customer?.email || ''),
        phone: customer?.phone || '',
        address: customer?.address || '',
        city: customer?.city || '',
        notes: customer?.notes || '',
    });

    function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

    async function submit(e) {
        e.preventDefault();
        setSaving(true); setErrorText('');
        try {
            const payload = {
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                document_type: form.document_type,
                document_number: form.document_number.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                address: form.address,
                city: form.city,
                notes: form.notes,
                is_generic: false,
            };
            if (isEdit) {
                await api.patch(`/customers/${customer.id}/`, payload);
            } else {
                await api.post('/customers/', payload);
            }
            onSaved();
        } catch (err) {
            const body = err.response?.data;
            setErrorText(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
        } finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold">
                        {isEdit ? `Editar cliente: ${customer.first_name} ${customer.last_name}` : 'Nuevo cliente'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
                </div>
                <form onSubmit={submit} className="p-4 space-y-3">
                    {errorText && (
                        <div className="bg-red-50 border border-red-300 rounded p-3">
                            <strong className="text-red-700 text-sm block mb-2">Error</strong>
                            <pre className="text-xs whitespace-pre-wrap">{errorText}</pre>
                        </div>
                    )}

                    {isEdit && (customer.document_number || '').match(/^(DRV026|SUC026|CUOTA)/i) && (
                        <div className="bg-yellow-50 border border-yellow-300 text-yellow-900 text-sm rounded p-2">
                            Este cliente tiene un documento autogenerado por la migración
                            (<strong className="font-mono">{customer.document_number}</strong>).
                            Reemplazalo por la cédula real para que aparezca correctamente en
                            los reportes.
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Nombre *">
                            <input type="text" value={form.first_name}
                                onChange={e => set('first_name', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="Apellido *">
                            <input type="text" value={form.last_name}
                                onChange={e => set('last_name', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="Tipo de documento">
                            <select value={form.document_type}
                                onChange={e => set('document_type', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="ci">Cédula de Identidad</option>
                                <option value="ruc">RUC</option>
                                <option value="passport">Pasaporte</option>
                            </select>
                        </Field>
                        <Field label="N° documento *">
                            <input type="text" value={form.document_number}
                                onChange={e => set('document_number', e.target.value)}
                                className="w-full px-3 py-2 border rounded font-mono" required />
                        </Field>
                        <Field label="Teléfono">
                            <input type="text" value={form.phone}
                                onChange={e => set('phone', e.target.value)}
                                placeholder="0981 123 456 o +595..."
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                        <Field label="Email">
                            <input type="email" value={form.email}
                                onChange={e => set('email', e.target.value)}
                                placeholder="(opcional)"
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                        <Field label="Ciudad">
                            <input type="text" value={form.city}
                                onChange={e => set('city', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                        <Field label="Dirección">
                            <input type="text" value={form.address}
                                onChange={e => set('address', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                    </div>
                    <Field label="Notas">
                        <textarea value={form.notes} rows={2}
                            onChange={e => set('notes', e.target.value)}
                            className="w-full px-3 py-2 border rounded" />
                    </Field>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear cliente')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            {children}
        </div>
    );
}
