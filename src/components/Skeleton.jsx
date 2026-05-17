/**
 * Skeletons para mostrar mientras carga data.
 *
 * Uso:
 *   if (loading) return <TableSkeleton rows={10} />;
 *   if (loading) return <CardsSkeleton count={4} />;
 */

function Skeleton({ className = '', width, height }) {
    const style = {};
    if (width) style.width = width;
    if (height) style.height = height;
    return <div className={`skeleton rounded ${className}`} style={style} />;
}

function TableSkeleton({ rows = 8, cols = 6 }) {
    return (
        <div className="overflow-hidden rounded-lg border bg-white">
            <div className="border-b bg-gray-50 p-3">
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                    {Array.from({ length: cols }).map((_, i) => (
                        <Skeleton key={i} height="14px" className="opacity-50" />
                    ))}
                </div>
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="border-b p-3 last:border-b-0">
                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                        {Array.from({ length: cols }).map((_, c) => (
                            <Skeleton key={c} height="16px" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CardsSkeleton({ count = 4 }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-4 space-y-3">
                    <Skeleton height="14px" width="60%" />
                    <Skeleton height="32px" width="80%" />
                    <Skeleton height="12px" width="40%" />
                </div>
            ))}
        </div>
    );
}

function ListSkeleton({ rows = 5 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white rounded border">
                    <Skeleton height="16px" width="60%" />
                    <Skeleton height="16px" width="20%" />
                </div>
            ))}
        </div>
    );
}
