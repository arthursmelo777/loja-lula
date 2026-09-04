"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, ShirtSize } from "@/types";
import { PRODUCTS } from "@/lib/products";

const STORAGE_KEY = "lula_cart_v1";

interface CartContextValue {
  items: CartItem[];
  addItem: (
    productId: string,
    size: ShirtSize | null,
    quantity: number,
    customName?: string | null
  ) => void;
  removeItem: (productId: string, size: ShirtSize | null, customName?: string | null) => void;
  setQuantity: (
    productId: string,
    size: ShirtSize | null,
    quantity: number,
    customName?: string | null
  ) => void;
  clear: () => void;
  totalItems: number;
  subtotal: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// Duas linhas só se combinam se o nome personalizado também for igual —
// cada estampa com nome diferente precisa ficar separada no carrinho.
function sameLine(a: CartItem, productId: string, size: ShirtSize | null, customName?: string | null) {
  return a.productId === productId && a.size === size && (a.customName ?? null) === (customName ?? null);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação única do carrinho a partir do localStorage no primeiro render
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // localStorage indisponível — segue com carrinho vazio
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignora falha de persistência
    }
  }, [items, hydrated]);

  const addItem = useCallback(
    (productId: string, size: ShirtSize | null, quantity: number, customName?: string | null) => {
      setItems((prev) => {
        const existing = prev.find((i) => sameLine(i, productId, size, customName));
        if (existing) {
          return prev.map((i) =>
            sameLine(i, productId, size, customName) ? { ...i, quantity: i.quantity + quantity } : i
          );
        }
        return [...prev, { productId, size, quantity, customName: customName ?? null }];
      });
      setDrawerOpen(true);
    },
    []
  );

  const removeItem = useCallback(
    (productId: string, size: ShirtSize | null, customName?: string | null) => {
      setItems((prev) => prev.filter((i) => !sameLine(i, productId, size, customName)));
    },
    []
  );

  const setQuantity = useCallback(
    (productId: string, size: ShirtSize | null, quantity: number, customName?: string | null) => {
      setItems((prev) =>
        prev
          .map((i) => (sameLine(i, productId, size, customName) ? { ...i, quantity } : i))
          .filter((i) => i.quantity > 0)
      );
    },
    []
  );

  const clear = useCallback(() => setItems([]), []);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, i) => {
        const product = PRODUCTS[i.productId];
        return product ? sum + product.price * i.quantity : sum;
      }, 0),
    [items]
  );

  const value: CartContextValue = {
    items,
    addItem,
    removeItem,
    setQuantity,
    clear,
    totalItems,
    subtotal,
    isDrawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return ctx;
}
