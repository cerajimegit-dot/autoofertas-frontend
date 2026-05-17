/**
 * Página Administración de Usuarios (sólo admin)
 *
 *  - Lista todos los usuarios de la empresa.
 *  - Crear nuevo usuario.
 *  - Editar nombre, email, rol, estado.
 *  - Resetear contraseña.
 *  - Configurar sucursales visibles por usuario.
 */

const { useState, useEffect, useMemo } = React;

function Users() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isAdmin = user && (user.role === 'admin' || user.is_superuser);

    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editingPwd, setEditingPwd] = useState(null);
    const [editingBranches, setEditingBranches] = useState(null);

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true); setError('');
        try {
            const [usersRes, branchesRes] = await Promise.all([
                api.get('/users/', { params: { page_size: 200 } }),
                api.get('/branches/', { params: { page_size: 100 } }),
            ]);
            setUsers(usersRes.data.results || usersRes.data);
            setBranches(branchesRes.data.results || branchesRes.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar');
        } finally { setLoading(false); }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter(u =>
            (u.username || '').toLowerCase().includes(q) ||
            (u.first_name || '').toLowerCase().includes(q) ||
            (u.last_name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }, [users, search]);

    async function toggleActive(u) {
        try {
            await api.patch(`/users/${u.id}/`, { is_active: !u.is_active });
            await fetchAll();
            toast.success(`${u.username}: ${!u.is_active ? 'activado' : 'desactivado'}`);
        } catch (err) {
            const msg = err.response?.data?.detail || JSON.stringify(err.response?.data || err.message);
            toast.error(`No se pudo cambiar el estado: ${msg}`);
        }
    }

    if (!isAdmin) {
        return (
            <Card>
                <p className="text-red-600">No tenés permiso para ver esta sección.</p>
            </Card>
        );
    }

    if (loading) return <div className="flex items-center justify-center h-96"><div className="loading"></div></div>;

    return (
        <div className="max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
                    <p className="text-gray-600">Mostrando <strong>{filtered.length}</strong> de <strong>{users.length}</strong> usuarios</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setShowCreate(true)}>+ Nuevo usuario</Button>
                    <Button variant="secondary" onClick={fetchAll}>↻ Refrescar</Button>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}

            <div className="mb-4">
                <input type="text" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por usuario, nombre o email..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Usuario</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nombre</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rol</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sucursales visibles</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(u => (
                                <tr key={u.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-2.5 text-sm font-mono">{u.username}</td>
                                    <td className="px-4 py-2.5 text-sm">{`${u.first_name || ''} ${u.last_name || ''}`.trim() || '-'}</td>
                                    <td className="px-4 py-2.5 text-sm">{u.email || '-'}</td>
                                    <td className="px-4 py-2.5 text-sm">
                                        {userRoleBadge(u.role, u.role_display)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <button onClick={() => toggleActive(u)}
                                            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                                                u.is_active ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}>
                                            {u.is_active ? '✓ Activo' : '✗ Inactivo'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-2.5 text-sm">
                                        {u.branches_visible_detail?.length > 0
                                            ? u.branches_visible_detail.map(b => b.name).join(', ')
                                            : <span className="italic text-gray-500">Todas</span>}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="secondary" onClick={() => setEditingBranches(u)}>🏢 Sucursales</Button>
                                            <Button size="sm" variant="secondary" onClick={() => setEditingPwd(u)}>🔑 Pwd</Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="text-center py-8 text-gray-600">
                        {search ? 'Sin resultados' : 'No hay usuarios'}
                    </div>
                )}
            </Card>

            {showCreate && <UserCreateModal branches={branches} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchAll(); }} />}
            {editingPwd && <PasswordResetModal user={editingPwd} onClose={() => setEditingPwd(null)} onDone={() => setEditingPwd(null)} />}
            {editingBranches && <BranchesAssignModal user={editingBranches} branches={branches}
                onClose={() => setEditingBranches(null)}
                onSaved={() => { setEditingBranches(null); fetchAll(); }} />}
        </div>
    );
}

/* ---------- Sub-componentes ---------- */

function UserCreateModal({ branches, onClose, onCreated }) {
    const [form, setForm] = React.useState({
        username: '', password: '', first_name: '', last_name: '',
        email: '', role: 'vendor', phone: '', branches: [],
    });
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');

    async function submit(e) {
        e.preventDefault();
        setSaving(true); setErrorText('');
        try {
            await api.post('/users/admin_create/', form);
            onCreated();
        } catch (err) {
            setErrorText(JSON.stringify(err.response?.data || err.message, null, 2));
        } finally { setSaving(false); }
    }

    function toggleBranch(id) {
        setForm(prev => ({
            ...prev,
            branches: prev.branches.includes(id)
                ? prev.branches.filter(x => x !== id)
                : [...prev.branches, id],
        }));
    }

    return (
        <Modal2 title="Nuevo usuario" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                {errorText && (
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                        <strong className="text-red-700 text-sm block mb-2">Error</strong>
                        <textarea readOnly value={errorText} rows={4}
                            onClick={e => e.target.select()}
                            className="w-full text-xs font-mono bg-white border border-red-200 rounded p-2" />
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Usuario *">
                        <input type="text" required value={form.username}
                            onChange={e => setForm({...form, username: e.target.value})}
                            className="w-full px-3 py-2 border rounded font-mono" />
                    </Field>
                    <Field label="Contraseña *">
                        <input type="password" required minLength={6} value={form.password}
                            onChange={e => setForm({...form, password: e.target.value})}
                            placeholder="mínimo 6 caracteres"
                            autoComplete="new-password"
                            className="w-full px-3 py-2 border rounded" />
                    </Field>
                    <Field label="Nombre">
                        <input type="text" value={form.first_name}
                            onChange={e => setForm({...form, first_name: e.target.value})}
                            className="w-full px-3 py-2 border rounded" />
                    </Field>
                    <Field label="Apellido">
                        <input type="text" value={form.last_name}
                            onChange={e => setForm({...form, last_name: e.target.value})}
                            className="w-full px-3 py-2 border rounded" />
                    </Field>
                    <Field label="Email">
                        <input type="email" value={form.email}
                            onChange={e => setForm({...form, email: e.target.value})}
                            className="w-full px-3 py-2 border rounded" />
                    </Field>
                    <Field label="Teléfono">
                        <input type="text" value={form.phone}
                            onChange={e => setForm({...form, phone: e.target.value})}
                            className="w-full px-3 py-2 border rounded" />
                    </Field>
                    <Field label="Rol *">
                        <select value={form.role}
                            onChange={e => setForm({...form, role: e.target.value})}
                            className="w-full px-3 py-2 border rounded">
                            <option value="vendor">Vendedor</option>
                            <option value="manager">Encargado de sucursal</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </Field>
                </div>
                <Field label="Sucursales visibles (vacío = todas)">
                    <div className="space-y-1">
                        {branches.map(b => (
                            <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={form.branches.includes(b.id)}
                                    onChange={() => toggleBranch(b.id)} />
                                {b.name} ({b.code})
                            </label>
                        ))}
                    </div>
                </Field>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Creando...' : 'Crear usuario'}
                    </Button>
                </div>
            </form>
        </Modal2>
    );
}

function PasswordResetModal({ user, onClose, onDone }) {
    const { toast } = useToast();
    const [pwd, setPwd] = React.useState('');
    const [show, setShow] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');

    async function submit(e) {
        e.preventDefault();
        if (pwd.length < 6) { setErrorText('Mínimo 6 caracteres'); return; }
        setSaving(true); setErrorText('');
        try {
            await api.post(`/users/${user.id}/set_password/`, { password: pwd });
            toast.success(`Contraseña de ${user.username} actualizada`);
            onDone();
        } catch (err) {
            setErrorText(JSON.stringify(err.response?.data || err.message, null, 2));
        } finally { setSaving(false); }
    }

    return (
        <Modal2 title={`Resetear contraseña: ${user.username}`} onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                {errorText && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{errorText}</div>}
                <Field label="Nueva contraseña">
                    <div className="flex gap-1">
                        <input type={show ? 'text' : 'password'} autoFocus value={pwd}
                            onChange={e => setPwd(e.target.value)}
                            placeholder="mínimo 6 caracteres"
                            className="flex-1 px-3 py-2 border rounded" />
                        <button type="button" onClick={() => setShow(s => !s)}
                            className="px-3 py-2 text-sm border rounded text-gray-700 hover:bg-gray-50"
                            title={show ? 'Ocultar' : 'Mostrar'}>
                            {show ? '🙈' : '👁'}
                        </button>
                    </div>
                </Field>
                <p className="text-xs text-gray-500">
                    El usuario va a poder iniciar sesión con esta nueva contraseña inmediatamente.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Guardando...' : 'Resetear'}
                    </Button>
                </div>
            </form>
        </Modal2>
    );
}

function BranchesAssignModal({ user, branches, onClose, onSaved }) {
    const [selected, setSelected] = React.useState(
        (user.branches_visible || user.branches_visible_detail?.map(b => b.id) || []).map(Number)
    );
    const [saving, setSaving] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');

    function toggle(id) {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }

    async function save() {
        setSaving(true); setErrorText('');
        try {
            await api.post(`/users/${user.id}/set_branches/`, { branches: selected });
            onSaved();
        } catch (err) {
            setErrorText(JSON.stringify(err.response?.data || err.message, null, 2));
        } finally { setSaving(false); }
    }

    return (
        <Modal2 title={`Sucursales visibles: ${user.username}`} onClose={onClose}>
            <div className="space-y-3">
                {errorText && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{errorText}</div>}
                <p className="text-sm text-gray-600">
                    Marcá las sucursales que este usuario puede ver.
                    {' '}<strong>Sin ninguna marcada = puede ver todas</strong>.
                </p>
                <div className="space-y-1">
                    {branches.map(b => (
                        <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 hover:bg-gray-50 rounded">
                            <input type="checkbox" checked={selected.includes(b.id)}
                                onChange={() => toggle(b.id)} />
                            <strong>{b.name}</strong>
                            <span className="text-gray-500">({b.code})</span>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="button" variant="primary" onClick={save} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                </div>
            </div>
        </Modal2>
    );
}

/* Pequeño Modal local (no choca con Modal de Sales.jsx) */
function Modal2({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}
