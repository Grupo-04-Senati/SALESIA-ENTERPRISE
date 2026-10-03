"""Importa los 22 modelos para que Alembic y las relaciones los registren."""

from __future__ import annotations

from app.models.audit_log import AuditLog
from app.models.bayes_analysis import BayesAnalysis
from app.models.category import Category
from app.models.company import Company
from app.models.customer import Customer
from app.models.dataset import Dataset
from app.models.dataset_variable import DatasetVariable
from app.models.employee import Employee
from app.models.insight import Insight
from app.models.inventory import Inventory
from app.models.inventory_movement import InventoryMovement
from app.models.observation import Observation
from app.models.payment import Payment
from app.models.product import Product
from app.models.random_variable import RandomVariable
from app.models.report import Report
from app.models.role import Role
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.statistical_analysis import StatisticalAnalysis
from app.models.statistical_result import StatisticalResult
from app.models.user import User

__all__ = [
    'AuditLog', 'BayesAnalysis', 'Category', 'Company', 'Customer', 'Dataset',
    'DatasetVariable', 'Employee', 'Insight', 'Inventory', 'InventoryMovement',
    'Observation', 'Payment', 'Product', 'RandomVariable', 'Report', 'Role',
    'Sale', 'SaleDetail', 'StatisticalAnalysis', 'StatisticalResult', 'User',
]
