/**
 * Contexto global de sucursal seleccionada.
 *
 * - Carga la lista de sucursales al iniciar.
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
    const [branches, setBranches] = React.useState([]);
    const [selectedBranch, setSelectedBranchState] = React.useState(() => {
        const saved = localStorage.getItem('selected_branch');
        return saved ? saved : '';  // '' = todas
    });
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let mounted = true;
        api.get('/branches/', { params: { page_size: 100 } })
            .then(r => {
                if (!mounted) return;
                const list = r.data.results || r.data;
                setBranches(list.filter(b => b.is_active !== false));
            })
            .catch(() => {})
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, []);

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
