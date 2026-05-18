/**
 * Página Inventario de Vehículos
 *
 * Filtros disponibles:
 *  - Búsqueda libre (VIN, marca, modelo, color, patente, año)
 *  - Estado (chips)
 *  - Marca (dropdown)
 *  - Modelo (dropdown, en cascada con la marca)
 *  - Año (rango desde/hasta)
 *  - Color (dropdown auto-populado del inventario)
 *  - Precio (rango)
 */

const { useState, useEffect, useMemo } = React;

function Vehicles() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filtros
    // Si vinimos vía Ctrl+K → "ir a vehículo" con ?q=<VIN>, el listado
    // arranca pre-filtrado por ese término (el palette no tiene detail
    // page todavía; el "abrir" se traduce en filtro). En ese caso también
    // forzamos stateFilter='all' — el palette puede llevarnos a un vendido
    // y no queremos esconderlo por el default 'available'.
    const initialQ = (() => {
        if (typeof window === 'undefined') return '';
        const sp = new URLSearchParams(window.location.search);
        return sp.get('q') || '';
    })();
    const [search, setSearch] = useState(initialQ);
    // Por defecto arrancamos en "Disponibles": es lo que el vendedor necesita ver
    // primero ("¿qué tengo para ofrecer?"). Para revisar vendidos se cambia el chip.
    const [stateFilter, setStateFilter] = useState(initialQ ? 'all' : 'available');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [yearFrom, setYearFrom] = useState('');
    const [yearTo, setYearTo] = useState('');
    const [color, setColor] = useState('');
    const [priceFrom, setPriceFrom] = useState('');
    const [priceTo, setPriceTo] = useState('');

    const { selectedBranch, branches } = useBranch();

    // Filtros de inconsistencias (chip)
    const [quality, setQuality] = useState('all'); // all | sin_precio | vin_basura | inconsistente

    useEffect(() => { fetchVehicles(); }, [selectedBranch]);

    async function fetchVehicles() {
        setLoading(true);
        try {
            const params = { page_size: 1000 };
            if (selectedBranch) params.branch = selectedBranch;
            const response = await api.get('/vehicles/', { params });
            setVehicles(response.data.results || response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar vehículos');
        } finally {
            setLoading(false);
        }
    }

    // Listas para los dropdowns (auto-populadas del inventario actual)
    const brands = useMemo(() => {
        const set = new Set();
        vehicles.forEach(v => v.brand_name && set.add(v.brand_name));
        return Array.from(set).sort();
    }, [vehicles]);

    const models = useMemo(() => {
        const filtered = brand
            ? vehicles.filter(v => v.brand_name === brand)
            : vehicles;
        const set = new Set();
        filtered.forEach(v => v.model_name && set.add(v.model_name));
        return Array.from(set).sort();
    }, [vehicles, brand]);

    const colors = useMemo(() => {
        const set = new Set();
        vehicles.forEach(v => v.color && v.color.trim() && set.add(v.color.trim()));
        return Array.from(set).sort();
    }, [vehicles]);

    // Heurísticas de inconsistencia (locales — el backend tiene el cálculo definitivo)
    function isVinBasura(v) {
        const vin = (v.vin || '').toUpperCase();
        return vin.startsWith('VIN-DUMMY') || /^VIN[0-9]+$/.test(vin) || vin === '' || vin.length < 6;
    }
    function isSinPrecio(v) { return !v.price || Number(v.price) === 0; }

    const qualityCounts = useMemo(() => ({
        all: vehicles.length,
        sin_precio: vehicles.filter(isSinPrecio).length,
        vin_basura: vehicles.filter(isVinBasura).length,
    }), [vehicles]);

    // Aplicar filtros
    const filtered = useMemo(() => {
        let list = vehicles;
        if (stateFilter !== 'all') list = list.filter(v => v.state === stateFilter);
        if (brand) list = list.filter(v => v.brand_name === brand);
        if (model) list = list.filter(v => v.model_name === model);
        if (color) list = list.filter(v => (v.color || '').trim() === color);
        if (yearFrom) list = list.filter(v => Number(v.year) >= Number(yearFrom));
        if (yearTo) list = list.filter(v => Number(v.year) <= Number(yearTo));
        if (priceFrom) list = list.filter(v => Number(v.price) >= Number(priceFrom));
        if (priceTo) list = list.filter(v => Number(v.price) <= Number(priceTo));
        if (quality === 'sin_precio')   list = list.filter(isSinPrecio);
        if (quality === 'vin_basura')   list = list.filter(isVinBasura);
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(v =>
                (v.vin || '').toLowerCase().includes(q) ||
                (v.brand_name || '').toLowerCase().includes(q) ||
                (v.model_name || '').toLowerCase().includes(q) ||
                (v.color || '').toLowerCase().includes(q) ||
                (v.license_plate || '').toLowerCase().includes(q) ||
                String(v.year || '').includes(q)
            );
        }
        return list;
    }, [vehicles, search, stateFilter, brand, model, color, yearFrom, yearTo, priceFrom, priceTo, quality]);

    const byState = useMemo(() => {
        const out = { all: vehicles.length, available: 0, reserved: 0, sold: 0, maintenance: 0 };
        for (const v of vehicles) out[v.state] = (out[v.state] || 0) + 1;
        return out;
    }, [vehicles]);

    const totalValor = useMemo(
        () => filtered.reduce((s, v) => s + Number(v.price || 0), 0),
        [filtered]
    );

    const filtersActive = !!(search || stateFilter !== 'all' || brand || model || color
        || yearFrom || yearTo || priceFrom || priceTo);

    function clearFilters() {
        setSearch(''); setStateFilter('all'); setBrand(''); setModel('');
        setYearFrom(''); setYearTo(''); setColor(''); setPriceFrom(''); setPriceTo('');
    }

    if (loading) {
        return (
            <div className="max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Inventario de Vehículos</h1>
                    <p className="text-gray-600">Cargando...</p>
                </div>
                <TableSkeleton rows={10} cols={7} />
            </div>
        );
    }

    const stateBadge = state => ({
        available:   'bg-green-100 text-green-800',
        reserved:    'bg-yellow-100 text-yellow-800',
        sold:        'bg-gray-200 text-gray-800',
        maintenance: 'bg-orange-100 text-orange-800',
    })[state] || 'bg-gray-100 text-gray-700';

    return (
        <div className="max-w-7xl">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inventario de Vehículos</h1>
                    <p className="text-gray-600">
                        Mostrando <strong>{filtered.length}</strong> de <strong>{vehicles.length}</strong> vehículos
                        {' '}· Valor total filtrado: <strong>{formatGs(totalValor)}</strong>
                    </p>
                </div>
                <Button variant="secondary" onClick={fetchVehicles}>↻ Refrescar</Button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}

            {/* Aviso de filtro de sucursal */}
            {selectedBranch && branches.length > 1 && (
                <div className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded p-2 mb-3">
                    Mostrando sólo vehículos de <strong>{branches.find(b => String(b.id) === String(selectedBranch))?.name}</strong>.
                    {' '}Cambiá el selector arriba a "Todas" para ver el stock global.
                </div>
            )}

            {/* Chips de inconsistencias */}
            {(qualityCounts.sin_precio > 0 || qualityCounts.vin_basura > 0) && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {[
                        ['all',        `Todos (${qualityCounts.all})`,                'gray'],
                        ['sin_precio', `⚠ Sin precio (${qualityCounts.sin_precio})`,   'red'],
                        ['vin_basura', `⚠ VIN placeholder (${qualityCounts.vin_basura})`,'yellow'],
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
            )}

            {/* Filtros */}
            <Card className="mb-4">
                <div className="space-y-3">
                    {/* Buscador libre */}
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por VIN, marca, modelo, color, patente, año..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />

                    {/* Chips de estado */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            ['all', 'Todos'],
                            ['available', 'Disponibles'],
                            ['reserved', 'Reservados'],
                            ['sold', 'Vendidos'],
                            ['maintenance', 'Mantenimiento'],
                        ].map(([key, label]) => (
                            <button key={key} type="button"
                                onClick={() => setStateFilter(key)}
                                className={`px-3 py-1.5 text-sm rounded-full border ${
                                    stateFilter === key
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}>
                                {label} ({byState[key] || 0})
                            </button>
                        ))}
                    </div>

                    {/* Dropdowns y rangos */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
                            <select value={brand}
                                onChange={e => { setBrand(e.target.value); setModel(''); }}
                                className="w-full px-3 py-2 border rounded">
                                <option value="">Todas ({brands.length})</option>
                                {brands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
                            <select value={model} onChange={e => setModel(e.target.value)}
                                disabled={false}
                                className="w-full px-3 py-2 border rounded">
                                <option value="">Todos ({models.length})</option>
                                {models.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                            <select value={color} onChange={e => setColor(e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="">Todos</option>
                                {colors.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                            <div className="flex gap-1">
                                <input type="number" placeholder="Desde" value={yearFrom}
                                    onChange={e => setYearFrom(e.target.value)}
                                    className="w-1/2 px-2 py-2 border rounded" />
                                <input type="number" placeholder="Hasta" value={yearTo}
                                    onChange={e => setYearTo(e.target.value)}
                                    className="w-1/2 px-2 py-2 border rounded" />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Precio (Gs.)</label>
                            <div className="flex gap-1">
                                <input type="number" placeholder="Desde" value={priceFrom}
                                    onChange={e => setPriceFrom(e.target.value)}
                                    className="w-1/2 px-2 py-2 border rounded" />
                                <input type="number" placeholder="Hasta" value={priceTo}
                                    onChange={e => setPriceTo(e.target.value)}
                                    className="w-1/2 px-2 py-2 border rounded" />
                            </div>
                        </div>
                    </div>

                    {filtersActive && (
                        <div className="flex justify-end pt-1">
                            <Button size="sm" variant="secondary" onClick={clearFilters}>
                                ✕ Limpiar filtros
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <ResponsiveTable
                    data={filtered}
                    getRowKey={v => v.id}
                    columns={[
                        { key: 'mm',     label: 'Marca / Modelo', primary: true,
                          render: v => (
                              <div>
                                  <div className="font-semibold">{v.brand_name} {v.model_name}</div>
                                  <div className="text-xs text-gray-500">{v.year} · {v.color || 'sin color'}</div>
                              </div>
                          ) },
                        { key: 'vin',    label: 'Chasis (VIN)', render: v => (
                              <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs">{v.vin}</span>
                                  {isVinBasura(v) && (
                                      <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-yellow-200 text-yellow-900"
                                            title="VIN generado por la migración — reemplazar por el chasis real">AUTO</span>
                                  )}
                              </div>
                          ) },
                        ...(branches.length > 1 && !selectedBranch ? [{
                            key: 'branch', label: 'Sucursal',
                            render: v => v.branch_name
                                ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      v.branch_name === 'CASA CENTRAL'
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-teal-100 text-teal-800'
                                  }`}>{v.branch_name}</span>
                                : <span className="text-gray-400">—</span>,
                        }] : []),
                        { key: 'price',  label: 'Precio', render: v => (
                              isSinPrecio(v)
                                  ? <span className="text-red-600 font-medium">⚠ Sin precio</span>
                                  : <span className="font-semibold">{formatGs(v.price)}</span>
                          ) },
                        { key: 'state',  label: 'Estado', render: v => vehicleStateBadge(v.state, v.state_display) },
                    ]}
                    emptyState={
                        filtersActive
                            ? <EmptyState filtered onClear={clearFilters} />
                            : <EmptyState
                                emoji="🚗"
                                title="No hay vehículos en inventario"
                                description="Cuando importes stock o crees un vehículo desde una venta, aparecerá acá."
                            />
                    }
                />
            </Card>
        </div>
    );
}
