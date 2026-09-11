"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { PRODUCTS } from "@/lib/products";
import { formatCents } from "@/lib/format";
import { maskCPF, maskCEP, maskPhone, onlyDigits } from "@/lib/masks";
import { getStoredFbc, getStoredUtm } from "@/lib/utm";
import { trackMetaEvent } from "@/lib/meta-pixel-client";

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

type CouponStatus = "idle" | "checking" | "valid" | "invalid";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState<CouponStatus>("idle");
  const [couponDiscountPercent, setCouponDiscountPercent] = useState(0);
  // Evita a corrida: limpar o carrinho após um pedido bem-sucedido deixa
  // `items` vazio, o que faria o efeito abaixo mandar de volta pro carrinho
  // em vez de seguir pra tela do PIX.
  const orderPlacedRef = useRef(false);
  const trackedInitiateCheckoutRef = useRef(false);

  const discount =
    couponStatus === "valid" ? Math.round((subtotal * couponDiscountPercent) / 100) : 0;
  const total = subtotal - discount;

  async function handleCouponBlur() {
    const code = couponCode.trim();
    if (!code) {
      setCouponStatus("idle");
      return;
    }
    setCouponStatus("checking");
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(code)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCouponDiscountPercent(data.discountPercent);
        setCouponStatus("valid");
      } else {
        setCouponStatus("invalid");
      }
    } catch {
      setCouponStatus("invalid");
    }
  }

  useEffect(() => {
    if (items.length === 0 && !orderPlacedRef.current) {
      router.replace("/carrinho");
    }
  }, [items, router]);

  useEffect(() => {
    // O carrinho hidrata do localStorage de forma assíncrona, então `items`
    // pode chegar vazio no primeiro render — só dispara quando (e assim que)
    // ele tiver itens de verdade, e só uma vez por visita ao checkout.
    if (items.length === 0 || trackedInitiateCheckoutRef.current) return;
    trackedInitiateCheckoutRef.current = true;
    trackMetaEvent("InitiateCheckout", {
      value: subtotal / 100,
      currency: "BRL",
      content_ids: items.map((i) => i.productId),
      num_items: items.length,
    });
  }, [items, subtotal]);

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
          couponCode: couponStatus === "valid" ? couponCode.trim() : null,
          tracking: getStoredUtm(),
          fbc: getStoredFbc(),
        }),
      });

      const data = await res.json();

      if (!res.ok && !data.redirectUrl) {
        setError(data.error || "Não foi possível processar seu pedido. Tente novamente.");
        setSubmitting(false);
        return;
      }

      orderPlacedRef.current = true;
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

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-display text-xl">CUPOM DE DESCONTO</legend>
            <div className="max-w-xs">
              <input
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponStatus("idle");
                }}
                onBlur={handleCouponBlur}
                placeholder="Ex: LULA10-AB12CD"
                className="input uppercase"
              />
              {couponStatus === "checking" && (
                <span className="mt-1 block text-xs text-ink/50">Verificando cupom…</span>
              )}
              {couponStatus === "valid" && (
                <span className="mt-1 block text-xs font-semibold text-brand-red">
                  🎉 {couponDiscountPercent}% de desconto aplicado!
                </span>
              )}
              {couponStatus === "invalid" && (
                <span className="mt-1 block text-xs text-brand-red">Cupom inválido ou expirado.</span>
              )}
            </div>
          </fieldset>

          {error && (
            <p className="border border-brand-red bg-brand-red/5 px-4 py-3 text-sm text-brand-red">
              {error}
            </p>
          )}

          {/* Fecha a compra logo abaixo do cadastro e ANTES dos depoimentos:
              quem já decidiu não precisa rolar por mais conteúdo para pagar.
              Largura total e com o valor à vista, para não ser preciso conferir
              o total noutra coluna antes de decidir. */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-red px-6 py-5 text-base font-bold uppercase tracking-wide text-white shadow-[6px_6px_0_0_rgba(10,10,10,0.9)] transition-colors hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? "Gerando PIX…" : `Finalizar compra · ${formatCents(total)}`}
          </button>

          <p className="-mt-4 text-center text-xs text-ink/50">
            Pagamento via PIX com confirmação automática.
          </p>

          <section aria-label="Depoimentos de clientes" className="flex flex-col gap-4 border border-ink/15 p-6">
            <h2 className="font-display text-xl">QUEM COMPROU, APROVOU ⭐⭐⭐⭐⭐</h2>
            <p className="text-sm text-ink/60">
              Mais de 2.300 pedidos entregues. Veja o que dizem quem já recebeu:
            </p>
            <ul className="flex flex-col gap-5">
              {TESTIMONIALS.map((t) => (
                <li key={t.name} className="flex gap-3">
                  <img
                    src={t.photo}
                    alt={`Foto de ${t.name}`}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-full border border-ink/15 object-cover"
                  />
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{t.name}</span>
                      <span className="text-xs text-amber-500" aria-label="5 estrelas">★★★★★</span>
                      <span className="text-[11px] font-medium text-green-700">✓ Compra verificada</span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink/80">{t.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

        </form>

        <aside className="h-fit border border-ink/15 p-6">
          <h2 className="mb-4 font-display text-xl">SEU PEDIDO</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {items.map((item) => {
              const product = PRODUCTS[item.productId];
              if (!product) return null;
              return (
                <li
                  key={`${item.productId}-${item.size}-${item.customName ?? ""}`}
                  className="flex justify-between gap-2"
                >
                  <span>
                    {product.name}
                    {item.size ? ` — Tamanho ${item.size}` : ""}
                    <span className="text-ink/50"> · {item.quantity}x</span>
                    {item.customName && (
                      <span className="block text-xs text-ink/50">Estampa: &ldquo;{item.customName}&rdquo;</span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium">{formatCents(product.price * item.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-col gap-1 hairline pt-4 text-sm">
            <div className="flex justify-between text-ink/60">
              <span>Subtotal</span>
              <span>{formatCents(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-brand-red">
                <span>Cupom ({couponDiscountPercent}%)</span>
                <span>−{formatCents(discount)}</span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between font-display text-xl">
            <span>TOTAL</span>
            <span>{formatCents(total)}</span>
          </div>
          <Link href="/carrinho" className="mt-4 block text-center text-xs text-ink/50 underline underline-offset-2">
            Voltar ao carrinho
          </Link>
        </aside>
      </div>
    </div>
  );
}

const TESTIMONIALS = [
  {
    name: "Mariana S.",
    photo: "/depoimentos/pessoa-1.jpeg",
    text: "Confesso que fiquei com pé atrás de pagar no PIX, mas foi super seguro: paguei e na hora recebi a confirmação do pedido no e-mail. Chegou em 4 dias, antes do prazo. A camiseta é de uma qualidade que eu não esperava pelo preço.",
  },
  {
    name: "Carlos Eduardo M.",
    photo: "/depoimentos/pessoa-2.jpeg",
    text: "Já é a segunda vez que compro. Da primeira fiquei na dúvida com o tamanho, mas a tabela de medidas é certinha — pedi o M e serviu perfeito. O tecido é grosso, não é aquela camiseta fina que deforma na primeira lavagem.",
  },
  {
    name: "Juliana R.",
    photo: "/depoimentos/pessoa-3.jpeg",
    text: "Comprei de presente pro meu namorado e morria de medo de não chegar a tempo. Chegou com dias de folga, embalagem caprichada e a estampa idêntica à foto do site. Ele adorou. Atendimento respondeu rapidinho quando chamei no WhatsApp.",
  },
  {
    name: "Fernanda L.",
    photo: "/depoimentos/pessoa-4.jpeg",
    text: "Eu sempre compro roupa online e essa foi uma das melhores experiências que já tive. Site fácil, pagamento rápido no PIX e produto exatamente como anunciado. Já indiquei pra três amigas.",
  },
  {
    name: "Rafael T.",
    photo: "/depoimentos/pessoa-5.jpeg",
    text: "Tava desconfiado porque o preço tava muito bom, mas arrisquei com o cupom e valeu demais. A estampa não desbota, já lavei umas 10 vezes e tá nova. Qualidade de loja grande com preço justo.",
  },
  {
    name: "Patrícia A.",
    photo: "/depoimentos/pessoa-6.jpeg",
    text: "O que mais me impressionou foi o caimento — veste muito bem, não fica nem apertada nem largona. E o rastreio funcionou certinho do início ao fim, acompanhei tudo. Virei cliente.",
  },
];

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
