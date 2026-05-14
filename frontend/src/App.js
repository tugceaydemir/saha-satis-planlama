import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Plans from "./pages/Plans";
import PlanDetail from "./pages/PlanDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Staff from "./pages/Staff";
import MyPlan from "./pages/MyPlan";
import Performance from "./pages/Performance";
import Profile from "./pages/Profile";
import AdminPerformance from "./pages/AdminPerformance";
import Announcements from "./pages/Announcements";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import "./App.css";

function ProtectedLayout({ user, onLogout, children }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    onLogout();
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? "✕" : "☰"}
      </button>
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      <nav className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="logo">
          <div className="logo-icon">SS</div>
          <h2>Saha Satış</h2>
        </div>
        <div className="sidebar-section">Ana Menü</div>
        <ul>
          {isAdmin && (
            <>
              <li>
                <NavLink to="/" end onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></span>
                  Gösterge Paneli
                </NavLink>
              </li>
              <li>
                <NavLink to="/customers" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
                  Müşteri Yönetimi
                </NavLink>
              </li>
              <li>
                <NavLink to="/plans" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></span>
                  Plan Yönetimi
                </NavLink>
              </li>
              <li>
                <NavLink to="/staff" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></span>
                  Personel Yönetimi
                </NavLink>
              </li>
              <li>
                <NavLink to="/performance" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
                  Performans Takibi
                </NavLink>
              </li>
              <li>
                <NavLink to="/announcements" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg></span>
                  Duyurular
                </NavLink>
              </li>
            </>
          )}
          {!isAdmin && (
            <>
              <li>
                <NavLink to="/" end onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
                  Performans Paneli
                </NavLink>
              </li>
              <li>
                <NavLink to="/my-plan" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></span>
                  Benim Planım
                </NavLink>
              </li>
              <li>
                <NavLink to="/announcements" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg></span>
                  Duyurular
                </NavLink>
              </li>
            </>
          )}
        </ul>
        <div className="sidebar-user">
          <div className="sidebar-user-info" onClick={() => navigate("/profile")} style={{ cursor: "pointer" }} title="Profil Ayarları">
            <div className="sidebar-user-avatar">{user?.full_name?.charAt(0) || "U"}</div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{user?.full_name}</div>
              <div className="sidebar-user-role">{isAdmin ? "Yönetici" : "Satış Temsilcisi"}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Çıkış Yap">⏻</button>
        </div>
        <div className="sidebar-footer">v1.0 — Karar Destek Sistemi</div>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    const checkAuth = () => {
      const saved = localStorage.getItem("user");
      if (!saved && user) setUser(null);
    };
    window.addEventListener("storage", checkAuth);
    const interval = setInterval(checkAuth, 1000);
    return () => {
      window.removeEventListener("storage", checkAuth);
      clearInterval(interval);
    };
  }, [user]);

  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isLoggedIn ? <Navigate to="/" /> : <Login onLogin={setUser} />} />
        <Route path="/register" element={isLoggedIn ? <Navigate to="/" /> : <Register onLogin={setUser} />} />
        <Route path="/forgot-password" element={isLoggedIn ? <Navigate to="/" /> : <ForgotPassword />} />
        <Route path="/reset-password" element={isLoggedIn ? <Navigate to="/" /> : <ResetPassword />} />
        <Route
          path="/*"
          element={
            isLoggedIn ? (
              <ProtectedLayout user={user} onLogout={() => setUser(null)}>
                <Routes>
                  <Route path="/profile" element={<Profile user={user} onUserUpdate={setUser} />} />
                  {isAdmin && (
                    <>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/plans" element={<Plans />} />
                      <Route path="/plans/:id" element={<PlanDetail />} />
                      <Route path="/staff" element={<Staff />} />
                      <Route path="/performance" element={<AdminPerformance />} />
                      <Route path="/announcements" element={<Announcements />} />
                    </>
                  )}
                  {!isAdmin && (
                    <>
                      <Route path="/" element={<Performance />} />
                      <Route path="/my-plan" element={<MyPlan />} />
                      <Route path="/announcements" element={<Announcements />} />
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
