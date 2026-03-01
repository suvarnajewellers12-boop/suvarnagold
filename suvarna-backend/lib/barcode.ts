import bwipjs from "bwip-js";

export const generateBarcode = async (text: string) => {
  const png = await bwipjs.toBuffer({
    bcid: "code128", // barcode type
    text: text,      // uniqueCode
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: "center",
  });

  return `data:image/png;base64,${png.toString("base64")}`;
};