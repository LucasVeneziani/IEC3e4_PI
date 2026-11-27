export type MarketListing = {
  title: string;
  price: string | null;
  url: string;
  source: string;
};

/** Formato devolvido pelo backend em Python em POST /scan (foto de roupa) e POST /barcode (qualquer produto). */
export type ClothingInfo = {
  /** Ausente em escaneamentos salvos antes do suporte a código de barras; tratar como 'clothing'. */
  kind?: 'clothing' | 'product';
  barcode?: string | null;
  barcode_type?: string | null;
  /** URL lida de um QR code. */
  link?: string | null;
  name: string;
  brand: string | null;
  category: string;
  colors: string[];
  material: string | null;
  pattern: string | null;
  style: string | null;
  era: string | null;
  condition: string | null;
  size_hint: string | null;
  description: string;
  estimated_price: { min: number; max: number; currency: string } | null;
  care: string[];
  tags: string[];
  market: MarketListing[];
};

export type ScanSummary = {
  id: number;
  name: string;
  scanned_at: number;
  /** URI data: montada a partir do BLOB da miniatura quando a linha é lida. */
  thumbnailUri: string | null;
};

export type Scan = ScanSummary & {
  imageUri: string | null;
  data: ClothingInfo;
};
