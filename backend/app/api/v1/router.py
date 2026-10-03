"""Agregación de routers de la API v1 (docs/05 · §2)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routers import (
    audit,
    auth,
    customers,
    dashboard,
    employees,
    insights,
    inventory,
    probability,
    products,
    random_variables,
    reports,
    sales,
    statistics,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(customers.router)
api_router.include_router(products.router)
api_router.include_router(employees.router)
api_router.include_router(sales.router)
api_router.include_router(inventory.router)
api_router.include_router(dashboard.router)
api_router.include_router(statistics.router)
api_router.include_router(probability.router)
api_router.include_router(random_variables.router)
api_router.include_router(insights.router)
api_router.include_router(reports.router)
api_router.include_router(audit.router)

__all__ = ['api_router']
