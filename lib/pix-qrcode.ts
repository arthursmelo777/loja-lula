import "server-only";
import QRCode from "qrcode";

/**
 * Muitas processadoras devolvem só o código "copia e cola" (o payload EMV) e
 * nenhuma imagem pronta do QR Code. Geramos a imagem aqui a partir desse texto,
 * sob demanda, ao renderizar a tela de pagamento — assim a loja não depende de
 * a processadora mandar figura.
 */
export async function generatePixQrCodeImage(pixCode: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(pixCode, { margin: 1, width: 512 });
  } catch (err) {
    console.error("Falha ao gerar imagem do QR Code PIX:", err);
    return null;
  }
}
