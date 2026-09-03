"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h2l2.2 10.2a2 2 0 0 0 2 1.6h6.6a2 2 0 0 0 2-1.6L20.5 9H7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20.5" r="1.4" fill="currentColor" />
      <circle cx="17" cy="20.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/#camisetas", label: "Camisetas" },
  { href: "/#bones", label: "Bonés" },
];

export function Header() {
  const { totalItems, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur hairline">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="font-display text-2xl tracking-tight sm:text-3xl">
          VESTE<span className="text-brand-red">LULA</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-brand-red transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Carrinho, ${totalItems} ${totalItems === 1 ? "item" : "itens"}`}
            className="relative flex h-11 w-11 items-center justify-center border border-ink"
          >
            <CartIcon />
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-brand-red px-1 text-xs font-semibold text-white">
                {totalItems}
              </span>
            )}
          </button>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center border border-ink sm:hidden"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-cream h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 hairline">
              <span className="font-display text-2xl tracking-tight">MENU</span>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center border border-ink"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 5L19 19M5 19L19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-4 px-5 py-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-lg font-medium tracking-wide transition-colors hover:text-brand-red"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
