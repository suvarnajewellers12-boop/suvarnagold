import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
 req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        schemes: {
          include: {
            scheme: true,   // Get monthly amount, duration, etc.
            coupon: true,   // Get the SUV code and grams
            payments: {     // Optional: Get the payment history list
                orderBy: { paidAt: 'desc' },
                take: 10
            }
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Remove password before sending to frontend
    const { password, ...safeCustomerData } = customer;

    return NextResponse.json(
      { customer: safeCustomerData },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Fetch single customer error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}