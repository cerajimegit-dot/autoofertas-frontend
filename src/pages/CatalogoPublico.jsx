/**
 * CatalogoPublico — página pública del catálogo por enterprise.
 *
 * Ruta: /catalogo/:slug  (SIN autenticación)
 * Fuente: GET /api/public/catalogo/{slug}/
 *
 * Muestra grid de cards con fotos + datos + precio + botón "Consultar por WhatsApp".
 * NO usa el Layout normal (sin sidebar/navbar).
 */

const { useParams: useParamsCP } = window.ReactRouterDOM;

function CatalogoPublico() {
    const { slug } = useParamsCP();
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [search, setSearch] = React.useState('');

    React.useEffect(() => {
        let cancelled = false;
        fetch(`${window.API_BASE_URL || 'http://localhost:8001/api'}/public/catalogo/${slug}/`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(j => { if (!cancelled) { setData(j); setLoading(false); } })
            .catch(err => { if (!cancelled) { setError(String(err)); setLoading(false); } });
        return () => { cancelled = true; };
    }, [slug]);

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="loading mx-auto mb-3"></div>
                <p className="text-gray-600">Cargando catálogo...</p>
            </div>
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-3">🚫</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Catálogo no encontrado</h1>
                <p className="text-gray-600">El enlace que seguiste puede estar incorrecto o vencido.</p>
            </div>
        </div>
    );

    const { enterprise, vehicles } = data;
    const filtered = search
        ? vehicles.filter(v =>
            `${v.brand} ${v.model} ${v.color} ${v.year}`.toLowerCase().includes(search.toLowerCase()))
        : vehicles;

    const waPhone = (enterprise.phone || '').replace(/[^\d]/g, '');

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header público */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-red-600">{enterprise.name}</h1>
                        <p className="text-sm text-gray-600">
                            {enterprise.city}
                            {enterprise.phone && <> · Tel: {enterprise.phone}</>}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Vehículos disponibles</p>
                        <p className="text-2xl font-bold">{vehicles.length}</p>
                    </div>
                </div>
            </header>

            {/* Buscador */}
            <div className="max-w-6xl mx-auto px-4 py-4">
                <input type="text" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por marca, modelo, año, color..."
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            {/* Grid de vehículos */}
            <main className="max-w-6xl mx-auto px-4 pb-8">
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-lg p-12 text-center">
                        <div className="text-5xl mb-3">🚗</div>
                        <p className="text-gray-600">Sin vehículos que coincidan con la búsqueda.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(v => (
                            <div key={v.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition">
                                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                                    {v.image_url
                                        ? <img src={v.image_url} className="w-full h-full object-cover" alt="" />
                                        : <div className="text-5xl opacity-30">🚗</div>
                                    }
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-lg">{v.brand} {v.model}</h3>
                                    <p className="text-sm text-gray-600">
                                        {v.year} · {v.color || 'Sin color'}
                                        {v.mileage > 0 && <> · {formatMoney(v.mileage)} km</>}
                                    </p>
                                    <div className="mt-3 flex items-end justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500">Precio</p>
                                            <p className="text-xl font-bold text-red-600">
                                                {v.price ? formatGs(v.price) : 'A consultar'}
                                            </p>
                                        </div>
                                        <a
                                            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                                `Hola, me interesa el ${v.brand} ${v.model} ${v.year} (${v.color || ''}). ¿Sigue disponible?`)}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="px-3 py-2 bg-emerald-500 text-white text-sm rounded hover:bg-emerald-600">
                                            📱 Consultar
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <footer className="bg-white border-t mt-8">
                <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-500">
                    Catálogo actualizado en tiempo real · {enterprise.name}
                </div>
            </footer>
        </div>
    );
}
