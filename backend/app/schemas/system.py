"""Schemas de sistema: notificaciones, exportaciones, reportes, reglas y KPIs (BE-3)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

NotificationLevel = Literal['info', 'warning', 'success', 'error']
ExportType = Literal['sales', 'products', 'customers', 'inventory', 'returns', 'quotes']
ExportFormat = Literal['csv', 'xlsx', 'json']
ReportType = Literal['ventas', 'estadistico', 'productos', 'clientes', 'vendedores']
Frequency = Literal['daily', 'weekly', 'monthly']
Severity = Literal['info', 'warning', 'critical']
KpiCode = Literal['revenue', 'sales_count', 'avg_ticket', 'customers', 'low_stock']
StatusValue = Literal['active', 'inactive']


class NotificationData(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    message: str = Field(min_length=3)
    level: NotificationLevel = 'info'
    user_id: Optional[int] = Field(default=None, ge=1)


class NotificationCreate(NotificationData):
    pass


class DataExportData(BaseModel):
    export_type: ExportType
    format: ExportFormat = 'csv'


class DataExportCreate(DataExportData):
    pass


class ScheduledReportData(BaseModel):
    report_type: ReportType
    title: str = Field(min_length=3, max_length=150)
    parameters: Optional[dict] = None
    frequency: Frequency = 'daily'
    next_run_at: Optional[datetime] = None
    status: Optional[StatusValue] = None


class ScheduledReportCreate(ScheduledReportData):
    pass


class ScheduledReportUpdate(ScheduledReportData):
    report_type: Optional[ReportType] = None
    title: Optional[str] = Field(default=None, min_length=3, max_length=150)
    frequency: Optional[Frequency] = None


class AutomationRuleData(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=3, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    condition: Optional[dict] = None
    action: Optional[dict] = None
    severity: Severity = 'info'
    status: Optional[StatusValue] = None


class AutomationRuleCreate(AutomationRuleData):
    pass


class AutomationRuleUpdate(AutomationRuleData):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    name: Optional[str] = Field(default=None, min_length=3, max_length=150)


class KpiSnapshotCreate(BaseModel):
    kpi_code: KpiCode
    period_start: str = Field(min_length=10, max_length=10)
    period_end: str = Field(min_length=10, max_length=10)
    value: Optional[float] = None
