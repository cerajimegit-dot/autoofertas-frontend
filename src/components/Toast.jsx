/**
 * Sistema de toast notifications.
 *
 * Reemplaza los alert() y confirm() nativos del browser por notificaciones
 * estilo "snackbar" en la esquina inferior derecha, no bloqueantes y estilables.
 *
 * Uso:
 *   const { toast } = useToast();
 *   toast.success('Guardado');
 *   toast.error('No se pudo guardar', detalleOpcional);
 *   toast.warning('Atención');
 *   toast.info('Tip rápido');
 *
 *   // Confirmación que devuelve Promise<bool>
 *   if (await toast.confirm('¿Eliminar esta cuota?')) { ... }
 */

const ToastContext = React.createContext(null);

function ToastProvider({ children }) {
    const [toasts, setToasts] = React.useState([]);
    const idRef = React.useRef(0);

    const dismiss = React.useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const push = React.useCallback((toast) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev, { ...toast, id }]);
        // Auto-dismiss salvo que sea de tipo confirm
        if (toast.type !== 'confirm') {
            const timeout = toast.timeout ?? 4000;
            setTimeout(() => dismiss(id), timeout);
        }
        return id;
    }, [dismiss]);

    const api = React.useMemo(() => ({
        success: (message, detail) => push({ type: 'success', message, detail }),
        error:   (message, detail) => push({ type: 'error',   message, detail, timeout: 7000 }),
        warning: (message, detail) => push({ type: 'warning', message, detail, timeout: 5000 }),
        info:    (message, detail) => push({ type: 'info',    message, detail }),
        confirm: (message, options = {}) => new Promise((resolve) => {
            const id = ++idRef.current;
            setToasts(prev => [...prev, {
                id, type: 'confirm',
                message,
                detail: options.detail,
                confirmText: options.confirmText || 'Sí',
                cancelText: options.cancelText || 'Cancelar',
                onConfirm: () => { dismiss(id); resolve(true); },
                onCancel: () => { dismiss(id); resolve(false); },
            }]);
        }),
        dismiss,
    }), [push, dismiss]);

    return (
        <ToastContext.Provider value={{ toast: api }}>
            {children}
            <ToastContainer toasts={toasts} dismiss={dismiss} />
        </ToastContext.Provider>
    );
}

function useToast() {
    const ctx = React.useContext(ToastContext);
    if (!ctx) {
        // Fallback en dev — si alguien usa useToast sin Provider, al menos no rompe.
        return {
            toast: {
                success: m => alert('OK: ' + m),
                error:   (m, d) => alert('Error: ' + m + (d ? '\n' + JSON.stringify(d) : '')),
                warning: m => alert('Aviso: ' + m),
                info:    m => alert(m),
                confirm: m => Promise.resolve(window.confirm(m)),
                dismiss: () => {},
            }
        };
    }
    return ctx;
}

function ToastContainer({ toasts, dismiss }) {
    return (
        <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-full max-w-sm pointer-events-none px-4 sm:px-0">
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }) {
    const styles = {
        success: { bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-900',  icon: '✓' },
        error:   { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-900',    icon: '✕' },
        warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-900', icon: '⚠' },
        info:    { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-900',   icon: 'ℹ' },
        confirm: { bg: 'bg-gray-50',   border: 'border-gray-400',   text: 'text-gray-900',   icon: '?' },
    }[toast.type] || { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-900', icon: '' };

    const detailText = (() => {
        if (!toast.detail) return null;
        if (typeof toast.detail === 'string') return toast.detail;
        try { return JSON.stringify(toast.detail, null, 2); } catch { return String(toast.detail); }
    })();

    return (
        <div className={`pointer-events-auto rounded-lg border ${styles.bg} ${styles.border} ${styles.text} shadow-lg p-3 animate-slide-in`}>
            <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">{styles.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{toast.message}</div>
                    {detailText && (
                        <pre className="text-xs mt-1 whitespace-pre-wrap break-words font-mono opacity-80 max-h-40 overflow-auto">
                            {detailText}
                        </pre>
                    )}
                    {toast.type === 'confirm' && (
                        <div className="flex gap-2 mt-2">
                            <button onClick={toast.onConfirm}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                {toast.confirmText}
                            </button>
                            <button onClick={toast.onCancel}
                                className="px-3 py-1 bg-gray-200 text-gray-800 text-xs rounded hover:bg-gray-300">
                                {toast.cancelText}
                            </button>
                        </div>
                    )}
                </div>
                {toast.type !== 'confirm' && (
                    <button onClick={onDismiss}
                        className="text-gray-400 hover:text-gray-600 leading-none text-lg">×</button>
                )}
            </div>
        </div>
    );
}
