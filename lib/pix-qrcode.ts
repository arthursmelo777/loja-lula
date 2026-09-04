import "server-only";
import QRCode from "qrcode";

/**
 * A InvictusPay não devolve uma imagem pronta do QR Code (os campos
 * `pix.qr_code_base64` e `pix.pix_url` vêm sempre `null` nas respostas reais)
 * — só o código "copia e cola" (`pix.pix_qr_code`). Geramos a imagem aqui a
 * partir desse texto, sob demanda, ao renderizar a tela de pagamento.
 */
export async function generatePixQrCodeImage(pixCode: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(pixCode, { margin: 1, width: 512 });
  } catch (err) {
    console.error("Falha ao gerar imagem do QR Code PIX:", err);
    return null;
  }
}
