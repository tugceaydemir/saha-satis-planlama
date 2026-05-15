from sqlalchemy import (
    Column, Integer, Float, String, DateTime, Date, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from datetime import datetime, date

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    full_name = Column(String(200), nullable=False)
    company = Column(String(200), nullable=True)
    role = Column(String(20), nullable=False, default="admin")
    cluster_index = Column(Integer, nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    monthly_revenue = Column(Float, nullable=False)
    visit_frequency = Column(Integer, nullable=False)
    customer_type = Column(String(10), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cluster_assignments = relationship("ClusterAssignment", back_populates="customer")
    weekly_assignments = relationship("WeeklyAssignment", back_populates="customer")
    route_stops = relationship("RouteStop", back_populates="customer")


class SalesRep(Base):
    __tablename__ = "sales_reps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)
    depot_x = Column(Float, nullable=True)
    depot_y = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cluster_assignments = relationship("ClusterAssignment", back_populates="sales_rep")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    st_count = Column(Integer, nullable=False)
    status = Column(String(50), default="pending")
    total_distance = Column(Float, nullable=True)
    solve_time_seconds = Column(Float, nullable=True)
    run_started_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cluster_assignments = relationship(
        "ClusterAssignment", back_populates="plan", cascade="all, delete-orphan"
    )
    weekly_assignments = relationship(
        "WeeklyAssignment", back_populates="plan", cascade="all, delete-orphan"
    )
    daily_routes = relationship(
        "DailyRoute", back_populates="plan", cascade="all, delete-orphan"
    )


class ClusterAssignment(Base):
    __tablename__ = "cluster_assignments"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    cluster_index = Column(Integer, nullable=False)
    center_customer_id = Column(Integer, nullable=True)
    sales_rep_id = Column(Integer, ForeignKey("sales_reps.id"), nullable=True)

    plan = relationship("Plan", back_populates="cluster_assignments")
    customer = relationship("Customer", back_populates="cluster_assignments")
    sales_rep = relationship("SalesRep", back_populates="cluster_assignments")


class WeeklyAssignment(Base):
    __tablename__ = "weekly_assignments"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    cluster_index = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)

    plan = relationship("Plan", back_populates="weekly_assignments")
    customer = relationship("Customer", back_populates="weekly_assignments")


class DailyRoute(Base):
    __tablename__ = "daily_routes"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    cluster_index = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    total_distance = Column(Float, nullable=True)
    total_time_minutes = Column(Float, nullable=True)
    customer_count = Column(Integer, nullable=True)

    plan = relationship("Plan", back_populates="daily_routes")
    stops = relationship(
        "RouteStop", back_populates="daily_route", cascade="all, delete-orphan"
    )


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    depot_x = Column(Float, nullable=False, default=38.6567541)
    depot_y = Column(Float, nullable=False, default=27.3435846)


class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True)
    daily_route_id = Column(Integer, ForeignKey("daily_routes.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    visit_order = Column(Integer, nullable=False)
    estimated_arrival_minutes = Column(Float, nullable=True)

    daily_route = relationship("DailyRoute", back_populates="stops")
    customer = relationship("Customer", back_populates="route_stops")


class SalesVisit(Base):
    __tablename__ = "sales_visits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    # Faz 3a: Mobil app'ten ziyaret tamamlama icin eklenen alanlar.
    # route_stop_id NULL olabilir cunku eski kayitlarda bu alan yoktu.
    route_stop_id = Column(Integer, ForeignKey("route_stops.id"), nullable=True)
    order_items_count = Column(Integer, nullable=True)
    visit_date = Column(Date, nullable=False, default=date.today)
    sale_amount = Column(Float, nullable=False, default=0)
    visited = Column(Integer, nullable=False, default=1)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    customer = relationship("Customer")
    route_stop = relationship("RouteStop")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, default="general")
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User")
