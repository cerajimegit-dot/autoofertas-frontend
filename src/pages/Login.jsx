/**
 * Página de Login
 */

const { useState } = React;
const { useHistory } = window.ReactRouterDOM;

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const { login } = useAuth();
    const history = useHistory();

    async function handleLogin(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);
        
        if (result.success) {
            setLoading(false);
            history.push('/');
        } else {
            setError(result.error);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Header con logo de AUTO OFERTAS */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-2xl shadow-lg mb-4 overflow-hidden p-2">
                        <img
                            src="/assets/logo.jpg"
                            alt="AUTO OFERTAS"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                                // Fallback al emoji si la imagen no carga
                                e.currentTarget.outerHTML = '<span class="text-5xl">🚗</span>';
                            }}
                        />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">AUTO OFERTAS</h1>
                    <p className="text-blue-100 text-sm">Sistema de gestión de ventas y cobranzas</p>
                </div>

                {/* Form Card */}
                <Card className="bg-white shadow-2xl">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Iniciar Sesión</h2>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Usuario
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                                autoComplete="username"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? <span className="loading"></span> : 'Iniciar Sesión'}
                        </Button>
                    </form>
                </Card>

                {/* Footer */}
                <p className="text-center text-blue-100 text-xs mt-6">
                    Si olvidaste tu contraseña, pedí a la administradora que la resetee.
                </p>
            </div>
        </div>
    );
}
