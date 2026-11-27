"""Busca em sites de usados anúncios parecidos com a peça escaneada."""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import asdict, dataclass
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"
)
MARKET_SITES = {
    "enjoei.com.br": "Enjoei",
    "repassa.com.br": "Repassa",
    "mercadolivre.com.br": "Mercado Livre",
    "produto.mercadolivre.com.br": "Mercado Livre",
    "olx.com.br": "OLX",
    "vinted.com.br": "Vinted",
    "shein.com": "Shein",
    "renner.com.br": "Renner",
    "cea.com.br": "C&A",
    "zara.com": "Zara",
}
PRICE_RE = re.compile(r"R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?")


@dataclass
class Listing:
    title: str
    url: str
    source: str
    price: str | None = None
    snippet: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def site_name(url: str) -> str | None:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    for domain, name in MARKET_SITES.items():
        if host == domain or host.endswith("." + domain):
            return name
    return None


def _unwrap_ddg(href: str) -> str:
    # O DuckDuckGo embrulha os resultados como //duckduckgo.com/l/?uddg=<url codificada>
    if "uddg=" in href:
        return unquote(parse_qs(urlparse(href).query).get("uddg", [href])[0])
    return href


def parse_duckduckgo(html: str) -> list[Listing]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[Listing] = []
    for result in soup.select(".result"):
        link = result.select_one("a.result__a")
        if not link or not link.get("href"):
            continue
        url = _unwrap_ddg(link["href"])
        source = site_name(url)
        if not source:
            continue
        snippet_el = result.select_one(".result__snippet")
        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else None
        price = PRICE_RE.search(snippet or "")
        out.append(Listing(link.get_text(" ", strip=True), url, source, price.group(0) if price else None, snippet))
    return out


def parse_bing(html: str) -> list[Listing]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[Listing] = []
    for result in soup.select("li.b_algo"):
        link = result.select_one("h2 a")
        if not link or not link.get("href"):
            continue
        url = link["href"]
        source = site_name(url)
        if not source:
            continue
        snippet_el = result.select_one(".b_caption p, p")
        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else None
        price = PRICE_RE.search(snippet or "")
        out.append(Listing(link.get_text(" ", strip=True), url, source, price.group(0) if price else None, snippet))
    return out


def extract_product_page(html: str) -> dict:
    """Extrai título / preço / descrição de uma página de produto (primeiro JSON-LD, depois meta tags, depois o texto)."""
    soup = BeautifulSoup(html, "html.parser")
    info: dict = {}
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        for node in data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []:
            if not isinstance(node, dict) or "Product" not in str(node.get("@type", "")):
                continue
            info.setdefault("title", node.get("name"))
            info.setdefault("description", node.get("description"))
            brand = node.get("brand")
            if isinstance(brand, dict):
                brand = brand.get("name")
            if brand:
                info.setdefault("brand", brand)
            offers = node.get("offers")
            if isinstance(offers, list):
                offers = offers[0] if offers else None
            if isinstance(offers, dict):
                price = offers.get("price") or offers.get("lowPrice")
                if price:
                    info.setdefault("price", f"R$ {price}" if offers.get("priceCurrency", "BRL") == "BRL" else f"{price} {offers.get('priceCurrency')}")

    def meta(*names: str) -> str | None:
        for name in names:
            tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
            if tag and tag.get("content"):
                return tag["content"].strip()
        return None

    info.setdefault("title", meta("og:title", "twitter:title") or (soup.title.string.strip() if soup.title and soup.title.string else None))
    info.setdefault("description", meta("og:description", "description"))
    amount = meta("product:price:amount", "og:price:amount")
    if amount:
        info.setdefault("price", f"R$ {amount}")
    if "price" not in info:
        m = PRICE_RE.search(soup.get_text(" ", strip=True)[:20000])
        if m:
            info["price"] = m.group(0)
    return {k: v for k, v in info.items() if v}


class Crawler:
    def __init__(self, client: httpx.AsyncClient | None = None, max_results: int = 6, timeout: float = 10.0):
        self.client = client or httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9"},
            timeout=timeout,
            follow_redirects=True,
        )
        self.max_results = max_results

    async def aclose(self):
        await self.client.aclose()

    async def search(self, query: str) -> list[Listing]:
        sites = " OR ".join(f"site:{d}" for d in ("enjoei.com.br", "repassa.com.br", "mercadolivre.com.br", "olx.com.br"))
        q = f"{query} ({sites})"
        listings: list[Listing] = []
        try:
            r = await self.client.post("https://html.duckduckgo.com/html/", data={"q": q, "kl": "br-pt"})
            if r.status_code == 200:
                listings = parse_duckduckgo(r.text)
        except httpx.HTTPError:
            pass
        if not listings:
            try:
                r = await self.client.get(f"https://www.bing.com/search?q={quote_plus(q)}&cc=br&setlang=pt-br")
                if r.status_code == 200:
                    listings = parse_bing(r.text)
            except httpx.HTTPError:
                pass
        seen: set[str] = set()
        unique = []
        for item in listings:
            if item.url not in seen:
                seen.add(item.url)
                unique.append(item)
        return unique[: self.max_results]

    async def enrich(self, listing: Listing) -> Listing:
        try:
            r = await self.client.get(listing.url)
            if r.status_code == 200:
                page = extract_product_page(r.text)
                listing.price = listing.price or page.get("price")
                listing.snippet = page.get("description") or listing.snippet
                if page.get("title") and len(page["title"]) > len(listing.title):
                    listing.title = page["title"]
        except httpx.HTTPError:
            pass
        return listing

    async def crawl(self, query: str) -> list[Listing]:
        listings = await self.search(query)
        return list(await asyncio.gather(*(self.enrich(item) for item in listings)))
