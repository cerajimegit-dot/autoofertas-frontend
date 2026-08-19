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
        // Limpiar estado local INMEDIATAMENTE (no esperar al backend).
        // Antes: se hacia `await api.post('/users/logout/')` primero, y si
        // el token estaba expirado o Render frio, el await colgaba y el
        // boton "Cerrar sesion" parecia no responder por 10+ segundos.
        const refresh = authUtils.getRefreshToken();
        authUtils.logout();
        setUser(null);
        setIsAuthenticated(false);

        // Notificar al backend para blacklistear el refresh, fire-and-forget.
        if (refresh) {
            api.post('/users/logout/', { refresh }).catch(() => {});
        }

        // Redirigir a /login con replace para que no quede en history.
        window.location.replace('/login');
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
