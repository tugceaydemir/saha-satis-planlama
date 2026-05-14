import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);
      const res = await api.post("/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      onLogin(res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Giriş başarısız");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">SS</div>
          <h1>Saha Satış</h1>
          <p>Karar Destek Sistemi</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@firma.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Şifre</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-emphasized auth-btn" disabled={loading}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
          <div style={{ textAlign: "right", marginTop: 8 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}>
              Şifremi Unuttum
            </Link>
          </div>
        </form>
        <div className="auth-qr">
          <div style={{
            margin: "20px auto 0",
            padding: 16,
            background: "rgba(99,102,241,0.06)",
            borderRadius: 14,
            textAlign: "center",
            maxWidth: 220,
            border: "1px dashed rgba(99,102,241,0.2)"
          }}>
            <img
              src={`${process.env.PUBLIC_URL}/qr-code.png`}
              alt="QR Kod"
              style={{ width: 120, height: 120, borderRadius: 8 }}
            />
            <p style={{
              margin: "10px 0 0",
              fontSize: 11,
              color: "#94a3b8",
              lineHeight: 1.4
            }}>
              Telefonunuzla okutarak<br/>mobilde açabilirsiniz
            </p>
          </div>
        </div>
        <div className="auth-footer">
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Hesabınız yoksa yöneticinizle iletişime geçin</span>
        </div>
      </div>
    </div>
  );
}
