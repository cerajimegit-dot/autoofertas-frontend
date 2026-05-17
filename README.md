# Frontend - Playas de Autos

Sistema de gestión de playas de autos - Interfaz web moderna.

## 🚀 Características

- ✅ **Autenticación JWT** con persistencia
- ✅ **Dashboard** con KPIs en tiempo real
- ✅ **Gestión de Vehículos** (inventario)
- ✅ **Gestión de Ventas** con detalles
- ✅ **Gestión de Clientes**
- ✅ **Gestión de Cuotas** con WhatsApp
- ✅ **Gráficos interactivos** con Chart.js
- ✅ **Diseño responsivo** con Tailwind CSS
- ✅ **Tema moderno** y fácil de usar

## 📋 Requisitos

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Backend corriendo en `http://localhost:8001`
- Python y Django funcionando (para el backend)

## 🌐 Acceso

**URL**: http://localhost:3000

### Credenciales de prueba

```
Usuario: admin
Contraseña: admin123
```

## 📁 Estructura del Proyecto

```
playa-frontend/
├── index.html              # Punto de entrada
├── src/
│   ├── utils/
│   │   ├── api.js         # Cliente Axios
│   │   ├── auth.js        # Utilidades de auth
│   │   └── storage.js     # LocalStorage helpers
│   ├── context/
│   │   └── AuthContext.jsx # Context global de auth
│   ├── components/
│   │   ├── Navbar.jsx     # Barra superior
│   │   ├── Sidebar.jsx    # Menú lateral
│   │   ├── Card.jsx       # Componente Card
│   │   └── Button.jsx     # Componente Button
│   ├── pages/
│   │   ├── Login.jsx      # Página de login
│   │   ├── Dashboard.jsx  # Dashboard principal
│   │   ├── Vehicles.jsx   # Gestión vehículos
│   │   ├── Sales.jsx      # Gestión ventas
│   │   ├── Customers.jsx  # Gestión clientes
│   │   └── Quotas.jsx     # Gestión cuotas
│   └── App.jsx            # Aplicación principal
└── README.md
```

## ⚙️ Instalación

### Opción 1: Servir con Python (Recomendado)

```bash
cd playa-frontend
python -m http.server 3000
```

Luego accede a: http://localhost:3000

### Opción 2: Usar Live Server en VS Code

1. Instala la extension "Live Server"
2. Haz clic derecho en `index.html` → "Open with Live Server"
3. Se abrirá automáticamente en http://localhost:5500

### Opción 3: Configurar servidor personalizado

Edita el archivo `index.html` y crea un pequeño servidor en:

```bash
node -e "require('http').createServer((req, res) => {
  if (req.url === '/') req.url = '/index.html';
  const fs = require('fs');
  try {
    res.end(fs.readFileSync(__dirname + req.url));
  } catch(e) {
    res.statusCode = 404;
    res.end('Not Found');
  }
}).listen(3000, () => console.log('Server on http://localhost:3000'))"
```

## 🔌 Configuración de API

La API se conecta automáticamente a:

```
http://localhost:8001/api
```

Para cambiar el endpoint, edita `src/utils/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:8001/api'; // Cambiar aquí
```

## 📊 Módulos Principales

### 1. Autenticación
- Login con usuario/contraseña
- JWT tokens (access + refresh)
- Persistencia en localStorage
- Protección de rutas

### 2. Dashboard
- KPIs en tiempo real
- Gráficos de ventas (línea)
- Estado de cuotas (doughnut)
- Top clientes
- Estadísticas de inventario

### 3. Inventario
- Listado de vehículos
- Filtrar por estado (available, sold, etc.)
- Detalles de costos
- Disponibilidad en tiempo real

### 4. Ventas
- Registro de ventas
- Historial de transacciones
- Cálculo automático de totales
- Filtros por fecha y cliente

### 5. Clientes
- Base de datos de clientes
- Información completa
- Tipos de documento (CI, RUC, Passport)
- Contacto directo

### 6. Cuotas
- Plans de pago
- Tracking de pagos
- Alertas de vencimiento
- **Generador de links WhatsApp** para cobranza
- Marcar como pagada

## 🎨 Temas y Personalización

### Colores principales

Tailwind CSS está configurado con colores por defecto:

- **Primario**: `bg-blue-600` (azul)
- **Secundario**: `bg-gray-200` (gris)
- **Peligro**: `bg-red-600` (rojo)
- **Éxito**: `bg-green-600` (verde)
- **Advertencia**: `bg-orange-600` (naranja)

### Modify colores

Edita el `<style>` en `index.html`:

```css
:root {
    --primary: #3b82f6;      /* Azul */
    --secondary: #10b981;    /* Verde */
    --danger: #ef4444;       /* Rojo */
    --warning: #f59e0b;      /* Naranja */
    --dark: #1f2937;         /* Gris oscuro */
}
```

## 🔐 Seguridad

- ✅ JWT tokens en LocalStorage
- ✅ Tokens se envían en Authorization header
- ✅ Logout limpia todos los datos
- ✅ Protección en rutas (ProtectedRoute)
- ✅ Manejo automático de errores 401

## 🐛 Troubleshooting

### Error: "Cannot GET /"

El servidor no está corriendo. Ejecuta:

```bash
python -m http.server 3000
```

### Error: "Cannot connect to API"

Verifica que el backend esté corriendo en puerto 8001:

```bash
cd playa
python manage.py runserver 0.0.0.0:8001
```

### Error: "Unauthorized" en login

Verifica credenciales:
- Usuario: `admin`
- Contraseña: `admin123`

O carga nuevos datos de prueba en el backend.

## 📱 Responsividad

El frontend es completamente responsivo:

- **Desktop**: 1920px+ (layout completo)
- **Tablet**: 768px-1920px (sidebar colapsible)
- **Mobile**: <768px (navegación adaptada)

## 🚀 Próximas Mejoras Sugeridas

1. **Formularios** para crear/editar datos
2. **Paginación** en tablas grandes
3. **Búsqueda y filtros** avanzados
4. **Exportar a Excel/PDF** de reportes
5. **Notificaciones** en tiempo real
6. **Modo oscuro** (dark mode)
7. **Multiidioma** (i18n)
8. **Offline mode** con service workers

## 📞 Soporte

Para problemas:

1. Verifica que el backend esté corriendo
2. Abre la consola del navegador (F12 → Console)
3. Revisa los logs de error
4. Verifica credenciales de API

---

**Estado**: ✅ Funcional  
**Última actualización**: Abril 3, 2026  
**Versión**: 1.0.0
