import { z } from "zod";
import { PRODUCTS, isValidSize } from "./products";

// Nome de estampa: letras (com acentos), espaços, apóstrofo e hífen — sem limite de charset restritivo demais.
const CUSTOM_NAME_PATTERN = /^[\p{L}\p{M}0-9 '\-.]+$/u;

export const cartItemSchema = z
  .object({
    productId: z.string().min(1),
    size: z.enum(["P", "M", "G", "GG", "XGG"]).nullable(),
    quantity: z.number().int().min(1).max(10),
    customName: z
      .string()
      .trim()
      .max(30, "Nome muito longo (máx. 30 caracteres)")
      .regex(CUSTOM_NAME_PATTERN, "Nome contém caracteres inválidos")
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((item, ctx) => {
    const product = PRODUCTS[item.productId];
    if (!product) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Produto inválido: ${item.productId}`,
        path: ["productId"],
      });
      return;
    }
    if (!isValidSize(product, item.size)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tamanho inválido para ${product.name}`,
        path: ["size"],
      });
    }
    if (item.customName && !product.personalizable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${product.name} não aceita personalização`,
        path: ["customName"],
      });
    }
  });

export const cartSchema = z.array(cartItemSchema).min(1);

// Apenas dígitos, o backend limpa formatação antes de validar
const digitsOnly = (min: number, max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(min).max(max));

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo"),
  email: z.string().trim().email("E-mail inválido"),
  phone: digitsOnly(10, 11).pipe(z.string()),
  document: digitsOnly(11, 11), // CPF
  zipCode: digitsOnly(8, 8),
  street: z.string().trim().min(2),
  number: z.string().trim().min(1),
  complement: z.string().trim().optional().default(""),
  neighborhood: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().length(2),
});

export const utmSchema = z.object({
  src: z.string().optional().default(""),
  utm_source: z.string().optional().default(""),
  utm_medium: z.string().optional().default(""),
  utm_campaign: z.string().optional().default(""),
  utm_term: z.string().optional().default(""),
  utm_content: z.string().optional().default(""),
});

export const checkoutRequestSchema = z.object({
  items: cartSchema,
  customer: checkoutCustomerSchema,
  couponCode: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  tracking: utmSchema.optional().default({
    src: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
  }),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const reviewRequestSchema = z.object({
  orderId: z.number().int().positive(),
  reviewToken: z.string().min(1),
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(""),
});

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base: string, factor: number) => {
    let total = 0;
    for (const digit of base) {
      total += parseInt(digit, 10) * factor--;
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const digit1 = calcCheckDigit(digits.slice(0, 9), 10);
  const digit2 = calcCheckDigit(digits.slice(0, 10), 11);
  return digit1 === parseInt(digits[9], 10) && digit2 === parseInt(digits[10], 10);
}
