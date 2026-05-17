/**
 * Componente Card reutilizable
 */

function Card({ title, children, className = '', footer = null }) {
    return (
        <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
            {title && (
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
            )}
            {children}
            {footer && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    {footer}
                </div>
            )}
        </div>
    );
}
