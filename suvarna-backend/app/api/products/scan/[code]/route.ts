import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedOrigin = "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ✅ Preflight handler
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
      { error: "Not found" },
      { status: 404, headers: corsHeaders }
    );
  }

  if (product.isSold) {
    return NextResponse.json(
      { error: "Already sold" },
      { status: 400, headers: corsHeaders }
    );
  }

  return NextResponse.json(product, {
    headers: corsHeaders,
  });
}
