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
// OPTIONS
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

  if (isWeightBased) {
    return "GOLD_22K";
  }

  return "CASH";
}

// ============================================================
// GET SINGLE CUSTOMER
// ============================================================

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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
          error:
            "Invalid Token",
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
    // CUSTOMER ID
    // ==========================================================

    const {
      id,
    } = await params;

    // ==========================================================
    // FETCH CUSTOMER
    // ==========================================================

    const customer =
      await prisma.customer.findUnique({
        where: {
          id,
        },

        include: {
          schemes: {
            include: {
              installments: {
                orderBy: {
                  installmentNumber:
                    "asc",
                },
              },

              scheme: true,

              coupon: true,

              payments: {
                orderBy: {
                  paidAt:
                    "desc",
                },
                take: 10,
              },
            },
          },
        },
      });

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "Customer not found",
        },
        {
          status: 404,
          headers: corsHeaders(),
        }
      );
    }

    // ==========================================================
    // REMOVE SENSITIVE DATA
    // ==========================================================

    const {
      password,
      mpin,
      ...safeCustomerData
    } = customer;

    // ==========================================================
    // NORMALIZE SCHEMES
    // ==========================================================

    const normalizedCustomer = {
      ...safeCustomerData,

      schemes:
        safeCustomerData
          .schemes
          .map(
            (
              customerScheme
            ) => {
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
                  ...customerScheme
                    .scheme,

                  rateType,

                  isWeightBased:
                    rateType !==
                    "CASH",
                },
              };
            }
          ),
    };

    return NextResponse.json(
      {
        customer:
          normalizedCustomer,
      },
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Fetch single customer error:",
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