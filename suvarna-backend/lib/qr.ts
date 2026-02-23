import QRCode from "qrcode";

export const generateQRCode = async (code: string) => {
  return await QRCode.toDataURL(code);
};
   