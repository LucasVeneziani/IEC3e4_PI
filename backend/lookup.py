"""Bancos de códigos de barras gratuitos: Open Food Facts (alimentos, cosméticos) e UPCitemdb (varejo em geral, plano de teste)."""

from __future__ import annotations

import httpx

from crawler import extract_product_page


async def open_food_facts(client: httpx.AsyncClient, code: str) -> dict | None:
    try:
        r = await client.get(
            f"https://world.openfoodfacts.org/api/v2/product/{code}.json",
            params={"fields": "product_name,brands,categories,quantity,generic_name"},
        )
        body = r.json() if r.status_code == 200 else {}
    except (httpx.HTTPError, ValueError):
        return None
    product = body.get("product") if body.get("status") == 1 else None
    if not product or not product.get("product_name"):
        return None
    return {"source": "Open Food Facts", **{k: v for k, v in product.items() if v}}


async def upcitemdb(client: httpx.AsyncClient, code: str) -> dict | None:
    try:
        r = await client.get("https://api.upcitemdb.com/prod/trial/lookup", params={"upc": code})
        body = r.json() if r.status_code == 200 else {}
    except (httpx.HTTPError, ValueError):
        return None
    items = body.get("items") or []
    if not items:
        return None
    item = items[0]
    keep = ("title", "brand", "category", "description", "model", "color", "size", "lowest_recorded_price", "highest_recorded_price")
    return {"source": "UPCitemdb", **{k: item[k] for k in keep if item.get(k)}}


async def qr_link(client: httpx.AsyncClient, url: str) -> dict | None:
    """QR codes costumam conter um link; lê a página para onde ele aponta."""
    try:
        r = await client.get(url)
    except httpx.HTTPError:
        return None
    if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
        return {"source": "QR code", "url": str(r.url)}
    return {"source": "QR code", "url": str(r.url), **extract_product_page(r.text)}


async def lookup_barcode(client: httpx.AsyncClient, code: str) -> list[dict]:
    if code.startswith(("http://", "https://")):
        page = await qr_link(client, code)
        return [page] if page else []
    if not code.isdigit():
        # QR code com texto simples: não há o que consultar, a IA lê o próprio texto.
        return [{"source": "QR code", "text": code}]
    results = [await open_food_facts(client, code), await upcitemdb(client, code)]
    return [r for r in results if r]
