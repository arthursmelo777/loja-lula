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
  /** Se true, o cliente pode digitar um nome para ser impresso na peça. */
  personalizable?: boolean;
}

export interface CartItem {
  productId: string;
  size: ShirtSize | null;
  quantity: number;
  /** Nome digitado pelo cliente para personalizar a estampa (apenas produtos personalizáveis). */
  customName?: string | null;
}

export type OrderStatus = "pending" | "paid" | "canceled" | "refunded";

export interface OrderItemRecord {
  id: number;
  order_id: number;
  product_id: string;
  product_name: string;
  variant: string | null;
  custom_name: string | null;
  unit_price: number;
  quantity: number;
  total: number;
}

export interface OrderRecord {
  id: number;
  review_token: string | null;
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
  discount: number;
  coupon_code: string | null;
  total: number;
  payment_method: string;
  payment_status: OrderStatus;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** Cookies e cabeçalhos do navegador do comprador, capturados no checkout
   *  e usados depois pela Conversions API do Meta (o webhook do gateway não
   *  tem acesso a eles). */
  meta_fbp: string | null;
  meta_fbc: string | null;
  client_ip: string | null;
  client_user_agent: string | null;
  pix_qr_code: string | null;
  pix_qr_code_text: string | null;
  /** Rastreio da entrega — preenchido pelo painel admin ao postar. */
  tracking_code: string | null;
  carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  raw_gateway_response: unknown;
  created_at: string;
  updated_at: string;
}

export interface UtmData {
  src: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
}

export interface ReviewRecord {
  id: number;
  order_id: number;
  product_id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  /** Só avaliações aprovadas no painel aparecem na loja. */
  approved: boolean;
}

export interface ProductRatingSummary {
  productId: string;
  average: number;
  count: number;
}

export interface CouponRecord {
  id: number;
  code: string;
  discount_percent: number;
  source_order_id: number;
  used_order_id: number | null;
  used_at: string | null;
  created_at: string;
  expires_at: string | null;
}
