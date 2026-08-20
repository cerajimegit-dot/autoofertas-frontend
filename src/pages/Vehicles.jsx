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
    const history = ReactRouterDOM.useHistory();
    const { rate: usdRate } = useExchangeRate();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filtros
    const [search, setSearch] = useState('');
    // Por defecto arrancamos en "Disponibles": es lo que el vendedor necesita ver
    // primero ("¿qué tengo para ofrecer?"). Para revisar vendidos se cambia el chip.
    const [stateFilter, setStateFilter] = useState('available');
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

    // Modal de edicion + template imprimible
    const [editing, setEditing] = useState(null);
    const [printVehicle, setPrintVehicle] = useState(null);
    const { toast } = useToast();

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
                    <p className="text-gray-600">Cargando inventario...</p>
                </div>
                <TableSkeleton rows={10} cols={7} message="Cargando vehículos del inventario..." />
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
                        { key: 'ganancia', label: 'Ganancia est.', render: v => {
                              const g = calcGananciaEstimada(v, usdRate);
                              if (g === null) return <span className="text-gray-400">—</span>;
                              const cls = g > 0 ? 'text-green-700' : g < 0 ? 'text-red-600' : 'text-gray-600';
                              return <span className={`text-sm font-medium ${cls}`} title={`Precio - (FOB×TC) - despachos`}>
                                  {formatGsShort(g)}
                              </span>;
                          } },
                        { key: 'state',  label: 'Estado', render: v => vehicleStateBadge(v.state, v.state_display) },
                        { key: 'actions', label: '', render: v => (
                              <div className="flex gap-1">
                                  <button type="button" onClick={() => setEditing(v)}
                                      className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                                      title="Editar vehículo">✏</button>
                                  <button type="button"
                                      onClick={() => {
                                          const msg = formatVehicleForShare(v);
                                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                                      }}
                                      className="w-8 h-8 flex items-center justify-center border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50"
                                      title="Compartir por WhatsApp">📱</button>
                                  <button type="button"
                                      onClick={() => {
                                          setPrintVehicle(v);
                                          setTimeout(() => window.print(), 100);
                                      }}
                                      className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                                      title="Imprimir ficha">🖨</button>
                                  {v.state === 'available' && (
                                      <button type="button"
                                          onClick={() => history.push(`/sales?new=1&vehicle=${v.id}`)}
                                          className="w-8 h-8 flex items-center justify-center border border-red-300 text-red-700 rounded hover:bg-red-50"
                                          title="Registrar venta">💰</button>
                                  )}
                              </div>
                          ) },
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

            {editing && (
                <VehicleEditModal
                    vehicle={editing}
                    onClose={() => setEditing(null)}
                    onSaved={(updated) => {
                        setVehicles(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
                        setEditing(null);
                        toast.success(`${updated.brand_name} ${updated.model_name} actualizado`);
                    }}
                />
            )}

            {/* Template imprimible — solo visible al hacer window.print() */}
            {printVehicle && <PrintableVehicleCard vehicle={printVehicle} />}
        </div>
    );
}

/* ---------- Ficha imprimible A4 de un vehiculo ---------- */
function PrintableVehicleCard({ vehicle: v }) {
    return (
        <div className="print-only" style={{ padding: '1cm', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '22pt' }}>AUTO OFERTAS</h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '10pt', color: '#666' }}>
                    Ficha de vehículo · Impreso {formatDate(new Date().toISOString())}
                </p>
            </div>

            <h2 style={{ fontSize: '18pt', margin: '0 0 4px 0' }}>
                {v.brand_name} {v.model_name}
            </h2>
            <p style={{ fontSize: '12pt', color: '#666', margin: '0 0 20px 0' }}>
                Año {v.year} · Color {v.color || '—'}
            </p>

            <table style={{ marginBottom: '20px' }}>
                <tbody>
                    <tr><th style={{ width: '35%' }}>Chasis</th><td style={{ fontFamily: 'monospace' }}>{v.vin}</td></tr>
                    <tr><th>Patente</th><td>{v.license_plate || '—'}</td></tr>
                    <tr><th>Año</th><td>{v.year}</td></tr>
                    <tr><th>Color</th><td>{v.color || '—'}</td></tr>
                    <tr><th>Kilometraje</th><td>{v.mileage ? `${formatMoney(v.mileage)} km` : '—'}</td></tr>
                    <tr><th>Estado</th><td>{v.state_display || v.state}</td></tr>
                    <tr><th>Sucursal</th><td>{v.branch_name || '—'}</td></tr>
                </tbody>
            </table>

            <div style={{ border: '2px solid #333', padding: '15px', textAlign: 'center', marginTop: '30px' }}>
                <div style={{ fontSize: '10pt', color: '#666' }}>PRECIO DE VENTA</div>
                <div style={{ fontSize: '24pt', fontWeight: 'bold', marginTop: '5px' }}>
                    {v.price && Number(v.price) > 0 ? formatGs(v.price) : 'A CONSULTAR'}
                </div>
            </div>

            <p style={{ marginTop: '40px', fontSize: '9pt', color: '#666' }}>
                Datos sujetos a verificación. Los precios pueden variar sin previo aviso.
            </p>
        </div>
    );
}

/* ---------- Modal de edicion de vehiculo ---------- */
function VehicleEditModal({ vehicle, onClose, onSaved }) {
    const [form, setForm] = React.useState({
        vin:           vehicle.vin || '',
        license_plate: vehicle.license_plate || '',
        color:         vehicle.color || '',
        year:          vehicle.year || '',
        mileage:       vehicle.mileage || 0,
        price:         vehicle.price || 0,
        state:         vehicle.state || 'available',
        description:   vehicle.description || '',
    });
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    async function save(e) {
        e.preventDefault();
        setSaving(true); setErrorText('');
        try {
            const payload = {
                vin: form.vin.trim(),
                license_plate: form.license_plate.trim(),
                color: form.color.trim(),
                year: Number(form.year) || 0,
                mileage: Number(form.mileage) || 0,
                price: Number(form.price) || 0,
                state: form.state,
                description: form.description,
            };
            const res = await apiClient.updateVehicle(vehicle.id, payload);
            onSaved(res.data);
        } catch (err) {
            setErrorText(err.response?.data?.detail || JSON.stringify(err.response?.data || err.message));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
             onClick={onClose}>
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                 onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b">
                    <div>
                        <div className="text-xs text-gray-500">Editar vehículo</div>
                        <div className="font-semibold">
                            {vehicle.brand_name} {vehicle.model_name} {vehicle.year}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">×</button>
                </div>

                <form onSubmit={save} className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Chasis (VIN) *</label>
                            <input type="text" value={form.vin}
                                onChange={e => set('vin', e.target.value)}
                                className="w-full px-3 py-2 border rounded font-mono text-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Patente</label>
                            <input type="text" value={form.license_plate}
                                onChange={e => set('license_plate', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                            <input type="text" value={form.color}
                                onChange={e => set('color', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                            <input type="number" value={form.year}
                                onChange={e => set('year', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kilometraje</label>
                            <input type="number" min="0" value={form.mileage}
                                onChange={e => set('mileage', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Precio (Gs.) {Number(form.price) === 0 && (
                                    <span className="text-red-600 text-xs">⚠ Sin precio</span>
                                )}
                            </label>
                            <input type="number" min="0" value={form.price}
                                onChange={e => set('price', e.target.value)}
                                className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                            <select value={form.state}
                                onChange={e => set('state', e.target.value)}
                                className="w-full px-3 py-2 border rounded">
                                <option value="available">Disponible</option>
                                <option value="reserved">Reservado</option>
                                <option value="sold">Vendido</option>
                                <option value="maintenance">Mantenimiento</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Notas</label>
                        <textarea value={form.description}
                            onChange={e => set('description', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border rounded text-sm" />
                    </div>

                    {errorText && (
                        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{errorText}</div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
