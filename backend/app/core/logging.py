"""Logging de la aplicación (sin secretos ni tokens, RNF-07)."""

from __future__ import annotations

import logging
import sys


def setup_logging(level: str = 'INFO') -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter('%(asctime)s | %(levelname)-8s | %(name)s | %(message)s')
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
