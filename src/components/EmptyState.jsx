/**
 * Empty state — pantalla amigable cuando un listado está vacío.
 *
 * Uso:
 *   <EmptyState
 *     emoji="🚗"
 *     title="No hay vehículos en inventario"
 *     description="Cuando registres una compra o una venta, los vehículos aparecerán acá."
 *     action={<Button onClick={openNew}>+ Nuevo vehículo</Button>}
 *   />
 *
 * Si hay filtros activos, usar variante "filtered" para mensaje distinto:
 *   <EmptyState filtered onClear={clearFilters} />
 */
function EmptyState({
    emoji = '📭',
    title,
    description,
    action,
    filtered = false,
    onClear,
}) {
    if (filtered) {
        return (
            <div className="text-center py-12 px-4">
                <div className="text-5xl mb-3 opacity-60">🔍</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Sin resultados con esos filtros</h3>
                <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                    Probá con criterios menos específicos o sacá algunos filtros para ver más resultados.
                </p>
                {onClear && (
                    <button onClick={onClear}
                        className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded">
                        ✕ Limpiar filtros
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="text-center py-12 px-4">
            <div className="text-5xl mb-3 opacity-60">{emoji}</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">{description}</p>
            )}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
