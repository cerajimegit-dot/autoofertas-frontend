/**
 * Hook para sincronizar un state con un query param de la URL.
 *
 * - Al montar, lee el valor del query param (si existe).
 * - Al cambiar el state, actualiza el query param con `history.replaceState`
 *   (no dispara navegación, no queda en history).
 * - Cuando el valor coincide con el default, remueve el param de la URL
 *   para mantenerla limpia.
 *
 * Uso:
 *   const [brand, setBrand] = useUrlState('brand', '');
 *   const [state, setState] = useUrlState('state', 'available');
 *
 * Beneficios:
 *   - Filtros persisten al recargar
 *   - Se pueden compartir/bookmarkear URLs con filtros aplicados
 *   - Botones "atrás" del browser funcionan de forma esperada
 */
function useUrlState(key, defaultValue = '') {
    const [value, setValueLocal] = React.useState(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const v = params.get(key);
            return v !== null ? v : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    const setValue = React.useCallback((newVal) => {
        setValueLocal(newVal);
        try {
            const url = new URL(window.location.href);
            if (newVal === defaultValue || newVal === '' || newVal === null || newVal === undefined) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, String(newVal));
            }
            window.history.replaceState({}, '', url.toString());
        } catch { /* ignore */ }
    }, [key, defaultValue]);

    return [value, setValue];
}
