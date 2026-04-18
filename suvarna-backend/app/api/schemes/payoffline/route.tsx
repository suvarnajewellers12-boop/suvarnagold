export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 🔹 Accept manual goldRate from the frontend body
    const { customerSchemeId, goldRate } = body; 

    if (!customerSchemeId) {
      return NextResponse.json({ error: "customerSchemeId is required" }, { status: 400, headers: corsHeaders() });
    }

    // 1. Fetch Enrollment (Lean fetch)
    const cs = await prisma.customerScheme.findUnique({
      where: { id: customerSchemeId },
      include: { scheme: true }
    });

    if (!cs) return NextResponse.json({ error: "Enrollment not found" }, { status: 404, headers: corsHeaders() });
    if (cs.isCompleted) return NextResponse.json({ error: "Scheme already completed" }, { status: 400, headers: corsHeaders() });

    // 2. Gram Calculation Logic
    let gramsAdded = 0;
    let liveRateUsed = 0;

    if (cs.scheme.isWeightBased) {
      // Use the rate from the body, or fallback to 0 if not provided
      liveRateUsed = goldRate ? parseFloat(String(goldRate).replace(/[^0-9.]/g, "")) : 0;
      
      if (liveRateUsed <= 0) {
        return NextResponse.json({ error: "Valid Gold Rate is required for weight-based schemes" }, { status: 400, headers: corsHeaders() });
      }
      
      gramsAdded = cs.scheme.monthlyAmount / liveRateUsed;
    }

    // 3. Execution via Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      const isLast = cs.installmentsLeft === 1;

      // A. Update Progress
      const updated = await tx.customerScheme.update({
        where: { id: customerSchemeId },
        data: {
          totalPaid: { increment: cs.scheme.monthlyAmount },
          installmentsPaid: { increment: 1 },
          installmentsLeft: { decrement: 1 },
          remainingAmount: { decrement: cs.scheme.monthlyAmount },
          accumulatedGrams: { increment: gramsAdded },
          isCompleted: isLast
        }
      });

      // B. Create History
      await tx.paymentHistory.create({
        data: {
          id: crypto.randomUUID(),
          customerSchemeId: customerSchemeId,
          amountPaid: cs.scheme.monthlyAmount,
          gramsAdded: gramsAdded || null,
          liveRate24K: liveRateUsed || null,
        }
      });

      // C. Sync Coupon (Upsert)
      await tx.coupon.upsert({
        where: { customerSchemeId },
        update: {
          totalWeightGrams: { increment: gramsAdded },
          isActive: isLast
        },
        create: {
          id: crypto.randomUUID(),
          code: `SUV-${cs.scheme.isWeightBased ? 'W' : 'V'}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          customerId: cs.customerId,
          schemeId: cs.schemeId,
          customerSchemeId,
          totalCashValue: !cs.scheme.isWeightBased ? (cs.scheme.durationMonths + (cs.scheme.maturityMonths || 0)) * cs.scheme.monthlyAmount : 0,
          totalWeightGrams: gramsAdded,
          isActive: isLast
        }
      });

      return updated;
    }, {
      timeout: 10000 // 10 second safety limit
    });

    return NextResponse.json({ 
      status: "Success", 
      message: "Installment recorded successfully",
      data: result 
    }, { status: 200, headers: corsHeaders() });

  } catch (error: any) {
    console.error("Manual Payment Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: corsHeaders() });
  }
}