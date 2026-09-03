import type { Metadata } from "next";
import "@fontsource/anton/400.css";
import "@fontsource-variable/inter";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { UtmCapture } from "@/components/UtmCapture";

export const metadata: Metadata = {
  title: "VesteLula — Camisetas e bonés exclusivos",
  description:
    "Camisetas e bonés exclusivos a partir de R$ 14,99. Pagamento via PIX com confirmação automática.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-cream text-ink">
        <CartProvider>
          <UtmCapture />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
