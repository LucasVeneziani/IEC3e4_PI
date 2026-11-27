"""Chamadas à OpenRouter: identifica o item pela foto e depois escreve o relatório final com os anúncios encontrados."""

from __future__ import annotations

import json
import re

import httpx

import config

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

IDENTIFY_PROMPT = """Você é especialista em brechós e no mercado de usados no Brasil. Identifique o objeto principal da foto.
Pode ser roupa, calçado, acessório ou qualquer outro objeto (brinquedo, livro, eletrônico, louça, decoração...).
Responda SOMENTE com JSON válido, em português, neste formato:
{
  "kind": "clothing" se for roupa, calçado ou acessório de moda; "product" para qualquer outro objeto,
  "name": "nome curto e descritivo do objeto (ex.: 'Boneco do Buzz Lightyear', 'Casaco de lã azul')",
  "brand": "marca/fabricante se visível ou identificável, senão null",
  "category": "ex.: Casaco, Vestido, Brinquedo, Livro, Eletrônico",
  "colors": ["cores principais"],
  "material": "material/tecido provável ou null",
  "pattern": "estampa (liso, xadrez, floral...) se for roupa, senão null",
  "style": "estilo ou linha/coleção (ex.: vintage, streetwear, personagem da Disney) ou null",
  "era": "década/época aparente ou null",
  "condition": "estado aparente (novo, ótimo, bom, desgastado) ou null",
  "size_hint": "tamanho/dimensão se visível, senão null",
  "search_query": "termos curtos para buscar itens iguais ou parecidos em sites de usados"
}
Se não houver nenhum objeto reconhecível na foto, use "name": "Objeto não identificado" e explique em "category"."""

REPORT_PROMPT = """Você é avaliador de um brechó brasileiro que também vende objetos usados em geral. Com base na
identificação do item (campo "kind": "clothing" para moda, "product" para outros objetos) e nos anúncios encontrados
na internet, escreva o relatório final. Responda SOMENTE com JSON válido, em português:
{
  "name": "...",
  "brand": "... ou null",
  "category": "...",
  "colors": ["..."],
  "material": "... ou null",
  "pattern": "... ou null",
  "style": "... ou null",
  "era": "... ou null",
  "condition": "... ou null",
  "size_hint": "... ou null",
  "description": "2 a 4 frases sobre o item: o que é, detalhes que importam (para roupa, como combinar; para objetos, para que serve, se é colecionável) e o que observar ao comprar/vender",
  "estimated_price": {"min": número, "max": número, "currency": "BRL"},
  "care": ["dicas de limpeza/conservação"],
  "tags": ["palavras-chave curtas"]
}
Baseie a faixa de preço de usado nos anúncios quando houver; se não houver, estime pelo mercado brasileiro de usados."""


PRODUCT_PROMPT = """Você ajuda um usuário brasileiro a identificar um produto (qualquer objeto, não só roupa)
a partir do código de barras ou QR code lido pela câmera (um QR code pode conter um link ou um texto), dos dados encontrados em bancos de códigos de barras e dos anúncios
encontrados na internet. Uma foto do produto pode vir junto. Se os dados não bastarem para identificar o produto com
segurança, diga isso no nome e na descrição em vez de inventar. Responda SOMENTE com JSON válido, em português:
{
  "name": "nome do produto",
  "brand": "... ou null",
  "category": "tipo de produto",
  "colors": ["..."],
  "material": "... ou null",
  "pattern": null,
  "style": null,
  "era": null,
  "condition": "estado aparente na foto ou null",
  "size_hint": "tamanho/quantidade/volume ou null",
  "description": "2 a 4 frases sobre o que é o produto e para que serve",
  "estimated_price": {"min": número, "max": número, "currency": "BRL"} ou null se não houver base,
  "care": ["dicas de uso/conservação, se fizer sentido"],
  "tags": ["palavras-chave curtas"]
}"""


class AIError(RuntimeError):
    pass


def parse_json(text: str) -> dict:
    """Os modelos às vezes envolvem o JSON em ``` ou escrevem texto em volta; pega o objeto mais externo."""
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise AIError("A IA não retornou um JSON válido.")
        return json.loads(cleaned[start : end + 1])


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, model: str | None = None, client: httpx.AsyncClient | None = None):
        self.api_key = api_key or config.get("OPENROUTER_API_KEY")
        self.model = model or config.get("OPENROUTER_MODEL", "google/gemini-2.5-flash")
        self.client = client or httpx.AsyncClient(timeout=60)

    async def aclose(self):
        await self.client.aclose()

    async def _chat(self, messages: list[dict]) -> dict:
        if not self.api_key:
            raise AIError("OPENROUTER_API_KEY não configurada no servidor (backend/app_secrets.py).")
        body = {"model": self.model, "messages": messages, "response_format": {"type": "json_object"}, "temperature": 0.2}
        headers = {"Authorization": f"Bearer {self.api_key}", "X-Title": "AppBrecho"}
        r = await self.client.post(OPENROUTER_URL, headers=headers, json=body)
        if r.status_code == 400 and "response_format" in r.text:
            # Alguns modelos (vários gratuitos) não aceitam response_format; o prompt já pede JSON.
            body.pop("response_format")
            r = await self.client.post(OPENROUTER_URL, headers=headers, json=body)
        if r.status_code != 200:
            raise AIError(f"OpenRouter respondeu {r.status_code}: {r.text[:300]}")
        data = r.json()
        if not data.get("choices"):
            raise AIError(f"OpenRouter não devolveu resposta: {json.dumps(data.get('error', data))[:300]}")
        content = data["choices"][0]["message"]["content"] or ""
        return parse_json(content if isinstance(content, str) else json.dumps(content))

    async def identify(self, image_base64: str, mime_type: str = "image/jpeg") -> dict:
        return await self._chat(
            [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": IDENTIFY_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}},
                    ],
                }
            ]
        )

    async def report(self, identified: dict, listings: list[dict]) -> dict:
        payload = {"identificacao": identified, "anuncios_encontrados": listings}
        return await self._chat(
            [
                {"role": "system", "content": REPORT_PROMPT},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ]
        )

    async def product_report(
        self, code: str, code_type: str, lookups: list[dict], listings: list[dict], image_base64: str | None, mime_type: str
    ) -> dict:
        payload = {"codigo": code, "tipo_codigo": code_type, "bancos_de_dados": lookups, "anuncios_encontrados": listings}
        content: list[dict] = [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}]
        if image_base64:
            content.append({"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}})
        return await self._chat([{"role": "system", "content": PRODUCT_PROMPT}, {"role": "user", "content": content}])
