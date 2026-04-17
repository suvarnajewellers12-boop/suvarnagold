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
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {
    // 🔐 Optional: Uncomment for production security
    // const authHeader = req.headers.get("authorization");
    // const token = authHeader?.split(" ")[1];
    // const decoded: any = verifyToken(token || "");
    // if (!decoded) return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });

    const body = await req.json();
    const { customerId, schemeId } = body;

    if (!customerId || !schemeId) {
      return new NextResponse(JSON.stringify({ error: "Customer ID and Scheme ID are required" }), { status: 400, headers: corsHeaders() });
    }

    // 1. Fetch Scheme & Check for ANY existing enrollment (Active or Completed)
    const [scheme, existingEnrollment] = await Promise.all([
      prisma.scheme.findUnique({ where: { id: schemeId } }),
      prisma.customerScheme.findFirst({ 
        where: { customerId, schemeId },
        include: { coupon: true }
      })
    ]);

    if (!scheme) {
      return new NextResponse(JSON.stringify({ error: "Scheme not found" }), { status: 404, headers: corsHeaders() });
    }

    // ================= BLOCKING LOGIC =================
    if (existingEnrollment) {
      // BLOCK 1: If the user already finished this specific scheme in the past
      if (existingEnrollment.isCompleted) {
        return new NextResponse(
          JSON.stringify({ error: "Lifecycle Conflict: You have already completed this scheme and cannot re-enroll." }), 
          { status: 400, headers: corsHeaders() }
        );
      }

      // BLOCK 2: If they are active but out of installments
      if (existingEnrollment.installmentsLeft <= 0) {
        return new NextResponse(
          JSON.stringify({ error: "Limit Reached: All installments for this scheme are already paid." }), 
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    // 2. Fetch Live 24K Rate (Crucial for Category-B)
    let liveRate = 0;
    let gramsEarned = 0;
    if (scheme.isWeightBased) {
      const rateRes = await fetch("https://suvarnagold-16e5.vercel.app/api/rates");
      const rateData = await rateRes.json();
      // Parse "₹15,557" -> 15557
      liveRate = parseFloat(rateData.gold24.replace(/[^\d.]/g, ''));
      gramsEarned = scheme.monthlyAmount / liveRate;
    }

    // ================= TRANSACTION LOGIC =================
    const result = await prisma.$transaction(async (tx) => {
      
      // CASE A: INSTALLMENT PAYMENT (User is already enrolled and active)
      if (existingEnrollment) {
        const isLastPayment = existingEnrollment.installmentsLeft === 1;

        const updatedEnrollment = await tx.customerScheme.update({
          where: { id: existingEnrollment.id },
          data: {
            totalPaid: { increment: scheme.monthlyAmount },
            installmentsPaid: { increment: 1 },
            installmentsLeft: { decrement: 1 },
            accumulatedGrams: { increment: gramsEarned },
            remainingAmount: { decrement: scheme.monthlyAmount },
            isCompleted: isLastPayment 
          }
        });

        // Sync the Live Coupon
        await tx.coupon.update({
          where: { customerSchemeId: existingEnrollment.id },
          data: { 
            totalWeightGrams: { increment: gramsEarned },
            isActive: isLastPayment // Coupon activates only on last payment
          }
        });

        // Audit Log
        await tx.paymentHistory.create({
          data: {
            customerSchemeId: existingEnrollment.id,
            amountPaid: scheme.monthlyAmount,
            liveRate24K: scheme.isWeightBased ? liveRate : null,
            gramsAdded: scheme.isWeightBased ? gramsEarned : null,
          }
        });

        return { type: "INSTALLMENT_PROCESSED", data: updatedEnrollment };
      }

      // CASE B: NEW ENROLLMENT (First Payment Included)
      const newEnrollment = await tx.customerScheme.create({
        data: {
          customerId,
          schemeId,
          totalPaid: scheme.monthlyAmount,
          installmentsPaid: 1,
          installmentsLeft: scheme.durationMonths - 1,
          remainingAmount: (scheme.durationMonths - 1) * scheme.monthlyAmount,
          accumulatedGrams: gramsEarned,
          isCompleted: false
        },
      });

      // Generate Unique Secure Coupon
      const couponCode = `SUV-${scheme.isWeightBased ? 'W' : 'V'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      await tx.coupon.create({
        data: {
          code: couponCode,
          customerId,
          schemeId,
          customerSchemeId: newEnrollment.id,
          // Cat-A: Full Bonus Value | Cat-B: Current Grams
          totalCashValue: !scheme.isWeightBased ? (scheme.durationMonths + (scheme.maturityMonths || 0)) * scheme.monthlyAmount : 0,
          totalWeightGrams: gramsEarned,
          isActive: false
        }
      });

      await tx.paymentHistory.create({
        data: {
          customerSchemeId: newEnrollment.id,
          amountPaid: scheme.monthlyAmount,
          liveRate24K: scheme.isWeightBased ? liveRate : null,
          gramsAdded: scheme.isWeightBased ? gramsEarned : null,
        }
      });

      return { type: "NEW_ENROLLMENT_STARTED", data: newEnrollment };
    });

    return new NextResponse(
      JSON.stringify({
        status: "Success",
        action: result.type,
        summary: {
          transactionGrams: gramsEarned.toFixed(4),
          marketRateUsed: liveRate,
          totalVaultBalance: result.data.accumulatedGrams.toFixed(4),
          installmentsLeft: result.data.installmentsLeft
        },
        enrollment: result.data
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("Critical Processing Error:", error);
    return new NextResponse(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500, headers: corsHeaders() });
  }
}