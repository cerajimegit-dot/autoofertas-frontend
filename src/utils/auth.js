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
        localStorage.setItem('access_token', '');
        localStorage.setItem('refresh_token', '');
        localStorage.setItem('user', '');
    },
    
    setUser: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
    },
    
    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
};
