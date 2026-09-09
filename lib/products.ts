import type { Product, ShirtSize } from "@/types";

const SHIRT_SIZES: ShirtSize[] = ["P", "M", "G", "GG", "XGG"];

/**
 * Catálogo interno de produtos. Esta é a ÚNICA fonte de verdade de preços.
 * O frontend nunca deve enviar preço — apenas productId, size e quantity.
 * O backend sempre recalcula o valor a partir daqui antes de criar qualquer cobrança.
 */
export const PRODUCTS: Record<string, Product> = {
  shirt_black: {
    id: "shirt_black",
    slug: "camiseta-lula-preta",
    name: "Camiseta Lula Preta",
    category: "camiseta",
    price: 2990,
    description:
      "Camiseta oversized 100% algodão, estampa frente e costas. Frente com ilustração e a assinatura 'LULA'; costas com a frase 'Quem caminha com o povo nunca caminha só' e espaço para personalizar com o seu nome.",
    images: {
      front: "/products/shirt-black-front.jpg",
      back: "/products/shirt-black-back.jpg",
    },
    sizes: SHIRT_SIZES,
    tangible: true,
    personalizable: true,
  },
  shirt_white: {
    id: "shirt_white",
    slug: "camiseta-lula-branca",
    name: "Camiseta Lula Branca",
    category: "camiseta",
    price: 2990,
    description:
      "Camiseta oversized 100% algodão, estampa frente e costas. Frente com ilustração e a assinatura 'LULA'; costas com a frase 'Quem caminha com o povo nunca caminha só' e espaço para personalizar com o seu nome.",
    images: {
      front: "/products/shirt-white-front.jpg",
      back: "/products/shirt-white-back.jpg",
    },
    sizes: SHIRT_SIZES,
    tangible: true,
    personalizable: true,
  },
  shirt_red: {
    id: "shirt_red",
    slug: "camiseta-lula-vermelha",
    name: "Camiseta Lula Vermelha",
    category: "camiseta",
    price: 2990,
    description:
      "Camiseta oversized 100% algodão, estampa frente e costas. Frente com ilustração e a assinatura 'LULA'; costas com a frase 'Quem caminha com o povo nunca caminha só' e espaço para personalizar com o seu nome.",
    images: {
      front: "/products/shirt-red-front.jpg",
      back: "/products/shirt-red-back.jpg",
    },
    sizes: SHIRT_SIZES,
    tangible: true,
    personalizable: true,
  },
  shirt_red_13: {
    id: "shirt_red_13",
    slug: "camiseta-vermelha-13",
    name: "Camiseta Vermelha 13",
    category: "camiseta",
    price: 2990,
    description:
      "Camiseta oversized 100% algodão em vermelho, estampa branca na frente: o número 13, o escudo e a mão em L. Costas lisas, sem estampa.",
    images: {
      front: "/products/shirt-red-13-front.jpg",
      back: "/products/shirt-red-13-back.jpg",
    },
    sizes: SHIRT_SIZES,
    tangible: true,
  },
  shirt_black_feliz: {
    id: "shirt_black_feliz",
    slug: "camiseta-preta-lula-sem-medo-de-ser-feliz",
    name: "Camiseta Preta Lula – Sem Medo de Ser Feliz",
    category: "camiseta",
    price: 2990,
    description:
      "Camiseta oversized 100% algodão em preto, estampa branca e vermelha na frente: a mão em L formando a assinatura 'Lula', a estrela e a frase 'Sem medo de ser Feliz!'. Costas lisas, sem estampa.",
    images: {
      front: "/products/shirt-black-feliz-front.jpg",
      back: "/products/shirt-black-feliz-back.jpg",
    },
    sizes: SHIRT_SIZES,
    tangible: true,
  },
  cap_black: {
    id: "cap_black",
    slug: "bone-lula-preto",
    name: "Boné Lula Preto",
    category: "bone",
    price: 1499,
    description:
      "Boné em sarja, seis gomos, bordado frontal com ilustração e assinatura 'LULA'. Tamanho único com ajuste traseiro.",
    images: { front: "/products/cap-black.jpg" },
    sizes: null,
    tangible: true,
  },
  cap_white: {
    id: "cap_white",
    slug: "bone-lula-branco",
    name: "Boné Lula Branco",
    category: "bone",
    price: 1499,
    description:
      "Boné em sarja, seis gomos, bordado frontal com ilustração e assinatura 'LULA'. Tamanho único com ajuste traseiro.",
    images: { front: "/products/cap-white.jpg" },
    sizes: null,
    tangible: true,
  },
  cap_red: {
    id: "cap_red",
    slug: "bone-lula-vermelho",
    name: "Boné Lula Vermelho",
    category: "bone",
    price: 1499,
    description:
      "Boné em sarja, seis gomos, bordado frontal com ilustração e assinatura 'LULA'. Tamanho único com ajuste traseiro.",
    images: { front: "/products/cap-red.jpg" },
    sizes: null,
    tangible: true,
  },
};

export function getProductById(id: string): Product | undefined {
  return PRODUCTS[id];
}

export function getProductBySlug(slug: string): Product | undefined {
  return Object.values(PRODUCTS).find((p) => p.slug === slug);
}

export function listProducts(): Product[] {
  return Object.values(PRODUCTS);
}

export function isValidSize(product: Product, size: string | null): boolean {
  if (!product.sizes) return size === null;
  return size !== null && product.sizes.includes(size as ShirtSize);
}
