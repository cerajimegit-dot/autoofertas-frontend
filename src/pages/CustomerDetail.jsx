/**
 * Página /customers/:id — historial completo de un cliente.
 *
 * Reemplaza la "hoja del cliente" del Excel viejo:
 *   - Datos personales (con alerta si el documento es autogenerado).
 *   - Resumen financiero: total comprado, total cobrado, saldo pendiente,
 *     saldo vencido — todo calculado en línea desde sus cuotas.
 *   - Listado de ventas con número, fecha, vehículo, total, sucursal,
 *     forma de pago. Cada una linkea al modal de cuotas.
 *   - Listado completo de cuotas con estado dinámico (is_overdue) y
 *     acción "Pagar" / "WhatsApp" por cuota.
 *   - Botón WhatsApp general al cliente.
 */

const { useState, useEffect, useMemo } = React;
const { useParams, useHistory, Link } = window.ReactRouterDOM;

function CustomerDetail() {
    const { id } = useParams();
    const history = useHistory();
    const { toast } = useToast();
    const { branches } = useBranch();

    const [customer, setCustomer] = useState(null);
    const [sales, setSales] = useState([]);
    const [quotas, setQuotas] = useState([]);
    const [summary, setSummary] = useState({
        tot_comprado: 0, n_ventas: 0,
        tot_cobrado: 0, n_pagadas: 0,
        tot_pendiente: 0, n_pendientes: 0,
        tot_vencido: 0, n_vencidas: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [payingQuota, setPayingQuota] = useState(null);

    useEffect(() => { fetchAll(); }, [id]); // eslint-disable-line

    async function fetchAll() {
        setLoading(true); setError('');
        try {
            // 1 sola llamada al backend; antes eran 3 round-trips paralelos a
            // Supabase São Paulo (~200ms cada uno de overhead RTT). El backend
            // hace todo en una conexión + agrega el resumen financiero con
            // agregaciones SQL (no recorre las cuotas en Python).
            const r = await api.get(`/customers/${id}/full/`);
            setCustomer(r.data.customer);
            setSales(r.data.sales || []);
            setQuotas(r.data.quotas || []);
            setSummary(r.data.summary || summary);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar el cliente');
        } finally { setLoading(false); }
    }

    // Quotas agrupadas por venta para el bloque "Cronograma por venta"
    const quotasBySale = useMemo(() => {
        const out = new Map();
        for (const q of quotas) {
            const key = q.sale_number || `sin-numero-${q.sale}`;
            if (!out.has(key)) out.set(key, []);
            out.get(key).push(q);
        }
        // Ordenar cuotas dentro de cada venta por quota_number
        for (const arr of out.values()) {
            arr.sort((a, b) => (a.quota_number || 0) - (b.quota_number || 0));
        }
        return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [quotas]);

    async function openWhatsappCustomer() {
        if (!customer?.phone) {
            toast.error('El cliente no tiene teléfono cargado');
            return;
        }
        // Usamos un mensaje genérico — reutilizamos el endpoint de la primera
        // cuota vencida o pendiente para no duplicar código de normalización.
        const target = quotas.find(q => q.is_overdue) || quotas.find(q => q.status === 'pending');
        if (target) {
            try {
                const r = await apiClient.getWhatsAppLink(target.id);
                window.open(r.data.whatsapp_link || r.data.whatsapp_url, '_blank');
                return;
            } catch (err) { /* fallback abajo */ }
        }
        // Sin cuotas: armar link manual con número normalizado por backend
        // (haríamos otra llamada, pero alcanza con un wa.me directo).
        const digits = (customer.phone || '').replace(/\D/g, '');
        const normalized = digits.startsWith('595')
            ? digits
            : digits.startsWith('0') ? '595' + digits.slice(1) : '595' + digits;
        window.open(`https://wa.me/${normalized}`, '_blank');
    }

    if (loading) {
        return (
            <div className="max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Cliente</h1>
                    <p className="text-gray-600">Cargando...</p>
                </div>
                <TableSkeleton rows={6} cols={5} />
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="max-w-3xl">
                <div className="bg-red-50 text-red-700 p-4 rounded">
                    {error || 'Cliente no encontrado'}
                </div>
                <Button variant="secondary" className="mt-3" onClick={() => history.push('/customers')}>
                    ← Volver a clientes
                </Button>
            </div>
        );
    }

    const nombre = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || '(sin nombre)';
    const docAuto = (customer.document_number || '').match(/^(DRV026|SUC026|CUOTA)/i);
    const emailSintetico = (customer.email || '').endsWith('@import.local');

    return (
        <div className="max-w-7xl">
            {/* Header con breadcrumb */}
            <div className="mb-4 text-sm text-gray-600">
                <Link to="/customers" className="hover:underline">Clientes</Link>
                <span className="mx-2">›</span>
                <span className="text-gray-900 font-medium">{nombre}</span>
            </div>

            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{nombre}</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-700">
                        <span className="font-mono">{customer.document_number}</span>
                        {customer.document_type_display && (
                            <span className="text-gray-500">({customer.document_type_display})</span>
                        )}
                        {customer.phone && <span>📞 {customer.phone}</span>}
                        {customer.city && <span>📍 {customer.city}</span>}
                    </div>
                </div>
                <div className="flex gap-2">
                    {customer.phone && (
                        <Button variant="success" onClick={openWhatsappCustomer}>
                            💬 WhatsApp
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => setEditing(true)}>
                        ✏ Editar
                    </Button>
                    <Button variant="secondary" onClick={() => history.push('/customers')}>
                        ← Volver
                    </Button>
                </div>
            </div>

            {/* Avisos de calidad de datos */}
            {docAuto && (
                <div className="bg-yellow-50 border border-yellow-300 text-yellow-900 text-sm rounded p-3 mb-4">
                    ⚠ Documento <strong className="font-mono">{customer.document_number}</strong> generado
                    por la migración. Pedí la cédula real al cliente y editá los datos para que aparezca
                    correctamente en los reportes.
                </div>
            )}
            {!customer.phone && (
                <div className="bg-orange-50 border border-orange-300 text-orange-900 text-sm rounded p-3 mb-4">
                    ⚠ Cliente sin teléfono — no vas a poder mandarle WhatsApp.
                </div>
            )}

            {/* Resumen financiero */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Card>
                    <div className="text-xs text-gray-500 uppercase">Comprado</div>
                    <div className="text-2xl font-bold text-red-700 mt-1">{formatGs(summary.tot_comprado)}</div>
                    <div className="text-xs text-gray-500 mt-1">{sales.length} venta(s)</div>
                </Card>
                <Card>
                    <div className="text-xs text-gray-500 uppercase">Cobrado</div>
                    <div className="text-2xl font-bold text-green-700 mt-1">{formatGs(summary.tot_cobrado)}</div>
                    <div className="text-xs text-gray-500 mt-1">{summary.n_pagadas} cuota(s)</div>
                </Card>
                <Card>
                    <div className="text-xs text-gray-500 uppercase">Saldo pendiente</div>
                    <div className="text-2xl font-bold text-yellow-700 mt-1">{formatGs(summary.tot_pendiente)}</div>
                    <div className="text-xs text-gray-500 mt-1">{summary.n_pendientes} al día + {summary.n_vencidas} vencidas</div>
                </Card>
                <Card className={summary.tot_vencido > 0 ? 'bg-red-50 border border-red-200' : ''}>
                    <div className="text-xs text-gray-500 uppercase">Saldo vencido</div>
                    <div className={`text-2xl font-bold mt-1 ${summary.tot_vencido > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                        {formatGs(summary.tot_vencido)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{summary.n_vencidas} cuota(s) vencidas</div>
                </Card>
            </div>

            {/* Ventas */}
            <Card className="mb-6" title="Ventas">
                {sales.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-4">Este cliente todavía no tiene ventas registradas.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 border-b">
                                <tr>
                                    <th className="text-left py-2">Número</th>
                                    <th className="text-left py-2">Fecha</th>
                                    {branches.length > 1 && <th className="text-left py-2">Sucursal</th>}
                                    <th className="text-left py-2">Vehículo</th>
                                    <th className="text-right py-2">Total</th>
                                    <th className="text-left py-2">Pago</th>
                                    <th className="text-left py-2">Contrato</th>
                                    <th className="text-left py-2">Cobranza</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map(s => (
                                    <tr key={s.id} className="border-b hover:bg-gray-50">
                                        <td className="py-2 font-mono font-semibold">{s.sale_number}</td>
                                        <td className="py-2">{formatDate(s.sale_date)}</td>
                                        {branches.length > 1 && (
                                            <td className="py-2 text-xs">
                                                {s.branch_name && (
                                                    <span className={`px-2 py-0.5 rounded font-medium ${
                                                        s.branch_name === 'CASA CENTRAL'
                                                            ? 'bg-indigo-100 text-indigo-800'
                                                            : 'bg-teal-100 text-teal-800'
                                                    }`}>{s.branch_name}</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="py-2">
                                            <div>{s.vehicle_info}</div>
                                            {s.vehicle_vin && <div className="text-xs text-gray-500 font-mono">Chasis: {s.vehicle_vin}</div>}
                                        </td>
                                        <td className="py-2 text-right font-semibold">{formatGs(s.total_price)}</td>
                                        <td className="py-2 text-xs">{s.payment_form_name || '-'}</td>
                                        <td className="py-2">{saleStatusBadge(s.status, s.status_display)}</td>
                                        <td className="py-2">
                                            {collectionStatusBadge(s.collection_status, s.collection_status_display, s.collection_summary)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Cuotas agrupadas por venta */}
            {quotasBySale.length > 0 && (
                <Card title="Cuotas por venta">
                    <div className="space-y-6">
                        {quotasBySale.map(([saleNumber, qs]) => {
                            const total = qs.reduce((s, q) => s + Number(q.amount || 0), 0);
                            const pagado = qs.filter(q => q.status === 'paid').reduce((s, q) => s + Number(q.amount || 0), 0);
                            return (
                                <div key={saleNumber}>
                                    <div className="flex justify-between items-baseline mb-2">
                                        <h4 className="font-semibold text-gray-800 font-mono">
                                            {saleNumber}
                                        </h4>
                                        <div className="text-xs text-gray-600">
                                            {qs.filter(q => q.status === 'paid').length}/{qs.length} cobradas ·
                                            {' '}{formatGs(pagado)} / {formatGs(total)}
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs text-gray-500 border-b bg-gray-50">
                                                <tr>
                                                    <th className="text-left px-2 py-1.5">N°</th>
                                                    <th className="text-left px-2 py-1.5">Plan</th>
                                                    <th className="text-right px-2 py-1.5">Monto</th>
                                                    <th className="text-left px-2 py-1.5">Vence</th>
                                                    <th className="text-left px-2 py-1.5">Estado</th>
                                                    <th className="text-left px-2 py-1.5">Cobrado</th>
                                                    <th className="text-left px-2 py-1.5">Forma</th>
                                                    <th className="text-right px-2 py-1.5">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {qs.map(q => (
                                                    <tr key={q.id} className={`border-b ${q.is_overdue ? 'bg-red-50/40' : ''}`}>
                                                        <td className="px-2 py-1.5">{q.quota_number}{q.total_plan ? `/${q.total_plan}` : ''}</td>
                                                        <td className="px-2 py-1.5 text-xs text-gray-600">{q.plan_name || '-'}</td>
                                                        <td className="px-2 py-1.5 text-right font-semibold">{formatGs(q.amount)}</td>
                                                        <td className="px-2 py-1.5">{formatDate(q.due_date)}</td>
                                                        <td className="px-2 py-1.5">
                                                            {quotaStatusBadge(q.status, q.status_display, q.is_overdue)}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-xs">
                                                            {q.payment_date ? formatDate(q.payment_date) : '-'}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-xs">
                                                            {q.payment_method
                                                                ? <span className="font-mono px-1.5 py-0.5 bg-gray-100 rounded" title={q.payment_method_display}>
                                                                      {q.payment_method}
                                                                  </span>
                                                                : <span className="text-gray-400">-</span>}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {q.status !== 'paid' && (
                                                                <Button size="sm" variant="success"
                                                                    onClick={() => setPayingQuota(q)}>
                                                                    ✓ Pagar
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Modal: editar cliente */}
            {editing && (
                <CustomerEditModal
                    customer={customer}
                    onClose={() => setEditing(false)}
                    onSaved={() => {
                        setEditing(false);
                        fetchAll();
                        toast.success('Cliente actualizado');
                    }}
                />
            )}

            {/* Modal: registrar pago */}
            {payingQuota && (
                <PayQuotaModal
                    quota={payingQuota}
                    onClose={() => setPayingQuota(null)}
                    onPaid={() => {
                        setPayingQuota(null);
                        fetchAll();
                        toast.success('Cuota cobrada');
                    }}
                />
            )}
        </div>
    );
}
