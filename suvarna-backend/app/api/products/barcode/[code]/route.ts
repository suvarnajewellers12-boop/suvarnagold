import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bwipjs from "bwip-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ✅ Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,     
    headers: corsHeaders,
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    // 🔥 FIX: await params
    const { code } = await context.params;

    if (!code) {
      return NextResponse.json(
        { error: "Invalid barcode" },
        { status: 400, headers: corsHeaders }
      );
    }

    const product = await prisma.product.findUnique({
      where: { uniqueCode: code },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // 🔥 Generate Barcode (Code128)
   const png = await bwipjs.toBuffer({
    bcid: "code128",

    text: text,

    scale: 3,          // 🔥 Increase width resolution
    height: 18,        // 🔥 Proper scan height
    includetext: true,
    textxalign: "center",

    paddingwidth: 30,  // 🔥 Critical quiet zone
    paddingheight: 20,

    backgroundcolor: "FFFFFF",
  });


    const barcodeImage = `data:image/png;base64,${barcodeBuffer.toString("base64")}`;

    return NextResponse.json(
      {
        barcodeImage,
        productId: product.id,
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("Barcode generation error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
