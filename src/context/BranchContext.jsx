/**
 * Contexto global de sucursal seleccionada.
 *
 * - Carga la lista de sucursales **después** de que el usuario está logueado.
 *   El BranchProvider se monta antes que el login y el token JWT, así que
 *   el fetch tiene que esperar a que `isAuthenticated` sea true. Si no
 *   se espera, el endpoint devuelve 401 y `branches` queda en `[]` para
 *   siempre — bug que escondía el selector para todos los usuarios excepto
 *   el que ya tenía un token cacheado de antes.
 * - Cuando el usuario hace logout, limpia branches y selección.
 * - El usuario elige una sucursal o "Todas".
 * - La elección se persiste en localStorage para que sobreviva al reload.
 * - Cualquier página puede leerla con useBranch() y agregarla a sus filtros.
 */

const BranchContext = React.createContext({
    branches: [],
    selectedBranch: null,
    setSelectedBranch: () => {},
    loading: true,
});

function BranchProvider({ children }) {
    const { isAuthenticated } = useAuth();   // observamos auth para re-fetchear

    const [branches, setBranches] = React.useState([]);
    const [selectedBranch, setSelectedBranchState] = React.useState(() => {
        const saved = localStorage.getItem('selected_branch');
        return saved ? saved : '';  // '' = todas
    });
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        // Si no hay sesión, no intentes fetchear (genera 401 silencioso y
        // dejaba el array vacío permanentemente).
        if (!isAuthenticated) {
            setBranches([]);
            setLoading(false);
            return;
        }

        let mounted = true;
        setLoading(true);
        api.get('/branches/', { params: { page_size: 100 } })
            .then(r => {
                if (!mounted) return;
                const list = r.data.results || r.data;
                setBranches(list.filter(b => b.is_active !== false));
            })
            .catch((err) => {
                if (!mounted) return;
                // Logueamos el error en consola pero no rompemos la UI
                console.warn('BranchContext: no se pudieron cargar las sucursales', err);
                setBranches([]);
            })
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, [isAuthenticated]);   // re-fetch al loguearse / al deslogear

    function setSelectedBranch(value) {
        setSelectedBranchState(value);
        if (value) localStorage.setItem('selected_branch', value);
        else localStorage.removeItem('selected_branch');
    }

    return (
        <BranchContext.Provider value={{ branches, selectedBranch, setSelectedBranch, loading }}>
            {children}
        </BranchContext.Provider>
    );
}

function useBranch() {
    return React.useContext(BranchContext);
}

/** Componente de selector — usable en el Navbar */
function BranchSelector() {
    const { branches, selectedBranch, setSelectedBranch, loading } = useBranch();
    if (loading || branches.length <= 1) return null;
    return (
        <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sucursal:</label>
            <select value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm">
                <option value="">Todas</option>
                {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
        </div>
    );
}
