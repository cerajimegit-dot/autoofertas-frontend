/**
 * Context de Autenticación
 * Maneja el estado global de autenticación
 */

const { createContext, useState, useEffect } = React;

const AuthContext = createContext();

function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Cargar usuario al montar componente
        const storedUser = authUtils.getUser();
        if (storedUser && authUtils.isAuthenticated()) {
            setUser(storedUser);
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const response = await apiClient.login(username, password);
            const { access, refresh, user: userData } = response.data;
            
            authUtils.setTokens(access, refresh);
            authUtils.setUser(userData);
            
            setUser(userData);
            setIsAuthenticated(true);
            
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Error al iniciar sesión' 
            };
        }
    };

    const logout = async () => {
        // Notificar al backend para que blacklistee el refresh token
        // (el backend lo agrega a token_blacklist y no se puede volver
        // a usar para renovar el access). Si la llamada falla, igual
        // limpiamos el storage local.
        const refresh = authUtils.getRefreshToken();
        if (refresh) {
            try {
                await api.post('/users/logout/', { refresh });
            } catch (e) {
                // Ignoramos errores: el usuario igual se va.
            }
        }
        authUtils.logout();
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ user, loading, isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

function useAuth() {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return context;
}
