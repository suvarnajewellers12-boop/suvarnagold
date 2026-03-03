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
    const { code } = await context.params;

    if (!code) {
      return NextResponse.json(
        { error: "Invalid SKU" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 🔥 Find by SKU (NOT uniqueCode anymore)
    const product = await prisma.product.findUnique({
      where: { sku: code },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // 🔥 Generate SCAN-OPTIMIZED Barcode using SKU
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: "code39",        // 🔥 Better for short SKU
      text: product.sku,     // 🔥 IMPORTANT: use SKU

      scale: 3,              // Medium size
      height: 20,            // Good scan height

      includetext: true,
      textxalign: "center",

      paddingwidth: 25,      // Quiet zone (VERY important)
      paddingheight: 15,

      backgroundcolor: "FFFFFF",
    });

    const barcodeImage = `data:image/png;base64,${barcodeBuffer.toString("base64")}`;

    return NextResponse.json(
      {
        barcodeImage,
        productId: product.id,
        sku: product.sku,
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