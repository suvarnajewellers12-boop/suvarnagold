import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });    }

    const body = await req.json();

    const purchase = await prisma.goldPurchase.create({
      data: {
        companyName: body.companyName,
        goldType: body.goldType,
        grams: body.grams,
        pricePerGram: body.pricePerGram,
        totalAmount: body.totalAmount,
        purchaseDate: new Date(body.purchaseDate),
        invoiceNumber: body.invoiceNumber,
        paymentMode: body.paymentMode,
        notes: body.notes,
        createdBy: decoded.id,
      },
    });

    return new NextResponse(
      JSON.stringify({ purchase }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {

    return new NextResponse(
      JSON.stringify({ error: "Failed to create purchase" }),
      { status: 500, headers: corsHeaders() }
    );

  }
}