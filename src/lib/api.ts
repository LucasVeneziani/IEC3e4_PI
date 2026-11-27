import type { ClothingInfo } from './types';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

/** Envia a foto para o backend em Python, que busca na internet e pede à OpenRouter para identificar o item (roupa ou qualquer objeto). */
export function scanClothing(imageBase64: string, signal?: AbortSignal): Promise<ClothingInfo> {
  return post('/scan', { image_base64: imageBase64, mime_type: 'image/jpeg' }, signal);
}

/** Consulta um código de barras ou QR code (qualquer objeto, não só roupa). A foto ajuda a IA quando o código é desconhecido. */
export function lookupBarcode(code: string, codeType: string, imageBase64: string | null, signal?: AbortSignal): Promise<ClothingInfo> {
  return post('/barcode', { code, code_type: codeType, image_base64: imageBase64, mime_type: 'image/jpeg' }, signal);
}

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<ClothingInfo> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new Error(`Não foi possível conectar ao servidor (${API_URL}).`);
  }
  if (!res.ok) {
    let detail = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as ClothingInfo;
}
