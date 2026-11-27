import base64
import json
import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai import OpenRouterClient, parse_json  # noqa: E402
from crawler import Crawler, extract_product_page, parse_duckduckgo, site_name  # noqa: E402

DDG_HTML = """
<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.enjoei.com.br%2Fp%2Fblazer-azul-123">Blazer azul marinho</a>
<a class="result__snippet">Blazer transpassado por R$ 129,90 em ótimo estado</a></div>
<div class="result"><a class="result__a" href="https://example.com/blog">Blog post</a></div>
"""

PRODUCT_HTML = """<html><head><title>x</title>
<script type="application/ld+json">{"@type":"Product","name":"Blazer Zara azul","brand":{"name":"Zara"},
"offers":{"price":"149.90","priceCurrency":"BRL"}}</script></head><body></body></html>"""


def test_parse_duckduckgo_keeps_market_sites_only():
    items = parse_duckduckgo(DDG_HTML)
    assert len(items) == 1
    assert items[0].url == "https://www.enjoei.com.br/p/blazer-azul-123"
    assert items[0].source == "Enjoei"
    assert items[0].price == "R$ 129,90"


def test_site_name():
    assert site_name("https://produto.mercadolivre.com.br/MLB-1") == "Mercado Livre"
    assert site_name("https://evil.com/enjoei.com.br") is None


def test_extract_product_page_json_ld():
    info = extract_product_page(PRODUCT_HTML)
    assert info["title"] == "Blazer Zara azul"
    assert info["brand"] == "Zara"
    assert info["price"] == "R$ 149.90"


def test_parse_json_handles_fences():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Aqui está: {"a": 2} obrigado') == {"a": 2}


@pytest.mark.anyio
async def test_scan_pipeline_with_mocked_network(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if "openrouter.ai" in str(request.url):
            body = json.loads(request.content)
            is_identify = isinstance(body["messages"][0]["content"], list)
            content = (
                {"name": "Blazer azul", "category": "Blazer", "colors": ["azul"], "search_query": "blazer azul"}
                if is_identify
                else {"description": "Blazer clássico.", "estimated_price": {"min": 80, "max": 150, "currency": "BRL"}, "tags": ["blazer"]}
            )
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})
        if "duckduckgo" in str(request.url):
            return httpx.Response(200, text=DDG_HTML)
        if "enjoei" in str(request.url):
            return httpx.Response(200, text=PRODUCT_HTML)
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    import main

    monkeypatch.setenv("DEMO_MODE", "0")
    main.app.state.ai = OpenRouterClient(api_key="test", client=httpx.AsyncClient(transport=transport))
    main.app.state.crawler = Crawler(client=httpx.AsyncClient(transport=transport))

    req = main.ScanRequest(image_base64=base64.b64encode(b"\xff\xd8fakejpeg").decode())
    result = await main.scan(req)
    assert result.name == "Blazer azul"
    assert result.estimated_price.max == 150
    assert result.market[0].source == "Enjoei"
    assert result.market[0].price == "R$ 129,90"


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _barcode_transport():
    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "openfoodfacts" in url:
            return httpx.Response(200, json={"status": 1, "product": {"product_name": "Café Torrado 500g", "brands": "Pilão"}})
        if "upcitemdb" in url:
            return httpx.Response(200, json={"items": []})
        if "openrouter.ai" in url:
            body = json.loads(request.content)
            payload = json.loads(body["messages"][1]["content"][0]["text"])
            name = payload["bancos_de_dados"][0].get("product_name") or payload["bancos_de_dados"][0].get("title") or "?"
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({"name": name, "category": "Produto"})}}]})
        if "loja.example" in url:
            return httpx.Response(200, text="<html><head><meta property='og:title' content='Liquidificador X'></head></html>", headers={"content-type": "text/html"})
        if "duckduckgo" in url:
            return httpx.Response(200, text=DDG_HTML)
        return httpx.Response(404)

    return httpx.MockTransport(handler)


@pytest.mark.anyio
async def test_barcode_ean(monkeypatch):
    import main

    monkeypatch.setenv("DEMO_MODE", "0")
    transport = _barcode_transport()
    main.app.state.ai = OpenRouterClient(api_key="test", client=httpx.AsyncClient(transport=transport))
    main.app.state.crawler = Crawler(client=httpx.AsyncClient(transport=transport))
    result = await main.barcode(main.BarcodeRequest(code="7896089011234", code_type="ean13"))
    assert result.kind == "product"
    assert result.name == "Café Torrado 500g"
    assert result.barcode == "7896089011234"
    assert result.market[0].source == "Enjoei"


@pytest.mark.anyio
async def test_qr_link(monkeypatch):
    import main

    monkeypatch.setenv("DEMO_MODE", "0")
    transport = _barcode_transport()
    main.app.state.ai = OpenRouterClient(api_key="test", client=httpx.AsyncClient(transport=transport))
    main.app.state.crawler = Crawler(client=httpx.AsyncClient(transport=transport))
    result = await main.barcode(main.BarcodeRequest(code="https://loja.example/p/1", code_type="qr"))
    assert result.name == "Liquidificador X"
    assert result.link == "https://loja.example/p/1"
    assert result.market[0].source == "Enjoei"  # a página indicou um produto, então as lojas foram consultadas


@pytest.mark.anyio
async def test_photo_scan_of_non_clothing_object(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if "openrouter.ai" in str(request.url):
            body = json.loads(request.content)
            calls.append(body)
            if "response_format" in body:
                return httpx.Response(400, text='{"error":"response_format is not supported"}')
            is_identify = isinstance(body["messages"][0]["content"], list)
            content = (
                {"kind": "product", "name": "Boneco Buzz Lightyear", "category": "Brinquedo", "search_query": "boneco buzz lightyear"}
                if is_identify
                else {"description": "Boneco colecionável.", "estimated_price": {"min": 40, "max": 90, "currency": "BRL"}}
            )
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})
        if "duckduckgo" in str(request.url):
            return httpx.Response(200, text=DDG_HTML)
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    import main

    monkeypatch.setenv("DEMO_MODE", "0")
    main.app.state.ai = OpenRouterClient(api_key="test", client=httpx.AsyncClient(transport=transport))
    main.app.state.crawler = Crawler(client=httpx.AsyncClient(transport=transport))
    result = await main.scan(main.ScanRequest(image_base64=base64.b64encode(b"\xff\xd8toy").decode()))
    assert result.kind == "product"
    assert result.name == "Boneco Buzz Lightyear"
    assert result.estimated_price.max == 90
    # o modelo recusou response_format e o cliente repetiu sem ele
    assert "response_format" in calls[0] and "response_format" not in calls[1]
