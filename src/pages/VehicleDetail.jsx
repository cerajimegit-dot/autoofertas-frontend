/**
 * VehicleDetail — ficha detallada de un vehículo.
 *
 * Muestra:
 *   - Cabecera con marca/modelo/año + acciones rápidas (WhatsApp, imprimir, vender, editar)
 *   - Grid 2 cols: ficha técnica + panel Balance de Unidad
 *   - Panel "Gastos imputados" (VehicleCost del vehículo)
 *   - Panel "Historial" (audit logs — pendiente, endpoint no listado aún)
 *
 * Ruta: /vehicles/:id
 */

const { useParams, useHistory: useHistoryVD } = window.ReactRouterDOM;

function VehicleDetail() {
    const { id } = useParams();
    const history = useHistoryVD();
    const { rate: usdRate } = useExchangeRate();
    const { toast } = useToast();

    const [vehicle, setVehicle] = React.useState(null);
    const [costs, setCosts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [editing, setEditing] = React.useState(false);
    const [printMode, setPrintMode] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([
            api.get(`/vehicles/${id}/`),
            api.get(`/vehicles/${id}/costs/`).catch(() => ({ data: [] })),
        ]).then(([v, c]) => {
            if (cancelled) return;
            setVehicle(v.data);
            setCosts(c.data.results || c.data || []);
        }).catch(err => {
            if (!cancelled) setError(err.response?.data?.detail || 'Error al cargar vehículo');
        }).finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [id]);

    if (loading) return (
        <div className="max-w-6xl">
            <p className="text-gray-600 mb-4">Cargando ficha...</p>
            <TableSkeleton rows={5} cols={2} />
        </div>
    );
    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded max-w-6xl">{error}</div>;
    if (!vehicle) return <div className="text-gray-600">Vehículo no encontrado.</div>;

    const v = vehicle;
    const ganancia = calcGananciaEstimada(v, usdRate);
    const fobGs = Number(v.fob || 0) * Number(usdRate || 0);
    const costosBase = fobGs + Number(v.dispatch||0) + Number(v.cam_vol||0) + Number(v.container||0);
    const costosExtra = costs.reduce((sum, c) => {
        const amt = Number(c.amount || 0);
        if (c.currency === 'USD' && c.exchange_rate) return sum + amt * Number(c.exchange_rate);
        return sum + amt;
    }, 0);
    const costoTotal = costosBase + costosExtra;
    const gananciaReal = Number(v.price || 0) - costoTotal;

    return (
        <div className="max-w-6xl">
            {/* Cabecera con acciones */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <button onClick={() => history.push('/vehicles')}
                        className="text-sm text-gray-600 hover:underline mb-2">← Volver a Vehículos</button>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {v.brand_name} {v.model_name}
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Año {v.year} · <span className="font-mono text-sm">{v.vin}</span>
                        {v.color && <> · {v.color}</>}
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap self-start">
                    <button onClick={() => setEditing(true)}
                        className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                        ✏ Editar
                    </button>
                    <button onClick={() => {
                            const msg = formatVehicleForShare(v);
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="px-3 py-2 text-sm border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">
                        📱 WhatsApp
                    </button>
                    <button onClick={() => {
                            setPrintMode(true);
                            setTimeout(() => { window.print(); setPrintMode(false); }, 100);
                        }}
                        className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                        🖨 Imprimir ficha
                    </button>
                    {v.state === 'available' && (
                        <button onClick={() => history.push(`/sales?new=1&vehicle=${v.id}`)}
                            className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                            💰 Registrar venta
                        </button>
                    )}
                </div>
            </div>

            {/* Grid principal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Ficha técnica */}
                <Card>
                    <h2 className="font-semibold text-lg mb-3">Ficha técnica</h2>
                    <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        <dt className="text-gray-500">Chasis (VIN)</dt>
                        <dd className="font-mono text-xs">{v.vin || '—'}</dd>
                        <dt className="text-gray-500">Patente</dt>
                        <dd>{v.license_plate || '—'}</dd>
                        <dt className="text-gray-500">Marca / Modelo</dt>
                        <dd>{v.brand_name} {v.model_name}</dd>
                        <dt className="text-gray-500">Año</dt>
                        <dd>{v.year}</dd>
                        <dt className="text-gray-500">Color</dt>
                        <dd>{v.color || '—'}</dd>
                        <dt className="text-gray-500">Kilometraje</dt>
                        <dd>{v.mileage ? `${formatMoney(v.mileage)} km` : '—'}</dd>
                        <dt className="text-gray-500">Sucursal</dt>
                        <dd>{v.branch_name || '—'}</dd>
                        <dt className="text-gray-500">Estado</dt>
                        <dd>{vehicleStateBadge(v.state, v.state_display)}</dd>
                    </dl>
                </Card>

                {/* Balance de unidad */}
                <Card>
                    <h2 className="font-semibold text-lg mb-3">Balance de la unidad</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b pb-1">
                            <span>FOB (USD {formatMoney(v.fob)})</span>
                            <span>× TC {formatMoney(usdRate)} = <strong>{formatGs(fobGs)}</strong></span>
                        </div>
                        <div className="flex justify-between">
                            <span>Cigüeña (cam vol)</span>
                            <strong>{formatGs(v.cam_vol)}</strong>
                        </div>
                        <div className="flex justify-between">
                            <span>Despacho</span>
                            <strong>{formatGs(v.dispatch)}</strong>
                        </div>
                        <div className="flex justify-between">
                            <span>Contenedor</span>
                            <strong>{formatGs(v.container)}</strong>
                        </div>
                        {costosExtra > 0 && (
                            <div className="flex justify-between">
                                <span>Otros costos ({costs.length})</span>
                                <strong>{formatGs(costosExtra)}</strong>
                            </div>
                        )}
                        <div className="flex justify-between border-t pt-2 text-base">
                            <span className="text-gray-700">Costo total:</span>
                            <strong>{formatGs(costoTotal)}</strong>
                        </div>
                        <div className="flex justify-between text-base">
                            <span className="text-gray-700">Precio de venta:</span>
                            <strong>{v.price && Number(v.price) > 0 ? formatGs(v.price) : <span className="text-red-600">Sin precio</span>}</strong>
                        </div>
                        <div className={`flex justify-between text-lg pt-2 border-t-2 ${
                            gananciaReal > 0 ? 'text-green-700' : gananciaReal < 0 ? 'text-red-700' : 'text-gray-600'
                        }`}>
                            <span className="font-semibold">Ganancia estimada:</span>
                            <span className="font-bold">
                                {v.price && Number(v.price) > 0 ? formatGs(gananciaReal) : '—'}
                            </span>
                        </div>
                        {v.price && Number(v.price) > 0 && costoTotal > 0 && (
                            <div className="text-xs text-gray-500 text-right">
                                Margen: {((gananciaReal / Number(v.price)) * 100).toFixed(1)}%
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Gastos imputados */}
            {costs.length > 0 && (
                <Card className="mt-4">
                    <h2 className="font-semibold text-lg mb-3">Gastos imputados ({costs.length})</h2>
                    <table className="w-full text-sm">
                        <thead className="border-b text-xs uppercase text-gray-500">
                            <tr><th className="text-left py-1">Concepto</th>
                                <th className="text-right py-1">Monto</th>
                                <th className="text-right py-1">Moneda</th></tr>
                        </thead>
                        <tbody>
                            {costs.map(c => (
                                <tr key={c.id} className="border-b last:border-0">
                                    <td className="py-2">{c.concept}</td>
                                    <td className="py-2 text-right font-medium">{formatMoney(c.amount)}</td>
                                    <td className="py-2 text-right text-gray-600">{c.currency}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {editing && (
                <VehicleEditModal
                    vehicle={v}
                    onClose={() => setEditing(false)}
                    onSaved={(updated) => {
                        setVehicle(prev => ({ ...prev, ...updated }));
                        setEditing(false);
                        toast.success('Vehículo actualizado');
                    }}
                />
            )}

            {/* Ficha imprimible */}
            {printMode && <PrintableVehicleCard vehicle={v} />}
        </div>
    );
}
