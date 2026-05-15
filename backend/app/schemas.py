from pydantic import BaseModel
from datetime import datetime, date


# ─── Customer ───────────────────────────────
class CustomerCreate(BaseModel):
    name: str
    x: float
    y: float
    monthly_revenue: float
    visit_frequency: int
    customer_type: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    x: float | None = None
    y: float | None = None
    monthly_revenue: float | None = None
    visit_frequency: int | None = None
    customer_type: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class CustomerOut(BaseModel):
    id: int
    name: str
    x: float
    y: float
    monthly_revenue: float
    visit_frequency: int
    customer_type: str | None
    phone: str | None
    address: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Sales Rep ──────────────────────────────
class SalesRepCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    depot_x: float | None = None
    depot_y: float | None = None


class SalesRepUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    depot_x: float | None = None
    depot_y: float | None = None


class SalesRepOut(BaseModel):
    id: int
    name: str
    phone: str | None
    email: str | None
    depot_x: float | None
    depot_y: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Plan ───────────────────────────────────
class PlanCreate(BaseModel):
    name: str
    st_count: int


class PlanOut(BaseModel):
    id: int
    name: str
    st_count: int
    status: str
    total_distance: float | None
    solve_time_seconds: float | None
    run_started_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Cluster Assignment ────────────────────
class ClusterAssignmentOut(BaseModel):
    customer_id: int
    customer_name: str
    cluster_index: int
    center_customer_id: int | None
    x: float
    y: float
    monthly_revenue: float
    visit_frequency: int


# ─── Weekly Assignment ─────────────────────
class WeeklyAssignmentOut(BaseModel):
    customer_id: int
    customer_name: str
    cluster_index: int
    day_of_week: int
    day_name: str
    monthly_revenue: float = 0
    visit_frequency: int = 0


# ─── Route ─────────────────────────────────
class RouteStopOut(BaseModel):
    visit_order: int
    customer_id: int
    customer_name: str
    x: float
    y: float
    estimated_arrival_minutes: float | None


class DailyRouteOut(BaseModel):
    cluster_index: int
    day_of_week: int
    day_name: str
    total_distance: float | None
    total_time_minutes: float | None
    customer_count: int | None
    stops: list[RouteStopOut]


# ─── Route Geometry (Faz 1 — TomTom ile gerçek yol çizgisi) ───
class RouteGeometryOut(BaseModel):
    """
    TomTom'dan alinan gercek yol geometrisi.

    geometry: [[lat, lon], [lat, lon], ...] formatinda nokta listesi.
              Frontend bu listeyi Polyline icin dogrudan kullanabilir.
    distance_meters: TomTom'un hesapladigi gercek yol mesafesi (metre)
    duration_seconds: TomTom'un tahmini suresi (saniye, trafik dahil)
    waypoints: Durak koordinatlari (sira ile). Frontend marker icin kullanabilir.
    """
    geometry: list[list[float]]
    distance_meters: float
    duration_seconds: float
    waypoints: list[list[float]]


# ─── Plan Full Result ──────────────────────
# ─── Settings ─────────────────────────────
class DepotUpdate(BaseModel):
    depot_x: float
    depot_y: float


class DepotOut(BaseModel):
    depot_x: float
    depot_y: float

    model_config = {"from_attributes": True}


class PlanResultOut(BaseModel):
    plan: PlanOut
    clusters: list[ClusterAssignmentOut]
    weekly_plan: list[WeeklyAssignmentOut]
    routes: list[DailyRouteOut]


# ─── Auth ─────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    company: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    company: str | None
    role: str
    cluster_index: int | None
    is_active: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Sales Visit ──────────────────────────
class SalesVisitCreate(BaseModel):
    customer_id: int
    visit_date: date
    sale_amount: float = 0
    visited: int = 1
    notes: str | None = None


class SalesVisitOut(BaseModel):
    id: int
    user_id: int
    customer_id: int
    customer_name: str | None = None
    visit_date: date
    sale_amount: float
    visited: int
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Visit Completion (Faz 3a — mobil app için ziyaret tamamlama) ───
class VisitCompletionCreate(BaseModel):
    """
    Mobil app'ten gelen ziyaret tamamlama isteği.
    route_stop_id, hangi durağın tamamlandığını belirtir.
    """
    route_stop_id: int
    order_amount: float = 0.0
    order_items_count: int | None = None
    notes: str | None = None


class VisitCompletionOut(BaseModel):
    """
    Tamamlanan bir ziyaretin döndüğü format.
    """
    id: int
    route_stop_id: int | None
    customer_id: int
    customer_name: str | None = None
    visit_order: int | None = None
    sale_amount: float
    order_items_count: int | None
    notes: str | None
    completed_at: datetime

    model_config = {"from_attributes": True}


# ─── Announcement ────────────────────────
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    category: str = "general"


class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    category: str
    author_id: int
    author_name: str | None = None
    is_active: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreateByAdmin(BaseModel):
    email: str
    password: str
    full_name: str
    company: str | None = None
    role: str = "sales_rep"
    cluster_index: int | None = None


class UserUpdateByAdmin(BaseModel):
    email: str | None = None
    full_name: str | None = None
    company: str | None = None
    role: str | None = None
    cluster_index: int | None = None
    is_active: int | None = None
    password: str | None = None
