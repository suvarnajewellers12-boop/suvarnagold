export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { verifyToken } from "@/lib/auth";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const body = await req.json();
    const { schemeId,customerId } = body;

    // const authHeader = req.headers.get("Authorization");
    // const token = authHeader?.split(" ")[1];
    // if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });

    // const decoded: any = verifyToken(token);
    // const currentUserId = decoded?.userId || decoded?.id;

    // 1. Fetch Scheme & Enrollment
    const [scheme, existingEnrollment] = await Promise.all([
      prisma.scheme.findUnique({ where: { id: schemeId } }),
      prisma.customerScheme.findFirst({
        where: { customerId: customerId, schemeId },
        include: { coupon: true }
      }),
    ]);

    if (!scheme) return NextResponse.json({ message: "Scheme not found" }, { status: 404, headers: corsHeaders(origin) });

    // 2. Lifecycle Check
    if (existingEnrollment && existingEnrollment.isCompleted) {
      return NextResponse.json({ message: "Scheme already completed." }, { status: 400, headers: corsHeaders(origin) });
    }
    
    if (existingEnrollment && existingEnrollment.installmentsLeft <= 0) {
       return NextResponse.json({ message: "No installments left to pay." }, { status: 400, headers: corsHeaders(origin) });
    }

    // 3. Gold Logic (Category-B)
    let liveRate = 0;
    let gramsEarned = 0;
    if (scheme.isWeightBased) {
      const rateRes = await fetch("https://suvarnagold-16e5.vercel.app/api/rates", { cache: 'no-store' });
      const rateData = await rateRes.json();
      liveRate = parseFloat(rateData.gold24.replace(/[^0-9.]/g, ""));
      gramsEarned = scheme.monthlyAmount / liveRate;
    }

    // 4. Transaction
    const result = await prisma.$transaction(async (tx) => {
      
      // CASE A: UPDATE EXISTING (Created by Admin OR previous payment)
      if (existingEnrollment) {
        const isLastPayment = existingEnrollment.installmentsLeft === 1;

        const updated = await tx.customerScheme.update({
          where: { id: existingEnrollment.id },
          data: {
            totalPaid: { increment: scheme.monthlyAmount },
            installmentsPaid: { increment: 1 },
            installmentsLeft: { decrement: 1 },
            accumulatedGrams: { increment: gramsEarned },
            remainingAmount: { decrement: scheme.monthlyAmount },
            isCompleted: isLastPayment,
          },
          include: { coupon: true }
        });

        // Ensure Coupon exists
        if (!existingEnrollment.coupon) {
          const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
          const newCoupon = await tx.coupon.create({
            data: {
              id: crypto.randomUUID(),
              code: `SUV-${scheme.isWeightBased ? 'W' : 'V'}-${uniqueSuffix}`,
              customerId: customerId,
              schemeId,
              customerSchemeId: existingEnrollment.id,
              totalCashValue: !scheme.isWeightBased ? (scheme.durationMonths + (scheme.maturityMonths || 0)) * scheme.monthlyAmount : 0,
              totalWeightGrams: gramsEarned,
              isActive: isLastPayment,
            },
          });
          return { type: "FIRST_PAYMENT_PROCESSED", data: { ...updated, coupon: newCoupon } };
        } else {
          const updatedCoupon = await tx.coupon.update({
            where: { customerSchemeId: existingEnrollment.id },
            data: {
              totalWeightGrams: { increment: gramsEarned },
              isActive: isLastPayment,
            },
          });
          return { type: "INSTALLMENT_PROCESSED", data: { ...updated, coupon: updatedCoupon } };
        }
      }

      // CASE B: COMPLETELY NEW ENROLLMENT
      const newCS = await tx.customerScheme.create({
        data: {
          id: crypto.randomUUID(),
          customerId: customerId,
          schemeId,
          totalPaid: scheme.monthlyAmount,
          remainingAmount: (scheme.durationMonths - 1) * scheme.monthlyAmount,
          installmentsPaid: 1,
          installmentsLeft: scheme.durationMonths - 1,
          accumulatedGrams: gramsEarned,
          isCompleted: false,
        },
      });

      const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const newCoupon = await tx.coupon.create({
        data: {
          id: crypto.randomUUID(),
          code: `SUV-${scheme.isWeightBased ? 'W' : 'V'}-${uniqueSuffix}`,
          customerId: customerId,
          schemeId,
          customerSchemeId: newCS.id,
          totalCashValue: !scheme.isWeightBased ? (scheme.durationMonths + (scheme.maturityMonths || 0)) * scheme.monthlyAmount : 0,
          totalWeightGrams: gramsEarned,
          isActive: false,
        },
      });

      return { type: "NEW_ENROLLMENT_STARTED", data: { ...newCS, coupon: newCoupon } };
    });

    // 5. Audit History (Outside transaction to prevent locking, or inside if strictness required)
    await prisma.paymentHistory.create({
      data: {
        id: crypto.randomUUID(),
        customerSchemeId: result.data.id,
        amountPaid: scheme.monthlyAmount,
        liveRate24K: scheme.isWeightBased ? liveRate : null,
        gramsAdded: scheme.isWeightBased ? gramsEarned : null,
      },
    });

    return NextResponse.json({
      status: "Success",
      action: result.type,
      summary: {
        transactionGrams: gramsEarned.toFixed(4),
        marketRateUsed: liveRate,
        totalVaultBalance: result.data.accumulatedGrams.toFixed(4),
      },
      enrollment: result.data,
    }, { status: 200, headers: corsHeaders(origin) });

  } catch (error: any) {
    console.error("Enrollment Error:", error);
    return NextResponse.json({ message: error.message }, { status: 500, headers: corsHeaders(origin) });
  }
}