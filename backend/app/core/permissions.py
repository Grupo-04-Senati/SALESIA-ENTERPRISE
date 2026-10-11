"""Catálogo canónico de módulos y submódulos del frontend.

Los permisos de un rol se guardan en ``Role.permissions`` (JSONB) con la forma
``{'modules': ['/ventas', ...], 'submodules': {'/inventario': ['existencias', ...]}}``.
Este módulo valida lo que la API acepta escribir: los paths coinciden con
``NAV_ITEMS`` del frontend (utils/constants.ts) y los submódulos con las
pestañas/paneles reales de cada página.
"""

from __future__ import annotations

MODULE_PATHS = frozenset({
    '/dashboard',
    '/ventas',
    '/inventario',
    '/clientes',
    '/productos',
    '/vendedores',
    '/compras',
    '/cotizaciones',
    '/devoluciones',
    '/precios',
    '/analytics',
    '/probabilidad',
    '/insights',
    '/reportes',
    '/configuracion',
    '/automatizaciones',
})

# submódulos válidos por módulo (ids de pestañas/paneles filtrables en la UI)
SUBMODULES: dict[str, frozenset[str]] = {
    '/inventario': frozenset({'existencias', 'movimientos', 'conteos', 'almacenes', 'sucursales'}),
    '/productos': frozenset({'productos', 'categorias', 'unidades'}),
    '/configuracion': frozenset({
        'perfil', 'parametros', 'usuarios', 'roles', 'sistema',
        'notificaciones', 'exportaciones', 'reportes',
    }),
}
