import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

const allowedOrigin = "http://localhost:8080";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
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
  // 🔥 FIX: await params
  const { code } = await context.params;

  if (!code) {
    return NextResponse.json(
      { error: "Invalid QR code" },
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

  const scanURL = `http://localhost:3000/api/products/scan/${code}`;
  const qrImage = await QRCode.toDataURL(scanURL);

  return NextResponse.json(
    {
      qrImage,
      productId: product.id,
    },
    { headers: corsHeaders }
  );
}
