"""Schemas de sistema: notificaciones, exportaciones, reportes, reglas y KPIs (BE-3)."""

from __future__ import annotations

from datetime import datetime
from typing import ClassVar, Literal, Optional

from pydantic import Field, field_validator

from app.schemas.base import NormalizedModel

NotificationLevel = Literal['info', 'warning', 'success', 'error']
ExportType = Literal['sales', 'products', 'customers', 'inventory', 'returns', 'quotes']
ExportFormat = Literal['csv', 'xlsx', 'json']
ReportType = Literal['ventas', 'estadistico', 'productos', 'clientes', 'vendedores']
Frequency = Literal['daily', 'weekly', 'monthly']
Severity = Literal['info', 'warning', 'critical']
KpiCode = Literal['revenue', 'sales_count', 'avg_ticket', 'customers', 'low_stock']
StatusValue = Literal['active', 'inactive']

# Tope de seguridad para payloads serializados que se guardan como JSON.
MAX_JSON_CHARS = 10_000


def _check_serialized_size(value: Optional[dict]) -> Optional[dict]:
    if value is not None and len(str(value)) > MAX_JSON_CHARS:
        raise ValueError(f'El contenido serializado supera los {MAX_JSON_CHARS} caracteres.')
    return value


class NotificationData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'title'})
    title: str = Field(min_length=3, max_length=150)
    message: str = Field(min_length=3, max_length=2000)
    level: NotificationLevel = 'info'
    user_id: Optional[int] = Field(default=None, ge=1)
    # Origen (opcional): usado por el backfill y por anuncios con destino.
    module: Optional[str] = Field(default=None, max_length=60)
    link: Optional[str] = Field(default=None, max_length=255)
    target_role: Optional[str] = Field(default=None, max_length=30)
    detail: Optional[dict] = None

    @field_validator('detail')
    @classmethod
    def _detail_size(cls, value: Optional[dict]) -> Optional[dict]:
        return _check_serialized_size(value)


class NotificationCreate(NotificationData):
    pass


class NotificationsConfigData(NormalizedModel):
    """PUT /notifications/config — {modules: {clave: [roles]}}."""

    modules: dict[str, list[str]]


class DataExportData(NormalizedModel):
    export_type: ExportType
    format: ExportFormat = 'csv'


class DataExportCreate(DataExportData):
    pass


class ScheduledReportData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'title'})
    report_type: ReportType
    title: str = Field(min_length=3, max_length=150)
    parameters: Optional[dict] = None
    frequency: Frequency = 'daily'
    next_run_at: Optional[datetime] = None
    status: Optional[StatusValue] = None

    @field_validator('parameters')
    @classmethod
    def _limit_parameters(cls, value: Optional[dict]) -> Optional[dict]:
        return _check_serialized_size(value)


class ScheduledReportCreate(ScheduledReportData):
    pass


class ScheduledReportUpdate(ScheduledReportData):
    report_type: Optional[ReportType] = None
    title: Optional[str] = Field(default=None, min_length=3, max_length=150)
    frequency: Optional[Frequency] = None


class AutomationRuleData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=3, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    condition: Optional[dict] = None
    action: Optional[dict] = None
    severity: Severity = 'info'
    status: Optional[StatusValue] = None

    @field_validator('condition', 'action')
    @classmethod
    def _limit_payload(cls, value: Optional[dict]) -> Optional[dict]:
        return _check_serialized_size(value)


class AutomationRuleCreate(AutomationRuleData):
    pass


class AutomationRuleUpdate(AutomationRuleData):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    name: Optional[str] = Field(default=None, min_length=3, max_length=150)


class KpiSnapshotCreate(NormalizedModel):
    kpi_code: KpiCode
    period_start: str = Field(min_length=10, max_length=10)
    period_end: str = Field(min_length=10, max_length=10)
    value: Optional[float] = None
