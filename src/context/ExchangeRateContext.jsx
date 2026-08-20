/**
 * Contexto de cotización del dólar.
 *
 * - Al montar la app, fetch a /exchange-rates/current/ (solo si hay auth).
 * - Cachea en localStorage con TTL de 1h — evita refetches al navegar.
 * - Expone { rate, source, date, loading, refresh } via useExchangeRate().
 *
 * Usado por:
 *   - Navbar (chip visible siempre)
 *   - Vehicles (columna ganancia estimada = precio - fob * rate - gastos)
 *   - VehicleDetail (panel Balance de Unidad)
 *   - Sale form (conversión USD→Gs al vender)
 */

const ExchangeRateContext = React.createContext({
    rate: 0,
    source: '',
    date: null,
    loading: true,
    refresh: () => {},
});

const CACHE_KEY = 'exchange_rate_cache';
const CACHE_TTL_MS = 60 * 60 * 1000;   // 1 hora

function ExchangeRateProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const [state, setState] = React.useState(() => {
        // Levantar cache al inicio para evitar flash de "0" en el navbar
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.ts < CACHE_TTL_MS) {
                    return { ...parsed.data, loading: false };
                }
            }
        } catch (e) { /* ignore */ }
        return { rate: 0, source: '', date: null, loading: true };
    });

    const fetchRate = React.useCallback(async () => {
        try {
            const r = await api.get('/exchange-rates/current/');
            const data = {
                rate: Number(r.data.rate) || 0,
                source: r.data.source || '',
                date: r.data.date || null,
            };
            setState({ ...data, loading: false });
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch (err) {
            // Si no hay cotización activa (404) o fallo de red, no rompemos la app.
            setState(prev => ({ ...prev, loading: false }));
        }
    }, []);

    React.useEffect(() => {
        if (!isAuthenticated) {
            setState({ rate: 0, source: '', date: null, loading: false });
            return;
        }
        // Cache-first: si ya hay cache válido no refetch. Sino, fetch.
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.ts < CACHE_TTL_MS) return;
            }
        } catch (e) { /* ignore */ }
        fetchRate();
    }, [isAuthenticated, fetchRate]);

    const refresh = React.useCallback(() => {
        localStorage.removeItem(CACHE_KEY);
        fetchRate();
    }, [fetchRate]);

    return (
        <ExchangeRateContext.Provider value={{ ...state, refresh }}>
            {children}
        </ExchangeRateContext.Provider>
    );
}

function useExchangeRate() {
    return React.useContext(ExchangeRateContext);
}
