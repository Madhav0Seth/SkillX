import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import Header from "./components/Header";
import { useWallet } from "./context/WalletContext";

const StartPage = lazy(() => import("./pages/StartPage"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const RolePage = lazy(() => import("./pages/RolePage"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const FreelancerDashboard = lazy(() => import("./pages/FreelancerDashboard"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

function ProtectedRoute({ children }) {
  const { isConnected } = useWallet();
  if (!isConnected) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") === "light" ? "light" : "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <Header theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <main className="page-container">
        <Suspense fallback={<p className="empty-state" role="status">Loading…</p>}>
          <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route
            path="/role"
            element={
              <ProtectedRoute>
                <RolePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client"
            element={
              <ProtectedRoute>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freelancer"
            element={
              <ProtectedRoute>
                <FreelancerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
