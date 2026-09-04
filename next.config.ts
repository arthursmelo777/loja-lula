import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF primeiro (melhor compressão em qualidade equivalente), com fallback para WebP.
    formats: ["image/avif", "image/webp"],
    // A partir do Next 16 o allowlist de qualidades passou a ser obrigatório
    // (default mudou para [75]). Precisamos de 90 para fotos de produto nítidas.
    qualities: [75, 90, 100],
  },
};

export default nextConfig;
