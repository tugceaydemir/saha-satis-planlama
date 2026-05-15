"""
Visits router — Mobil app'in ziyaret tamamlama akışı için endpoint'ler.

Mobil app, bir müşteri durağını tamamladığında bu router'a istek gönderir.
İçeride sales_visits tablosu güncellenir.

Endpoint'ler:
  POST /api/visits/complete-stop  → bir durağı tamamlandı işaretle
  GET  /api/visits/today          → bugün tamamlananları listele
  GET  /api/visits/plan/{plan_id} → bir plana ait tamamlananları listele
"""
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Customer, RouteStop, SalesVisit, DailyRoute
from ..schemas import VisitCompletionCreate, VisitCompletionOut
from ..auth import get_current_user


router = APIRouter(prefix="/api/visits", tags=["visits"])


@router.post(
    "/complete-stop",
    response_model=VisitCompletionOut,
    status_code=201,
)
def complete_stop(
    body: VisitCompletionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Bir route_stop'u tamamlandı olarak işaretler.
    Mobil app'ten "Siparişi Onayla" tuşuna basıldığında çağrılır.

    Akış:
      1. route_stop'u bul, müşteri bilgisini al
      2. SalesVisit tablosuna yeni bir kayıt ekle (veya varsa güncelle)
      3. Tamamlanan ziyaret objesini döndür
    """
    stop = db.query(RouteStop).filter(RouteStop.id == body.route_stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Durak bulunamadı")

    customer = db.query(Customer).filter(Customer.id == stop.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")

    # Aynı stop için zaten kayıt var mı? Varsa güncelle, yoksa oluştur.
    # Bu sayede jüri aynı durağa birden çok tıklasa bile tek kayıt kalır.
    existing = db.query(SalesVisit).filter(
        SalesVisit.route_stop_id == body.route_stop_id,
        SalesVisit.user_id == user.id,
    ).first()

    if existing:
        existing.sale_amount = body.order_amount
        existing.order_items_count = body.order_items_count
        existing.notes = body.notes
        existing.visited = 1
        existing.created_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        visit = existing
    else:
        visit = SalesVisit(
            user_id=user.id,
            customer_id=customer.id,
            route_stop_id=body.route_stop_id,
            visit_date=date.today(),
            sale_amount=body.order_amount,
            order_items_count=body.order_items_count,
            visited=1,
            notes=body.notes,
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)

    return VisitCompletionOut(
        id=visit.id,
        route_stop_id=visit.route_stop_id,
        customer_id=visit.customer_id,
        customer_name=customer.name,
        visit_order=stop.visit_order,
        sale_amount=visit.sale_amount,
        order_items_count=visit.order_items_count,
        notes=visit.notes,
        completed_at=visit.created_at,
    )


@router.get(
    "/today",
    response_model=list[VisitCompletionOut],
)
def get_today_visits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Bugün tamamlanan ziyaretleri listele.
    Mobil app'in Dashboard ve Visits ekranlarında kullanılır.
    """
    today = date.today()
    visits = db.query(SalesVisit).filter(
        SalesVisit.user_id == user.id,
        SalesVisit.visit_date == today,
        SalesVisit.visited == 1,
    ).order_by(SalesVisit.created_at.desc()).all()

    result = []
    for v in visits:
        customer = db.query(Customer).filter(Customer.id == v.customer_id).first()
        stop_order = None
        if v.route_stop_id:
            stop = db.query(RouteStop).filter(RouteStop.id == v.route_stop_id).first()
            if stop:
                stop_order = stop.visit_order

        result.append(VisitCompletionOut(
            id=v.id,
            route_stop_id=v.route_stop_id,
            customer_id=v.customer_id,
            customer_name=customer.name if customer else None,
            visit_order=stop_order,
            sale_amount=v.sale_amount,
            order_items_count=v.order_items_count,
            notes=v.notes,
            completed_at=v.created_at,
        ))
    return result


@router.get(
    "/plan/{plan_id}",
    response_model=list[VisitCompletionOut],
)
def get_plan_visits(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Belirli bir plana ait tamamlanan ziyaretleri listele.
    Mobil app'in Visits ekranında bir planın tamamlanma durumunu göstermek için kullanılır.
    """
    stop_ids = [
        s.id for s in db.query(RouteStop)
        .join(DailyRoute, RouteStop.daily_route_id == DailyRoute.id)
        .filter(DailyRoute.plan_id == plan_id)
        .all()
    ]

    if not stop_ids:
        return []

    visits = db.query(SalesVisit).filter(
        SalesVisit.route_stop_id.in_(stop_ids),
        SalesVisit.visited == 1,
    ).order_by(SalesVisit.created_at.desc()).all()

    result = []
    for v in visits:
        customer = db.query(Customer).filter(Customer.id == v.customer_id).first()
        stop = db.query(RouteStop).filter(RouteStop.id == v.route_stop_id).first()

        result.append(VisitCompletionOut(
            id=v.id,
            route_stop_id=v.route_stop_id,
            customer_id=v.customer_id,
            customer_name=customer.name if customer else None,
            visit_order=stop.visit_order if stop else None,
            sale_amount=v.sale_amount,
            order_items_count=v.order_items_count,
            notes=v.notes,
            completed_at=v.created_at,
        ))
    return result
