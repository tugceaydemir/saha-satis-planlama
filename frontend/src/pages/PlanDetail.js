import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api";

const COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e11d48"];
const DAY_NAMES = { 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi" };
const DAY_SHORT = { 1: "Pzt", 2: "Salı", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt" };

const depotIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border:3px solid #fff;box-shadow:0 3px 10px rgba(239,68,68,0.4);letter-spacing:-0.5px">D</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const STEPS = [
  { key: "clustering", label: "Kümeleme", desc: "Müşteriler satış bölgelerine ayrılıyor" },
  { key: "assignment", label: "Haftalık Atama", desc: "Müşteriler günlere atanıyor" },
  { key: "routing", label: "Rota Optimizasyonu", desc: "Günlük ziyaret sıraları optimize ediliyor" },
];

function isRunning(status) {
  return ["clustering", "assignment", "routing"].includes(status);
}

function makeNumberIcon(num, color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:10px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2.5px solid #fff;box-shadow:0 2px 8px ${color}66">${num}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function PlanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [results, setResults] = useState(null);
  const [tab, setTab] = useState("routes");
  const [selectedDay, setSelectedDay] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [depot, setDepot] = useState(null);
  const [users, setUsers] = useState([]);

  const loadPlan = useCallback(() => {
    api.get(`/plans/${id}`).then((r) => setPlan(r.data));
  }, [id]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  useEffect(() => {
    api.get("/settings/depot").then((r) => setDepot(r.data)).catch(() => {});
    api.get("/auth/users").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (plan?.status === "completed") {
      api.get(`/plans/${id}/results`).then((r) => setResults(r.data));
    }
  }, [plan?.status, id]);

  useEffect(() => {
    if (plan && isRunning(plan.status) && plan.run_started_at) {
      const ts = plan.run_started_at.endsWith("Z") ? plan.run_started_at : plan.run_started_at + "Z";
      const startMs = new Date(ts).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
      tick();
      const pollInterval = setInterval(loadPlan, 3000);
      const tickInterval = setInterval(tick, 1000);
      return () => { clearInterval(pollInterval); clearInterval(tickInterval); };
    }
  }, [plan?.status, plan?.run_started_at, loadPlan]);

  const handleRun = async () => {
    setElapsed(0);
    setResults(null);
    try {
      await api.post(`/plans/${id}/run`);
      loadPlan();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleStop = async () => {
    if (!window.confirm("Çalışan optimizasyonu durdurmak istediğinize emin misiniz?")) return;
    try {
      await api.post(`/plans/${id}/stop`);
      loadPlan();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Bu planı silmek istediğinize emin misiniz?")) return;
    await api.delete(`/plans/${id}`);
    navigate("/plans");
  };

  if (!plan) return <div className="loading"><div className="spinner" /></div>;

  const stList = results
    ? [...new Set(results.clusters.map((c) => c.cluster_index))].sort((a, b) => a - b)
    : [];

  return (
    <div>
      <div className="object-header">
        <h1>{plan.name}</h1>
        <div className="object-header-meta">
          <span>{plan.st_count} Satış Temsilcisi</span>
          <span className="sep" />
          <span>{new Date(plan.created_at).toLocaleString("tr-TR")}</span>
          {plan.solve_time_seconds != null && (
            <>
              <span className="sep" />
              <span>Çözüm süresi: {formatDuration(plan.solve_time_seconds)}</span>
            </>
          )}
        </div>
        <div className="object-header-actions">
          <StatusBadge status={plan.status} />
          {isRunning(plan.status) ? (
            <button className="btn btn-negative" onClick={handleStop}>Durdur</button>
          ) : (
            <button className="btn btn-emphasized" onClick={handleRun}>
              {plan.status === "completed" ? "Tekrar Çalıştır" : "Optimizasyonu Başlat"}
            </button>
          )}
          {!isRunning(plan.status) && (
            <button className="btn btn-negative" onClick={handleDelete}>Planı Sil</button>
          )}
        </div>
      </div>

      <div className="page-body">
        {isRunning(plan.status) && <PipelineProgress currentStep={plan.status} elapsed={elapsed} />}

        {plan.status === "cancelled" && (
          <div className="msg-strip" style={{ background: "#fef9c3", borderColor: "#facc15", color: "#854d0e" }}>
            <strong>Plan durduruldu.</strong> Tekrar çalıştırabilirsiniz.
          </div>
        )}

        {plan.status === "interrupted" && (
          <div className="msg-strip" style={{ background: "#fee2e2", borderColor: "#f87171", color: "#991b1b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span><strong>Plan başarısız oldu.</strong> Sunucu yeniden başlatıldığı için optimizasyon yarıda kesildi.</span>
            <button className="btn btn-emphasized btn-sm" onClick={handleRun} style={{ marginLeft: 16, flexShrink: 0 }}>
              Tekrar Çalıştır
            </button>
          </div>
        )}

        {plan.status.startsWith("error") && (
          <div className="msg-strip" style={{ background: "#fee2e2", borderColor: "#f87171", color: "#991b1b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span><strong>Hata oluştu:</strong> {plan.status.replace("error: ", "")}</span>
            <button className="btn btn-emphasized btn-sm" onClick={handleRun} style={{ marginLeft: 16, flexShrink: 0 }}>
              Tekrar Çalıştır
            </button>
          </div>
        )}

        {results && (
          <>
            <div className="kpi-strip">
              <div className="kpi-tile">
                <div className="kpi-label">Küme (ST) Sayısı</div>
                <div className="kpi-value">{stList.length}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Toplam Müşteri</div>
                <div className="kpi-value">{results.clusters.length}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Toplam Mesafe</div>
                <div className="kpi-value sm">
                  {plan.total_distance?.toFixed(2)}<span className="kpi-unit">km</span>
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Günlük Rota Sayısı</div>
                <div className="kpi-value">{results.routes.length}</div>
              </div>
            </div>

            {/* Mobilde dropdown, masaüstünde tab-bar */}
            {window.innerWidth <= 768 ? (
              <div style={{ marginBottom: 16 }}>
                <select
                  className="form-input"
                  value={tab}
                  onChange={(e) => setTab(e.target.value)}
                  style={{ width: "100%", fontWeight: 600 }}
                >
                  {[
                    { key: "routes", label: "🗺️ Rotalar" },
                    { key: "map", label: "📍 Harita" },
                    { key: "clusters", label: "📊 Kümeleme" },
                    { key: "charts", label: "📈 Grafikler" },
                    { key: "weekly", label: "📅 Haftalık Plan" },
                  ].map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="tab-bar">
                {[
                  { key: "routes", label: "Rotalar" },
                  { key: "map", label: "Harita" },
                  { key: "clusters", label: "Kümeleme" },
                  { key: "charts", label: "Grafikler" },
                  { key: "weekly", label: "Haftalık Plan" },
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`tab-item ${tab === t.key ? "active" : ""}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {tab === "map" && <MapTab results={results} selectedDay={selectedDay} setSelectedDay={setSelectedDay} depot={depot} />}
            {tab === "clusters" && <ClustersTab results={results} stList={stList} users={users} depot={depot} />}
            {tab === "charts" && <ChartsTab results={results} />}
            {tab === "weekly" && <WeeklyTab results={results} stList={stList} />}
            {tab === "routes" && <RoutesTab results={results} stList={stList} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══ PIPELINE PROGRESS ═══ */
function PipelineProgress({ currentStep, elapsed }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const timerStr = hrs > 0
    ? `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-header">
        <h3>Optimizasyon İlerlemesi</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          <span className="timer">{timerStr}</span>
        </div>
      </div>
      <div className="panel-body padded">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          {STEPS.map((step, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <div className={`progress-step-line ${isDone || isActive ? "done" : ""}`} style={{ flex: 1, marginTop: 16 }} />
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: window.innerWidth <= 768 ? 80 : 120, flexShrink: 0 }}>
                  <div className={`progress-step-circle ${isDone ? "done" : isActive ? "active" : "pending"}`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 10, color: isActive ? "var(--brand)" : isDone ? "var(--positive)" : "var(--text-tertiary)" }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, textAlign: "center" }}>
                    {isDone && "Tamamlandı"}
                    {isActive && (
                      <span style={{ color: "var(--brand)" }}>
                        <span className="spinner" style={{ width: 10, height: 10, borderWidth: 2, marginRight: 4, verticalAlign: "middle" }} />
                        Çalışıyor...
                      </span>
                    )}
                    {!isDone && !isActive && step.desc}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ MAP TAB ═══ */
function MapTab({ results, selectedDay, setSelectedDay, depot }) {
  const allPoints = results.clusters;
  if (allPoints.length === 0) return null;

  const center = [
    allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length,
    allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length,
  ];

  const filteredRoutes = selectedDay
    ? results.routes.filter((r) => r.day_of_week === selectedDay)
    : results.routes;

  return (
    <div>
      <div className="seg-bar">
        <button className={`seg-item ${!selectedDay ? "active" : ""}`} onClick={() => setSelectedDay(null)}>Tümü</button>
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <button key={d} className={`seg-item ${selectedDay === d ? "active" : ""}`} onClick={() => setSelectedDay(d)}>{DAY_SHORT[d]}</button>
        ))}
      </div>
      <div className="map-container">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
          {allPoints.map((p, i) => (
            <CircleMarker key={i} center={[p.x, p.y]} radius={7} fillColor={COLORS[p.cluster_index % COLORS.length]} color="#fff" weight={2} fillOpacity={0.9}>
              <Popup>
                <div style={{ fontSize: 13 }}>
                  <strong>{p.customer_name}</strong><br />
                  ST {p.cluster_index} · Ciro: {Number(p.monthly_revenue).toLocaleString("tr-TR")} ₺<br />
                  Ziyaret: {p.visit_frequency}x / hafta
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {filteredRoutes.map((route, ri) => {
            if (route.stops.length < 2) return null;
            const positions = route.stops.map((s) => [s.x, s.y]);
            return <Polyline key={ri} positions={positions} color={COLORS[route.cluster_index % COLORS.length]} weight={3} opacity={0.7} dashArray="8 4" />;
          })}
          {depot && (
            <Marker position={[depot.depot_x, depot.depot_y]} icon={depotIcon}>
              <Popup><strong>DEPO</strong></Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

/* ═══ CLUSTERS TAB ═══ */
function ClustersTab({ results, stList, users, depot }) {
  const [filterST, setFilterST] = useState(null);
  const visibleClusters = filterST !== null ? [filterST] : stList;

  const repMap = {};
  users.filter((u) => u.role === "sales_rep" && u.cluster_index !== null).forEach((u) => {
    repMap[u.cluster_index] = u;
  });

  const mapPoints = results.clusters.filter((c) => visibleClusters.includes(c.cluster_index));
  const mapCenter = mapPoints.length > 0
    ? [mapPoints.reduce((s, p) => s + p.x, 0) / mapPoints.length, mapPoints.reduce((s, p) => s + p.y, 0) / mapPoints.length]
    : depot ? [depot.depot_x, depot.depot_y] : [38.6, 27.4];

  return (
    <div>
      <div className="seg-bar" style={{ marginBottom: 16 }}>
        <button className={`seg-item ${filterST === null ? "active" : ""}`} onClick={() => setFilterST(null)}>Tüm Kümeler</button>
        {stList.map((ci) => (
          <button key={ci} className={`seg-item ${filterST === ci ? "active" : ""}`} onClick={() => setFilterST(ci)}>
            Küme {ci}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3>{filterST !== null ? `Küme ${filterST} — Harita` : "Tüm Kümeler — Harita"}</h3>
          <span className="panel-info">{mapPoints.length} müşteri</span>
        </div>
        <div style={{ height: window.innerWidth <= 768 ? 280 : 400 }}>
          <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }} key={`cluster-map-${filterST}`}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
            {mapPoints.map((p, i) => (
              <CircleMarker key={i} center={[p.x, p.y]} radius={8} fillColor={COLORS[p.cluster_index % COLORS.length]} color="#fff" weight={2} fillOpacity={0.9}>
                <Popup>
                  <div style={{ fontSize: 13, minWidth: 160 }}>
                    <strong>{p.customer_name}</strong><br />
                    Küme {p.cluster_index} · Ciro: {Number(p.monthly_revenue).toLocaleString("tr-TR")} ₺<br />
                    Ziyaret: {p.visit_frequency}x / hafta
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            {depot && (
              <Marker position={[depot.depot_x, depot.depot_y]} icon={depotIcon}>
                <Popup><strong>DEPO</strong></Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>

      {visibleClusters.map((ci) => {
        const clusterCustomers = results.clusters.filter((c) => c.cluster_index === ci);
        const totalRev = clusterCustomers.reduce((s, c) => s + c.monthly_revenue, 0);
        const totalVisits = clusterCustomers.reduce((s, c) => s + c.visit_frequency, 0);
        const center = clusterCustomers.find((c) => c.customer_id === c.center_customer_id);
        const rep = repMap[ci];
        const color = COLORS[ci % COLORS.length];

        return (
          <div key={ci} className="panel">
            <div className="panel-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="cluster-dot" style={{ background: color, margin: 0 }} />
                Küme {ci} — {clusterCustomers.length} müşteri
              </h3>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <span>Ciro: <strong>{Number(totalRev).toLocaleString("tr-TR")} ₺</strong></span>
                <span>Ziyaret: <strong>{totalVisits}</strong></span>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 24, fontSize: 13 }}>
              <div>
                <span style={{ color: "#94a3b8" }}>Merkez Müşteri: </span>
                <strong>{center?.customer_name || "—"}</strong>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Satış Temsilcisi: </span>
                <strong style={{ color: rep ? color : "#ef4444" }}>
                  {rep ? rep.full_name : "Atanmadı"}
                </strong>
                {rep && <span style={{ color: "#94a3b8", marginLeft: 6 }}>({rep.email})</span>}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Müşteri Adı</th>
                    <th>Aylık Ciro</th>
                    <th>Ziyaret Sıklığı</th>
                    <th>Merkez</th>
                  </tr>
                </thead>
                <tbody>
                  {clusterCustomers.map((c, i) => (
                    <tr key={c.customer_id}>
                      <td className="cell-dim">{i + 1}</td>
                      <td className="cell-bold">{c.customer_name}</td>
                      <td className="cell-mono">{Number(c.monthly_revenue).toLocaleString("tr-TR")} ₺</td>
                      <td><span className="badge-freq">{c.visit_frequency}x / hafta</span></td>
                      <td>{c.customer_id === c.center_customer_id ? <span style={{ color: color, fontWeight: 700 }}>★ Merkez</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ CHARTS TAB ═══ */
function ChartsTab({ results }) {
  const clusterData = {};
  results.clusters.forEach((c) => {
    if (!clusterData[c.cluster_index]) clusterData[c.cluster_index] = { name: `ST ${c.cluster_index}`, count: 0, revenue: 0, visits: 0 };
    clusterData[c.cluster_index].count++;
    clusterData[c.cluster_index].revenue += c.monthly_revenue;
    clusterData[c.cluster_index].visits += c.visit_frequency;
  });
  const clusterChartData = Object.values(clusterData);

  const dayData = {};
  results.routes.forEach((r) => {
    const dn = DAY_SHORT[r.day_of_week];
    if (!dayData[dn]) dayData[dn] = { name: dn, distance: 0, customers: 0 };
    dayData[dn].distance += r.total_distance || 0;
    dayData[dn].customers += r.customer_count || 0;
  });
  const dayChartData = Object.values(dayData);

  return (
    <div className="grid-2">
      <div className="chart-panel">
        <h3>ST Bazlı Müşteri Sayısı</h3>
        <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 280}>
          <BarChart data={clusterChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" name="Müşteri" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-panel">
        <h3>ST Bazlı Ciro Dağılımı</h3>
        <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 280}>
          <PieChart>
            <Pie data={clusterChartData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={50}
              label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`} labelLine={{ strokeWidth: 1 }}>
              {clusterChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => Number(v).toLocaleString("tr-TR") + " ₺"} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-panel">
        <h3>Gün Bazlı Toplam Mesafe</h3>
        <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 280}>
          <BarChart data={dayChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
            <Bar dataKey="distance" name="Mesafe (km)" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-panel">
        <h3>Gün Bazlı Ziyaret Sayısı</h3>
        <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 280}>
          <BarChart data={dayChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
            <Bar dataKey="customers" name="Müşteri" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══ WEEKLY TAB ═══ */
function WeeklyTab({ results, stList }) {
  const [filterST, setFilterST] = useState(stList[0] ?? 0);

  return (
    <div>
      <div className="seg-bar" style={{ marginBottom: 16 }}>
        {stList.map((ci) => (
          <button key={ci} className={`seg-item ${filterST === ci ? "active" : ""}`} onClick={() => setFilterST(ci)}>
            ST {ci}
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="panel-header">
          <h3>Haftalık Ziyaret Planı — ST {filterST}</h3>
          <span className="panel-info">
            {results.weekly_plan.filter((w) => w.cluster_index === filterST).length} atama
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Müşteri</th>
                <th>Pzt</th><th>Salı</th><th>Çar</th><th>Per</th><th>Cum</th><th>Cmt</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const custIds = [...new Set(
                  results.weekly_plan.filter((w) => w.cluster_index === filterST).map((w) => w.customer_id)
                )];
                return custIds.map((custId) => {
                  const rows = results.weekly_plan.filter((w) => w.cluster_index === filterST && w.customer_id === custId);
                  const days = rows.map((r) => r.day_of_week);
                  const custName = rows[0]?.customer_name || "";
                  const color = COLORS[filterST % COLORS.length];
                  return (
                    <tr key={custId}>
                      <td className="cell-bold">{custName}</td>
                      {[1, 2, 3, 4, 5, 6].map((d) => (
                        <td key={d} style={{ textAlign: "center" }}>
                          {days.includes(d) ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 22, height: 22, borderRadius: "50%",
                              background: color, color: "#fff",
                              fontSize: 11, fontWeight: 700,
                            }}>✓</span>
                          ) : (
                            <span style={{ color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


/* ═══ ROUTES TAB ═══ */
function RoutesTab({ results, stList }) {
  const [filterST, setFilterST] = useState(stList[0] ?? 0);
  const [filterDay, setFilterDay] = useState(1);

  const seen = new Set();
  const deduped = results.routes.filter((r) => {
    const key = `${r.cluster_index}-${r.day_of_week}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filtered = deduped
    .filter((r) => r.cluster_index === filterST)
    .filter((r) => r.day_of_week === filterDay)
    .sort((a, b) => a.day_of_week - b.day_of_week);

  const isMobile = window.innerWidth <= 768;

  // Harita için tüm durakları topla
  const allStops = filtered.flatMap((r) => r.stops || []);
  const mapCenter = allStops.length > 0
    ? [allStops.reduce((s, p) => s + p.x, 0) / allStops.length, allStops.reduce((s, p) => s + p.y, 0) / allStops.length]
    : [38.6, 27.4];

  return (
    <div>
      {/* Filtreler */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Satış Temsilcisi</div>
          {isMobile ? (
            <select className="form-input" value={filterST} onChange={(e) => setFilterST(Number(e.target.value))} style={{ width: "100%" }}>
              {stList.map((ci) => <option key={ci} value={ci}>ST {ci}</option>)}
            </select>
          ) : (
            <div className="seg-bar">
              {stList.map((ci) => (
                <button key={ci} className={`seg-item ${filterST === ci ? "active" : ""}`} onClick={() => setFilterST(ci)}>ST {ci}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Gün</div>
          {isMobile ? (
            <select className="form-input" value={filterDay} onChange={(e) => setFilterDay(Number(e.target.value))} style={{ width: "100%" }}>
              {[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
            </select>
          ) : (
            <div className="seg-bar">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <button key={d} className={`seg-item ${filterDay === d ? "active" : ""}`} onClick={() => setFilterDay(d)}>{DAY_SHORT[d]}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel"><div className="empty-state"><p>Seçilen filtre için rota bulunamadı.</p></div></div>
      ) : (
        filtered.map((route, ri) => {
          const color = COLORS[route.cluster_index % COLORS.length];
          const routeCoords = (route.stops || []).map((s) => [s.x, s.y]);

          return (
            <div key={ri}>
              {/* Rota başlık */}
              <div className="panel" style={{ marginBottom: 12 }}>
                <div className="panel-header">
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="cluster-dot" style={{ background: color, margin: 0 }} />
                    ST {route.cluster_index} — {route.day_name}
                  </h3>
                  <span className="panel-info">{route.customer_count} müşteri · {route.total_distance?.toFixed(2)} km</span>
                </div>

                {/* Harita */}
                <div style={{ height: isMobile ? 250 : 350 }}>
                  <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                    {routeCoords.length > 1 && <Polyline positions={routeCoords} color={color} weight={3} opacity={0.8} dashArray="8 4" />}
                    {(route.stops || []).map((s) => (
                      <Marker key={s.visit_order} position={[s.x, s.y]} icon={makeNumberIcon(s.visit_order, color)}>
                        <Popup>
                          <div style={{ fontSize: 13 }}>
                            <strong>{s.customer_name}</strong><br />
                            Sıra: {s.visit_order}
                            {s.estimated_arrival_minutes != null && <><br />Varış: {s.estimated_arrival_minutes.toFixed(0)} dk</>}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>

                {/* Durak listesi — mobilde kart, masaüstünde tablo */}
                {isMobile ? (
                  <div style={{ padding: 12 }}>
                    {(route.stops || []).map((s) => (
                      <div key={s.visit_order} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 0", borderBottom: "1px solid var(--border-light)",
                      }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: "50%", background: color,
                          fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
                        }}>{s.visit_order}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.customer_name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {s.estimated_arrival_minutes != null ? `${s.estimated_arrival_minutes.toFixed(0)} dk` : ""}
                          </div>
                        </div>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.x},${s.y}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            background: "var(--brand-gradient)", color: "#fff", border: "none",
                            borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                            textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                          }}>
                          Yol Tarifi
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Sıra</th><th>Müşteri</th><th>Tahmini Varış</th><th>Navigasyon</th></tr>
                    </thead>
                    <tbody>
                      {(route.stops || []).map((s) => (
                        <tr key={s.visit_order}>
                          <td>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 24, height: 24, borderRadius: "50%", background: color,
                              fontSize: 11, fontWeight: 700, color: "#fff",
                            }}>{s.visit_order}</span>
                          </td>
                          <td className="cell-bold">{s.customer_name}</td>
                          <td className="cell-mono">{s.estimated_arrival_minutes != null ? `${s.estimated_arrival_minutes.toFixed(0)} dk` : "—"}</td>
                          <td>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.x},${s.y}`}
                              target="_blank" rel="noopener noreferrer" className="btn btn-emphasized btn-xs">
                              Yol Tarifi
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "completed") return <span className="status status-completed"><span className="status-dot" />Tamamlandı</span>;
  if (isRunning(status)) return <span className="status status-running"><span className="status-dot" />Çalışıyor</span>;
  if (status === "pending") return <span className="status status-pending"><span className="status-dot" />Bekliyor</span>;
  if (status === "cancelled") return <span className="status status-pending"><span className="status-dot" />Durduruldu</span>;
  if (status === "interrupted") return <span className="status status-error"><span className="status-dot" />Başarısız</span>;
  return <span className="status status-error"><span className="status-dot" />Hata</span>;
}

function formatDuration(seconds) {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h} sa ${m} dk`;
  }
  if (seconds < 60) return seconds.toFixed(1) + " sn";
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min} dk ${sec} sn`;
}
