import Link from "next/link";

export function Footer() {
  return (
    <footer className="hairline mt-24 bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/" className="font-display text-2xl">
            VESTE<span className="text-brand-red">LULA</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-cream/70">
            Camisetas e bonés exclusivos. Pagamento via PIX, produção e envio para todo o Brasil.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:gap-16">
          <div>
            <h3 className="mb-3 font-semibold uppercase tracking-wide text-cream/60">Loja</h3>
            <ul className="space-y-2">
              <li><Link href="/#camisetas" className="hover:text-brand-red">Camisetas</Link></li>
              <li><Link href="/#bones" className="hover:text-brand-red">Bonés</Link></li>
              <li><Link href="/carrinho" className="hover:text-brand-red">Carrinho</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-semibold uppercase tracking-wide text-cream/60">Pagamento</h3>
            <ul className="space-y-2 text-cream/80">
              <li>PIX via InvictusPay</li>
              <li>Confirmação automática</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="hairline border-cream/10 px-5 py-4 text-center text-xs text-cream/50 sm:px-8">
        © {new Date().getFullYear()} VesteLula. Produto não oficial, feito por fãs.
      </div>
    </footer>
  );
}
