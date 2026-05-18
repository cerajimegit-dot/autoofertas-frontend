/**
 * Página Gestión de Ventas
 *
 * Funcionalidades:
 *  - Lista todas las ventas ordenadas por fecha (descendente).
 *  - Buscador por número, cliente o vehículo.
 *  - Columna "Pago" con badge de Contado/Crédito/Mixto.
 *  - Editar venta: reasignar cliente y vehículo (o crear un vehículo nuevo).
 *  - Gestionar cuotas: ver, marcar como pagada, editar monto/fecha/estado.
 */

const { useState, useEffect, useMemo } = React;

function Sales() {
    const [sales, setSales] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [brands, setBrands] = useState([]);
    const [paymentForms, setPaymentForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // Pre-llenamos `search` desde ?q=<...> en la URL — esto permite que el
    // palette global (Ctrl+K) "abra" una venta dejándola filtrada como
    // única fila visible. Sin la lectura del query string, el palette
    // mandaría al usuario al listado completo y tendría que volver a
    // tipear el número de venta.
    const initialSearch = (() => {
        if (typeof window === 'undefined') return '';
        const sp = new URLSearchParams(window.location.search);
        return sp.get('q') || '';
    })();
    const [search, setSearch] = useState(initialSearch);
    const [showCreateSale, setShowCreateSale] = useState(false);

    // Filtros de calidad de datos
    const [qualityFilter, setQualityFilter] = useState('all'); // all | mig | sin_cliente | sin_vehiculo | placeholder

    // Filtro por período (mismas convenciones que el Dashboard)
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const { selectedBranch, branches } = useBranch();
    const { toast } = useToast();
    // Lo usamos para el PDF de cronograma (nombre + logo de la empresa).
    const { user } = useAuth();

    // Edición de venta
    const [editingSale, setEditingSale] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [saleNumber, setSaleNumber] = useState('');
    const [saleDate, setSaleDate] = useState('');
    const [downPayment, setDownPayment] = useState('');
    const [savingSale, setSavingSale] = useState(false);

    // Creación de vehículo / cliente
    const [showCreateVehicle, setShowCreateVehicle] = useState(false);
    const [showCreateCustomer, setShowCreateCustomer] = useState(false);

    // Modal de cuotas
    const [quotasSale, setQuotasSale] = useState(null);
    const [quotas, setQuotas] = useState([]);
    const [loadingQuotas, setLoadingQuotas] = useState(false);

    // Catálogos para los modales (customers, vehicles, brands, paymentForms) se
    // cargan lazy — la página principal sólo necesita /sales/. Antes traíamos
    // 5 endpoints en paralelo (~2-3MB en total) al entrar a /sales y agarrar
    // 298 customers disparaba además un COUNT por cliente en el backend (N+1).
    const [catalogsLoaded, setCatalogsLoaded] = useState(false);
    const [catalogsLoading, setCatalogsLoading] = useState(false);

    // Re-fetch al cambiar sucursal o período
    useEffect(() => { fetchSales(); }, [selectedBranch, dateFrom, dateTo]);

    async function fetchSales() {
        setLoading(true);
        setError('');
        try {
            const params = { page_size: 1000 };
            if (selectedBranch) params.branch = selectedBranch;
            if (dateFrom)       params.date_from = dateFrom;
            if (dateTo)         params.date_to = dateTo;
            const salesRes = await api.get('/sales/', { params });
            setSales(salesRes.data.results || salesRes.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar ventas');
        } finally {
            setLoading(false);
        }
    }

    // Rangos rápidos — mismo set que usa el Dashboard.
    function quickRanges() {
        const hoy = new Date();
        const yy = hoy.getFullYear(), mm = hoy.getMonth();
        const pad = n => String(n).padStart(2, '0');
        const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        return [
            { label: 'Este mes',         from: `${yy}-${pad(mm+1)}-01`, to: iso(hoy) },
            { label: 'Mes anterior',     from: `${yy}-${pad(mm)}-01`,
              to: iso(new Date(yy, mm, 0)) },
            { label: 'Este año',         from: `${yy}-01-01`, to: iso(hoy) },
            { label: 'Año anterior',     from: `${yy-1}-01-01`, to: `${yy-1}-12-31` },
            { label: 'Últimos 90 días',
              from: iso(new Date(hoy.getTime() - 90*86400000)), to: iso(hoy) },
        ];
    }

    function clearDateRange() { setDateFrom(''); setDateTo(''); }

    async function loadCatalogs() {
        if (catalogsLoaded || catalogsLoading) return;
        setCatalogsLoading(true);
        try {
            const branchParam = selectedBranch ? { branch: selectedBranch } : {};
            const [customersRes, vehiclesRes, brandsRes, paymentFormsRes] = await Promise.all([
                api.get('/customers/',     { params: { page_size: 1000 } }),
                api.get('/vehicles/',      { params: { page_size: 1000, ...branchParam } }),
                api.get('/brands/',        { params: { page_size: 1000 } }),
                api.get('/payment-forms/', { params: { page_size: 1000 } }),
            ]);
            setCustomers(   customersRes.data.results    || customersRes.data);
            setVehicles(    vehiclesRes.data.results     || vehiclesRes.data);
            setBrands(      brandsRes.data.results       || brandsRes.data);
            setPaymentForms(paymentFormsRes.data.results || paymentFormsRes.data);
            setCatalogsLoaded(true);
        } catch (err) {
            toast.error('No se pudieron cargar los catálogos');
        } finally {
            setCatalogsLoading(false);
        }
    }

    /**
     * Descarga CSV de ventas con los filtros server-side activos.
     * Mismo patrón que B1 (cash export): responseType blob, header
     * Content-Disposition para nombre de archivo, click virtual.
     */
    async function exportSalesCsv() {
        try {
            const params = {};
            if (selectedBranch) params.branch = selectedBranch;
            if (dateFrom)       params.date_from = dateFrom;
            if (dateTo)         params.date_to = dateTo;
            const res = await api.get('/sales/export/', { params, responseType: 'blob' });
            const cd = res.headers['content-disposition'] || '';
            const m = cd.match(/filename="?([^"]+)"?/);
            const filename = m ? m[1] : `ventas_${dateFrom || 'all'}.csv`;
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('CSV descargado');
        } catch (err) {
            toast.error('No se pudo exportar el CSV');
        }
    }

    // Mantenemos fetchAll para los componentes que dependían de él (recarga total).
    async function fetchAll() {
        await fetchSales();
        if (catalogsLoaded) {
            // Refrescar catálogos sólo si ya estaban cargados.
            setCatalogsLoaded(false);
            await loadCatalogs();
        }
    }

    // Wrappers: cuando el usuario abre los modales, garantizamos que los catálogos
    // estén cargados antes de mostrarlos.
    async function openCreateSale() {
        await loadCatalogs();
        setShowCreateSale(true);
    }
    async function openEditSaleWithCatalogs(sale) {
        await loadCatalogs();
        openEditSale(sale);
    }
    async function openQuotasWithCatalogs(sale) {
        // Quotas no necesita catálogos extras — sólo carga las cuotas de la venta.
        await openQuotas(sale);
    }

    function isMig(s) { return (s.sale_number || '').toUpperCase().startsWith('MIG'); }
    function isPlaceholder(s) {
        const n = (s.sale_number || '').toUpperCase();
        return n.includes('??') || n.startsWith('V0') || n === 'VDUMMY';
    }
    // Usamos el FK directo (s.customer es null si no hay) — antes mirábamos
    // s.customer_name que es un string serializado, lo que daba falsos
    // negativos para clientes con nombres tipo "Cliente General" o "N/A"
    // y arrastraba ventas con cliente al filtro "sin cliente".
    function isSinCliente(s) { return s.customer == null; }
    function isSinVehiculo(s) { return s.vehicle == null; }

    // "Es mía": la venta fue cargada por el usuario actual.
    // `s.seller` puede ser objeto {id} o id pelado según el serializer;
    // chequeamos ambos.
    function isMia(s) {
        const sellerId = typeof s.seller === 'object' && s.seller ? s.seller.id : s.seller;
        return sellerId != null && user?.id != null && Number(sellerId) === Number(user.id);
    }

    const qualityCounts = useMemo(() => ({
        all: sales.length,
        mig: sales.filter(isMig).length,
        placeholder: sales.filter(isPlaceholder).length,
        sin_cliente: sales.filter(isSinCliente).length,
        sin_vehiculo: sales.filter(isSinVehiculo).length,
        sin_seller: sales.filter(s => !s.seller && !s.seller_name).length,
        mias: sales.filter(isMia).length,
    }), [sales, user]);

    const filteredSales = useMemo(() => {
        let list = sales;
        if (qualityFilter === 'mig')         list = list.filter(isMig);
        if (qualityFilter === 'placeholder') list = list.filter(isPlaceholder);
        if (qualityFilter === 'sin_cliente') list = list.filter(isSinCliente);
        if (qualityFilter === 'sin_vehiculo')list = list.filter(isSinVehiculo);
        if (qualityFilter === 'reales')      list = list.filter(s => !isMig(s) && !isPlaceholder(s));
        if (qualityFilter === 'mias')        list = list.filter(isMia);
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter(s =>
            (s.sale_number  || '').toLowerCase().includes(q) ||
            (s.customer_name|| '').toLowerCase().includes(q) ||
            (s.vehicle_info || '').toLowerCase().includes(q) ||
            (s.vehicle_vin  || '').toLowerCase().includes(q)
        );
    }, [sales, search, qualityFilter]);

    /* ========= Edición de venta ========= */
    function openEditSale(sale) {
        setEditingSale(sale);
        setSelectedCustomer(sale.customer || '');
        setSelectedVehicle(sale.vehicle || '');
        setSaleNumber(sale.sale_number || '');
        setSaleDate(sale.sale_date ? String(sale.sale_date).slice(0, 10) : '');
        setDownPayment(sale.down_payment != null ? String(sale.down_payment) : '0');
    }
    function closeEditSale() {
        setEditingSale(null);
        setSelectedCustomer('');
        setSelectedVehicle('');
        setSaleNumber('');
        setSaleDate('');
        setDownPayment('');
    }
    async function saveSale() {
        if (!editingSale) return;
        setSavingSale(true);
        try {
            const payload = {
                sale_number:  saleNumber.trim() || editingSale.sale_number,
                customer:     selectedCustomer  || null,
                vehicle:      selectedVehicle   || null,
                down_payment: Number(downPayment) || 0,
            };
            if (saleDate) {
                payload.sale_date = `${saleDate}T12:00:00`;
            }
            await api.patch(`/sales/${editingSale.id}/`, payload);
            await fetchAll();
            closeEditSale();
            toast.success(`Venta ${saleNumber || editingSale.sale_number} actualizada`);
        } catch (err) {
            toast.error('No se pudo guardar la venta', err.response?.data || err.message);
        } finally {
            setSavingSale(false);
        }
    }

    /* ========= Exportar ventas MIG a Excel ========= */
    function exportMigToExcel() {
        const migs = sales.filter(s => (s.sale_number || '').toUpperCase().startsWith('MIG'));
        if (migs.length === 0) {
            toast.warning('No hay ventas con código MIG para exportar');
            return;
        }
        // Filas ordenadas por fecha asc para que el usuario pueda ir marcando cronológicamente
        const rows = migs
            .slice()
            .sort((a, b) => (a.sale_date || '').localeCompare(b.sale_date || ''))
            .map(s => ({
                'Código actual (MIG)': s.sale_number,
                'Código real (completar)': '',
                'Fecha actual (migración)': s.sale_date ? String(s.sale_date).slice(0, 10) : '',
                'Fecha real (completar)': '',
                'Cliente': s.customer_name || '',
                'Vehículo': s.vehicle_info || '',
                'Chasis (VIN)': s.vehicle_vin || '',
                'Total': Number(s.total_price || 0),
                'Pago': s.payment_form_name || '',
                'Estado': s.status_display || s.status || '',
                'ID interno': s.id,
            }));

        const ws = XLSX.utils.json_to_sheet(rows);
        // Ancho aproximado de columnas
        ws['!cols'] = [
            { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
            { wch: 30 }, { wch: 30 }, { wch: 22 }, { wch: 14 },
            { wch: 10 }, { wch: 12 }, { wch: 10 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ventas MIG');

        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `ventas_MIG_a_completar_${fecha}.xlsx`);
    }

    // Callback cuando se crea un vehículo en el submodal
    async function onVehicleCreated(newVehicle) {
        const res = await api.get('/vehicles/', { params: { page_size: 1000 } });
        setVehicles(res.data.results || res.data);
        setSelectedVehicle(newVehicle.id);
        setShowCreateVehicle(false);
    }

    // Callback cuando se crea un cliente en el submodal
    async function onCustomerCreated(newCustomer) {
        const res = await api.get('/customers/', { params: { page_size: 1000 } });
        setCustomers(res.data.results || res.data);
        setSelectedCustomer(newCustomer.id);
        setShowCreateCustomer(false);
    }

    /* ========= Cuotas ========= */
    async function openQuotas(sale) {
        setQuotasSale(sale);
        setLoadingQuotas(true);
        try {
            const res = await api.get('/quotas/', { params: { sale: sale.id, page_size: 1000 } });
            setQuotas(res.data.results || res.data);
        } catch (err) {
            toast.error('No se pudieron cargar las cuotas', err.response?.data?.detail || err.message);
        } finally {
            setLoadingQuotas(false);
        }
    }
    function closeQuotas() { setQuotasSale(null); setQuotas([]); }
    async function markQuotaPaid(quotaId) {
        try {
            await api.post(`/quotas/${quotaId}/mark_as_paid/`);
            await openQuotas(quotasSale);
        } catch (err) { toast.error('No se pudo marcar como pagada', err.response?.data?.detail || err.message); }
    }
    async function updateQuota(quotaId, patch) {
        try {
            await api.patch(`/quotas/${quotaId}/`, patch);
            await openQuotas(quotasSale);
        } catch (err) { toast.error('No se pudo editar la cuota', err.response?.data || err.message); }
    }

    if (loading) {
        return (
            <div className="max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
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
                    <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
                    <p className="text-gray-600">
                        Mostrando <strong>{filteredSales.length}</strong> de <strong>{sales.length}</strong> ventas
                        {' '}(ordenadas por fecha, más recientes primero)
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="primary"   onClick={openCreateSale} disabled={catalogsLoading}>
                        {catalogsLoading ? 'Cargando...' : '+ Nueva venta'}
                    </Button>
                    <Button variant="secondary" onClick={exportSalesCsv}
                        title="Descargar CSV con las ventas del período + filtros activos">
                        ⬇ Exportar CSV
                    </Button>
                    <Button variant="success"   onClick={exportMigToExcel}>📥 Exportar MIGs a Excel</Button>
                    <Button variant="secondary" onClick={fetchAll}>↻ Refrescar</Button>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}

            {/* Filtro de período (mismo set de quick ranges que el Dashboard) */}
            <Card className="mb-3">
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
                                    dateFrom === r.from && dateTo === r.to ? 'bg-gray-100 border-gray-400' : ''
                                }`}>
                                {r.label}
                            </button>
                        ))}
                        {(dateFrom || dateTo) && (
                            <button type="button" onClick={clearDateRange}
                                className="px-3 py-1.5 text-xs border rounded text-gray-600 hover:bg-gray-100">
                                ✕ Sin filtro
                            </button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Chips de calidad de datos */}
            <div className="flex flex-wrap gap-2 mb-3">
                {[
                    ['all',          `Todas (${qualityCounts.all})`,                  'gray'],
                    ['reales',       `Solo reales (${qualityCounts.all - qualityCounts.mig - qualityCounts.placeholder})`, 'blue'],
                    // "Mis ventas" sólo aparece si el usuario tiene al menos una.
                    ...(qualityCounts.mias > 0 ? [['mias', `👤 Mis ventas (${qualityCounts.mias})`, 'emerald']] : []),
                    ['mig',          `⚠ Códigos MIG (${qualityCounts.mig})`,           'yellow'],
                    ['placeholder',  `⚠ Placeholder (${qualityCounts.placeholder})`,   'orange'],
                    ['sin_cliente',  `⚠ Sin cliente (${qualityCounts.sin_cliente})`,   'red'],
                    ['sin_vehiculo', `⚠ Sin vehículo (${qualityCounts.sin_vehiculo})`, 'red'],
                ].map(([key, label, color]) => (
                    <button key={key} type="button"
                        onClick={() => setQualityFilter(key)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition ${
                            qualityFilter === key
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
                    placeholder="Buscar por número, cliente o vehículo..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
            </div>

            {/* Aviso de filtro de sucursal activo (para no confundirse al ver pocos resultados) */}
            {selectedBranch && branches.length > 1 && (
                <div className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded p-2 mb-3">
                    Mostrando <strong>solamente</strong> ventas de <strong>{branches.find(b => String(b.id) === String(selectedBranch))?.name}</strong>.
                    {' '}Para ver todas, cambiá el selector de sucursal a "Todas" arriba.
                </div>
            )}

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Número</th>
                                {branches.length > 1 && !selectedBranch && (
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sucursal</th>
                                )}
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fecha ↓</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vehículo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Pago</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Contrato</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cobranza</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.map(sale => {
                                const sinCliente = isSinCliente(sale);
                                const sinVehiculo = isSinVehiculo(sale);
                                const esMig = isMig(sale);
                                const esPlaceholder = isPlaceholder(sale);
                                const rowClass = sinCliente || sinVehiculo
                                    ? 'border-b hover:bg-gray-50 bg-red-50/30'
                                    : esMig || esPlaceholder
                                        ? 'border-b hover:bg-gray-50 bg-yellow-50/30'
                                        : 'border-b hover:bg-gray-50';
                                return (
                                    <tr key={sale.id} className={rowClass}>
                                        <td className="px-4 py-3 font-semibold text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono">{sale.sale_number}</span>
                                                {esMig && (
                                                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-yellow-200 text-yellow-900" title="Código de migración — completar">
                                                        MIG
                                                    </span>
                                                )}
                                                {esPlaceholder && (
                                                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-orange-200 text-orange-900" title="Código placeholder">
                                                        ??
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {branches.length > 1 && !selectedBranch && (
                                            <td className="px-4 py-3 text-xs">
                                                {sale.branch_name
                                                    ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                          sale.branch_name === 'CASA CENTRAL'
                                                              ? 'bg-indigo-100 text-indigo-800'
                                                              : 'bg-teal-100 text-teal-800'
                                                      }`}>{sale.branch_name}</span>
                                                    : <span className="text-gray-400">—</span>}
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-sm">{formatDate(sale.sale_date) || '-'}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {sinCliente
                                                ? <span className="text-red-600 font-medium">⚠ Sin cliente</span>
                                                : sale.customer_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {sinVehiculo
                                                ? <span className="text-red-600 font-medium">⚠ Sin vehículo</span>
                                                : (
                                                    <div>
                                                        <div>{sale.vehicle_info}</div>
                                                        {sale.vehicle_vin && (
                                                            <div className="text-xs text-gray-500 font-mono">
                                                                Chasis: {sale.vehicle_vin}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-semibold">{formatGs(sale.total_price)}</div>
                                            {Number(sale.down_payment || 0) > 0 && (
                                                <div className="text-xs text-gray-500">
                                                    Entrega: {formatGs(sale.down_payment)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {paymentFormBadge(sale.payment_form_name)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {saleStatusBadge(sale.status, sale.status_display)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {collectionStatusBadge(
                                                sale.collection_status,
                                                sale.collection_status_display,
                                                sale.collection_summary,
                                            )}
                                            {sale.collection_summary?.balance_pending > 0 && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Saldo: {formatGs(sale.collection_summary.balance_pending)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="primary"
                                                    onClick={() => openEditSaleWithCatalogs(sale)}>✏ Editar</Button>
                                                <Button size="sm" variant="secondary"
                                                    onClick={() => openQuotasWithCatalogs(sale)}>📋 Cuotas</Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredSales.length === 0 && (
                    search
                        ? <EmptyState filtered onClear={() => setSearch('')} />
                        : <EmptyState
                            emoji="💰"
                            title="No hay ventas registradas"
                            description="Cuando registres una venta, aparecerá acá con su detalle, cuotas y estado."
                            action={<Button variant="primary" onClick={openCreateSale}>+ Nueva venta</Button>}
                        />
                )}
            </Card>

            {/* ===================== Modal: Editar venta ===================== */}
            {editingSale && (
                <Modal title={`Editar venta ${editingSale.sale_number}`} onClose={closeEditSale} wide>
                    <div className="space-y-4">
                        {/* Código interno */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Código interno
                            </label>
                            <input
                                type="text"
                                value={saleNumber}
                                onChange={e => setSaleNumber(e.target.value)}
                                placeholder="Ej: CM123/25"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                            />
                            {saleNumber.toUpperCase().startsWith('MIG') && (
                                <p className="text-xs text-yellow-700 mt-1">
                                    ⚠ Este es un código genérico de migración. Reemplazalo por el código real.
                                </p>
                            )}
                        </div>

                        {/* Fecha de venta */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha de venta
                            </label>
                            <input
                                type="date"
                                value={saleDate}
                                onChange={e => setSaleDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Poné la fecha real en la que se realizó la venta (no la fecha de registro).
                            </p>
                        </div>

                        {/* Cliente */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <CustomerSearchSelect
                                        customers={customers}
                                        value={selectedCustomer}
                                        onChange={setSelectedCustomer}
                                    />
                                </div>
                                <Button variant="success" onClick={() => setShowCreateCustomer(true)}>
                                    + Crear
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{customers.length} clientes en la base</p>
                        </div>

                        {/* Vehículo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vehículo</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <VehicleSearchSelect
                                        vehicles={vehicles}
                                        value={selectedVehicle}
                                        onChange={setSelectedVehicle}
                                    />
                                </div>
                                <Button variant="success" onClick={() => setShowCreateVehicle(true)}>
                                    + Crear
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{vehicles.length} vehículos en inventario</p>
                        </div>

                        {/* Entrega inicial (relevante sobre todo para crédito/mixto) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Entrega inicial
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={downPayment}
                                onChange={e => setDownPayment(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Monto entregado al firmar (dejar 0 si no aplica).
                                {editingSale.total_price && Number(downPayment) > 0 && (
                                    <> A financiar en cuotas: <strong>{formatGs(Number(editingSale.total_price) - Number(downPayment))}</strong></>
                                )}
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="secondary" onClick={closeEditSale} disabled={savingSale}>Cancelar</Button>
                            <Button variant="primary"   onClick={saveSale}      disabled={savingSale}>
                                {savingSale ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ===================== Modal: Crear vehículo ===================== */}
            {showCreateVehicle && (
                <VehicleCreateModal
                    brands={brands}
                    onClose={() => setShowCreateVehicle(false)}
                    onCreated={onVehicleCreated}
                />
            )}

            {/* ===================== Modal: Crear cliente ===================== */}
            {showCreateCustomer && (
                <CustomerCreateModal
                    onClose={() => setShowCreateCustomer(false)}
                    onCreated={onCustomerCreated}
                />
            )}

            {/* ===================== Modal: Nueva venta ===================== */}
            {showCreateSale && (
                <SaleCreateModal
                    customers={customers}
                    vehicles={vehicles}
                    brands={brands}
                    paymentForms={paymentForms}
                    onClose={() => setShowCreateSale(false)}
                    onCreated={async (sale) => {
                        setShowCreateSale(false);
                        // El POST ya devuelve la venta completa — no hace falta
                        // re-traer la lista entera sólo para encontrar el ID.
                        await fetchAll();
                        if (sale) openEditSale(sale);
                    }}
                />
            )}

            {/* ===================== Modal: Cuotas ===================== */}
            {quotasSale && (
                <Modal title={`Cuotas de la venta ${quotasSale.sale_number}`} onClose={closeQuotas} wide>
                    {loadingQuotas
                        ? <div className="text-center py-4"><div className="loading"></div></div>
                        : (
                            <>
                                {/* Botón PDF: visible cuando hay cuotas generadas.
                                    Reutiliza printQuotaSchedule (cargado globalmente
                                    desde src/utils/printSchedule.js). */}
                                {quotas.length > 0 && (
                                    <div className="flex justify-end mb-2">
                                        <button type="button"
                                            onClick={() => window.printQuotaSchedule({
                                                enterprise: {
                                                    name: user?.enterprise_name,
                                                    logo_url: user?.enterprise_logo_url,
                                                },
                                                customer: {
                                                    first_name: quotasSale.customer_name?.split(' ')[0] || '',
                                                    last_name:  quotasSale.customer_name?.split(' ').slice(1).join(' ') || '',
                                                    document_number: quotasSale.customer_document || '',
                                                    phone: quotasSale.customer_phone || '',
                                                    email: quotasSale.customer_email || '',
                                                },
                                                sale: {
                                                    sale_number: quotasSale.sale_number,
                                                    sale_date:   quotasSale.sale_date,
                                                    total_price: quotasSale.total_price,
                                                    down_payment: quotasSale.down_payment,
                                                    vehicle_info: quotasSale.vehicle_info,
                                                },
                                                quotas,
                                            })}
                                            className="text-xs px-3 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50"
                                            title="Generar PDF del cronograma de cuotas (Imprimir / Guardar PDF)">
                                            🖨 PDF cronograma
                                        </button>
                                    </div>
                                )}
                                <QuotasList quotas={quotas} onMarkPaid={markQuotaPaid} onUpdate={updateQuota} />
                                <QuotaGenerator
                                    sale={quotasSale}
                                    existingQuotasCount={quotas.length}
                                    onSaved={() => openQuotas(quotasSale)}
                                />
                            </>
                        )
                    }
                </Modal>
            )}
        </div>
    );
}

/* =========================================================
   Sub-componentes
   ========================================================= */

function Modal({ title, onClose, children, wide = false }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg shadow-xl ${wide ? 'max-w-5xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-y-auto`}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}

/* ---------- Formulario para crear un vehículo nuevo ---------- */
function VehicleCreateModal({ brands: initialBrands, onClose, onCreated }) {
    const [brands, setBrands] = React.useState(initialBrands || []);
    const [models, setModels] = React.useState([]);
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const [showCreateBrand, setShowCreateBrand] = React.useState(false);
    const [showCreateModel, setShowCreateModel] = React.useState(false);
    const [form, setForm] = React.useState({
        brand: '', model: '', year: new Date().getFullYear(),
        vin: '', license_plate: '', color: '', mileage: 0,
        fob: 0, container: 0, dispatch: 0, cam_vol: 0,
        price: 0, currency: 'PYG', state: 'available', description: '',
    });
    // Conceptos extras de costo — filas dinámicas que el usuario puede agregar.
    const [extraCosts, setExtraCosts] = React.useState([]);
    const COMMON_CONCEPTS = [
        'Flete interno', 'Seguro', 'Impuestos', 'Gastos administrativos',
        'Comisión', 'Certificación', 'Inspección técnica', 'Patente',
        'Honorarios', 'Otros',
    ];

    function addExtraCost() {
        setExtraCosts(prev => [...prev, { concept: '', amount: 0, currency: 'PYG', notes: '' }]);
    }
    function updateExtraCost(idx, patch) {
        setExtraCosts(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
    }
    function removeExtraCost(idx) {
        setExtraCosts(prev => prev.filter((_, i) => i !== idx));
    }

    // Al cambiar marca, cargar sus modelos
    React.useEffect(() => {
        if (!form.brand) { setModels([]); return; }
        api.get('/vehicle-models/', { params: { brand: form.brand, page_size: 1000 } })
            .then(r => setModels(r.data.results || r.data))
            .catch(() => setModels([]));
    }, [form.brand]);

    // Sugerencia de precio basada en ventas históricas del mismo modelo.
    // Lazy: se dispara cuando hay brand + model + year. Debounce de 300ms
    // para no spam de requests mientras el usuario cambia campos.
    const [priceSuggestion, setPriceSuggestion] = React.useState(null);
    const [suggestionLoading, setSuggestionLoading] = React.useState(false);
    React.useEffect(() => {
        if (!form.brand || !form.model || !form.year) {
            setPriceSuggestion(null);
            return;
        }
        let cancelled = false;
        setSuggestionLoading(true);
        const t = setTimeout(() => {
            api.get('/vehicles/price_suggestion/', {
                params: { brand: form.brand, model: form.model, year: form.year },
            }).then(r => {
                if (!cancelled) setPriceSuggestion(r.data);
            }).catch(() => {
                if (!cancelled) setPriceSuggestion(null);
            }).finally(() => {
                if (!cancelled) setSuggestionLoading(false);
            });
        }, 300);
        return () => { cancelled = true; clearTimeout(t); };
    }, [form.brand, form.model, form.year]);

    async function onBrandCreated(newBrand) {
        const res = await api.get('/brands/', { params: { page_size: 1000 } });
        setBrands(res.data.results || res.data);
        set('brand', String(newBrand.id));
        set('model', '');
        setShowCreateBrand(false);
    }

    async function onModelCreated(newModel) {
        const res = await api.get('/vehicle-models/', { params: { brand: form.brand, page_size: 1000 } });
        setModels(res.data.results || res.data);
        set('model', String(newModel.id));
        setShowCreateModel(false);
    }

    function set(key, value) { setForm(prev => ({ ...prev, [key]: value })); }

    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        setErrorText('');
        try {
            const payload = {
                brand: form.brand || null,
                model: form.model || null,
                year: Number(form.year),
                vin: form.vin.trim(),
                license_plate: form.license_plate,
                color: form.color,
                mileage: Number(form.mileage) || 0,
                fob: Number(form.fob) || 0,
                container: Number(form.container) || 0,
                dispatch: Number(form.dispatch) || 0,
                cam_vol: Number(form.cam_vol) || 0,
                price: Number(form.price) || 0,
                currency: form.currency,
                state: form.state,
                description: form.description,
            };
            const res = await api.post('/vehicles/', payload);
            const vehicle = res.data;

            // Crear costos extras uno por uno
            const validExtras = extraCosts.filter(c => c.concept.trim() && Number(c.amount) !== 0);
            for (let i = 0; i < validExtras.length; i++) {
                const c = validExtras[i];
                try {
                    await api.post('/vehicle-costs/', {
                        vehicle: vehicle.id,
                        concept: c.concept.trim(),
                        amount: Number(c.amount),
                        currency: c.currency,
                        notes: c.notes || '',
                        order: i,
                    });
                } catch (err) {
                    console.warn('Error creando concepto extra', c, err);
                }
            }
            onCreated(vehicle);
        } catch (err) {
            const status = err.response?.status;
            const body = err.response?.data;
            const msg = [
                `Status: ${status || '(sin respuesta)'}`,
                `URL: ${err.config?.url || '-'}`,
                `Payload enviado:`,
                JSON.stringify({
                    brand: form.brand, model: form.model, year: form.year,
                    vin: form.vin, price: form.price, currency: form.currency,
                    state: form.state
                }, null, 2),
                ``,
                `Respuesta del backend:`,
                typeof body === 'string' ? body : JSON.stringify(body, null, 2),
            ].join('\n');
            setErrorText(msg);
            console.error('VehicleCreate error:', err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title="Crear nuevo vehículo" onClose={onClose} wide>
            <form onSubmit={submit} className="space-y-4">
                {errorText && (
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                            <strong className="text-red-700 text-sm">Error al crear vehículo</strong>
                            <button type="button"
                                onClick={() => { navigator.clipboard?.writeText(errorText); }}
                                className="text-xs text-red-700 underline">
                                Copiar al portapapeles
                            </button>
                        </div>
                        <textarea
                            readOnly
                            value={errorText}
                            rows={8}
                            onClick={e => e.target.select()}
                            className="w-full text-xs font-mono bg-white border border-red-200 rounded p-2 text-gray-800"
                        />
                    </div>
                )}

                {/* Identificación */}
                <Section title="Identificación">
                    <Grid>
                        <Field label="Marca *">
                            <div className="flex gap-1">
                                <select value={form.brand} onChange={e => { set('brand', e.target.value); set('model', ''); }}
                                    className="flex-1 px-3 py-2 border rounded" required>
                                    <option value="">-- Elegir --</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <button type="button" onClick={() => setShowCreateBrand(true)}
                                    title="Crear nueva marca"
                                    className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                                    +
                                </button>
                            </div>
                        </Field>
                        <Field label="Modelo *">
                            <div className="flex gap-1">
                                <select value={form.model} onChange={e => set('model', e.target.value)}
                                    className="flex-1 px-3 py-2 border rounded" required disabled={!form.brand}>
                                    <option value="">-- Elegir marca primero --</option>
                                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                <button type="button" onClick={() => setShowCreateModel(true)}
                                    title="Crear nuevo modelo para esta marca"
                                    disabled={!form.brand}
                                    className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
                                    +
                                </button>
                            </div>
                        </Field>
                        <Field label="Año *">
                            <input type="number" min="1900" max="2100" value={form.year}
                                onChange={e => set('year', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="VIN *">
                            <input type="text" value={form.vin}
                                onChange={e => set('vin', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required maxLength={50} />
                        </Field>
                        <Field label="Patente">
                            <input type="text" value={form.license_plate}
                                onChange={e => set('license_plate', e.target.value)}
                                className="w-full px-3 py-2 border rounded" maxLength={50} />
                        </Field>
                        <Field label="Color">
                            <input type="text" value={form.color}
                                onChange={e => set('color', e.target.value)}
                                className="w-full px-3 py-2 border rounded" maxLength={50} />
                        </Field>
                        <Field label="Kilometraje">
                            <input type="number" min="0" value={form.mileage}
                                onChange={e => set('mileage', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                        <Field label="Estado">
                            <select value={form.state} onChange={e => set('state', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="available">Disponible</option>
                                <option value="reserved">Reservado</option>
                                <option value="sold">Vendido</option>
                                <option value="maintenance">Mantenimiento</option>
                            </select>
                        </Field>
                    </Grid>
                </Section>

                {/* Costos */}
                <Section title="Costos">
                    <Grid>
                        <Field label="FOB *">
                            <input type="number" step="0.01" value={form.fob}
                                onChange={e => set('fob', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="CONTEN (contenedor)">
                            <input type="number" step="0.01" value={form.container}
                                onChange={e => set('container', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                        <Field label="DESPACHO">
                            <input type="number" step="0.01" value={form.dispatch}
                                onChange={e => set('dispatch', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                        <Field label="CAM/VOL">
                            <input type="number" step="0.01" value={form.cam_vol}
                                onChange={e => set('cam_vol', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                    </Grid>

                    {/* Conceptos extras (dinámicos) */}
                    <div className="mt-4 pt-3 border-t">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Conceptos adicionales
                            </h4>
                            <Button type="button" size="sm" variant="secondary" onClick={addExtraCost}>
                                + Agregar concepto
                            </Button>
                        </div>

                        {extraCosts.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">
                                Sin conceptos extras. Agregá Flete, Seguro, Impuestos, etc. si corresponde.
                            </p>
                        ) : (
                            <>
                                <datalist id="concept-suggestions">
                                    {COMMON_CONCEPTS.map(c => <option key={c} value={c} />)}
                                </datalist>
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 border-b">
                                        <tr>
                                            <th className="text-left py-1 w-1/2">Concepto</th>
                                            <th className="text-left py-1">Monto</th>
                                            <th className="text-left py-1">Moneda</th>
                                            <th className="text-left py-1 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {extraCosts.map((c, i) => (
                                            <tr key={i} className="border-b">
                                                <td className="py-1 pr-2">
                                                    <input type="text" list="concept-suggestions"
                                                        value={c.concept}
                                                        onChange={e => updateExtraCost(i, { concept: e.target.value })}
                                                        placeholder="Ej: Flete interno"
                                                        className="w-full px-2 py-1 border rounded" />
                                                </td>
                                                <td className="py-1 pr-2">
                                                    <input type="number" step="0.01" value={c.amount}
                                                        onChange={e => updateExtraCost(i, { amount: e.target.value })}
                                                        className="w-32 px-2 py-1 border rounded" />
                                                </td>
                                                <td className="py-1 pr-2">
                                                    <select value={c.currency}
                                                        onChange={e => updateExtraCost(i, { currency: e.target.value })}
                                                        className="px-2 py-1 border rounded">
                                                        <option value="PYG">PYG</option>
                                                        <option value="USD">USD</option>
                                                    </select>
                                                </td>
                                                <td className="py-1 text-right">
                                                    <button type="button" onClick={() => removeExtraCost(i)}
                                                        className="text-red-600 hover:text-red-800 text-lg" title="Quitar">
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </Section>

                {/* Precio */}
                <Section title="Precio de venta">
                    {/* Sugerencia de precio basada en ventas históricas del
                        mismo modelo. Hint, no impuesto — el usuario decide. */}
                    {priceSuggestion && priceSuggestion.matches > 0 && form.currency === 'PYG' && (
                        <PriceSuggestionHint
                            data={priceSuggestion}
                            onUse={(v) => set('price', String(Math.round(v)))}
                        />
                    )}
                    {suggestionLoading && (
                        <p className="text-xs text-gray-500 mb-2">Buscando ventas similares…</p>
                    )}
                    <Grid>
                        <Field label="Precio *">
                            <input type="number" step="0.01" value={form.price}
                                onChange={e => set('price', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="Moneda">
                            <select value={form.currency} onChange={e => set('currency', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="PYG">Guaraní (PYG)</option>
                                <option value="USD">Dólar (USD)</option>
                            </select>
                        </Field>
                    </Grid>
                    {form.currency === 'USD' && (
                        <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                            ⚠ Para precios en USD necesitás una cotización activa en el sistema.
                            Si no tenés una, creá una en el admin primero.
                        </p>
                    )}
                </Section>

                {/* Descripción */}
                <Field label="Descripción">
                    <textarea value={form.description} rows={2}
                        onChange={e => set('description', e.target.value)}
                        className="w-full px-3 py-2 border rounded" />
                </Field>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit"  variant="primary"  disabled={saving}>
                        {saving ? 'Creando...' : 'Crear vehículo'}
                    </Button>
                </div>
            </form>

            {showCreateBrand && (
                <BrandCreateModal
                    onClose={() => setShowCreateBrand(false)}
                    onCreated={onBrandCreated}
                />
            )}
            {showCreateModel && (
                <VehicleModelCreateModal
                    brandId={form.brand}
                    brandName={brands.find(b => String(b.id) === String(form.brand))?.name || ''}
                    onClose={() => setShowCreateModel(false)}
                    onCreated={onModelCreated}
                />
            )}
        </Modal>
    );
}

/* ---------- Crear venta nueva ---------- */
function SaleCreateModal({ customers, vehicles, brands, paymentForms, onClose, onCreated }) {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [form, setForm] = React.useState({
        sale_number: '',
        sale_date: todayStr,
        customer: '',
        vehicle: '',
        unit_price: '',
        discount: '0',
        down_payment: '0',
        payment_form: '',
        status: 'completed',
        notes: '',
    });
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const [showCreateVehicle, setShowCreateVehicle] = React.useState(false);
    const [showCreateCustomer, setShowCreateCustomer] = React.useState(false);
    const [vehiclesState, setVehiclesState] = React.useState(vehicles);
    const [customersState, setCustomersState] = React.useState(customers);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    // Al seleccionar un vehículo, sugerir el precio si está en 0/vacío
    React.useEffect(() => {
        if (!form.vehicle) return;
        const v = vehiclesState.find(x => String(x.id) === String(form.vehicle));
        if (v && v.price && (!form.unit_price || Number(form.unit_price) === 0)) {
            set('unit_price', String(v.price));
        }
    }, [form.vehicle]); // eslint-disable-line

    const totalPrice = Math.max(0, Number(form.unit_price || 0) - Number(form.discount || 0));
    const aFinanciar = Math.max(0, totalPrice - Number(form.down_payment || 0));

    async function onVehicleCreated(newVehicle) {
        const res = await api.get('/vehicles/', { params: { page_size: 1000 } });
        setVehiclesState(res.data.results || res.data);
        set('vehicle', newVehicle.id);
        setShowCreateVehicle(false);
    }
    async function onCustomerCreated(newCustomer) {
        const res = await api.get('/customers/', { params: { page_size: 1000 } });
        setCustomersState(res.data.results || res.data);
        set('customer', newCustomer.id);
        setShowCreateCustomer(false);
    }

    async function submit(e) {
        e.preventDefault();
        setSaving(true); setErrorText('');
        try {
            const payload = {
                sale_number: form.sale_number.trim() || undefined,
                sale_date: `${form.sale_date}T12:00:00`,
                customer: form.customer || null,
                vehicle: form.vehicle || null,
                unit_price: Number(form.unit_price) || 0,
                discount: Number(form.discount) || 0,
                total_price: totalPrice,
                down_payment: Number(form.down_payment) || 0,
                payment_form: form.payment_form || null,
                status: form.status,
                notes: form.notes,
            };
            const res = await api.post('/sales/', payload);
            onCreated(res.data);
        } catch (err) {
            const body = err.response?.data;
            setErrorText([
                `Status: ${err.response?.status || '(sin respuesta)'}`,
                `URL: ${err.config?.url || '-'}`,
                ``,
                `Respuesta del backend:`,
                typeof body === 'string' ? body : JSON.stringify(body, null, 2),
            ].join('\n'));
            console.error('SaleCreate error:', err);
        } finally { setSaving(false); }
    }

    return (
        <Modal title="Nueva venta" onClose={onClose} wide>
            <form onSubmit={submit} className="space-y-4">
                {errorText && (
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                            <strong className="text-red-700 text-sm">Error al crear venta</strong>
                            <button type="button"
                                onClick={() => navigator.clipboard?.writeText(errorText)}
                                className="text-xs text-red-700 underline">Copiar</button>
                        </div>
                        <textarea readOnly value={errorText} rows={8}
                            onClick={e => e.target.select()}
                            className="w-full text-xs font-mono bg-white border border-red-200 rounded p-2" />
                    </div>
                )}

                <Section title="Identificación">
                    <Grid>
                        <Field label="Código interno (dejar vacío para auto-generar)">
                            <input type="text" value={form.sale_number}
                                onChange={e => set('sale_number', e.target.value)}
                                placeholder="Ej: CM137/26"
                                className="w-full px-3 py-2 border rounded font-mono" />
                        </Field>
                        <Field label="Fecha de venta *">
                            <input type="date" value={form.sale_date}
                                onChange={e => set('sale_date', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                    </Grid>
                </Section>

                <Section title="Cliente y vehículo">
                    <div className="space-y-3">
                        <Field label="Cliente">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <CustomerSearchSelect
                                        customers={customersState}
                                        value={form.customer}
                                        onChange={v => set('customer', v)}
                                    />
                                </div>
                                <Button type="button" variant="success"
                                    onClick={() => setShowCreateCustomer(true)}>+ Crear</Button>
                            </div>
                        </Field>
                        <Field label="Vehículo">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <VehicleSearchSelect
                                        vehicles={vehiclesState}
                                        value={form.vehicle}
                                        onChange={v => set('vehicle', v)}
                                    />
                                </div>
                                <Button type="button" variant="success"
                                    onClick={() => setShowCreateVehicle(true)}>+ Crear</Button>
                            </div>
                        </Field>
                    </div>
                </Section>

                <Section title="Precio y pago">
                    <Grid>
                        <Field label="Precio unitario *">
                            <input type="number" step="0.01" min="0" value={form.unit_price}
                                onChange={e => set('unit_price', e.target.value)}
                                className="w-full px-3 py-2 border rounded" required />
                        </Field>
                        <Field label="Descuento">
                            <input type="number" step="0.01" min="0" value={form.discount}
                                onChange={e => set('discount', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                        <Field label="Forma de pago">
                            <select value={form.payment_form}
                                onChange={e => set('payment_form', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="">-- Elegir --</option>
                                {paymentForms.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Entrega inicial">
                            <input type="number" step="0.01" min="0" value={form.down_payment}
                                onChange={e => set('down_payment', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                    </Grid>
                    <div className="mt-3 p-3 bg-slate-50 rounded text-sm">
                        <div className="flex justify-between">
                            <span>Total de la venta:</span>
                            <strong>{formatGs(totalPrice)}</strong>
                        </div>
                        {Number(form.down_payment) > 0 && (
                            <div className="flex justify-between text-gray-700 mt-1">
                                <span>A financiar en cuotas:</span>
                                <strong>{formatGs(aFinanciar)}</strong>
                            </div>
                        )}
                    </div>
                </Section>

                <Section title="Estado y notas">
                    <Grid>
                        <Field label="Estado">
                            <select value={form.status}
                                onChange={e => set('status', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="completed">Completada</option>
                                <option value="pending">Pendiente</option>
                                <option value="cancelled">Cancelada</option>
                            </select>
                        </Field>
                        <Field label="Notas">
                            <textarea value={form.notes} rows={2}
                                onChange={e => set('notes', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </Field>
                    </Grid>
                </Section>

                <div className="flex justify-end gap-2 pt-3 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Creando...' : 'Crear venta'}
                    </Button>
                </div>
                <p className="text-xs text-gray-500 text-center">
                    Después de crear, se abre la edición para que puedas asignar más datos o generar cuotas si es crédito.
                </p>
            </form>

            {showCreateVehicle && (
                <VehicleCreateModal
                    brands={brands}
                    onClose={() => setShowCreateVehicle(false)}
                    onCreated={onVehicleCreated}
                />
            )}
            {showCreateCustomer && (
                <CustomerCreateModal
                    onClose={() => setShowCreateCustomer(false)}
                    onCreated={onCustomerCreated}
                />
            )}
        </Modal>
    );
}

/* ---------- Crear marca ---------- */
function BrandCreateModal({ onClose, onCreated }) {
    const [form, setForm] = React.useState({ name: '', description: '' });
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');

    async function submit(e) {
        e.preventDefault();
        setSaving(true); setErrorText('');
        try {
            const res = await api.post('/brands/', {
                name: form.name.trim(),
                description: form.description,
                is_active: true,
            });
            onCreated(res.data);
        } catch (err) {
            setErrorText(JSON.stringify(err.response?.data || err.message, null, 2));
            console.error('BrandCreate error:', err);
        } finally { setSaving(false); }
    }

    return (
        <Modal title="Crear nueva marca" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                {errorText && (
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                        <strong className="text-red-700 text-sm block mb-2">Error</strong>
                        <textarea readOnly value={errorText} rows={4}
                            onClick={e => e.target.select()}
                            className="w-full text-xs font-mono bg-white border border-red-200 rounded p-2" />
                    </div>
                )}
                <Field label="Nombre de la marca *">
                    <input type="text" value={form.name} autoFocus
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Ej: TOYOTA, HYUNDAI..."
                        className="w-full px-3 py-2 border rounded" required />
                </Field>
                <Field label="Descripción (opcional)">
                    <textarea value={form.description} rows={2}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded" />
                </Field>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Creando...' : 'Crear marca'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

/* ---------- Crear modelo de vehículo ---------- */
function VehicleModelCreateModal({ brandId, brandName, onClose, onCreated }) {
    const [form, setForm] = React.useState({ name: '', description: '' });
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');

    async function submit(e) {
        e.preventDefault();
        setSaving(true); setErrorText('');
        try {
            const res = await api.post('/vehicle-models/', {
                brand: brandId,
                name: form.name.trim(),
                description: form.description,
                is_active: true,
            });
            onCreated(res.data);
        } catch (err) {
            setErrorText(JSON.stringify(err.response?.data || err.message, null, 2));
            console.error('ModelCreate error:', err);
        } finally { setSaving(false); }
    }

    return (
        <Modal title={`Crear modelo para ${brandName}`} onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                {errorText && (
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                        <strong className="text-red-700 text-sm block mb-2">Error</strong>
                        <textarea readOnly value={errorText} rows={4}
                            onClick={e => e.target.select()}
                            className="w-full text-xs font-mono bg-white border border-red-200 rounded p-2" />
                    </div>
                )}
                <Field label="Nombre del modelo *">
                    <input type="text" value={form.name} autoFocus
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Ej: VITZ 1.3, RACTIS 1.5, SIENTA..."
                        className="w-full px-3 py-2 border rounded" required />
                </Field>
                <Field label="Descripción (opcional)">
                    <textarea value={form.description} rows={2}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded" />
                </Field>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Creando...' : 'Crear modelo'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

function Section({ title, children }) {
    return (
        <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">{title}</h3>
            {children}
        </div>
    );
}

/* ---------- Formulario para crear un cliente nuevo ---------- */
function CustomerCreateModal({ onClose, onCreated }) {
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const [form, setForm] = React.useState({
        first_name: '', last_name: '',
        document_type: 'ci', document_number: '',
        email: '', phone: '', address: '', city: '',
        notes: '',
    });

    function set(key, value) { setForm(prev => ({ ...prev, [key]: value })); }

    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        setErrorText('');
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
            const res = await api.post('/customers/', payload);
            onCreated(res.data);
        } catch (err) {
            const status = err.response?.status;
            const body = err.response?.data;
            const msg = [
                `Status: ${status || '(sin respuesta)'}`,
                `URL: ${err.config?.url || '-'}`,
                ``,
                `Respuesta del backend:`,
                typeof body === 'string' ? body : JSON.stringify(body, null, 2),
            ].join('\n');
            setErrorText(msg);
            console.error('CustomerCreate error:', err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title="Crear nuevo cliente" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                {errorText && (
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                            <strong className="text-red-700 text-sm">Error al crear cliente</strong>
                            <button type="button"
                                onClick={() => { navigator.clipboard?.writeText(errorText); }}
                                className="text-xs text-red-700 underline">
                                Copiar al portapapeles
                            </button>
                        </div>
                        <textarea readOnly value={errorText} rows={6}
                            onClick={e => e.target.select()}
                            className="w-full text-xs font-mono bg-white border border-red-200 rounded p-2 text-gray-800" />
                    </div>
                )}
                <Grid>
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
                    <Field label="Tipo de documento *">
                        <select value={form.document_type}
                            onChange={e => set('document_type', e.target.value)}
                            className="w-full px-3 py-2 border rounded">
                            <option value="ci">Cédula de Identidad</option>
                            <option value="ruc">RUC</option>
                            <option value="passport">Pasaporte</option>
                        </select>
                    </Field>
                    <Field label="Número de documento *">
                        <input type="text" value={form.document_number}
                            onChange={e => set('document_number', e.target.value)}
                            className="w-full px-3 py-2 border rounded" required />
                    </Field>
                    <Field label="Teléfono">
                        <input type="text" value={form.phone}
                            onChange={e => set('phone', e.target.value)}
                            placeholder="+5959..." className="w-full px-3 py-2 border rounded" />
                    </Field>
                    <Field label="Email">
                        <input type="email" value={form.email}
                            onChange={e => set('email', e.target.value)}
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
                </Grid>
                <Field label="Notas">
                    <textarea value={form.notes} rows={2}
                        onChange={e => set('notes', e.target.value)}
                        className="w-full px-3 py-2 border rounded" />
                </Field>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit"  variant="primary"  disabled={saving}>
                        {saving ? 'Creando...' : 'Crear cliente'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

/**
 * Hint visual de "ventas similares" arriba del campo de precio.
 *
 * `scope` indica qué tan precisa es la sugerencia:
 *   - exact_year:    mismo modelo + año exacto → mensaje más afirmativo.
 *   - year_window_2: mismo modelo, año dentro de ±2 → menos preciso.
 *   - any_year:      mismo modelo, cualquier año → orientativo.
 *
 * No imponemos el precio. Sólo damos contexto y un botón "Usar mediana"
 * para que un click haga el atajo común.
 */
function PriceSuggestionHint({ data, onUse }) {
    const fmt = n => Math.round(Number(n)).toLocaleString('es-PY');
    const scopeMsg = {
        exact_year:    `${data.matches} venta(s) del mismo modelo y año`,
        year_window_2: `${data.matches} venta(s) del mismo modelo (±2 años)`,
        any_year:      `${data.matches} venta(s) del mismo modelo (cualquier año)`,
    }[data.scope] || 'Ventas similares';
    return (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm">
            <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                    <div className="font-medium text-blue-900">💡 {scopeMsg}</div>
                    <div className="text-xs text-gray-700 mt-1">
                        Rango: <strong>Gs. {fmt(data.min)}</strong> a <strong>Gs. {fmt(data.max)}</strong>{' '}
                        · Mediana: <strong>Gs. {fmt(data.median)}</strong>{' '}
                        · Promedio: Gs. {fmt(data.mean)}
                    </div>
                    {data.recent_examples && data.recent_examples.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                            Ejemplos recientes:{' '}
                            {data.recent_examples.map((ex, i) => (
                                <span key={i} className="mr-2">
                                    {ex.sale_number} ({ex.year}, Gs. {fmt(ex.total_price)})
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <button type="button"
                    onClick={() => onUse(data.median)}
                    title="Usar la mediana del histórico como precio sugerido"
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">
                    Usar Gs. {fmt(data.median)}
                </button>
            </div>
        </div>
    );
}

function Grid({ children }) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            {children}
        </div>
    );
}

/* ---------- Buscador-selector genérico con autocompletado ---------- */
function SearchSelect({
    items,
    value,
    onChange,
    getLabel,
    getSearchText,
    placeholder = 'Buscar...',
    emptyLabel = '— Sin seleccionar —',
    maxResults = 50,
}) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const containerRef = React.useRef(null);

    // Cerrar al hacer click fuera
    React.useEffect(() => {
        function onDocClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const selectedItem = items.find(i => String(i.id) === String(value));
    const displayValue = selectedItem ? getLabel(selectedItem) : '';

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items.slice(0, maxResults);
        return items
            .filter(i => getSearchText(i).toLowerCase().includes(q))
            .slice(0, maxResults);
    }, [items, query, maxResults]);

    function select(item) {
        onChange(item ? item.id : '');
        setOpen(false);
        setQuery('');
    }

    return (
        <div ref={containerRef} className="relative">
            <div
                onClick={() => setOpen(true)}
                className="flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 bg-white"
            >
                <span className={selectedItem ? 'text-gray-900' : 'text-gray-400'}>
                    {displayValue || emptyLabel}
                </span>
                <span className="text-gray-400 text-xs ml-2">▼</span>
            </div>

            {open && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
                    <input
                        type="text"
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 border-b border-gray-200 focus:outline-none"
                    />
                    <div className="overflow-y-auto flex-1">
                        <div
                            onClick={() => select(null)}
                            className="px-3 py-2 text-sm text-gray-500 italic hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                        >
                            {emptyLabel}
                        </div>
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                Sin resultados
                            </div>
                        ) : (
                            filtered.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => select(item)}
                                    className={`px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer ${
                                        String(item.id) === String(value) ? 'bg-gray-200 font-medium' : ''
                                    }`}
                                >
                                    {getLabel(item)}
                                </div>
                            ))
                        )}
                    </div>
                    {items.length > filtered.length && query && (
                        <div className="px-3 py-1 text-xs text-gray-500 border-t bg-gray-50">
                            Mostrando {filtered.length} de {items.length} · escribí más para refinar
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ---------- Selector especializado de vehículo ---------- */
function VehicleSearchSelect({ vehicles, value, onChange }) {
    return (
        <SearchSelect
            items={vehicles}
            value={value}
            onChange={onChange}
            placeholder="Buscar por chasis, marca, modelo..."
            emptyLabel="— Sin vehículo asignado —"
            getLabel={v => (
                <div>
                    <div className="font-medium">
                        {[v.brand_name, v.model_name, v.year].filter(Boolean).join(' ')}
                        {' · '}{formatGs(v.price)}
                    </div>
                    <div className="text-xs font-mono text-gray-600">Chasis: {v.vin}</div>
                </div>
            )}
            getSearchText={v => [
                v.vin, v.brand_name, v.model_name, v.year, v.color, v.license_plate
            ].filter(Boolean).join(' ')}
        />
    );
}

/* ---------- Selector especializado de cliente ---------- */
function CustomerSearchSelect({ customers, value, onChange }) {
    return (
        <SearchSelect
            items={customers}
            value={value}
            onChange={onChange}
            placeholder="Buscar por nombre o documento..."
            emptyLabel="— Sin cliente asignado —"
            getLabel={c => {
                const nombre = `${c.first_name || ''} ${c.last_name || ''}`.trim() || '(sin nombre)';
                return (
                    <div>
                        <div className="font-medium">{nombre}</div>
                        {c.document_number && (
                            <div className="text-xs text-gray-600">
                                {c.document_type_display || c.document_type}: {c.document_number}
                                {c.phone ? ` · ${c.phone}` : ''}
                            </div>
                        )}
                    </div>
                );
            }}
            getSearchText={c => [
                c.first_name, c.last_name, c.document_number, c.email, c.phone, c.city
            ].filter(Boolean).join(' ')}
        />
    );
}

/* ---------- Generador de plan de cuotas ---------- */
function QuotaGenerator({ sale, existingQuotasCount, onSaved }) {
    const { toast } = useToast();
    const [numQuotas,   setNumQuotas]   = React.useState(12);
    const [firstDue,    setFirstDue]    = React.useState('');
    const [amount,      setAmount]      = React.useState('');
    const [planName,    setPlanName]    = React.useState('');
    const [preview,     setPreview]     = React.useState([]);
    const [saving,      setSaving]      = React.useState(false);

    // Monto a financiar = total - entrega inicial
    const aFinanciar = Math.max(
        0,
        Number(sale.total_price || 0) - Number(sale.down_payment || 0)
    );

    // Sugerir monto por defecto = (total - entrega inicial) / cantidad de cuotas
    React.useEffect(() => {
        if (!amount && numQuotas && aFinanciar) {
            setAmount(String(Math.round(aFinanciar / numQuotas)));
        }
    }, [numQuotas, aFinanciar]); // eslint-disable-line

    function addMonths(isoDate, n) {
        // Suma n meses a una fecha en formato YYYY-MM-DD, manteniendo el día si es posible
        const [y, m, d] = isoDate.split('-').map(Number);
        const dt = new Date(y, m - 1 + n, d);
        // Si el día original no existe en el mes destino, Date ya lo ajustó
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }

    function generarPreview() {
        if (!firstDue || !amount || !numQuotas) {
            toast.warning('Completá cantidad de cuotas, fecha del primer vencimiento y monto');
            return;
        }
        const n = parseInt(numQuotas, 10);
        const amt = Number(amount);
        const rows = [];
        for (let i = 0; i < n; i++) {
            rows.push({
                quota_number: existingQuotasCount + i + 1,
                due_date: addMonths(firstDue, i),
                amount: amt,
                plan_name: planName || `${n} cuotas`,
                note: '',
            });
        }
        setPreview(rows);
    }

    function updatePreviewRow(idx, patch) {
        setPreview(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    }

    function removePreviewRow(idx) {
        setPreview(prev => prev.filter((_, i) => i !== idx));
    }

    function addExtraRow() {
        const last = preview[preview.length - 1];
        setPreview(prev => [...prev, {
            quota_number: last ? last.quota_number + 1 : existingQuotasCount + 1,
            due_date: last ? addMonths(last.due_date, 1) : firstDue,
            amount: last ? last.amount : Number(amount || 0),
            plan_name: planName || `${preview.length + 1} cuotas`,
            note: '',
        }]);
    }

    async function guardarTodas() {
        if (preview.length === 0) return;
        setSaving(true);
        try {
            // Crear las cuotas una por una (el backend valida por cada POST)
            for (const q of preview) {
                await api.post('/quotas/', {
                    sale: sale.id,
                    customer: sale.customer || null,
                    quota_number: q.quota_number,
                    plan_name: q.plan_name,
                    total_plan: preview.length + existingQuotasCount,
                    amount: Number(q.amount),
                    due_date: q.due_date,
                    status: 'pending',
                    notes: q.note || '',
                });
            }
            setPreview([]);
            setAmount('');
            setFirstDue('');
            onSaved();
        } catch (err) {
            toast.error('Error al guardar cuotas', err.response?.data || err.message);
        } finally {
            setSaving(false);
        }
    }

    const totalPreview = preview.reduce((s, q) => s + Number(q.amount || 0), 0);

    return (
        <div className="mt-6 pt-4 border-t">
            <h3 className="font-semibold text-gray-800 mb-3">
                {existingQuotasCount > 0 ? '➕ Agregar más cuotas' : '📋 Generar plan de cuotas'}
            </h3>

            {/* Inputs para generar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <Field label="Cantidad de cuotas">
                    <input type="number" min="1" max="120" value={numQuotas}
                        onChange={e => setNumQuotas(e.target.value)}
                        className="w-full px-3 py-2 border rounded" />
                </Field>
                <Field label="1er vencimiento">
                    <input type="date" value={firstDue}
                        onChange={e => setFirstDue(e.target.value)}
                        className="w-full px-3 py-2 border rounded" />
                </Field>
                <Field label="Monto por cuota">
                    <input type="number" step="0.01" value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full px-3 py-2 border rounded" />
                </Field>
                <Field label="Nombre del plan (opcional)">
                    <input type="text" value={planName}
                        onChange={e => setPlanName(e.target.value)}
                        placeholder={`${numQuotas} cuotas`}
                        className="w-full px-3 py-2 border rounded" />
                </Field>
            </div>

            <div className="mb-4">
                <Button variant="primary" onClick={generarPreview}>
                    🎯 Generar preview
                </Button>
                {preview.length > 0 && (
                    <span className="ml-3 text-sm text-gray-600">
                        Preview: <strong>{preview.length}</strong> cuotas ·
                        {' '}Total: <strong>{formatGs(totalPreview)}</strong>
                        {Number(sale.down_payment || 0) > 0 && (
                            <> · Entrega inicial: <strong>{formatGs(sale.down_payment)}</strong></>
                        )}
                        {sale.total_price && (
                            <> · A financiar: <strong>{formatGs(aFinanciar)}</strong>
                            {' '}
                            <span className={totalPreview.toFixed(0) === aFinanciar.toFixed(0)
                                ? 'text-green-600' : 'text-orange-600'}>
                                (diferencia: {formatGs(totalPreview - aFinanciar)})
                            </span></>
                        )}
                    </span>
                )}
            </div>

            {/* Preview editable */}
            {preview.length > 0 && (
                <>
                    <div className="overflow-x-auto border rounded mb-3">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-3 py-2 text-left">#</th>
                                    <th className="px-3 py-2 text-left">Vencimiento</th>
                                    <th className="px-3 py-2 text-left">Monto</th>
                                    <th className="px-3 py-2 text-left">Nota</th>
                                    <th className="px-3 py-2 text-left"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((q, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="px-3 py-1">{q.quota_number}</td>
                                        <td className="px-3 py-1">
                                            <input type="date" className="px-2 py-1 border rounded"
                                                value={q.due_date}
                                                onChange={e => updatePreviewRow(i, { due_date: e.target.value })} />
                                        </td>
                                        <td className="px-3 py-1">
                                            <input type="number" step="0.01" className="w-32 px-2 py-1 border rounded"
                                                value={q.amount}
                                                onChange={e => updatePreviewRow(i, { amount: e.target.value })} />
                                        </td>
                                        <td className="px-3 py-1">
                                            <input type="text" placeholder="Refuerzo, etc."
                                                className="w-full px-2 py-1 border rounded"
                                                value={q.note}
                                                onChange={e => updatePreviewRow(i, { note: e.target.value })} />
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                            <button type="button"
                                                onClick={() => removePreviewRow(i)}
                                                className="text-red-600 hover:text-red-800 text-lg" title="Quitar">
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between">
                        <Button variant="secondary" onClick={addExtraRow}>+ Agregar fila</Button>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setPreview([])} disabled={saving}>
                                Descartar
                            </Button>
                            <Button variant="success" onClick={guardarTodas} disabled={saving}>
                                {saving ? 'Guardando...' : `💾 Guardar ${preview.length} cuotas`}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/* ---------- Lista y edición de cuotas ---------- */
function QuotasList({ quotas, onMarkPaid, onUpdate }) {
    const [editingId, setEditingId] = React.useState(null);
    const [draft, setDraft] = React.useState({});

    function startEdit(q) {
        setEditingId(q.id);
        setDraft({ amount: q.amount, due_date: q.due_date, status: q.status });
    }
    async function saveEdit() { await onUpdate(editingId, draft); setEditingId(null); }

    if (quotas.length === 0) {
        return <div className="text-center text-gray-600 py-4">Esta venta no tiene cuotas.</div>;
    }
    const total = quotas.reduce((sum, q) => sum + Number(q.amount || 0), 0);
    const paid  = quotas.filter(q => q.status === 'paid').reduce((sum, q) => sum + Number(q.amount || 0), 0);

    return (
        <div>
            <div className="mb-3 text-sm text-gray-700">
                <strong>{quotas.length}</strong> cuotas ·
                {' '}Total: <strong>{formatGs(total)}</strong> ·
                {' '}Cobrado: <strong>{formatGs(paid)}</strong>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Plan</th>
                        <th className="px-3 py-2 text-left">Monto</th>
                        <th className="px-3 py-2 text-left">Vence</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                        <th className="px-3 py-2 text-left">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {quotas.map(q => {
                        const editing = editingId === q.id;
                        return (
                            <tr key={q.id} className="border-b">
                                <td className="px-3 py-2">{q.quota_number}</td>
                                <td className="px-3 py-2 text-xs text-gray-600">{q.plan_name || '-'}</td>
                                <td className="px-3 py-2">
                                    {editing
                                        ? <input type="number" className="w-28 px-2 py-1 border rounded"
                                            value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
                                        : formatGs(q.amount)}
                                </td>
                                <td className="px-3 py-2">
                                    {editing
                                        ? <input type="date" className="px-2 py-1 border rounded"
                                            value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} />
                                        : (formatDate(q.due_date) || '-')}
                                </td>
                                <td className="px-3 py-2">
                                    {editing
                                        ? <select className="px-2 py-1 border rounded"
                                            value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                                            <option value="pending">Pendiente</option>
                                            <option value="paid">Pagada</option>
                                            <option value="cancelled">Cancelada</option>
                                        </select>
                                        : quotaStatusBadge(q.status, q.status_display, q.is_overdue)}
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex gap-1">
                                        {editing ? (
                                            <>
                                                <Button size="sm" variant="primary"   onClick={saveEdit}>Guardar</Button>
                                                <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancelar</Button>
                                            </>
                                        ) : (
                                            <>
                                                {q.status !== 'paid' && (
                                                    <Button size="sm" variant="success" onClick={() => onMarkPaid(q.id)}>✓ Pagar</Button>
                                                )}
                                                <Button size="sm" variant="secondary" onClick={() => startEdit(q)}>✏</Button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
