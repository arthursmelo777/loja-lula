import { getProductById } from "./products";
import type { CartItem } from "@/types";

export interface PricedItem {
  productId: string;
  productName: string;
  variant: string | null;
  customName: string | null;
  unitPrice: number;
  quantity: number;
  total: number;
  category: "camiseta" | "bone";
}

export interface PricedCart {
  items: PricedItem[];
  subtotal: number;
  total: number;
}

/**
 * Recalcula o carrinho inteiramente a partir do catálogo interno (lib/products.ts).
 * Nunca aceita preço, nome de produto ou total vindos do cliente.
 */
export function priceCart(items: CartItem[]): PricedCart {
  const priced: PricedItem[] = items.map((item) => {
    const product = getProductById(item.productId);
    if (!product) {
      throw new Error(`Produto inexistente: ${item.productId}`);
    }
    const unitPrice = product.price; // sempre do catálogo interno
    const total = unitPrice * item.quantity;
    return {
      productId: product.id,
      productName: product.name,
      variant: item.size,
      customName: item.customName ?? null,
      unitPrice,
      quantity: item.quantity,
      total,
      category: product.category,
    };
  });

  const subtotal = priced.reduce((sum, i) => sum + i.total, 0);

  return { items: priced, subtotal, total: subtotal };
}
