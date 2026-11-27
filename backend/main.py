"""Backend de IA do AppBrechó: POST /scan com uma foto devolve o item identificado (roupa ou qualquer objeto), a faixa de preço e anúncios parecidos."""

from __future__ import annotations

import base64
import binascii
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
from ai import AIError, OpenRouterClient
from crawler import Crawler
from lookup import lookup_barcode

MAX_IMAGE_BYTES = 8 * 1024 * 1024


class ScanRequest(BaseModel):
    image_base64: str = Field(..., description="Bytes JPEG/PNG em base64 (o prefixo data: é opcional)")
    mime_type: str = "image/jpeg"


class BarcodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=512)
    code_type: str = "ean13"
    image_base64: str | None = Field(None, description="Foto opcional tirada quando o código foi lido")
    mime_type: str = "image/jpeg"


class MarketListing(BaseModel):
    title: str
    price: str | None = None
    url: str
    source: str


class EstimatedPrice(BaseModel):
    min: float
    max: float
    currency: str = "BRL"


class ClothingInfo(BaseModel):
    kind: str = "clothing"  # "clothing" (roupa/moda) ou "product" (qualquer outro objeto)
    barcode: str | None = None
    barcode_type: str | None = None
    link: str | None = None  # URL lida de um QR code
    name: str
    brand: str | None = None
    category: str = "Roupa"
    colors: list[str] = []
    material: str | None = None
    pattern: str | None = None
    style: str | None = None
    era: str | None = None
    condition: str | None = None
    size_hint: str | None = None
    description: str = ""
    estimated_price: EstimatedPrice | None = None
    care: list[str] = []
    tags: list[str] = []
    market: list[MarketListing] = []


DEMO_RESULT = ClothingInfo(
    name="Blazer transpassado de lã azul-marinho",
    brand=None,
    category="Casaco / Blazer",
    colors=["Azul-marinho"],
    material="Lã (provável)",
    pattern="Liso",
    style="Social clássico",
    era="Anos 90",
    condition="Ótimo",
    size_hint=None,
    description="Blazer longo transpassado com lapela larga e seis botões. Combina com calça reta ou jeans para um visual mais casual.",
    estimated_price=EstimatedPrice(min=90, max=180),
    care=["Lavar a seco", "Guardar em cabide largo"],
    tags=["blazer", "alfaiataria", "vintage"],
    market=[MarketListing(title="Blazer azul marinho transpassado", price="R$ 129,90", url="https://www.enjoei.com.br/", source="Enjoei")],
)


DEMO_PRODUCT = ClothingInfo(
    kind="product",
    name="Produto de exemplo",
    category="Produto",
    description="Resultado de exemplo do modo demonstração. Com a chave da OpenRouter configurada, o código é buscado em bancos de códigos de barras e lojas online.",
    tags=["exemplo"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ai = OpenRouterClient()
    app.state.crawler = Crawler()
    yield
    await app.state.ai.aclose()
    await app.state.crawler.aclose()


app = FastAPI(title="AppBrechó AI", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def decode_image(image_base64: str) -> str:
    raw = image_base64.split(",", 1)[-1]
    try:
        size = len(base64.b64decode(raw, validate=False))
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Imagem inválida.")
    if size == 0 or size > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Imagem vazia ou muito grande.")
    return raw


def to_info(merged: dict) -> ClothingInfo:
    try:
        return ClothingInfo.model_validate(merged)
    except Exception:
        # Às vezes o modelo devolve tipos estranhos (ex.: preço como texto); mantém o que dá para usar.
        merged.pop("estimated_price", None)
        merged["name"] = str(merged.get("name") or "Item")
        return ClothingInfo.model_validate({k: v for k, v in merged.items() if k in ClothingInfo.model_fields})


def market_from(listings: list[dict]) -> list[dict]:
    return [{"title": item["title"], "price": item.get("price"), "url": item["url"], "source": item["source"]} for item in listings]


def demo_mode() -> bool:
    return config.demo_mode()


@app.get("/health")
async def health():
    return {"ok": True, "demo": demo_mode(), "model": app.state.ai.model, "has_key": bool(app.state.ai.api_key)}


@app.post("/scan", response_model=ClothingInfo)
async def scan(req: ScanRequest) -> ClothingInfo:
    raw = decode_image(req.image_base64)
    if demo_mode():
        return DEMO_RESULT

    ai: OpenRouterClient = app.state.ai
    crawler: Crawler = app.state.crawler
    try:
        identified = await ai.identify(raw, req.mime_type)
        query = identified.get("search_query") or identified.get("name") or "usado"
        listings = [item.to_dict() for item in await crawler.crawl(str(query))]
        report = await ai.report(identified, listings)
    except AIError as e:
        raise HTTPException(502, str(e))

    merged = {**identified, **{k: v for k, v in report.items() if v not in (None, "", [])}}
    merged["kind"] = "product" if identified.get("kind") == "product" else "clothing"
    merged["market"] = market_from(listings)
    return to_info(merged)


@app.post("/barcode", response_model=ClothingInfo)
async def barcode(req: BarcodeRequest) -> ClothingInfo:
    """Qualquer objeto com código de barras/QR code: consulta o código, busca em lojas e deixa a IA resumir."""
    code = req.code.strip()
    raw = decode_image(req.image_base64) if req.image_base64 else None
    if demo_mode():
        return DEMO_PRODUCT.model_copy(update={"barcode": code, "barcode_type": req.code_type})

    ai: OpenRouterClient = app.state.ai
    crawler: Crawler = app.state.crawler
    lookups = await lookup_barcode(crawler.client, code)
    query = code
    if lookups:
        first = lookups[0]
        query = " ".join(str(first.get(k, "")) for k in ("brands", "brand", "product_name", "title") if first.get(k)) or code
    is_url = code.startswith(("http://", "https://"))
    # Um link ou texto de QR code só é buscado em lojas se ele indicar um produto.
    listings = [] if (is_url or not code.isdigit()) and query == code else [item.to_dict() for item in await crawler.crawl(query)]
    try:
        report = await ai.product_report(code, req.code_type, lookups, listings, raw, req.mime_type)
    except AIError as e:
        raise HTTPException(502, str(e))

    merged = {k: v for k, v in report.items() if v not in (None, "", [])}
    merged.update(kind="product", barcode=code, barcode_type=req.code_type, market=market_from(listings))
    if is_url:
        merged["link"] = code
    return to_info(merged)
