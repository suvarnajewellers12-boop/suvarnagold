import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🔹 CORS Helper Function
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// 🔹 Handle Preflight (OPTIONS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ================= ASSIGN SCHEME API =================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customerId, schemeId } = body;

    if (!customerId || !schemeId) {
      return NextResponse.json(
        { error: "Missing customerId or schemeId" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // 1. Fetch Scheme details
    const scheme = await prisma.scheme.findUnique({ where: { id: schemeId } });
    if (!scheme) {
      return NextResponse.json(
        { error: "Scheme not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    // 2. Check for duplicate active enrollment
    const exists = await prisma.customerScheme.findFirst({
      where: { 
        customerId, 
        schemeId, 
        isCompleted: false 
      }
    });

    if (exists) {
      return NextResponse.json(
        { error: "Customer is already active in this scheme" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // 3. Calculation for Initialization
    const totalAmount = scheme.monthlyAmount * scheme.durationMonths;

    // 4. Create the Enrollment record
    const enrollment = await prisma.customerScheme.create({
      data: {
        customerId,
        schemeId,
        totalPaid: 0,
        installmentsPaid: 0,
        installmentsLeft: scheme.durationMonths,
        remainingAmount: totalAmount,
        accumulatedGrams: 0,
        isCompleted: false,
      },
    });

    return NextResponse.json(
      { message: "Scheme assigned successfully", enrollment },
      { status: 201, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("Assign Scheme Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}