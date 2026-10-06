export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ------------------------------------------------------------
// ENROLL / PAY INSTALLMENT
// ------------------------------------------------------------
export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const body = await req.json();

    const {
      schemeId,
      customerId,

      // Customer-selected amount from dropdown.
      // Supporting both names makes frontend integration easier.
      amount,
      selectedAmount,
    } = body;

    // --------------------------------------------------------
    // 1. BASIC VALIDATION
    // --------------------------------------------------------

    if (!schemeId) {
      return NextResponse.json(
        {
          message: "schemeId is required.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        {
          message: "customerId is required.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    const requestedAmountRaw = amount ?? selectedAmount;

    // --------------------------------------------------------
    // 2. FETCH SCHEME + EXISTING ENROLLMENT
    // --------------------------------------------------------

    const [scheme, existingEnrollment] = await Promise.all([
      prisma.scheme.findUnique({
        where: {
          id: schemeId,
        },
      }),

      prisma.customerScheme.findFirst({
        where: {
          customerId,
          schemeId,
        },
        include: {
          coupon: true,
        },
      }),
    ]);

    if (!scheme) {
      return NextResponse.json(
        {
          message: "Scheme not found.",
        },
        {
          status: 404,
          headers: corsHeaders(origin),
        }
      );
    }

    // --------------------------------------------------------
    // 3. CHECK ENROLLMENT LIFECYCLE
    // --------------------------------------------------------

    if (existingEnrollment?.isCompleted) {
      return NextResponse.json(
        {
          message: "Scheme already completed.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      existingEnrollment &&
      existingEnrollment.installmentsLeft <= 0
    ) {
      return NextResponse.json(
        {
          message: "No installments left to pay.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // --------------------------------------------------------
    // 4. DETERMINE INSTALLMENT AMOUNT
    // --------------------------------------------------------
    //
    // FIRST PAYMENT:
    // Customer must send an amount.
    //
    // FUTURE PAYMENTS:
    // Stored installmentAmount is always used.
    //
    // This prevents customers from enrolling with ₹5000
    // and later changing request amount to ₹1000.
    // --------------------------------------------------------

    let installmentAmount: number;

    if (existingEnrollment) {
      installmentAmount = Number(
        existingEnrollment.installmentAmount
      );

      if (
        !Number.isFinite(installmentAmount) ||
        installmentAmount <= 0
      ) {
        return NextResponse.json(
          {
            message:
              "Invalid installment amount stored for this enrollment.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      /*
       * Optional validation:
       *
       * If frontend still sends amount during later payments,
       * make sure it matches the originally selected amount.
       */
      if (
        requestedAmountRaw !== undefined &&
        requestedAmountRaw !== null
      ) {
        const requestedAmount = Number(requestedAmountRaw);

        if (
          Number.isFinite(requestedAmount) &&
          Math.abs(requestedAmount - installmentAmount) > 0.01
        ) {
          return NextResponse.json(
            {
              message:
                "Installment amount cannot be changed after enrollment.",
              selectedInstallmentAmount: installmentAmount,
            },
            {
              status: 400,
              headers: corsHeaders(origin),
            }
          );
        }
      }
    } else {
      // First payment / new enrollment
      if (
        requestedAmountRaw === undefined ||
        requestedAmountRaw === null ||
        requestedAmountRaw === ""
      ) {
        return NextResponse.json(
          {
            message:
              "Please select an installment amount before enrolling.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      installmentAmount = Number(requestedAmountRaw);

      if (
        !Number.isFinite(installmentAmount) ||
        installmentAmount <= 0
      ) {
        return NextResponse.json(
          {
            message:
              "Selected installment amount must be greater than 0.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }
    }

    // Keep money to 2 decimal places.
    installmentAmount =
      Math.round((installmentAmount + Number.EPSILON) * 100) / 100;

    // --------------------------------------------------------
    // 5. GOLD / WEIGHT BASED SCHEME
    // --------------------------------------------------------

    let liveRate = 0;
    let gramsEarned = 0;

    if (scheme.isWeightBased) {
      const rateRes = await fetch(
        "https://suvarnagold-16e5.vercel.app/api/rates",
        {
          cache: "no-store",
        }
      );

      if (!rateRes.ok) {
        throw new Error(
          `Unable to fetch live gold rate. Status: ${rateRes.status}`
        );
      }

      const rateData = await rateRes.json();

      if (!rateData?.gold22) {
        throw new Error(
          "22K gold rate is unavailable from the rates API."
        );
      }

      liveRate = parseFloat(
        String(rateData.gold22).replace(/[^0-9.]/g, "")
      );

      if (!Number.isFinite(liveRate) || liveRate <= 0) {
        throw new Error("Invalid 22K gold rate received.");
      }

      // IMPORTANT:
      // Customer selected amount is used here.
      gramsEarned = installmentAmount / liveRate;
    }

    // --------------------------------------------------------
    // 6. DATABASE TRANSACTION
    // --------------------------------------------------------

    const result = await prisma.$transaction(async (tx) => {
      // ======================================================
      // CASE A:
      // CUSTOMER IS ALREADY ENROLLED
      // ======================================================

      if (existingEnrollment) {
        const isLastPayment =
          existingEnrollment.installmentsLeft === 1;

        const newRemainingAmount = Math.max(
          0,
          Number(existingEnrollment.remainingAmount) -
            installmentAmount
        );

        const updated = await tx.customerScheme.update({
          where: {
            id: existingEnrollment.id,
          },
          data: {
            totalPaid: {
              increment: installmentAmount,
            },

            installmentsPaid: {
              increment: 1,
            },

            installmentsLeft: {
              decrement: 1,
            },

            accumulatedGrams: {
              increment: gramsEarned,
            },

            remainingAmount: newRemainingAmount,

            isCompleted: isLastPayment,
          },
          include: {
            coupon: true,
          },
        });

        let coupon;

        // ----------------------------------------------------
        // Coupon doesn't exist
        // ----------------------------------------------------

        if (!existingEnrollment.coupon) {
          const uniqueSuffix = crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase();

          coupon = await tx.coupon.create({
            data: {
              id: crypto.randomUUID(),

              code: `SUV-${
                scheme.isWeightBased ? "W" : "V"
              }-${uniqueSuffix}`,

              customerId,
              schemeId,

              customerSchemeId: existingEnrollment.id,

              // VALUE BASED SCHEME
              //
              // Example:
              // selected amount = ₹5000
              // duration = 11 months
              // maturity benefit = 1 month
              //
              // coupon value =
              // ₹5000 × 12 = ₹60,000
              totalCashValue: !scheme.isWeightBased
                ? (scheme.durationMonths +
                    (scheme.maturityMonths || 0)) *
                  installmentAmount
                : 0,

              totalWeightGrams: scheme.isWeightBased
                ? gramsEarned
                : 0,

              isActive: isLastPayment,
            },
          });

          // Payment history is now inside the transaction
          await tx.paymentHistory.create({
            data: {
              id: crypto.randomUUID(),
              customerSchemeId: existingEnrollment.id,

              amountPaid: installmentAmount,

              liveRate22K: scheme.isWeightBased
                ? liveRate
                : null,

              gramsAdded: scheme.isWeightBased
                ? gramsEarned
                : null,
            },
          });

          return {
            type: "FIRST_PAYMENT_PROCESSED",

            data: {
              ...updated,
              coupon,
            },
          };
        }

        // ----------------------------------------------------
        // Existing coupon
        // ----------------------------------------------------

        coupon = await tx.coupon.update({
          where: {
            customerSchemeId: existingEnrollment.id,
          },
          data: {
            totalWeightGrams: scheme.isWeightBased
              ? {
                  increment: gramsEarned,
                }
              : undefined,

            isActive: isLastPayment,
          },
        });

        // ----------------------------------------------------
        // Payment History
        // ----------------------------------------------------

        await tx.paymentHistory.create({
          data: {
            id: crypto.randomUUID(),

            customerSchemeId: existingEnrollment.id,

            amountPaid: installmentAmount,

            liveRate22K: scheme.isWeightBased
              ? liveRate
              : null,

            gramsAdded: scheme.isWeightBased
              ? gramsEarned
              : null,
          },
        });

        return {
          type: "INSTALLMENT_PROCESSED",

          data: {
            ...updated,
            coupon,
          },
        };
      }

      // ======================================================
      // CASE B:
      // COMPLETELY NEW ENROLLMENT
      // ======================================================

      const installmentsLeft =
        scheme.durationMonths - 1;

      const isCompleted =
        installmentsLeft <= 0;

      // Remaining amount represents ONLY amounts customer
      // still needs to pay.
      //
      // Example:
      // ₹5000 selected × 11 months
      // first ₹5000 is paid now
      //
      // remaining = ₹50,000
      const remainingAmount =
        installmentsLeft * installmentAmount;

      const newCustomerScheme =
        await tx.customerScheme.create({
          data: {
            id: crypto.randomUUID(),

            customerId,

            schemeId,

            // Save selected amount permanently
            installmentAmount,

            totalPaid: installmentAmount,

            remainingAmount,

            installmentsPaid: 1,

            installmentsLeft,

            accumulatedGrams: gramsEarned,

            isCompleted,
          },
        });

      // ------------------------------------------------------
      // CREATE COUPON
      // ------------------------------------------------------

      const uniqueSuffix = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

      const newCoupon = await tx.coupon.create({
        data: {
          id: crypto.randomUUID(),

          code: `SUV-${
            scheme.isWeightBased ? "W" : "V"
          }-${uniqueSuffix}`,

          customerId,

          schemeId,

          customerSchemeId: newCustomerScheme.id,

          /*
           * VALUE BASED:
           *
           * Customer chooses ₹5000.
           *
           * durationMonths = 11
           * maturityMonths = 1
           *
           * ₹5000 × 12 = ₹60,000 coupon value.
           */
          totalCashValue: !scheme.isWeightBased
            ? (scheme.durationMonths +
                (scheme.maturityMonths || 0)) *
              installmentAmount
            : 0,

          // Only first payment grams initially.
          totalWeightGrams: scheme.isWeightBased
            ? gramsEarned
            : 0,

          isActive: isCompleted,
        },
      });

      // ------------------------------------------------------
      // PAYMENT HISTORY
      // ------------------------------------------------------

      await tx.paymentHistory.create({
        data: {
          id: crypto.randomUUID(),

          customerSchemeId: newCustomerScheme.id,

          amountPaid: installmentAmount,

          liveRate22K: scheme.isWeightBased
            ? liveRate
            : null,

          gramsAdded: scheme.isWeightBased
            ? gramsEarned
            : null,
        },
      });

      return {
        type: "NEW_ENROLLMENT_STARTED",

        data: {
          ...newCustomerScheme,
          coupon: newCoupon,
        },
      };
    });

    // --------------------------------------------------------
    // 7. RESPONSE
    // --------------------------------------------------------

    return NextResponse.json(
      {
        status: "Success",

        action: result.type,

        summary: {
          installmentAmount,

          transactionAmount: installmentAmount,

          transactionGrams: scheme.isWeightBased
            ? gramsEarned.toFixed(4)
            : "0.0000",

          marketRateUsed: scheme.isWeightBased
            ? liveRate
            : null,

          totalPaid: result.data.totalPaid,

          remainingAmount: result.data.remainingAmount,

          installmentsPaid:
            result.data.installmentsPaid,

          installmentsLeft:
            result.data.installmentsLeft,

          totalVaultBalance: Number(
            result.data.accumulatedGrams
          ).toFixed(4),
        },

        enrollment: result.data,
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error("Enrollment Error:", error);

    return NextResponse.json(
      {
        message:
          error?.message ||
          "Something went wrong while processing enrollment.",
      },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}