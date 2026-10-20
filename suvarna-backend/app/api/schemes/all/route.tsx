import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================
// CORS
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
  };
}

// ============================================================
// PREFLIGHT
// ============================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ============================================================
// NORMALIZE RATE TYPE
// ============================================================

function normalizeRateType(
  rateType: string | null | undefined,
  isWeightBased: boolean
) {
  const raw =
    String(rateType ?? "")
      .trim()
      .toUpperCase();

  if (
    raw === "GOLD_22K" ||
    raw === "GOLD_18K" ||
    raw === "SILVER"
  ) {
    return raw;
  }

  // ==========================================================
  // LEGACY SUPPORT
  //
  // Old schemes may have:
  //
  // isWeightBased = true
  // rateType = CASH
  //
  // Previously weight-based meant 22K gold,
  // so expose those as GOLD_22K.
  // ==========================================================

  if (isWeightBased) {
    return "GOLD_22K";
  }

  return "CASH";
}

// ============================================================
// GET ALL SCHEMES
// ============================================================

export async function GET(req: Request) {
  try {
    const schemes =
      await prisma.scheme.findMany({
        include: {
          enrollments: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  phone: true,
                },
              },

              coupon: true,

              // Useful for Super Admin / admin details
              installments: {
                orderBy: {
                  installmentNumber: "asc",
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    // ==========================================================
    // NORMALIZE SCHEME DATA
    // ==========================================================

    const normalizedSchemes =
      schemes.map((scheme) => {
        const normalizedRateType =
          normalizeRateType(
            scheme.rateType,
            scheme.isWeightBased
          );

        return {
          ...scheme,

          rateType:
            normalizedRateType,

          // Keep this consistent with rateType.
          isWeightBased:
            normalizedRateType !==
            "CASH",
        };
      });

    return NextResponse.json(
      {
        success: true,
        count:
          normalizedSchemes.length,
        schemes:
          normalizedSchemes,
      },
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (error: any) {
    console.error(
      "[FETCH SCHEMES ERROR]",
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