import Image from "next/image";
import Link from "next/link";
import { listProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

// Força renderização dinâmica (por requisição): esta página lê as notas médias
// direto do Postgres via getAllRatingSummaries(). Com `revalidate`, o Next tenta
// pré-gerar "/" estaticamente durante o `next build` — ou seja, o build passa a
// depender de conseguir abrir conexão com o banco a partir da máquina de build
// da Vercel. Se o banco estiver indisponível, mais lento, ou o ambiente de build
// não alcançar o host do Postgres nesse momento, o build inteiro falha com
// "Error occurred prerendering page /". `force-dynamic` evita isso: a consulta
// só roda em runtime (a cada requisição), nunca durante o build.
export const dynamic = "force-dynamic";

export default async function Home() {
  const products = listProducts();
  const shirts = products.filter((p) => p.category === "camiseta");
  const caps = products.filter((p) => p.category === "bone");

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-4 text-sm font-semibold text-brand-red">Coleção 2026</p>
            <h1 className="font-display text-[3.2rem] leading-[0.95] sm:text-[4.5rem] md:text-[5rem]">
              VISTA
              <br />
              SUA
              <br />
              ESCOLHA.
            </h1>
            <p className="mt-6 max-w-sm text-base text-ink/70">
              Camisetas e bonés exclusivos a partir de R$ 14,99. Estampas fortes, produção limitada,
              pagamento via PIX com confirmação automática.
            </p>
            <Link
              href="#camisetas"
              className="mt-8 inline-block bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
            >
              Ver produtos
            </Link>
          </div>

          <div className="relative flex justify-center md:justify-end">
            <div
              aria-hidden
              className="absolute right-8 top-6 h-56 w-56 rounded-full bg-brand-red/90 sm:h-72 sm:w-72"
            />
            <div className="relative w-56 sm:w-72 md:w-80">
              <Image
                src="/products/shirt-black-front.jpg"
                alt="Camiseta Lula Preta"
                width={640}
                height={640}
                quality={90}
                preload
                className="relative w-full border border-ink/10 object-cover shadow-[10px_10px_0_0_rgba(10,10,10,0.9)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CAMISETAS */}
      <section id="camisetas" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-3xl sm:text-4xl">CAMISETAS</h2>
          <span className="text-sm text-ink/50">{shirts.length} produtos</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {shirts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* BONÉS */}
      <section id="bones" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-3xl sm:text-4xl">BONÉS</h2>
          <span className="text-sm text-ink/50">{caps.length} produtos</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {caps.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
