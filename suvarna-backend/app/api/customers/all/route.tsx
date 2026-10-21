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
      "GET, OPTIONS",
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
// RATE TYPE NORMALIZER
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

  // Legacy weighted schemes
  if (isWeightBased) {
    return "GOLD_22K";
  }

  return "CASH";
}

// ============================================================
// GET ALL CUSTOMERS
// ============================================================

export async function GET(req: Request) {
  try {
    // ==========================================================
    // AUTH
    // ==========================================================

    const authHeader =
      req.headers.get(
        "authorization"
      );

    const token =
      authHeader?.startsWith(
        "Bearer "
      )
        ? authHeader.split(
            " "
          )[1]
        : null;

    if (!token) {
      return NextResponse.json(
        {
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

    if (!decoded) {
      return NextResponse.json(
        {
          error: "Invalid Token",
        },
        {
          status: 401,
          headers: corsHeaders(),
        }
      );
    }

    if (
      decoded.role !== "ADMIN" &&
      decoded.role !==
        "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        {
          error: "Forbidden",
        },
        {
          status: 403,
          headers: corsHeaders(),
        }
      );
    }

    // ==========================================================
    // FETCH CUSTOMERS
    // ==========================================================

    const customers =
      await prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          username: true,
          phone: true,
          createdAt: true,

          schemes: {
            include: {
              scheme: true,

              coupon: true,

              installments: {
                orderBy: {
                  installmentNumber:
                    "asc",
                },
              },

              payments: {
                orderBy: {
                  paidAt: "desc",
                },
                take: 10,
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    // ==========================================================
    // NORMALIZE SCHEME TYPE
    // ==========================================================

    const normalizedCustomers =
      customers.map(
        (customer) => ({
          ...customer,

          schemes:
            customer.schemes.map(
              (customerScheme) => {
                const rateType =
                  normalizeRateType(
                    customerScheme
                      .scheme
                      .rateType,
                    customerScheme
                      .scheme
                      .isWeightBased
                  );

                return {
                  ...customerScheme,

                  scheme: {
                    ...customerScheme.scheme,

                    rateType,

                    isWeightBased:
                      rateType !==
                      "CASH",
                  },
                };
              }
            ),
        })
      );

    return NextResponse.json(
      {
        customers:
          normalizedCustomers,
      },
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Fetch customers error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal Server Error",
      },
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}