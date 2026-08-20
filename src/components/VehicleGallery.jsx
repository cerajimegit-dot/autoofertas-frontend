/**
 * VehicleGallery — galería simple de fotos de un vehículo.
 *
 * Muestra las fotos en un carousel horizontal simple, permite subir
 * nuevas (input file, con cámara en mobile) y borrar existentes.
 *
 * Props: vehicleId (int)
 */

function VehicleGallery({ vehicleId }) {
    const [images, setImages] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [uploading, setUploading] = React.useState(false);
    const [current, setCurrent] = React.useState(0);
    const fileInputRef = React.useRef(null);
    const { toast } = useToast();

    async function loadImages() {
        setLoading(true);
        try {
            const res = await api.get(`/vehicles/${vehicleId}/images/`);
            setImages(res.data || []);
        } catch (err) {
            /* no photos yet */
            setImages([]);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => { loadImages(); }, [vehicleId]);

    async function onFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('order', String(images.length));
            await api.post(`/vehicles/${vehicleId}/images/`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await loadImages();
            toast.success('Foto subida');
            setCurrent(images.length);   // ver la recién subida
        } catch (err) {
            toast.error('No se pudo subir la foto', err.response?.data || err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function deleteImage(imgId) {
        if (!window.confirm('¿Borrar esta foto?')) return;
        try {
            await api.delete(`/vehicles/${vehicleId}/images/${imgId}/`);
            await loadImages();
            setCurrent(0);
            toast.success('Foto borrada');
        } catch (err) {
            toast.error('No se pudo borrar', err.response?.data || err.message);
        }
    }

    if (loading) return <div className="w-full h-64 bg-gray-100 rounded animate-pulse" />;

    if (images.length === 0) {
        return (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm text-gray-600 mb-3">Sin fotos todavía</p>
                <label className="inline-block px-4 py-2 bg-red-600 text-white rounded cursor-pointer hover:bg-red-700 text-sm">
                    {uploading ? 'Subiendo...' : '+ Agregar primera foto'}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                        className="hidden" onChange={onFileChange} disabled={uploading} />
                </label>
                <p className="text-xs text-gray-400 mt-2">En celular usa la cámara directamente</p>
            </div>
        );
    }

    const currentImg = images[current];

    return (
        <div className="space-y-2">
            {/* Foto grande */}
            <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                <img src={currentImg.url} alt="Vehículo"
                    className="w-full h-full object-contain" />
                {images.length > 1 && (
                    <>
                        <button onClick={() => setCurrent((current - 1 + images.length) % images.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full hover:bg-black/70">
                            ‹
                        </button>
                        <button onClick={() => setCurrent((current + 1) % images.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full hover:bg-black/70">
                            ›
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2 py-0.5 rounded text-xs">
                            {current + 1} / {images.length}
                        </div>
                    </>
                )}
                <button onClick={() => deleteImage(currentImg.id)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full hover:bg-red-700 text-sm"
                    title="Borrar foto">🗑</button>
            </div>

            {/* Thumbnails + subir */}
            <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                    <button key={img.id} onClick={() => setCurrent(i)}
                        className={`w-16 h-16 rounded overflow-hidden border-2 shrink-0 ${
                            i === current ? 'border-red-500' : 'border-gray-200'
                        }`}>
                        <img src={img.url} className="w-full h-full object-cover" alt="" />
                    </button>
                ))}
                <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50 shrink-0">
                    {uploading ? '...' : '+'}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                        className="hidden" onChange={onFileChange} disabled={uploading} />
                </label>
            </div>
        </div>
    );
}
