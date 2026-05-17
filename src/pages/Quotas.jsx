/**
 * Página Gestión de Cuotas — listado, marcar pago con fecha real y forma,
 * generar link de WhatsApp con teléfono normalizado y mensaje en español PY.
 */

const { useState, useEffect, useMemo } = React;

function Quotas() {
    const [quotas, setQuotas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState('overdue'); // overdue | pending | paid | all
    const [search, setSearch] = useState('');
    const [payingQuota, setPayingQuota] = useState(null);

    const { selectedBranch, branches } = useBranch();
    const { toast } = useToast();

    useEffect(() => {
        fetchQuotas();
    }, [filterStatus, selectedBranch]);

    async function fetchQuotas() {
        setLoading(true);
        try {
            // El estado "overdue" en /quotas con status=overdue solo trae las que
            // tienen ese estado literal en BD (62 actualmente, mientras hay ~970
            // pendientes con vencimiento pasado). Usamos el endpoint /overdue/
            // para los vencidos "de facto".
            let response;
            const branchParam = selectedBranch ? { branch: selectedBranch } : {};
            if (filterStatus === 'overdue') {
                response = await api.get('/quotas/overdue/', {
                    params: { page_size: 1000, ...branchParam },
                });
            } else {
                const params = { page_size: 1000, ...branchParam };
                if (filterStatus !== 'all') params.status = filterStatus;
                response = await api.get('/quotas/', { params });
            }
            const data = response.data.results || response.data;
            setQuotas(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar cuotas');
        } finally {
            setLoading(false);
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return quotas;
        return quotas.filter(c =>
            (c.customer_name  || '').toLowerCase().includes(q) ||
            (c.sale_number    || '').toLowerCase().includes(q) ||
            (c.plan_name      || '').toLowerCase().includes(q)
        );
    }, [quotas, search]);

    async function generateWhatsAppLink(quota) {
        if (!quota.customer_id) {
            toast.error('Esta cuota no tiene cliente asignado');
            return;
        }
        try {
            const response = await apiClient.getWhatsAppLink(quota.id);
            const url = response.data.whatsapp_link || response.data.whatsapp_url;
            if (!url) throw new Error('Sin link');
            window.open(url, '_blank');
        } catch (err) {
            const msg = err.response?.data?.error || 'No se pudo generar el link';
            toast.error(msg);
        }
    }

    const totals = useMemo(() => {
        const tot = filtered.reduce((s, q) => s + Number(q.amount || 0), 0);
        return { count: filtered.length, monto: tot };
    }, [filtered]);

    if (loading) {
        return (
            <div className="max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Cuotas</h1>
                    <p className="text-gray-600">Cargando...</p>
                </div>
                <TableSkeleton rows={10} cols={6} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Cuotas por cobrar</h1>
                    <p className="text-gray-600">
                        Mostrando <strong>{totals.count}</strong> cuotas
                        {' '}por <strong>{formatGs(totals.monto)}</strong>
                        {selectedBranch ? (
                            <> — sucursal <strong>{branches.find(b => String(b.id) === String(selectedBranch))?.name}</strong></>
                        ) : branches.length > 1 ? (
                            <> — todas las sucursales</>
                        ) : null}
                    </p>
                </div>
                <Button variant="secondary" onClick={fetchQuotas}>↻ Refrescar</Button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 mb-4">
                {[
                    ['overdue', 'Vencidas'],
                    ['pending', 'Pendientes'],
                    ['paid',    'Cobradas'],
                    ['all',     'Todas'],
                ].map(([key, label]) => (
                    <Button
                        key={key}
                        variant={filterStatus === key ? 'primary' : 'secondary'}
                        onClick={() => setFilterStatus(key)}
                    >
                        {label}
                    </Button>
                ))}
            </div>

            <div className="mb-4">
                <input type="text" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por cliente, número de venta o plan..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            {/* Tabla de cuotas */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Venta</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">N°</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Monto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vence</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Forma</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((quota) => {
                                const venc = quota.due_date;
                                const isOverdue = venc && new Date(venc) < new Date(new Date().toDateString())
                                                  && quota.status !== 'paid';
                                return (
                                    <tr key={quota.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-sm">
                                            {quota.sale_number || <span className="text-gray-400 italic">sin venta</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">
                                            {quota.quota_number}{quota.total_plan ? `/${quota.total_plan}` : ''}
                                            {quota.plan_name && (
                                                <div className="text-xs text-gray-500">{quota.plan_name}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {quota.customer_name || <span className="text-red-600">⚠ Sin cliente</span>}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-sm">{formatGs(quota.amount)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {formatDate(venc)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {quotaStatusBadge(quota.status, quota.status_display, isOverdue)}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {quota.payment_method
                                                ? <span className="font-mono px-1.5 py-0.5 bg-gray-100 rounded" title={quota.payment_method_display}>
                                                      {quota.payment_method}
                                                  </span>
                                                : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                {quota.status !== 'paid' && (
                                                    <Button size="sm" variant="success"
                                                        onClick={() => setPayingQuota(quota)}>
                                                        ✓ Pagar
                                                    </Button>
                                                )}
                                                {quota.status !== 'paid' && quota.customer_id && (
                                                    <Button size="sm" variant="secondary"
                                                        onClick={() => generateWhatsAppLink(quota)}>
                                                        💬 WhatsApp
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filtered.length === 0 && (
                    search
                        ? <EmptyState filtered onClear={() => setSearch('')} />
                        : <EmptyState
                            emoji="✅"
                            title="No hay cuotas en este filtro"
                            description={
                                filterStatus === 'overdue'
                                    ? 'Ningún cliente tiene cuotas vencidas. Si esperás ver alguno, probá cambiar de sucursal.'
                                    : 'Cuando registres ventas a crédito, las cuotas aparecerán acá.'
                            }
                        />
                )}
            </Card>

            {/* Modal de confirmación de pago */}
            {payingQuota && (
                <PayQuotaModal
                    quota={payingQuota}
                    onClose={() => setPayingQuota(null)}
                    onPaid={() => { setPayingQuota(null); fetchQuotas(); toast.success('Cuota cobrada'); }}
                />
            )}
        </div>
    );
}

/* ---------- Modal: registrar pago con fecha y forma ---------- */
function PayQuotaModal({ quota, onClose, onPaid }) {
    const { toast } = useToast();
    const todayStr = new Date().toISOString().slice(0, 10);
    const [paymentDate, setPaymentDate] = React.useState(todayStr);
    const [note, setNote] = React.useState('');
    const [forma, setForma] = React.useState('EF');
    const [saving, setSaving] = React.useState(false);

    async function submit() {
        setSaving(true);
        try {
            // payment_method ahora vive como campo propio en Quotum (FK choice).
            // La nota libre va aparte, sin prefijos.
            await apiClient.markQuotaAsPaid(quota.id, {
                payment_date: paymentDate,
                payment_method: forma,
                notes: note || undefined,
            });
            onPaid();
        } catch (err) {
            const msg = err.response?.data?.detail
                || err.response?.data?.payment_date
                || err.response?.data?.payment_method
                || 'No se pudo registrar el pago';
            toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold">Registrar pago</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="bg-slate-50 p-3 rounded text-sm">
                        <div><strong>Venta:</strong> {quota.sale_number || '(sin nº)'}</div>
                        <div><strong>Cliente:</strong> {quota.customer_name || '(sin cliente)'}</div>
                        <div><strong>Cuota N°:</strong> {quota.quota_number}{quota.total_plan ? `/${quota.total_plan}` : ''}</div>
                        <div><strong>Monto:</strong> {formatGs(quota.amount)}</div>
                        <div><strong>Vencía:</strong> {formatDate(quota.due_date)}</div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha en que se cobró</label>
                        <input type="date" value={paymentDate}
                            onChange={e => setPaymentDate(e.target.value)}
                            max={todayStr}
                            className="w-full px-3 py-2 border rounded" />
                        <p className="text-xs text-gray-500 mt-1">
                            Si se cobró antes (TB del banco, cheque demorado), ponele la fecha real.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                ['EF', 'Efectivo'],
                                ['TB', 'Transferencia'],
                                ['CJ', 'Caja'],
                                ['AC', 'Acuerdo'],
                            ].map(([k, l]) => (
                                <label key={k} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${forma === k ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>
                                    <input type="radio" name="forma" value={k}
                                        checked={forma === k}
                                        onChange={() => setForma(k)} />
                                    <strong className="font-mono">{k}</strong> {l}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
                        <input type="text" value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Ej: N° comprobante, banco..."
                            className="w-full px-3 py-2 border rounded" />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                        <Button variant="success" onClick={submit} disabled={saving}>
                            {saving ? 'Registrando...' : '✓ Registrar pago'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
