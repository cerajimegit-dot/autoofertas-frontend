/**
 * Dashboard gerencial
 */

const { useState, useEffect, useMemo } = React;
const { Link: RouterLink } = window.ReactRouterDOM;

/** Primer día del mes actual en formato YYYY-MM-DD */
function firstOfMonth() {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yy}-${mm}-01`;
}
function today() {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/** Genera rangos rápidos */
function quickRanges() {
    const hoy = new Date();
    const yy = hoy.getFullYear(), mm = hoy.getMonth();
    const pad = n => String(n).padStart(2, '0');
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return [
        { label: 'Este mes', from: `${yy}-${pad(mm+1)}-01`, to: iso(hoy) },
        { label: 'Mes anterior', from: `${yy}-${pad(mm)}-01`,
          to: iso(new Date(yy, mm, 0)) },
        { label: 'Este año', from: `${yy}-01-01`, to: iso(hoy) },
        { label: 'Año anterior', from: `${yy-1}-01-01`, to: `${yy-1}-12-31` },
        { label: 'Últimos 90 días',
          from: iso(new Date(hoy.getTime() - 90*86400000)), to: iso(hoy) },
    ];
}

function Dashboard() {
    const [dateFrom, setDateFrom] = useState(firstOfMonth());
    const [dateTo,   setDateTo]   = useState(today());
    const { selectedBranch, branches } = useBranch();

    const [data, setData] = useState({
        summary: null, salesByMonth: null, quotasStatus: null,
        topCustomers: null, inventoryStats: null, ranking: null,
        morosos: null, aging: null, paymentForms: null, alertas: null,
        dataQuality: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Re-fetch al cambiar fechas o sucursal seleccionada.
    useEffect(() => { fetchAll(); }, [dateFrom, dateTo, selectedBranch]); // eslint-disable-line

    async function fetchAll() {
        setLoading(true);
        setError('');
        const branchParam = selectedBranch ? { branch: selectedBranch } : {};
        const params = { date_from: dateFrom, date_to: dateTo, ...branchParam };
        try {
            const [
                summary, salesByMonth, quotasStatus, topCustomers, inventoryStats,
                ranking, morosos, aging, paymentForms, alertas, dataQuality,
            ] = await Promise.allSettled([
                apiClient.getDashboardSummary(params),
                apiClient.getSalesByMonth(branchParam),
                apiClient.getQuotasStatus(branchParam),
                apiClient.getTopCustomers(branchParam),
                apiClient.getInventoryStats(branchParam),
                apiClient.getVehicleModelsRanking(params),
                apiClient.getTopMorosos(branchParam),
                apiClient.getAgingCuotas(branchParam),
                apiClient.getSalesByPaymentForm(params),
                apiClient.getAlertas(branchParam),
                apiClient.getDataQuality(branchParam),
            ]);
            const unwrap = r => r.status === 'fulfilled' ? r.value.data : null;
            setData({
                summary: unwrap(summary),
                salesByMonth: unwrap(salesByMonth),
                quotasStatus: unwrap(quotasStatus),
                topCustomers: unwrap(topCustomers),
                inventoryStats: unwrap(inventoryStats),
                ranking: unwrap(ranking),
                morosos: unwrap(morosos),
                aging: unwrap(aging),
                paymentForms: unwrap(paymentForms),
                alertas: unwrap(alertas),
                dataQuality: unwrap(dataQuality),
            });
            const failed = [summary, salesByMonth, quotasStatus, topCustomers, inventoryStats,
                            ranking, morosos, aging, paymentForms, alertas, dataQuality]
                .filter(r => r.status === 'rejected');
            if (failed.length) {
                console.warn('Dashboard: fallaron', failed);
                setError(`${failed.length} bloque(s) no cargaron — ver consola`);
            }
        } finally {
            setLoading(false);
        }
    }

    const branchName = selectedBranch
        ? (branches.find(b => String(b.id) === String(selectedBranch))?.name || '')
        : '';

    if (loading && !data.summary) {
        return <div className="flex items-center justify-center h-96"><div className="loading"></div></div>;
    }

    const s = data.summary || {};
    const a = data.alertas || {};

    return (
        <div className="max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">
                    {branchName
                        ? <>Mostrando sólo <strong>{branchName}</strong></>
                        : branches.length > 1
                            ? <>Mostrando <strong>todas las sucursales</strong> (cambiá el selector arriba para filtrar)</>
                            : <>Panel gerencial</>}
                </p>
            </div>

            {/* Filtro de período */}
            <Card className="mb-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                        <input type="date" value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                        <input type="date" value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 border rounded" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {quickRanges().map(r => (
                            <button key={r.label} type="button"
                                onClick={() => { setDateFrom(r.from); setDateTo(r.to); }}
                                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-100">
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" onClick={fetchAll}>↻ Refrescar</Button>
                </div>
            </Card>

            {error && <div className="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 text-sm">⚠ {error}</div>}

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card title="Vehículos">
                    <div className="text-3xl font-bold text-red-600">{formatInt(s.total_vehicles)}</div>
                    <p className="text-gray-600 text-sm">{formatInt(s.inventario_disponible)} disponibles</p>
                </Card>
                <Card title="Ventas del período">
                    <div className="text-3xl font-bold text-green-600">{formatGs(s.ventas_mes?.monto)}</div>
                    <p className="text-gray-600 text-sm">{formatInt(s.ventas_mes?.total)} ventas</p>
                </Card>
                <Card title="Cobrado del período">
                    <div className="text-3xl font-bold text-emerald-600">{formatGs(s.cobrado_periodo?.monto)}</div>
                    <p className="text-gray-600 text-sm">{formatInt(s.cobrado_periodo?.total)} cuotas cobradas</p>
                </Card>
                <Card title="Cartera vencida">
                    <div className="text-3xl font-bold text-red-600">{formatGs(s.cuotas_vencidas?.monto)}</div>
                    <p className="text-gray-600 text-sm">{formatInt(s.cuotas_vencidas?.total)} cuotas · {formatInt(s.cuotas_pendientes?.total)} pendientes totales</p>
                </Card>
            </div>

            {/* Ratios gerenciales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <MiniStat label="Ratio de cobranza" value={`${a.ratio_cobranza_pct ?? 0}%`}
                    color="text-red-600"
                    hint={`Cobrado / (cobrado + pendiente)`} />
                <MiniStat label="Morosidad" value={`${a.ratio_morosidad_pct ?? 0}%`}
                    color="text-orange-600"
                    hint="Vencido / pendiente" />
                <MiniStat label="Cartera pendiente" value={formatGs(a.cartera_pendiente)}
                    color="text-yellow-700" />
                <MiniStat label="Cartera cobrada" value={formatGs(a.cartera_cobrada)}
                    color="text-green-700" />
            </div>

            {/* Panel de inconsistencias — calidad de datos */}
            <DataQualityPanel data={data.dataQuality} />

            {/* Ranking + Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {data.ranking?.models?.length > 0 && (
                    <Card title={`Top modelos vendidos (período)`}>
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 border-b">
                                <tr>
                                    <th className="text-left py-1">#</th>
                                    <th className="text-left py-1">Modelo</th>
                                    <th className="text-right py-1">Ventas</th>
                                    <th className="text-right py-1">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.ranking.models.map((m, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="py-1 text-gray-500">{i+1}</td>
                                        <td className="py-1">{m.modelo}</td>
                                        <td className="py-1 text-right font-medium">{m.ventas}</td>
                                        <td className="py-1 text-right">{formatGs(m.monto)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}

                {data.ranking?.brands?.length > 0 && (
                    <Card title={`Ventas por marca (período)`}>
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 border-b">
                                <tr>
                                    <th className="text-left py-1">Marca</th>
                                    <th className="text-right py-1">Ventas</th>
                                    <th className="text-right py-1">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.ranking.brands.map((b, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="py-1">{b.marca}</td>
                                        <td className="py-1 text-right font-medium">{b.ventas}</td>
                                        <td className="py-1 text-right">{formatGs(b.monto)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}
            </div>

            {/* Forma de pago + Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {data.paymentForms?.data?.length > 0 && (
                    <Card title="Distribución por forma de pago (período)">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 border-b">
                                <tr>
                                    <th className="text-left py-1">Forma</th>
                                    <th className="text-right py-1">Ventas</th>
                                    <th className="text-right py-1">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.paymentForms.data.map((p, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="py-1">{p.forma_pago}</td>
                                        <td className="py-1 text-right font-medium">{p.ventas}</td>
                                        <td className="py-1 text-right">{formatGs(p.monto)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}

                {data.aging?.data && (
                    <Card title="Antigüedad de deuda vencida">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 border-b">
                                <tr>
                                    <th className="text-left py-1">Rango</th>
                                    <th className="text-right py-1">Cuotas</th>
                                    <th className="text-right py-1">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.aging.data.map((r, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="py-1">{r.rango}</td>
                                        <td className="py-1 text-right font-medium">{r.cuotas}</td>
                                        <td className="py-1 text-right">{formatGs(r.monto)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="text-xs text-gray-500 mt-2">
                            Vencen en próx. 7 días: <strong>{a.proximas_7_dias?.cuotas || 0}</strong> ({formatGs(a.proximas_7_dias?.monto)}) ·
                            Próx. 30 días: <strong>{a.proximas_30_dias?.cuotas || 0}</strong> ({formatGs(a.proximas_30_dias?.monto)})
                        </div>
                    </Card>
                )}
            </div>

            {/* Morosos */}
            {data.morosos?.data?.length > 0 && (
                <Card title="Clientes morosos (top 15 por monto vencido)" className="mb-6">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 border-b">
                            <tr>
                                <th className="text-left py-1">Cliente</th>
                                <th className="text-left py-1">Documento</th>
                                <th className="text-left py-1">Teléfono</th>
                                <th className="text-right py-1">Cuotas vencidas</th>
                                <th className="text-right py-1">Monto vencido</th>
                                <th className="text-right py-1">Días de atraso</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.morosos.data.map(m => (
                                <tr key={m.customer_id} className="border-b">
                                    <td className="py-1 font-medium">
                                        <RouterLink to={`/customers/${m.customer_id}`}
                                            className="text-red-700 hover:underline">
                                            {m.nombre}
                                        </RouterLink>
                                    </td>
                                    <td className="py-1 font-mono text-xs">{m.documento}</td>
                                    <td className="py-1 text-xs">{m.telefono}</td>
                                    <td className="py-1 text-right">{m.cuotas_vencidas}</td>
                                    <td className="py-1 text-right text-red-700 font-semibold">{formatGs(m.monto_vencido)}</td>
                                    <td className="py-1 text-right">
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            m.dias_atraso_max > 90 ? 'bg-red-100 text-red-800' :
                                            m.dias_atraso_max > 30 ? 'bg-orange-100 text-orange-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>{m.dias_atraso_max} días</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {/* Ventas por mes + Top clientes + Inventario */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {data.salesByMonth?.data?.length > 0 && (
                    <Card title="Ventas por mes (últimos 12)">
                        <div className="h-64"><SalesChart data={data.salesByMonth.data} /></div>
                    </Card>
                )}
                {data.quotasStatus && (
                    <Card title="Estado global de cuotas">
                        <div className="h-64"><QuotasChart data={data.quotasStatus} /></div>
                    </Card>
                )}
                {data.topCustomers?.data?.length > 0 && (
                    <Card title="Mejores clientes (histórico)">
                        <div className="space-y-2">
                            {data.topCustomers.data.slice(0, 10).map((c, idx) => (
                                <div key={c.customer_id || idx} className="flex justify-between items-center pb-1 border-b text-sm">
                                    <span>
                                        {idx+1}.{' '}
                                        {c.customer_id
                                            ? <RouterLink to={`/customers/${c.customer_id}`}
                                                  className="text-red-700 hover:underline">{c.cliente}</RouterLink>
                                            : c.cliente}
                                    </span>
                                    <span className="font-semibold">{formatGs(c.total_gastado)} · {c.numero_compras}x</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
                {data.inventoryStats && (
                    <Card title="Estado del inventario">
                        <InventoryPanel stats={data.inventoryStats} />
                    </Card>
                )}
            </div>
        </div>
    );
}

/* ---------- Subcomponentes ---------- */

function DataQualityPanel({ data }) {
    const history = window.ReactRouterDOM.useHistory();
    const [open, setOpen] = React.useState(false);
    if (!data) return null;

    // Lista de chequeos, ordenada por severidad y volumen.
    const checks = [
        { key: 'ventas_sin_cliente',     label: 'Ventas sin cliente asignado',
          sev: 'red',    href: '/sales?q=sin_cliente' },
        { key: 'ventas_sin_vehiculo',    label: 'Ventas sin vehículo asignado',
          sev: 'red',    href: '/sales?q=sin_vehiculo' },
        { key: 'ventas_mig',             label: 'Ventas con código MIG (placeholder de migración)',
          sev: 'yellow', href: '/sales?q=mig' },
        { key: 'ventas_placeholder',     label: 'Ventas con código ?? / V000xxx',
          sev: 'yellow', href: '/sales?q=placeholder' },
        { key: 'ventas_sin_vendedor',    label: 'Ventas sin vendedor asignado',
          sev: 'yellow', href: '/sales' },
        { key: 'cuotas_overdue_de_facto',label: 'Cuotas pendientes con vencimiento pasado',
          sev: 'red',    href: '/quotas' },
        { key: 'cuotas_fecha_rara',      label: 'Cuotas con fecha de vencimiento fuera de rango',
          sev: 'red',    href: null },
        { key: 'cuotas_pago_futuro',     label: 'Cuotas marcadas como cobradas con fecha futura',
          sev: 'red',    href: null },
        { key: 'cuotas_monto_cero',      label: 'Cuotas con monto 0',
          sev: 'yellow', href: null },
        { key: 'cuotas_sin_plan',        label: 'Cuotas sin nombre de plan',
          sev: 'gray',   href: null },
        { key: 'vehiculos_inconsistentes', label: 'Vehículos "disponibles" pero ya vendidos',
          sev: 'red',    href: '/vehicles' },
        { key: 'vehiculos_vin_basura',   label: 'Vehículos con VIN de placeholder',
          sev: 'yellow', href: '/vehicles' },
        { key: 'vehiculos_sin_precio',   label: 'Vehículos sin precio cargado',
          sev: 'yellow', href: '/vehicles' },
        { key: 'clientes_doc_auto',      label: 'Clientes con documento autogenerado',
          sev: 'yellow', href: '/customers?q=auto' },
        { key: 'clientes_email_sintetico',label: 'Clientes con email "@import.local"',
          sev: 'gray',   href: '/customers' },
        { key: 'clientes_sin_telefono',  label: 'Clientes sin teléfono',
          sev: 'gray',   href: '/customers?q=sin_tel' },
    ].map(c => ({
        ...c,
        count: data[c.key]?.count || 0,
        monto: data[c.key]?.monto,
        sample: data[c.key]?.sample,
    })).filter(c => c.count > 0);

    if (checks.length === 0) {
        return (
            <Card className="mb-6 bg-green-50 border border-green-200">
                <div className="text-sm text-green-800">
                    ✅ Sin inconsistencias detectadas en los datos cargados.
                </div>
            </Card>
        );
    }

    const totalCount = checks.reduce((s, c) => s + c.count, 0);

    const sevClass = sev => ({
        red:    'bg-red-100 text-red-800 border-red-200',
        yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        gray:   'bg-gray-100 text-gray-700 border-gray-200',
    })[sev];

    const visible = open ? checks : checks.slice(0, 4);

    return (
        <Card className="mb-6 border-l-4 border-l-red-400">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-semibold text-gray-800">
                        ⚠ Datos a revisar
                    </h3>
                    <p className="text-xs text-gray-600">
                        {totalCount} inconsistencias en {checks.length} categorías.
                        Hacé click en cada fila para ir al listado filtrado.
                    </p>
                </div>
                <button onClick={() => setOpen(o => !o)}
                    className="text-sm text-red-600 hover:underline">
                    {open ? 'Ver menos' : `Ver todas (${checks.length})`}
                </button>
            </div>

            <div className="space-y-1">
                {visible.map(c => (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => c.href && history.push(c.href)}
                        disabled={!c.href}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${sevClass(c.sev)} ${c.href ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}>
                        <span className="text-left">{c.label}</span>
                        <span className="font-semibold whitespace-nowrap">
                            {c.count.toLocaleString('es-PY')}
                            {c.monto != null && c.monto > 0 && (
                                <> · {formatGs(c.monto)}</>
                            )}
                            {c.href && <span className="ml-2 opacity-60">→</span>}
                        </span>
                    </button>
                ))}
            </div>
        </Card>
    );
}

function MiniStat({ label, value, color = 'text-gray-900', hint }) {
    return (
        <Card>
            <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
            <div className={`text-2xl font-bold ${color} mt-1`}>{value}</div>
            {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
        </Card>
    );
}

function InventoryPanel({ stats }) {
    const labels = {
        total_vehicles: 'Total vehículos', disponibles: 'Disponibles',
        reservados: 'Reservados', vendidos: 'Vendidos', mantenimiento: 'Mantenimiento',
        valor_total: 'Valor total', valor_disponible: 'Valor disponible', costo_total: 'Costo total',
    };
    const moneyKeys = new Set(['valor_total', 'valor_disponible', 'costo_total']);
    return (
        <div className="space-y-1 text-sm">
            {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="flex justify-between pb-1 border-b">
                    <span className="text-gray-700">{labels[k] || k}</span>
                    <span className="font-semibold">
                        {moneyKeys.has(k) ? formatGs(v) : formatInt(v)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function SalesChart({ data }) {
    const canvasRef = React.useRef(null);
    const chartRef = React.useRef(null);
    React.useEffect(() => {
        if (!canvasRef.current || !window.Chart) return;
        if (chartRef.current) chartRef.current.destroy();
        chartRef.current = new Chart(canvasRef.current, {
            type: 'line',
            data: {
                labels: data.map(i => i.mes),
                datasets: [{
                    label: 'Monto', data: data.map(i => i.monto),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: true, tension: 0.4,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { ticks: { callback: v => formatGs(v) } } },
            },
        });
        return () => chartRef.current?.destroy();
    }, [data]);
    return <canvas ref={canvasRef}></canvas>;
}

function QuotasChart({ data }) {
    const canvasRef = React.useRef(null);
    const chartRef = React.useRef(null);
    React.useEffect(() => {
        if (!canvasRef.current || !window.Chart) return;
        if (chartRef.current) chartRef.current.destroy();
        const entries = [
            { label: 'Pendientes', value: data.pendientes?.total || 0, color: '#f59e0b' },
            { label: 'Cobradas', value: data.cobradas?.total || 0, color: '#10b981' },
            { label: 'Vencidas', value: data.vencidas?.total || 0, color: '#ef4444' },
            { label: 'Próx. 30 días', value: data.proximas_30_dias?.total || 0, color: '#3b82f6' },
        ];
        chartRef.current = new Chart(canvasRef.current, {
            type: 'doughnut',
            data: {
                labels: entries.map(e => e.label),
                datasets: [{ data: entries.map(e => e.value), backgroundColor: entries.map(e => e.color) }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
            },
        });
        return () => chartRef.current?.destroy();
    }, [data]);
    return <canvas ref={canvasRef}></canvas>;
}
