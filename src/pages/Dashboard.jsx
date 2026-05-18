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
        dataQuality: null, health: null,
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
                ranking, morosos, aging, paymentForms, alertas, dataQuality, health,
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
                apiClient.getHealthMetrics(params),
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
                health: unwrap(health),
            });
            const failed = [summary, salesByMonth, quotasStatus, topCustomers, inventoryStats,
                            ranking, morosos, aging, paymentForms, alertas, dataQuality, health]
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

            {/* Panel de salud del negocio — métricas blandas que no aparecen
                en los KPIs duros: morosidad ponderada, ticket, días de pago,
                vehículos estancados, top vendedor, tasa de conversión. */}
            <HealthPanel data={data.health} />

            {/* Panel "A cobrar esta semana" — lista clickeable de cuotas
                próximas a vencer con link WhatsApp pre-armado por cliente. */}
            <UpcomingQuotasPanel selectedBranch={selectedBranch} />

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

/**
 * Panel "A cobrar próximas" — cuotas que vencen en los próximos N días
 * (default 7), con WhatsApp link pre-armado por cliente.
 *
 * Se monta solo en el dashboard y fetchea con su propio efecto para que
 * el slider de días no obligue a refrescar todos los demás bloques.
 * El selector de sucursal global se pasa como prop para que el panel
 * respete el filtro del navbar.
 */
function UpcomingQuotasPanel({ selectedBranch }) {
    const [days, setDays] = useState(7);
    const [includeOverdue, setIncludeOverdue] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const params = { days, include_overdue: includeOverdue };
        if (selectedBranch) params.branch = selectedBranch;
        apiClient.getUpcomingQuotas(params).then(r => {
            if (!cancelled) setData(r.data);
        }).catch(() => { if (!cancelled) setData(null); })
          .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [days, includeOverdue, selectedBranch]);

    return (
        <Card className="mb-6"
            title={`A cobrar (próximos ${days} días${includeOverdue ? ' + vencidas' : ''})`}>
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex items-center gap-2 text-sm">
                    <label className="text-gray-600">Ventana:</label>
                    {[3, 7, 14, 30].map(d => (
                        <button key={d} type="button"
                            onClick={() => setDays(d)}
                            className={`px-2 py-0.5 rounded text-xs border ${
                                days === d ? 'bg-red-600 text-white border-red-600' : 'bg-white hover:bg-gray-50'
                            }`}>
                            {d}d
                        </button>
                    ))}
                </div>
                <label className="flex items-center gap-1 text-sm text-gray-600">
                    <input type="checkbox" checked={includeOverdue}
                        onChange={e => setIncludeOverdue(e.target.checked)} />
                    Incluir vencidas
                </label>
            </div>

            {loading && <div className="text-sm text-gray-500">Cargando…</div>}
            {!loading && data && data.results.length === 0 && (
                <div className="text-sm text-gray-500 italic">
                    Sin cuotas próximas a cobrar en este período. 🎉
                </div>
            )}
            {!loading && data && data.results.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 border-b">
                            <tr>
                                <th className="text-left py-1">Vence</th>
                                <th className="text-left py-1">Cliente</th>
                                <th className="text-left py-1">Cuota</th>
                                <th className="text-right py-1">Monto</th>
                                <th className="text-left py-1">Teléfono</th>
                                <th className="text-right py-1">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.results.map(q => {
                                const dia = q.days_until_due;
                                const colorDia = dia == null
                                    ? 'text-gray-500'
                                    : dia < 0 ? 'text-red-700 font-semibold'
                                    : dia <= 2 ? 'text-amber-700 font-semibold'
                                    : 'text-gray-800';
                                return (
                                    <tr key={q.id} className="border-b hover:bg-gray-50">
                                        <td className={`py-1 ${colorDia}`}>
                                            {formatDate(q.due_date)}
                                            {dia != null && (
                                                <span className="text-xs ml-1">
                                                    ({dia < 0 ? `${-dia}d atrasada` : dia === 0 ? 'hoy' : `en ${dia}d`})
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-1">{q.customer_name || '-'}</td>
                                        <td className="py-1 text-xs">
                                            {q.sale_number ? `${q.sale_number} · cuota ${q.quota_number}` : `cuota ${q.quota_number}`}
                                        </td>
                                        <td className="py-1 text-right font-medium">{formatGs(q.amount)}</td>
                                        <td className="py-1 text-xs text-gray-600">{q.customer_phone || '—'}</td>
                                        <td className="py-1 text-right">
                                            {q.whatsapp_link
                                                ? <a href={q.whatsapp_link} target="_blank" rel="noopener noreferrer"
                                                    className="inline-block text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                                                    📱 WhatsApp
                                                  </a>
                                                : <span className="text-xs text-gray-400">sin teléfono</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

/**
 * Salud del negocio — métricas blandas calculadas en /dashboard/health/.
 *
 * Mostramos 6 tarjetas con un valor + interpretación. Cada métrica lleva
 * una pista de color (verde/rojo) según si está "saludable" para el
 * promedio del rubro.
 *
 * Umbrales orientativos (AUTO OFERTAS):
 *   - Morosidad <10% sano; >25% atención.
 *   - Días pago <3 sano; >7 atención.
 *   - Estancados <5 sano; >15 atención.
 *   - Ticket promedio: sin umbral universal (depende del segmento).
 */
function HealthPanel({ data }) {
    if (!data) return null;

    const mora = data.tasa_morosidad?.porcentaje ?? 0;
    const moraColor = mora < 10 ? 'text-green-700' : mora < 25 ? 'text-amber-700' : 'text-red-700';

    const dpp = data.dias_promedio_pago?.dias;
    const dppColor = dpp == null
        ? 'text-gray-500'
        : dpp <= 0 ? 'text-green-700'
        : dpp <= 3 ? 'text-emerald-700'
        : dpp <= 7 ? 'text-amber-700'
        : 'text-red-700';

    const est = data.vehiculos_estancados_90d?.count ?? 0;
    const estColor = est < 5 ? 'text-green-700' : est < 15 ? 'text-amber-700' : 'text-red-700';

    return (
        <Card title="Salud del negocio (período seleccionado)" className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniStat
                    label="Tasa de morosidad"
                    value={`${mora}%`}
                    color={moraColor}
                    hint={`${data.tasa_morosidad?.n_vencidas || 0} vencidas / ${data.tasa_morosidad?.n_activas || 0} activas`}
                />
                <MiniStat
                    label="Ticket promedio"
                    value={formatGs(data.ticket_promedio?.monto)}
                    color="text-gray-900"
                    hint={`${data.ticket_promedio?.n_ventas || 0} ventas`}
                />
                <MiniStat
                    label="Días promedio de pago"
                    value={dpp == null ? '—' : `${dpp >= 0 ? '+' : ''}${dpp}d`}
                    color={dppColor}
                    hint={dpp == null
                        ? 'sin cuotas pagadas'
                        : dpp <= 0 ? 'pagan antes 👍' : 'tras vencimiento'}
                />
                <MiniStat
                    label="Estancados >90d"
                    value={formatInt(est)}
                    color={estColor}
                    hint="autos available sin moverse"
                />
                <MiniStat
                    label="Top vendedor"
                    value={data.top_vendedor?.nombre || '—'}
                    color="text-gray-900"
                    hint={data.top_vendedor
                        ? `${data.top_vendedor.ventas}x · ${formatGs(data.top_vendedor.total)}`
                        : 'sin ventas con vendedor'}
                />
                <MiniStat
                    label="Conversión cliente"
                    value={`${data.tasa_conversion_clientes?.ratio ?? 0}x`}
                    color="text-gray-900"
                    hint={`${data.tasa_conversion_clientes?.ventas || 0} ventas / ${data.tasa_conversion_clientes?.clientes_unicos || 0} clientes`}
                />
            </div>
        </Card>
    );
}
