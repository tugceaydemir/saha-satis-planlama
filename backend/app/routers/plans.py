from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
import numpy as np
import time as time_mod

from ..database import get_db, SessionLocal
from ..models import (
    Customer, Plan, AppSettings, User,
    ClusterAssignment, WeeklyAssignment, DailyRoute, RouteStop
)
from ..schemas import (
    PlanCreate, PlanOut, PlanResultOut,
    ClusterAssignmentOut, WeeklyAssignmentOut, DailyRouteOut, RouteStopOut,
    RouteGeometryOut,
)
from ..auth import get_current_user
from ..services.clustering import run_simulated_annealing
from ..services.assignment import run_weekly_assignment
from ..services.routing import solve_route
from ..services.tomtom_geometry import get_route_geometry

DAY_NAMES = {1: "Pzt", 2: "Salı", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt"}

REVENUE_TOL = 0.02
VISIT_TOL = 0.05
ASSIGNMENT_ALPHA = 0.1
ASSIGNMENT_LAMBDA = 0.9

router = APIRouter(prefix="/api/plans", tags=["Planlar"])


@router.get("/", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(Plan).order_by(Plan.created_at.desc()).all()


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")
    return plan


@router.post("/", response_model=PlanOut, status_code=201)
def create_plan(data: PlanCreate, db: Session = Depends(get_db)):
    customer_count = db.query(Customer).count()
    if customer_count < data.st_count:
        raise HTTPException(
            status_code=400,
            detail=f"Müşteri sayısı ({customer_count}) ST sayısından ({data.st_count}) az olamaz"
        )
    plan = Plan(name=data.name, st_count=data.st_count, status="pending")
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")
    db.delete(plan)
    db.commit()
    return {"detail": "Plan silindi"}


@router.post("/{plan_id}/run")
def run_plan(plan_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")
    if plan.status in ("clustering", "assignment", "routing"):
        raise HTTPException(status_code=409, detail="Plan zaten çalışıyor, lütfen bekleyin")

    plan.status = "clustering"
    plan.run_started_at = datetime.utcnow()
    plan.total_distance = None
    plan.solve_time_seconds = None
    db.commit()

    background_tasks.add_task(_run_full_pipeline, plan_id)
    return {"detail": "Plan çalıştırılıyor..."}


@router.post("/{plan_id}/stop")
def stop_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")
    if plan.status not in ("clustering", "assignment", "routing"):
        raise HTTPException(status_code=400, detail="Plan şu anda çalışmıyor")

    plan.status = "cancelled"
    db.commit()
    return {"detail": "Plan durduruldu"}


@router.get("/{plan_id}/results")
def get_plan_results(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")

    clusters = []
    seen_customers = {}
    for ca in db.query(ClusterAssignment).filter(ClusterAssignment.plan_id == plan_id).order_by(ClusterAssignment.id.desc()).all():
        if ca.customer_id in seen_customers:
            continue
        seen_customers[ca.customer_id] = True
        cust = db.query(Customer).filter(Customer.id == ca.customer_id).first()
        clusters.append(ClusterAssignmentOut(
            customer_id=ca.customer_id,
            customer_name=cust.name if cust else "",
            cluster_index=ca.cluster_index,
            center_customer_id=ca.center_customer_id,
            x=cust.x if cust else 0, y=cust.y if cust else 0,
            monthly_revenue=cust.monthly_revenue if cust else 0,
            visit_frequency=cust.visit_frequency if cust else 0,
        ))

    weekly = []
    for wa in db.query(WeeklyAssignment).filter(WeeklyAssignment.plan_id == plan_id).all():
        cust = db.query(Customer).filter(Customer.id == wa.customer_id).first()
        weekly.append(WeeklyAssignmentOut(
            customer_id=wa.customer_id,
            customer_name=cust.name if cust else "",
            cluster_index=wa.cluster_index,
            day_of_week=wa.day_of_week,
            day_name=DAY_NAMES.get(wa.day_of_week, ""),
            monthly_revenue=cust.monthly_revenue if cust else 0,
            visit_frequency=cust.visit_frequency if cust else 0,
        ))

    routes = []
    for dr in db.query(DailyRoute).filter(DailyRoute.plan_id == plan_id).all():
        stops = []
        for s in db.query(RouteStop).filter(RouteStop.daily_route_id == dr.id).order_by(RouteStop.visit_order).all():
            cust = db.query(Customer).filter(Customer.id == s.customer_id).first()
            stops.append(RouteStopOut(
                visit_order=s.visit_order, customer_id=s.customer_id,
                customer_name=cust.name if cust else "",
                x=cust.x if cust else 0, y=cust.y if cust else 0,
                estimated_arrival_minutes=s.estimated_arrival_minutes,
            ))
        routes.append(DailyRouteOut(
            cluster_index=dr.cluster_index, day_of_week=dr.day_of_week,
            day_name=DAY_NAMES.get(dr.day_of_week, ""),
            total_distance=dr.total_distance,
            total_time_minutes=dr.total_time_minutes,
            customer_count=dr.customer_count, stops=stops,
        ))

    return PlanResultOut(
        plan=PlanOut.model_validate(plan),
        clusters=clusters, weekly_plan=weekly, routes=routes,
    )


@router.get("/{plan_id}/routes/{day}/geometry", response_model=RouteGeometryOut)
def get_route_geometry_for_day(
    plan_id: int,
    day: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Bir planın belirli günü için gerçek yol geometrisini OSRM'den alır.

    Akış:
      1. Kullanıcının cluster_index'i alınır
      2. O cluster'a + güne ait DailyRoute bulunur
      3. Stops'tan koordinatlar sırayla çıkarılır
      4. Önüne ve arkasına depo koordinatları eklenir
      5. OSRM'den gerçek yol geometrisi alınır
      6. Sonuç dönülür

    Hem mobil hem web bu endpoint'i kullanır.
    """
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")

    # Admin ise tüm cluster'ları görebilir, kullanıcı sadece kendi cluster'ını
    if user.role == "admin":
        # Admin için query parametresi olarak cluster_index beklenebilir,
        # ama şimdilik MyPlan flow'u için kullanıcı cluster_index'i kullanıyoruz.
        # İleride admin paneli için ek bir endpoint açılabilir.
        cluster_index = user.cluster_index
        if cluster_index is None:
            raise HTTPException(
                status_code=400,
                detail="Admin kullanıcının kendi cluster_index'i yok; bu endpoint admin için henüz açılmadı."
            )
    else:
        if user.cluster_index is None:
            raise HTTPException(status_code=400, detail="Size atanmış bir bölge yok")
        cluster_index = user.cluster_index

    # DailyRoute'u bul
    daily_route = db.query(DailyRoute).filter(
        DailyRoute.plan_id == plan_id,
        DailyRoute.cluster_index == cluster_index,
        DailyRoute.day_of_week == day,
    ).first()

    if not daily_route:
        raise HTTPException(
            status_code=404,
            detail=f"Bu plan ve gün için rota bulunamadı (cluster {cluster_index}, gün {day})"
        )

    # Stops'u sırayla çek
    stops = db.query(RouteStop).filter(
        RouteStop.daily_route_id == daily_route.id
    ).order_by(RouteStop.visit_order).all()

    if not stops:
        raise HTTPException(status_code=404, detail="Bu rotada hiç durak yok")

    # Durak koordinatlarını çıkar (her durağın bağlı olduğu müşteriden)
    waypoint_coords = []
    for stop in stops:
        customer = db.query(Customer).filter(Customer.id == stop.customer_id).first()
        if customer:
            waypoint_coords.append((customer.x, customer.y))

    if not waypoint_coords:
        raise HTTPException(status_code=404, detail="Durak koordinatları bulunamadı")

    # Depo koordinatlarını ekle (başa ve sona)
    depot_setting = db.query(AppSettings).first()
    if not depot_setting:
        raise HTTPException(status_code=500, detail="Depo ayarı bulunamadı")

    depot = (depot_setting.depot_x, depot_setting.depot_y)
    full_route_coords = [depot] + waypoint_coords + [depot]

    # OSRM'den gerçek yol geometrisi al
    result = get_route_geometry(full_route_coords, overview="full")

    if result is None:
        raise HTTPException(
            status_code=502,
            detail="OSRM servisinden geometri alınamadı. Lütfen tekrar deneyin."
        )

    return RouteGeometryOut(
        geometry=result["geometry"],
        distance_meters=result["distance_meters"],
        duration_seconds=result["duration_seconds"],
        waypoints=[[lat, lon] for lat, lon in full_route_coords],
    )


@router.get("/{plan_id}/my-plan")
def get_my_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")
    if user.cluster_index is None:
        raise HTTPException(status_code=400, detail="Size atanmış bir bölge yok")

    ci = user.cluster_index

    clusters = []
    for ca in db.query(ClusterAssignment).filter(
        ClusterAssignment.plan_id == plan_id,
        ClusterAssignment.cluster_index == ci,
    ).all():
        cust = db.query(Customer).filter(Customer.id == ca.customer_id).first()
        clusters.append(ClusterAssignmentOut(
            customer_id=ca.customer_id,
            customer_name=cust.name if cust else "",
            cluster_index=ca.cluster_index,
            center_customer_id=ca.center_customer_id,
            x=cust.x if cust else 0, y=cust.y if cust else 0,
            monthly_revenue=cust.monthly_revenue if cust else 0,
            visit_frequency=cust.visit_frequency if cust else 0,
        ))

    weekly = []
    for wa in db.query(WeeklyAssignment).filter(
        WeeklyAssignment.plan_id == plan_id,
        WeeklyAssignment.cluster_index == ci,
    ).all():
        cust = db.query(Customer).filter(Customer.id == wa.customer_id).first()
        weekly.append(WeeklyAssignmentOut(
            customer_id=wa.customer_id,
            customer_name=cust.name if cust else "",
            cluster_index=wa.cluster_index,
            day_of_week=wa.day_of_week,
            day_name=DAY_NAMES.get(wa.day_of_week, ""),
            monthly_revenue=cust.monthly_revenue if cust else 0,
            visit_frequency=cust.visit_frequency if cust else 0,
        ))

    routes = []
    for dr in db.query(DailyRoute).filter(
        DailyRoute.plan_id == plan_id,
        DailyRoute.cluster_index == ci,
    ).all():
        stops = []
        for s in db.query(RouteStop).filter(RouteStop.daily_route_id == dr.id).order_by(RouteStop.visit_order).all():
            cust = db.query(Customer).filter(Customer.id == s.customer_id).first()
            stops.append(RouteStopOut(
                visit_order=s.visit_order, customer_id=s.customer_id,
                customer_name=cust.name if cust else "",
                x=cust.x if cust else 0, y=cust.y if cust else 0,
                estimated_arrival_minutes=s.estimated_arrival_minutes,
            ))
        routes.append(DailyRouteOut(
            cluster_index=dr.cluster_index, day_of_week=dr.day_of_week,
            day_name=DAY_NAMES.get(dr.day_of_week, ""),
            total_distance=dr.total_distance,
            total_time_minutes=dr.total_time_minutes,
            customer_count=dr.customer_count, stops=stops,
        ))

    return PlanResultOut(
        plan=PlanOut.model_validate(plan),
        clusters=clusters, weekly_plan=weekly, routes=routes,
    )


def _update_status(db, plan_id, status):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if plan:
        plan.status = status
        db.commit()


def _is_cancelled(db, plan_id):
    db.expire_all()
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    return plan is None or plan.status == "cancelled"


def _clean_plan_data(db, plan_id):
    db.query(ClusterAssignment).filter(ClusterAssignment.plan_id == plan_id).delete()
    db.query(WeeklyAssignment).filter(WeeklyAssignment.plan_id == plan_id).delete()
    for dr in db.query(DailyRoute).filter(DailyRoute.plan_id == plan_id).all():
        db.query(RouteStop).filter(RouteStop.daily_route_id == dr.id).delete()
    db.query(DailyRoute).filter(DailyRoute.plan_id == plan_id).delete()
    db.commit()


def _run_full_pipeline(plan_id: int):
    db = SessionLocal()
    try:
        t0 = time_mod.time()
        plan = db.query(Plan).filter(Plan.id == plan_id).first()
        customers = db.query(Customer).all()
        cust_ids = [c.id for c in customers]
        x = np.array([c.x for c in customers])
        y = np.array([c.y for c in customers])
        rev = np.array([c.monthly_revenue for c in customers])
        vis = np.array([c.visit_frequency for c in customers])

        _clean_plan_data(db, plan_id)

        # ── ADIM 1: KÜMELEME ──
        _update_status(db, plan_id, "clustering")

        clustering_result = run_simulated_annealing(
            x_coords=x, y_coords=y, revenue=rev, visit_freq=vis,
            n_st=plan.st_count,
            revenue_tol=REVENUE_TOL,
            visit_tol=VISIT_TOL,
            num_runs=5,
            time_limit=10800,
        )

        if _is_cancelled(db, plan_id):
            _clean_plan_data(db, plan_id)
            return

        clusters = clustering_result["clusters"]
        for ci, cluster_data in clusters.items():
            center_cust_id = cust_ids[cluster_data["center_index"]]
            for cust_idx in cluster_data["customer_indices"]:
                ca = ClusterAssignment(
                    plan_id=plan_id,
                    customer_id=cust_ids[cust_idx],
                    cluster_index=ci,
                    center_customer_id=center_cust_id,
                )
                db.add(ca)
        db.commit()

        # ── ADIM 2: HAFTALIK ATAMA ──
        if _is_cancelled(db, plan_id):
            _clean_plan_data(db, plan_id)
            return
        _update_status(db, plan_id, "assignment")

        cluster_map = {}
        for ci, cluster_data in clusters.items():
            cluster_map[ci] = cluster_data["customer_indices"]

        settings = db.query(AppSettings).first()
        depot_x = settings.depot_x if settings else 38.6567541
        depot_y = settings.depot_y if settings else 27.3435846

        all_day_customers = {}

        for ci, cust_indices in cluster_map.items():
            if _is_cancelled(db, plan_id):
                _clean_plan_data(db, plan_id)
                return

            weekly_freqs = {}
            for i in cust_indices:
                f = int(vis[i])
                weekly_freqs[i] = max(1, min(f, 3))

            result = run_weekly_assignment(
                customer_indices=cust_indices,
                x_coords=x, y_coords=y,
                visit_frequencies=weekly_freqs,
                depot_x=depot_x, depot_y=depot_y,
                days=[1, 2, 3, 4, 5, 6],
                alpha=ASSIGNMENT_ALPHA,
                time_limit=3600,
            )

            if result is None:
                raise RuntimeError(f"Küme {ci} için atama çözümü bulunamadı")

            for cust_idx, days in result["assignments"].items():
                for day in days:
                    wa = WeeklyAssignment(
                        plan_id=plan_id,
                        customer_id=cust_ids[cust_idx],
                        cluster_index=ci,
                        day_of_week=day,
                    )
                    db.add(wa)

            for day, day_custs in result["day_customers"].items():
                all_day_customers[(ci, day)] = day_custs

        db.commit()

        # ── ADIM 3: ROTALAMA ──
        if _is_cancelled(db, plan_id):
            _clean_plan_data(db, plan_id)
            return
        _update_status(db, plan_id, "routing")

        total_distance = 0.0
        total_time = 0.0
        for (ci, day), day_custs in all_day_customers.items():
            if not day_custs:
                continue

            if _is_cancelled(db, plan_id):
                _clean_plan_data(db, plan_id)
                return

            route_result = solve_route(
                customer_indices=day_custs,
                x_coords=x, y_coords=y,
                depot_x=depot_x, depot_y=depot_y,
                time_limit=1800,
            )

            arrival_times = route_result.get("arrival_times", {})

            dr = DailyRoute(
                plan_id=plan_id,
                cluster_index=ci,
                day_of_week=day,
                total_distance=route_result["total_distance"],
                total_time_minutes=route_result.get("total_time"),
                customer_count=len(route_result["route"]),
            )
            db.add(dr)
            db.flush()

            for order, cust_idx in enumerate(route_result["route"], 1):
                rs = RouteStop(
                    daily_route_id=dr.id,
                    customer_id=cust_ids[cust_idx],
                    visit_order=order,
                    estimated_arrival_minutes=arrival_times.get(cust_idx),
                )
                db.add(rs)

            total_distance += route_result["total_distance"]
            total_time += route_result.get("total_time", 0)

        plan = db.query(Plan).filter(Plan.id == plan_id).first()
        plan.total_distance = total_distance
        plan.solve_time_seconds = time_mod.time() - t0
        plan.status = "completed"
        db.commit()

    except Exception as e:
        plan = db.query(Plan).filter(Plan.id == plan_id).first()
        if plan and plan.status != "cancelled":
            plan.status = f"error: {str(e)[:200]}"
            db.commit()
    finally:
        db.close()
