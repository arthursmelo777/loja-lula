export type ProductCategory = "camiseta" | "bone";

export type ShirtSize = "P" | "M" | "G" | "GG" | "XGG";

export interface ProductImage {
  front: string;
  back?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  price: number; // em centavos — nunca confie em valores vindos do cliente
  description: string;
  images: ProductImage;
  sizes: ShirtSize[] | null; // null = tamanho único (bonés)
  tangible: true;
}

export interface CartItem {
  productId: string;
  size: ShirtSize | null;
  quantity: number;
}

export type OrderStatus = "pending" | "paid" | "canceled" | "refunded";

export interface OrderItemRecord {
  id: number;
  order_id: number;
  product_id: string;
  product_name: string;
  variant: string | null;
  unit_price: number;
  quantity: number;
  total: number;
}

export interface OrderRecord {
  id: number;
  transaction_hash: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_document: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  subtotal: number;
  total: number;
  payment_method: string;
  payment_status: OrderStatus;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  pix_qr_code: string | null;
  pix_qr_code_text: string | null;
  raw_gateway_response: unknown;
  created_at: string;
  updated_at: string;
}

export interface NormalizedPixResult {
  transactionHash: string;
  qrCodeImage: string | null; // base64 ou URL da imagem do QR Code
  qrCodeText: string | null; // código "copia e cola"
  status: OrderStatus;
  raw: unknown;
}

export interface UtmData {
  src: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
}
