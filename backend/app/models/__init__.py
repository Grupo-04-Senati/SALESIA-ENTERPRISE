"""Importa los 54 modelos para que Alembic y las relaciones los registren."""

from __future__ import annotations

from app.models.analytics_extra import AutomationRule, DataExport, KpiSnapshot, ScheduledReport
from app.models.audit_log import AuditLog
from app.models.bayes_analysis import BayesAnalysis
from app.models.branch import Branch
from app.models.category import Category
from app.models.company import Company
from app.models.crm import CustomerInteraction, CustomerSegment
from app.models.customer import Customer
from app.models.dataset import Dataset
from app.models.dataset_variable import DatasetVariable
from app.models.employee import Employee
from app.models.insight import Insight
from app.models.inventory import Inventory
from app.models.inventory_movement import InventoryMovement
from app.models.observation import Observation
from app.models.payment import Payment
from app.models.pricing import PriceList, PriceListItem, ProductPromotion, Promotion, Unit
from app.models.product import Product
from app.models.purchase import PurchaseOrder, PurchaseOrderDetail
from app.models.quote import Quote, QuoteDetail
from app.models.random_variable import RandomVariable
from app.models.report import Report
from app.models.role import Role
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.sales_return import SalesReturn, SalesReturnDetail
from app.models.security import LoginAttempt, PasswordReset, Permission, RefreshToken, RolePermission
from app.models.statistical_analysis import StatisticalAnalysis
from app.models.statistical_result import StatisticalResult
from app.models.supplier import Supplier
from app.models.system import AppEvent, Notification, SystemSetting
from app.models.user import User
from app.models.warehouse import Shipment, StockCount, StockCountDetail, Warehouse, WarehouseStock

__all__ = [
    'AppEvent', 'AuditLog', 'AutomationRule', 'BayesAnalysis', 'Branch', 'Category',
    'Company', 'Customer', 'CustomerInteraction', 'CustomerSegment', 'DataExport',
    'Dataset', 'DatasetVariable', 'Employee', 'Insight', 'Inventory',
    'InventoryMovement', 'KpiSnapshot', 'LoginAttempt', 'Notification', 'Observation',
    'PasswordReset', 'Payment', 'Permission', 'PriceList', 'PriceListItem',
    'Product', 'ProductPromotion', 'Promotion', 'PurchaseOrder', 'PurchaseOrderDetail',
    'Quote', 'QuoteDetail', 'RandomVariable', 'RefreshToken', 'Report', 'Role',
    'RolePermission', 'Sale', 'SaleDetail', 'SalesReturn', 'SalesReturnDetail',
    'ScheduledReport', 'Shipment', 'StatisticalAnalysis', 'StatisticalResult',
    'StockCount', 'StockCountDetail', 'Supplier', 'SystemSetting', 'Unit', 'User',
    'Warehouse', 'WarehouseStock',
]
