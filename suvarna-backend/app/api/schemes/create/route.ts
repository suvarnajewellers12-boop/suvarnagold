import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// ============================================================
// CORS
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
  };
}

// ============================================================
// OPTIONS
// ============================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ============================================================
// VALID RATE TYPES
// ============================================================

const VALID_RATE_TYPES = [
  "CASH",
  "GOLD_22K",
  "GOLD_18K",
  "SILVER",
] as const;

type SchemeRateType =
  (typeof VALID_RATE_TYPES)[number];

// ============================================================
// POST - CREATE SCHEME
// ============================================================

export async function POST(req: Request) {
  try {
    // ==========================================================
    // 1. AUTHENTICATION
    // ==========================================================

    const authHeader =
      req.headers.get("authorization");

    const token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
          headers: corsHeaders(),
        }
      );
    }

    const decoded: any =
      verifyToken(token);

    if (
      !decoded ||
      (
        decoded.role !== "ADMIN" &&
        decoded.role !== "SUPER_ADMIN"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        {
          status: 403,
          headers: corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 2. REQUEST BODY
    // ==========================================================

    const body =
      await req.json();

    const {
      name,
      durationMonths,

      // --------------------------------------------------------
      // Kept because Scheme model still contains monthlyAmount.
      //
      // Customer actual installment is selected separately
      // during enrollment and stored in:
      //
      // CustomerScheme.installmentAmount
      // --------------------------------------------------------
      monthlyAmount,

      // CASH scheme benefit / maturity months
      maturityMonths,

      // NEW
      //
      // CASH
      // GOLD_22K
      // GOLD_18K
      // SILVER
      rateType,
    } = body;

    // ==========================================================
    // 3. BASIC VALIDATION
    // ==========================================================

    const cleanName =
      String(name ?? "").trim();

    if (!cleanName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Scheme name is required.",
        },
        {
          status: 400,
          headers: corsHeaders(),
        }
      );
    }

    // ==========================================================
    // DURATION
    // ==========================================================

    const tenure =
      Number(durationMonths);

    if (
      !Number.isInteger(tenure) ||
      tenure <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "durationMonths must be a positive whole number.",
        },
        {
          status: 400,
          headers: corsHeaders(),
        }
      );
    }

    // ==========================================================
    // RATE TYPE
    // ==========================================================

    const normalizedRateType =
      String(
        rateType ?? ""
      )
        .trim()
        .toUpperCase() as SchemeRateType;

    if (
      !VALID_RATE_TYPES.includes(
        normalizedRateType
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Invalid rateType.",

          allowedRateTypes:
            VALID_RATE_TYPES,
        },
        {
          status: 400,
          headers: corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 4. DERIVE WEIGHT-BASED STATUS
    //
    // Do NOT allow frontend to control this independently.
    // ==========================================================

    const isWeightBased =
      normalizedRateType ===
        "GOLD_22K" ||
      normalizedRateType ===
        "GOLD_18K" ||
      normalizedRateType ===
        "SILVER";

    // ==========================================================
    // 5. MONTHLY AMOUNT
    //
    // Scheme.monthlyAmount is now effectively legacy/template
    // information because the customer selects their actual
    // installment amount during enrollment.
    //
    // Keep a valid value because your Prisma model still has
    // monthlyAmount as required.
    // ==========================================================

    let monthly =
      Number(monthlyAmount);

    if (
      !Number.isFinite(monthly) ||
      monthly < 0
    ) {
      monthly = 0;
    }

    // ==========================================================
    // 6. MATURITY / BENEFIT MONTHS
    // ==========================================================

    let normalizedMaturityMonths:
        number | null =
      null;

    // ----------------------------------------------------------
    // CASH SCHEME
    //
    // Maturity months can be used as the benefit period.
    // ----------------------------------------------------------

    if (
      normalizedRateType ===
      "CASH"
    ) {
      if (
        maturityMonths ===
          undefined ||
        maturityMonths ===
          null ||
        maturityMonths ===
          ""
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "maturityMonths is required for CASH schemes.",
          },
          {
            status: 400,
            headers:
              corsHeaders(),
          }
        );
      }

      const maturity =
        Number(
          maturityMonths
        );

      if (
        !Number.isInteger(
          maturity
        ) ||
        maturity < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "maturityMonths must be zero or a positive whole number.",
          },
          {
            status: 400,
            headers:
              corsHeaders(),
          }
        );
      }

      normalizedMaturityMonths =
        maturity;
    }

    // ----------------------------------------------------------
    // GOLD / SILVER
    //
    // Weight-locking schemes don't need cash maturity months.
    // ----------------------------------------------------------

    else {
      normalizedMaturityMonths =
        null;
    }

    // ==========================================================
    // 7. CREATE DATABASE DATA
    // ==========================================================

    const schemeData = {
      name:
        cleanName,

      durationMonths:
        tenure,

      monthlyAmount:
        monthly,

      rateType:
        normalizedRateType,

      isWeightBased,

      maturityMonths:
        normalizedMaturityMonths,
    };

    // ==========================================================
    // 8. CREATE SCHEME
    // ==========================================================

    const scheme =
      await prisma.scheme.create({
        data: schemeData,
      });

    // ==========================================================
    // 9. RESPONSE
    // ==========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          `${getRateTypeLabel(
            normalizedRateType
          )} scheme created successfully.`,

        scheme,

        configuration: {
          rateType:
            normalizedRateType,

          isWeightBased,

          lockingRate:
            normalizedRateType ===
            "CASH"
              ? null
              : "LIVE_RATE_AT_PAYMENT_TIME",
        },
      },
      {
        status: 201,
        headers: corsHeaders(),
      }
    );
  } catch (error: any) {
    console.error(
      "[CREATE SCHEME ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Internal Server Error",
      },
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}

// ============================================================
// DISPLAY LABEL
// ============================================================

function getRateTypeLabel(
  rateType: SchemeRateType
) {
  switch (rateType) {
    case "GOLD_22K":
      return "22K Gold Locking";

    case "GOLD_18K":
      return "18K Gold Locking";

    case "SILVER":
      return "Silver Locking";

    case "CASH":
      return "Cash";

    default:
      return "Scheme";
  }
}