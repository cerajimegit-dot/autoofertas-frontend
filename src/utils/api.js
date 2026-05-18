/**
 * Utilidades para API REST
 * Configura axios y proporciona funciones helper
 */

// En produccion se setea window.API_BASE_URL desde index.html / config.js
const API_BASE_URL = (typeof window !== 'undefined' && window.API_BASE_URL)
    ? window.API_BASE_URL
    : 'http://localhost:8001/api';

// Crear instancia de axios
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Interceptor para agregar token JWT
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => Promise.reject(error)
);

// Interceptor para manejar errores
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            const url = (error.config && error.config.url) || '';
            const isLoginRequest = url.includes('/users/login');
            const onLoginPage = window.location.pathname.replace(/\/$/, '') === '/login';
            // Solo redirigir si NO estamos en login y el request no es el login mismo
            if (!isLoginRequest && !onLoginPage) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Funciones API
const apiClient = {
    // Auth
    login: (username, password) => 
        api.post('/users/login/', { username, password }),
    register: (data) => 
        api.post('/users/register/', data),
    getCurrentUser: () => 
        api.get('/users/me/'),
    
    // Vehicles
    getVehicles: (params) => 
        api.get('/vehicles/', { params }),
    createVehicle: (data) => 
        api.post('/vehicles/', data),
    updateVehicle: (id, data) => 
        api.put(`/vehicles/${id}/`, data),
    deleteVehicle: (id) => 
        api.delete(`/vehicles/${id}/`),
    getAvailableVehicles: () => 
        api.get('/vehicles/available/'),
    getValorisedStock: () =>
        api.get('/vehicles/valorized_stock/'),
    getStuckVehicles: (params = {}) =>
        api.get('/vehicles/stuck/', { params }),
    
    // Brands
    getBrands: () => 
        api.get('/brands/'),
    createBrand: (name) => 
        api.post('/brands/', { name, is_active: true }),
    
    // Models
    getModels: () => 
        api.get('/vehicle-models/'),
    
    // Exchange Rates
    getExchangeRates: () => 
        api.get('/exchange-rates/'),
    getCurrentExchangeRate: () => 
        api.get('/exchange-rates/current/'),
    
    // Customers
    getCustomers: () => 
        api.get('/customers/'),
    createCustomer: (data) => 
        api.post('/customers/', data),
    updateCustomer: (id, data) => 
        api.put(`/customers/${id}/`, data),
    deleteCustomer: (id) => 
        api.delete(`/customers/${id}/`),
    
    // Sales
    getSales: (params) => 
        api.get('/sales/', { params }),
    createSale: (data) => 
        api.post('/sales/', data),
    getMonthlySales: () => 
        api.get('/sales/monthly_sales/'),
    getSalesReport: (startDate, endDate) => 
        api.get('/sales/sales_report/', { 
            params: { start_date: startDate, end_date: endDate } 
        }),
    
    // Payment Forms
    getPaymentForms: () => 
        api.get('/payment-forms/'),
    createPaymentForm: (name) => 
        api.post('/payment-forms/', { name, is_active: true }),
    
    // Quotas
    getQuotas: (params) => 
        api.get('/quotas/', { params }),
    createQuota: (data) => 
        api.post('/quotas/', data),
    markQuotaAsPaid: (id, payload = {}) =>
        api.post(`/quotas/${id}/mark_as_paid/`, payload),
    getPendingQuotas: (params = {}) =>
        api.get('/quotas/pending/', { params }),
    getOverdueQuotas: (params = {}) =>
        api.get('/quotas/overdue/', { params }),
    getNext30DaysQuotas: () =>
        api.get('/quotas/next_30_days/'),
    getUpcomingQuotas: (params = {}) =>
        api.get('/quotas/upcoming/', { params }),
    getQuotaReport: () =>
        api.get('/quotas/quota_report/'),
    // El endpoint contact_whatsapp acepta GET (las acciones idempotentes deben
    // ser GET, no POST). Devuelve { whatsapp_link, whatsapp_url, message, phone_normalized }.
    getWhatsAppLink: (id) =>
        api.get(`/quotas/${id}/contact_whatsapp/`),
    
    // Dashboard
    getDashboardSummary: (params = {}) =>
        api.get('/dashboard/summary/', { params }),
    getSalesByMonth: (params = {}) =>
        api.get('/dashboard/sales_by_month/', { params }),
    getSalesByBranch: (params = {}) =>
        api.get('/dashboard/sales_by_branch/', { params }),
    getVehicleModelsRanking: (params = {}) =>
        api.get('/dashboard/vehicle_models_ranking/', { params }),
    getQuotasStatus: (params = {}) =>
        api.get('/dashboard/quotas_status/', { params }),
    getInventoryStats: (params = {}) =>
        api.get('/dashboard/inventory_stats/', { params }),
    getTopCustomers: (params = {}) =>
        api.get('/dashboard/top_customers/', { params }),
    getTopMorosos: (params = {}) =>
        api.get('/dashboard/top_morosos/', { params }),
    getAgingCuotas: (params = {}) =>
        api.get('/dashboard/aging_cuotas/', { params }),
    getSalesByPaymentForm: (params = {}) =>
        api.get('/dashboard/sales_by_payment_form/', { params }),
    getAlertas: (params = {}) =>
        api.get('/dashboard/alertas/', { params }),
    getDataQuality: (params = {}) =>
        api.get('/dashboard/data_quality/', { params }),
    getHealthMetrics: (params = {}) =>
        api.get('/dashboard/health/', { params }),
};
