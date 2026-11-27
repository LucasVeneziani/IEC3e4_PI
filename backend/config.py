"""Lê as configurações: variável de ambiente primeiro, depois app_secrets.py, depois o valor padrão."""

from __future__ import annotations

import os

try:
    import app_secrets
except ImportError:
    app_secrets = None


def get(name: str, default: str = "") -> str:
    value = os.getenv(name)
    if value:
        return value
    value = getattr(app_secrets, name, None)
    if value is None or value == "":
        return default
    return str(value)


def demo_mode() -> bool:
    return get("DEMO_MODE", "0").lower() in {"1", "true", "yes"}
