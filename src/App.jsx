/**
 * Aplicación Principal
 */

const { BrowserRouter, Switch, Route, Redirect } = window.ReactRouterDOM;

function ProtectedRoute({ isAuthenticated, loading, children }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="loading"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Redirect to="/login" />;
    }

    return children;
}

function Layout({ children, onLogout }) {
    return (
        <>
            <Navbar onLogout={onLogout} />
            <div className="flex">
                <Sidebar />
                <main className="flex-1 p-8">
                    {children}
                </main>
            </div>
        </>
    );
}

function App() {
    const { isAuthenticated, loading, logout } = useAuth();

    const handleLogout = () => {
        logout();
    };

    return (
        <BrowserRouter>
            <KeyboardShortcutsProvider>
            <Switch>
                {/* Ruta de login */}
                <Route exact path="/login">
                    <Login />
                </Route>

                {/* Rutas protegidas */}
                <Route exact path="/">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <Dashboard />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/vehicles">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <Vehicles />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/vehicles/:id">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <VehicleDetail />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/sales">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <Sales />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/customers">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <Customers />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/customers/:id">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <CustomerDetail />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/quotas">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <Quotas />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/flujo-caja">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <Cash />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                <Route exact path="/users">
                    <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                        <Layout onLogout={handleLogout}>
                            <Users />
                        </Layout>
                    </ProtectedRoute>
                </Route>

                {/* Redirect por defecto */}
                <Redirect to="/" />
            </Switch>
            </KeyboardShortcutsProvider>
        </BrowserRouter>
    );
}

// Renderizar app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <AuthProvider>
        <ExchangeRateProvider>
            <BranchProvider>
                <ToastProvider>
                    <App />
                </ToastProvider>
            </BranchProvider>
        </ExchangeRateProvider>
    </AuthProvider>
);
