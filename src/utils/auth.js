/**
 * Utilidades de autenticación
 */

const authUtils = {
    setTokens: (accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
        }
    },
    
    getAccessToken: () => localStorage.getItem('access_token'),
    getRefreshToken: () => localStorage.getItem('refresh_token'),
    
    isAuthenticated: () => !!localStorage.getItem('access_token'),
    
    logout: () => {
        // removeItem — antes usabamos setItem('') que dejaba residuo y confundia
        // debug ("por que hay un access_token vacio guardado?")
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    },
    
    setUser: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
    },
    
    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
};
