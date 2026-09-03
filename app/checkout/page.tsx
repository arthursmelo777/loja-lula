"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { PRODUCTS } from "@/lib/products";
import { formatCents } from "@/lib/format";
import { maskCPF, maskCEP, maskPhone, onlyDigits } from "@/lib/masks";
import { getStoredUtm } from "@/lib/utm";

interface FormState {
  name: string;
  email: string;
  phone: string;
  document: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const INITIAL_STATE: FormState = {
  name: "",
  email: "",
  phone: "",
  document: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      router.replace("/carrinho");
    }
  }, [items, router]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCepBlur() {
    const digits = onlyDigits(form.zipCode);
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {
      // silencioso — o cliente pode preencher manualmente
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer: {
            name: form.name,
            email: form.email,
            phone: onlyDigits(form.phone),
            document: onlyDigits(form.document),
            zipCode: onlyDigits(form.zipCode),
            street: form.street,
            number: form.number,
            complement: form.complement,
            neighborhood: form.neighborhood,
            city: form.city,
            state: form.state,
          },
          tracking: getStoredUtm(),
        }),
      });

      const data = await res.json();

      if (!res.ok && !data.redirectUrl) {
        setError(data.error || "Não foi possível processar seu pedido. Tente novamente.");
        setSubmitting(false);
        return;
      }

      clear();
      router.push(data.redirectUrl);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setSubmitting(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-3xl sm:text-4xl">CHECKOUT</h1>

      <div className="mt-8 flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 font-display text-xl">DADOS PESSOAIS</legend>
            <Field label="Nome completo" required>
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="input"
                autoComplete="name"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail" required>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="input"
                  autoComplete="email"
                />
              </Field>
              <Field label="Telefone" required>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => update("phone", maskPhone(e.target.value))}
                  className="input"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                />
              </Field>
            </div>
            <Field label="CPF" required>
              <input
                required
                value={form.document}
                onChange={(e) => update("document", maskCPF(e.target.value))}
                className="input max-w-xs"
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 font-display text-xl">ENDEREÇO DE ENTREGA</legend>
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="CEP" required>
                <input
                  required
                  value={form.zipCode}
                  onChange={(e) => update("zipCode", maskCEP(e.target.value))}
                  onBlur={handleCepBlur}
                  className="input"
                  inputMode="numeric"
                  placeholder="00000-000"
                />
                {cepLoading && <span className="mt-1 block text-xs text-ink/50">Buscando endereço…</span>}
              </Field>
              <Field label="Rua" required>
                <input
                  required
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                  className="input"
                  autoComplete="address-line1"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Número" required>
                <input
                  required
                  value={form.number}
                  onChange={(e) => update("number", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Complemento">
                <input
                  value={form.complement}
                  onChange={(e) => update("complement", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Bairro" required>
                <input
                  required
                  value={form.neighborhood}
                  onChange={(e) => update("neighborhood", e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Cidade" required>
                <input
                  required
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Estado (UF)" required>
                <input
                  required
                  value={form.state}
                  maxLength={2}
                  onChange={(e) => update("state", e.target.value.toUpperCase())}
                  className="input uppercase"
                />
              </Field>
            </div>
          </fieldset>

          {error && (
            <p className="border border-brand-red bg-brand-red/5 px-4 py-3 text-sm text-brand-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-red py-4 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60 sm:w-auto sm:px-10"
          >
            {submitting ? "Gerando PIX…" : "Pagar com PIX"}
          </button>
        </form>

        <aside className="h-fit border border-ink/15 p-6">
          <h2 className="mb-4 font-display text-xl">SEU PEDIDO</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {items.map((item) => {
              const product = PRODUCTS[item.productId];
              if (!product) return null;
              return (
                <li key={`${item.productId}-${item.size}`} className="flex justify-between gap-2">
                  <span>
                    {product.name}
                    {item.size ? ` — Tamanho ${item.size}` : ""}
                    <span className="text-ink/50"> · {item.quantity}x</span>
                  </span>
                  <span className="shrink-0 font-medium">{formatCents(product.price * item.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between font-display text-xl hairline pt-4">
            <span>TOTAL</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          <Link href="/carrinho" className="mt-4 block text-center text-xs text-ink/50 underline underline-offset-2">
            Voltar ao carrinho
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="text-brand-red"> *</span>}
      </span>
      {children}
    </label>
  );
}
