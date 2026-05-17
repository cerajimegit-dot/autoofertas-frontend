/**
 * Página /flujo-caja — registro de ingresos y egresos.
 *
 * Reemplaza el archivo Excel "FLUJO DE CAJA ..." mensual. Combina:
 *   - Movimientos auto-generados por ventas contado, señas y cobros de cuota.
 *   - Movimientos manuales: gastos, alquileres, compras al exterior, transporte.
 *
 * El usuario ve los 3 KPIs (ingresos, egresos, neto), filtra por período y
 * sucursal, y carga lo que falta con "+ Nuevo movimiento".
 */

const { useState, useEffect, useMemo } = React;

function Cash() {
    const { selectedBranch, branches } = useBranch();
    const { toast } = useToast();

    const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
    const [dateTo, setDateTo] = useState(todayIso());
    const [kindFilter, setKindFilter] = useState('');
    const [directionFilter, setDirectionFilter] = useState('');

    const [movements, setMovements] = useState([]);
    const [summary, setSummary] = useState({
        ingresos: { total: 0, n: 0 },
        egresos:  { total: 0, n: 0 },
        neto: 0,
        by_kind: [],
    });
    const [kindOptions, setKindOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState(null);

    function firstDayOfMonth() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    }
    function todayIso() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    function quickRanges() {
        const hoy = new Date();
        const yy = hoy.getFullYear(), mm = hoy.getMonth();
        const pad = n => String(n).padStart(2, '0');
        const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        return [
            { label: 'Este mes',     from: `${yy}-${pad(mm+1)}-01`, to: iso(hoy) },
            { label: 'Mes anterior', from: `${yy}-${pad(mm)}-01`,
              to: iso(new Date(yy, mm, 0)) },
            { label: 'Este año',     from: `${yy}-01-01`, to: iso(hoy) },
            { label: 'Año anterior', from: `${yy-1}-01-01`, to: `${yy-1}-12-31` },
        ];
    }

    useEffect(() => {
        api.get('/cash-movements/kinds/').then(r => setKindOptions(r.data.kinds || []))
            .catch(() => {});
    }, []);

    useEffect(() => { fetchAll(); }, [dateFrom, dateTo, selectedBranch, kindFilter, directionFilter]);

    async function fetchAll() {
        setLoading(true);
        try {
            const params = { page_size: 1000 };
            if (dateFrom)       params.date_from = dateFrom;
            if (dateTo)         params.date_to = dateTo;
            if (selectedBranch) params.branch = selectedBranch;
            if (kindFilter)     params.kind = kindFilter;
            if (directionFilter) params.direction = directionFilter;
            const [movRes, summRes] = await Promise.all([
                api.get('/cash-movements/', { params }),
                api.get('/cash-movements/summary/', { params: {
                    date_from: dateFrom, date_to: dateTo,
                    ...(selectedBranch ? { branch: selectedBranch } : {}),
                }}),
            ]);
            setMovements(movRes.data.results || movRes.data);
            setSummary(summRes.data);
        } catch (err) {
            toast.error('No se pudo cargar el flujo de caja');
        } finally { setLoading(false); }
    }

    async function deleteMovement(m) {
        if (m.is_auto) {
            toast.error('Este movimiento es automático — cambiá la venta o cuota de origen');
            return;
        }
        if (!confirm(`¿Borrar este movimiento del ${formatDate(m.date)}?`)) return;
        try {
            await api.delete(`/cash-movements/${m.id}/`);
            toast.success('Movimiento borrado');
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'No se pudo borrar');
        }
    }

    function kindLabel(k) {
        return kindOptions.find(o => o.value === k)?.label || k;
    }

    function kindBadgeClass(k, direction) {
        if (direction === 'out') return 'bg-red-100 text-red-800';
        if (k === 'cobro_cuota')    return 'bg-green-100 text-green-800';
        if (k === 'venta_contado')  return 'bg-emerald-100 text-emerald-800';
        if (k === 'seña_credito')   return 'bg-blue-100 text-blue-800';
        if (k === 'pago_a_cuenta')  return 'bg-cyan-100 text-cyan-800';
        return 'bg-gray-100 text-gray-800';
    }

    return (
        <div className="max-w-7xl">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Flujo de caja</h1>
                    <p className="text-gray-600">
                        Ingresos y egresos del período
                        {selectedBranch && branches.length > 1
                            ? <> — <strong>{branches.find(b => String(b.id) === String(selectedBranch))?.name}</strong></>
                            : ''}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setShowCreate(true)}>+ Nuevo movimiento</Button>
                    <Button variant="secondary" onClick={fetchAll}>↻ Refrescar</Button>
                </div>
            </div>

            {/* Filtros */}
            <Card className="mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                        <input type="date" value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 border rounded text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                        <input type="date" value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 border rounded text-sm" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {quickRanges().map(r => (
                            <button key={r.label} type="button"
                                onClick={() => { setDateFrom(r.from); setDateTo(r.to); }}
                                className={`px-3 py-1.5 text-xs border rounded hover:bg-gray-100 ${
                                    dateFrom === r.from && dateTo === r.to ? 'bg-blue-100 border-blue-300' : ''
                                }`}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)}
                            className="px-3 py-2 border rounded text-sm">
                            <option value="">Todos</option>
                            {kindOptions.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                        <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)}
                            className="px-3 py-2 border rounded text-sm">
                            <option value="">Todas</option>
                            <option value="in">Solo ingresos</option>
                            <option value="out">Solo egresos</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card>
                    <div className="text-xs text-gray-500 uppercase">Ingresos</div>
                    <div className="text-3xl font-bold text-green-700 mt-1">{formatGs(summary.ingresos?.total)}</div>
                    <div className="text-xs text-gray-500 mt-1">{summary.ingresos?.n} movimientos</div>
                </Card>
                <Card>
                    <div className="text-xs text-gray-500 uppercase">Egresos</div>
                    <div className="text-3xl font-bold text-red-700 mt-1">{formatGs(summary.egresos?.total)}</div>
                    <div className="text-xs text-gray-500 mt-1">{summary.egresos?.n} movimientos</div>
                </Card>
                <Card className={summary.neto >= 0 ? '' : 'bg-red-50 border-red-200'}>
                    <div className="text-xs text-gray-500 uppercase">Saldo neto</div>
                    <div className={`text-3xl font-bold mt-1 ${summary.neto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatGs(summary.neto)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Ingresos − Egresos</div>
                </Card>
            </div>

            {/* Distribución por tipo */}
            {summary.by_kind?.length > 0 && (
                <Card className="mb-4" title="Distribución por tipo">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        {summary.by_kind.map((b, i) => (
                            <div key={i} className="flex justify-between border-b py-1 text-sm">
                                <span>
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                        b.direction === 'in' ? 'bg-green-500' : 'bg-red-500'
                                    }`}></span>
                                    {kindLabel(b.kind)}
                                </span>
                                <span className={b.direction === 'in' ? 'text-green-700' : 'text-red-700'}>
                                    {b.direction === 'out' && '-'}{formatGs(b.total)} ({b.n})
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Tabla de movimientos */}
            <Card>
                {loading
                    ? <TableSkeleton rows={10} cols={6} />
                    : movements.length === 0
                        ? <EmptyState
                            emoji="💰"
                            title="Sin movimientos en este período"
                            description="Probá cambiar el rango de fechas o cargar un movimiento manual con + Nuevo movimiento."
                        />
                        : <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Fecha</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Tipo</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Operación</th>
                                        <th className="px-3 py-2 text-right text-xs uppercase">Monto</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase">Origen</th>
                                        <th className="px-3 py-2 text-right text-xs uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map(m => (
                                        <tr key={m.id} className="border-b hover:bg-gray-50">
                                            <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.date)}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                    kindBadgeClass(m.kind, m.direction)
                                                }`}>{m.kind_display}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div>{m.description}</div>
                                                {m.provider && <div className="text-xs text-gray-500">Proveedor: {m.provider}</div>}
                                                {m.currency === 'USD' && m.amount_usd && (
                                                    <div className="text-xs text-gray-500">
                                                        USD {m.amount_usd} · TC {m.exchange_rate}
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${
                                                m.direction === 'in' ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                                {m.direction === 'out' && '-'}{formatGs(m.amount)}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                {m.is_auto
                                                    ? <span title="Generado por venta/cobranza" className="text-gray-500">⚙ auto</span>
                                                    : <span title="Cargado manualmente" className="text-gray-700">✏ manual</span>}
                                                {m.sale_number && <div className="font-mono text-xs">{m.sale_number}</div>}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {!m.is_auto && (
                                                    <>
                                                        <Button size="sm" variant="secondary" onClick={() => setEditing(m)}>✏</Button>
                                                        {' '}
                                                        <Button size="sm" variant="danger" onClick={() => deleteMovement(m)}>🗑</Button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                          </div>
                }
            </Card>

            {showCreate && (
                <CashMovementModal
                    kindOptions={kindOptions}
                    onClose={() => setShowCreate(false)}
                    onSaved={() => { setShowCreate(false); fetchAll(); toast.success('Movimiento creado'); }}
                />
            )}
            {editing && (
                <CashMovementModal
                    movement={editing}
                    kindOptions={kindOptions}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); fetchAll(); toast.success('Movimiento actualizado'); }}
                />
            )}
        </div>
    );
}

/* ---------- Modal crear/editar ---------- */
function CashMovementModal({ movement, kindOptions, onClose, onSaved }) {
    const isEdit = !!movement;
    const { toast } = useToast();
    const { branches } = useBranch();
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');

    const [form, setForm] = React.useState({
        date: movement?.date || new Date().toISOString().slice(0, 10),
        kind: movement?.kind || 'gasto_playa',
        direction: movement?.direction || 'out',
        amount: movement?.amount || '',
        description: movement?.description || '',
        currency: movement?.currency || 'PYG',
        amount_usd: movement?.amount_usd || '',
        exchange_rate: movement?.exchange_rate || '',
        provider: movement?.provider || '',
        branch: movement?.branch || '',
        notes: movement?.notes || '',
    });

    function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

    async function submit(e) {
        e.preventDefault();
        setSaving(true); setErrorText('');
        try {
            const payload = {
                date: form.date,
                kind: form.kind,
                direction: form.direction,
                amount: form.amount,
                description: form.description,
                currency: form.currency,
                provider: form.provider,
                notes: form.notes,
                branch: form.branch || null,
            };
            if (form.currency === 'USD') {
                payload.amount_usd = form.amount_usd || null;
                payload.exchange_rate = form.exchange_rate || null;
            }
            if (isEdit) {
                await api.patch(`/cash-movements/${movement.id}/`, payload);
            } else {
                await api.post('/cash-movements/', payload);
            }
            onSaved();
        } catch (err) {
            setErrorText(JSON.stringify(err.response?.data || err.message, null, 2));
        } finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold">{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                </div>
                <form onSubmit={submit} className="p-4 space-y-3">
                    {errorText && (
                        <div className="bg-red-50 border border-red-300 rounded p-3">
                            <strong className="text-red-700 text-sm block mb-2">Error</strong>
                            <pre className="text-xs whitespace-pre-wrap">{errorText}</pre>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Fecha *">
                            <input type="date" value={form.date}
                                onChange={e => set('date', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="Sucursal">
                            <select value={form.branch} onChange={e => set('branch', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="">— Sin sucursal —</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Tipo *">
                            <select value={form.kind} onChange={e => set('kind', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required>
                                {kindOptions.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Dirección *">
                            <div className="flex gap-3 pt-2">
                                <label className="flex items-center gap-1 text-sm">
                                    <input type="radio" name="direction" value="in"
                                        checked={form.direction === 'in'}
                                        onChange={() => set('direction', 'in')} />
                                    <span className="text-green-700">Ingreso</span>
                                </label>
                                <label className="flex items-center gap-1 text-sm">
                                    <input type="radio" name="direction" value="out"
                                        checked={form.direction === 'out'}
                                        onChange={() => set('direction', 'out')} />
                                    <span className="text-red-700">Egreso</span>
                                </label>
                            </div>
                        </Field>
                        <Field label="Monto en Gs. *">
                            <input type="number" step="1" min="0" value={form.amount}
                                onChange={e => set('amount', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="Moneda">
                            <select value={form.currency} onChange={e => set('currency', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="PYG">Guaraní</option>
                                <option value="USD">USD (con tipo de cambio)</option>
                            </select>
                        </Field>
                        {form.currency === 'USD' && <>
                            <Field label="Monto USD original">
                                <input type="number" step="0.01" value={form.amount_usd}
                                    onChange={e => set('amount_usd', e.target.value)}
                                    className="w-full px-3 py-2 border rounded" />
                            </Field>
                            <Field label="Tipo de cambio">
                                <input type="number" step="0.01" value={form.exchange_rate}
                                    onChange={e => set('exchange_rate', e.target.value)}
                                    placeholder="Ej: 6600"
                                    className="w-full px-3 py-2 border rounded" />
                            </Field>
                        </>}
                        <Field label="Proveedor (opcional)">
                            <input type="text" value={form.provider}
                                onChange={e => set('provider', e.target.value)}
                                placeholder="Ej: AUTOWINI, DADANI..."
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                    </div>
                    <Field label="Operación / descripción *">
                        <textarea value={form.description} rows={2}
                            onChange={e => set('description', e.target.value)}
                            placeholder="Ej: PAGO DE ALQUILER FEBRERO/26"
                            className="w-full px-3 py-2 border rounded" required />
                    </Field>
                    <Field label="Notas">
                        <textarea value={form.notes} rows={2}
                            onChange={e => set('notes', e.target.value)}
                            className="w-full px-3 py-2 border rounded" />
                    </Field>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Guardando...' : (isEdit ? 'Guardar' : 'Crear')}
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
