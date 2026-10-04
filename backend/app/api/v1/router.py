"""Agregación de routers de la API v1 (docs/05 · §2)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routers import (
    automation_rules,
    audit,
    auth,
    branches,
    customer_interactions,
    customer_segments,
    customers,
    dashboard,
    data_exports,
    employees,
    insights,
    inventory,
    kpi_snapshots,
    notifications,
    price_lists,
    probability,
    products,
    purchase_orders,
    promotions,
    quotes,
    random_variables,
    reports,
    returns,
    sales,
    scheduled_reports,
    shipments,
    statistics,
    stock_counts,
    suppliers,
    units,
    users,
    warehouses,
    warehouse_stock,
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

# Módulos nuevos: compras, cotizaciones, devoluciones, precios, CRM,
# almacén y sistema (tablas ampliadas de la migración 0003).
api_router.include_router(suppliers.router)
api_router.include_router(purchase_orders.router)
api_router.include_router(shipments.router)
api_router.include_router(quotes.router)
api_router.include_router(returns.router)
api_router.include_router(price_lists.router)
api_router.include_router(promotions.router)
api_router.include_router(customer_segments.router)
api_router.include_router(customer_interactions.router)
api_router.include_router(units.router)
api_router.include_router(branches.router)
api_router.include_router(warehouses.router)
api_router.include_router(warehouse_stock.router)
api_router.include_router(stock_counts.router)
api_router.include_router(notifications.router)
api_router.include_router(data_exports.router)
api_router.include_router(scheduled_reports.router)
api_router.include_router(automation_rules.router)
api_router.include_router(kpi_snapshots.router)

__all__ = ['api_router']
