/**
 * ResponsiveTable — tabla que colapsa a cards en pantallas chicas.
 *
 * Acepta una definición de columnas y los datos. En desktop (>= md) muestra
 * una tabla normal; en mobile (< md) muestra cada fila como una card vertical
 * con label/value.
 *
 * Uso:
 *   <ResponsiveTable
 *     columns={[
 *       { key: 'sale_number', label: 'Número', primary: true },
 *       { key: 'sale_date',   label: 'Fecha',  render: row => formatDate(row.sale_date) },
 *       { key: 'customer_name', label: 'Cliente' },
 *       { key: 'total_price', label: 'Total', render: row => formatGs(row.total_price), align: 'right' },
 *       { key: 'actions', label: '', render: row => <Button>Editar</Button>, hideOnMobile: false },
 *     ]}
 *     data={filteredSales}
 *     getRowKey={r => r.id}
 *   />
 *
 * Opciones por columna:
 *   - `primary`: en mobile aparece destacado en el encabezado de la card
 *   - `hideOnMobile`: oculta esta columna en pantallas chicas
 *   - `render`: función que recibe la fila y devuelve el contenido
 *   - `align`: 'left' | 'right' | 'center'
 */
function ResponsiveTable({ columns, data, getRowKey = (r, i) => r.id ?? i, emptyState, mobileHeaderRender }) {
    const visibleCols = columns.filter(c => !c.hideOnMobile);
    const primaryCol = columns.find(c => c.primary) || columns[0];

    if (data.length === 0 && emptyState) return emptyState;

    return (
        <>
            {/* Desktop: tabla */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            {columns.map(col => (
                                <th key={col.key}
                                    className={`px-4 py-3 text-${col.align || 'left'} text-xs font-medium text-gray-700 uppercase`}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={getRowKey(row, i)} className="border-b hover:bg-gray-50">
                                {columns.map(col => (
                                    <td key={col.key}
                                        className={`px-4 py-2.5 text-sm text-${col.align || 'left'}`}>
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
                {data.map((row, i) => (
                    <div key={getRowKey(row, i)} className="bg-white rounded-lg border p-3">
                        {mobileHeaderRender
                            ? mobileHeaderRender(row)
                            : <div className="font-semibold text-base mb-2 pb-2 border-b">
                                {primaryCol.render ? primaryCol.render(row) : row[primaryCol.key]}
                              </div>
                        }
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                            {visibleCols
                                .filter(c => c !== primaryCol && c.label)
                                .map(col => (
                                    <React.Fragment key={col.key}>
                                        <span className="text-gray-500 text-xs uppercase">{col.label}</span>
                                        <span className="text-gray-900 text-right">
                                            {col.render ? col.render(row) : row[col.key]}
                                        </span>
                                    </React.Fragment>
                                ))
                            }
                        </div>
                        {/* Acciones (columna sin label) en su propia fila */}
                        {visibleCols.filter(c => !c.label).map(col => (
                            <div key={col.key} className="mt-2 pt-2 border-t flex justify-end">
                                {col.render ? col.render(row) : row[col.key]}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </>
    );
}
