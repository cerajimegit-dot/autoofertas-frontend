/**
 * Utilidades de almacenamiento local
 */

const storageUtils = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Error guardando en localStorage:', e);
        }
    },

    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Error leyendo de localStorage:', e);
            return defaultValue;
        }
    },

    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Error eliminando de localStorage:', e);
        }
    },

    clear: () => {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Error limpiando localStorage:', e);
        }
    },
};
