export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import crypto from "crypto";

// ============================================================
// CORS
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
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
// RATE TYPE
// ============================================================

type SchemeRateType =
  | "CASH"
  | "GOLD_22K"
  | "GOLD_18K"
  | "SILVER";

// ============================================================
// FETCH CURRENT METAL RATE
// ============================================================

async function getLiveRate(
  rateType: SchemeRateType
): Promise<number | null> {
  if (rateType === "CASH") {
    return null;
  }

  const response =
    await fetch(
      "https://suvarnagold-16e5.vercel.app/api/rates",
      {
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      "Unable to fetch current metal rate."
    );
  }

  const data =
    await response.json();

  let rawRate: unknown;

  switch (rateType) {
    case "GOLD_22K":
      rawRate = data?.gold22;
      break;

    case "GOLD_18K":
      rawRate = data?.gold18;
      break;

    case "SILVER":
      rawRate = data?.silver;
      break;

    default:
      rawRate = null;
  }

  const parsedRate =
    Number.parseFloat(
      String(rawRate ?? "").replace(
        /[^0-9.]/g,
        ""
      )
    );

  if (
    !Number.isFinite(parsedRate) ||
    parsedRate <= 0
  ) {
    throw new Error(
      `Invalid live rate received for ${rateType}.`
    );
  }

  return parsedRate;
}

// ============================================================
// POST
//
// PAY MISSED INSTALLMENTS AT STORE
//
// Supports:
//
// 1 missed installment
// OR
// multiple missed installments
//
// Does NOT support:
// future installment payment
// upcoming installment payment
// normal current online installment
// ============================================================

export async function POST(
  req: Request
) {
  try {
    // ==========================================================
    // 1. ADMIN AUTH
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
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
          headers:
            corsHeaders(),
        }
      );
    }

    const decoded: any =
      verifyToken(
        token
      );

    if (
      !decoded ||
      (
        decoded.role !==
          "ADMIN" &&
        decoded.role !==
          "SUPER_ADMIN"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        {
          status: 403,
          headers:
            corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 2. BODY
    // ==========================================================

    const body =
      await req.json();

    const {
      customerSchemeId,

      // --------------------------------------------------------
      // For one missed installment:
      //
      // installmentId: "..."
      //
      // For multiple:
      //
      // installmentIds: ["...", "..."]
      //
      // If neither is supplied:
      // earliest missed installment is paid.
      // --------------------------------------------------------

      installmentId,
      installmentIds,

      // Optional note from admin.
      note,

      // Optional external/store reference.
      reference,
    } = body;

    // ==========================================================
    // 3. BASIC VALIDATION
    // ==========================================================

    if (!customerSchemeId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "customerSchemeId is required.",
        },
        {
          status: 400,
          headers:
            corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 4. FETCH ENROLLMENT
    // ==========================================================

    const customerScheme =
      await prisma
        .customerScheme
        .findUnique({
          where: {
            id:
              String(
                customerSchemeId
              ),
          },

          include: {
            scheme: true,

            coupon: true,

            installments: {
              orderBy: {
                installmentNumber:
                  "asc",
              },
            },
          },
        });

    if (!customerScheme) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enrollment not found.",
        },
        {
          status: 404,
          headers:
            corsHeaders(),
        }
      );
    }

    if (
      customerScheme.isCompleted
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Scheme already completed.",
        },
        {
          status: 400,
          headers:
            corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 5. VALIDATE RATE TYPE
    // ==========================================================

    let rateType =
      customerScheme
        .scheme
        .rateType as SchemeRateType;

    // ----------------------------------------------------------
    // LEGACY SAFETY
    //
    // Old weighted schemes may have:
    //
    // isWeightBased = true
    // rateType = CASH
    //
    // For those legacy schemes, treat them as GOLD_22K.
    //
    // New schemes should always have proper rateType.
    // ----------------------------------------------------------

    if (
      rateType === "CASH" &&
      customerScheme
        .scheme
        .isWeightBased
    ) {
      rateType =
        "GOLD_22K";
    }

    if (
      ![
        "CASH",
        "GOLD_22K",
        "GOLD_18K",
        "SILVER",
      ].includes(
        rateType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported scheme rate type.",
        },
        {
          status: 400,
          headers:
            corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 6. GET MISSED INSTALLMENTS
    // ==========================================================

    const allMissedInstallments =
      customerScheme
        .installments
        .filter(
          (item) =>
            item.status ===
            "MISSED"
        );

    if (
      allMissedInstallments
        .length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          code:
            "NO_MISSED_INSTALLMENTS",

          error:
            "There are no missed installments to clear.",
        },
        {
          status: 400,
          headers:
            corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 7. BUILD REQUESTED IDS
    // ==========================================================

    let requestedIds:
      string[] = [];

    if (
      Array.isArray(
        installmentIds
      )
    ) {
      requestedIds =
        installmentIds
          .map(
            (id: any) =>
              String(id)
          )
          .filter(
            (id: any) =>
              id.trim()
                  .isNotEmpty
          );
    }

    if (
      requestedIds.length ===
        0 &&
      installmentId
    ) {
      requestedIds = [
        String(
          installmentId
        ),
      ];
    }

    // ----------------------------------------------------------
    // Backwards-compatible behavior:
    //
    // If admin does not send installmentId(s),
    // pay only the EARLIEST missed installment.
    // ----------------------------------------------------------

    if (
      requestedIds.length ===
      0
    ) {
      requestedIds = [
        allMissedInstallments[0]
          .id,
      ];
    }

    // Remove duplicates.
    requestedIds = [
      ...new Set(
        requestedIds
      ),
    ];

    // ==========================================================
    // 8. FIND SELECTED MISSED ROWS
    // ==========================================================

    const selectedInstallments =
      allMissedInstallments
        .filter(
          (item) =>
            requestedIds.includes(
              item.id
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            a.installmentNumber -
            b.installmentNumber
        );

    // ==========================================================
    // ALL REQUESTED IDs MUST BE VALID MISSED INSTALLMENTS
    // ==========================================================

    if (
      selectedInstallments
        .length !==
      requestedIds.length
    ) {
      return NextResponse.json(
        {
          success: false,

          code:
            "INVALID_MISSED_INSTALLMENT",

          error:
            "One or more selected installments are not valid missed installments.",
        },
        {
          status: 400,
          headers:
            corsHeaders(),
        }
      );
    }

    // ==========================================================
    // 9. CHRONOLOGICAL RULE
    //
    // Admin can pay:
    //
    // earliest missed only
    //
    // OR
    //
    // earliest missed + next missed + ...
    //
    // But cannot skip an earlier missed month.
    // ==========================================================

    for (
      let index = 0;
      index <
      selectedInstallments
        .length;
      index++
    ) {
      const expected =
        allMissedInstallments[
          index
        ];

      const selected =
        selectedInstallments[
          index
        ];

      if (
        expected.id !==
        selected.id
      ) {
        return NextResponse.json(
          {
            success: false,

            code:
              "EARLIER_MISSED_INSTALLMENT_PENDING",

            error:
              "Missed installments must be cleared in chronological order.",

            earliestMissed: {
              id:
                allMissedInstallments[
                  0
                ].id,

              installmentNumber:
                allMissedInstallments[
                  0
                ]
                  .installmentNumber,

              dueDate:
                allMissedInstallments[
                  0
                ]
                  .dueDate,
            },
          },
          {
            status: 400,
            headers:
              corsHeaders(),
          }
        );
      }
    }

    // ==========================================================
    // 10. LIVE RATE
    //
    // The store cannot manually decide the metal rate.
    //
    // Rate is fetched server-side at the time payment is
    // recorded.
    // ==========================================================

    const rateUsed =
      await getLiveRate(
        rateType
      );

    // ==========================================================
    // 11. CALCULATE EACH MISSED INSTALLMENT
    // ==========================================================

    const calculations =
      selectedInstallments.map(
        (installment) => {
          const amount =
            Number(
              installment.amount
            );

          if (
            !Number.isFinite(
              amount
            ) ||
            amount <= 0
          ) {
            throw new Error(
              `Invalid amount on installment ${installment.installmentNumber}.`
            );
          }

          const gramsAdded =
            rateType ===
              "CASH" ||
            rateUsed ===
              null
              ? 0
              : amount /
                rateUsed;

          return {
            installment,
            amount,
            gramsAdded,
          };
        }
      );

    // ==========================================================
    // TOTALS
    // ==========================================================

    const totalAmountPaid =
      calculations.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.amount,
        0
      );

    const totalGramsAdded =
      calculations.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.gramsAdded,
        0
      );

    const installmentCount =
      calculations.length;

    // ==========================================================
    // 12. TRANSACTION
    // ==========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ====================================================
          // RE-READ MISSED ROWS INSIDE TRANSACTION
          //
          // Prevent double-processing if two admin requests hit
          // close together.
          // ====================================================

          const freshInstallments =
            await tx
              .schemeInstallment
              .findMany({
                where: {
                  id: {
                    in:
                      selectedInstallments.map(
                        (
                          item
                        ) =>
                          item.id
                      ),
                  },

                  customerSchemeId:
                    customerScheme.id,
                },

                orderBy: {
                  installmentNumber:
                    "asc",
                },
              });

          if (
            freshInstallments
              .length !==
            selectedInstallments
              .length
          ) {
            throw new Error(
              "Unable to locate all selected installments."
            );
          }

          for (
            const installment
            of freshInstallments
          ) {
            if (
              installment.status !==
              "MISSED"
            ) {
              throw new Error(
                `Installment ${installment.installmentNumber} has already been processed or is not missed.`
              );
            }
          }

          const paidAt =
            new Date();

          // ====================================================
          // A. PAY EACH MISSED INSTALLMENT
          // ====================================================

          for (
            const item
            of calculations
          ) {
            const historyId =
              crypto.randomUUID();

            // --------------------------------------------------
            // Installment row
            // --------------------------------------------------

            await tx
              .schemeInstallment
              .update({
                where: {
                  id:
                    item
                      .installment
                      .id,
                },

                data: {
                  status:
                    "PAID",

                  paidAt,

                  paymentMode:
                    "OFFLINE",

                  rateType,

                  rateUsed:
                    rateType ===
                    "CASH"
                      ? null
                      : rateUsed,

                  gramsAdded:
                    rateType ===
                    "CASH"
                      ? null
                      : item
                          .gramsAdded,

                  note:
                    note
                      ? String(
                          note
                        )
                      : `Missed installment ${item.installment.installmentNumber} paid at store`,
                },
              });

            // --------------------------------------------------
            // Payment History
            // --------------------------------------------------

            await tx
              .paymentHistory
              .create({
                data: {
                  id:
                    historyId,

                  customerSchemeId:
                    customerScheme.id,

                  amountPaid:
                    item.amount,

                  rateType,

                  // Keep old field only for 22K backward
                  // compatibility.
                  liveRate22K:
                    rateType ===
                      "GOLD_22K"
                      ? rateUsed
                      : null,

                  rateUsed:
                    rateType ===
                    "CASH"
                      ? null
                      : rateUsed,

                  gramsAdded:
                    rateType ===
                    "CASH"
                      ? null
                      : item
                          .gramsAdded,

                  paymentMode:
                    "OFFLINE",

                  reference:
                    reference
                      ? String(
                          reference
                        )
                      : `STORE-${item.installment.installmentNumber}-${historyId}`,
                },
              });
          }

          // ====================================================
          // B. DETERMINE FINAL PROGRESS
          // ====================================================

          const finalPaidCount =
            customerScheme
              .installmentsPaid +
            installmentCount;

          const finalInstallmentsLeft =
            Math.max(
              0,
              customerScheme
                .installmentsLeft -
                installmentCount
            );

          const finalRemainingAmount =
            Math.max(
              0,
              Number(
                customerScheme
                  .remainingAmount
              ) -
                totalAmountPaid
            );

          const isCompleted =
            finalInstallmentsLeft ===
              0 ||
            finalPaidCount >=
              customerScheme
                .scheme
                .durationMonths;

          // ====================================================
          // C. UPDATE CUSTOMER SCHEME
          // ====================================================

          const updated =
            await tx
              .customerScheme
              .update({
                where: {
                  id:
                    customerScheme.id,
                },

                data: {
                  totalPaid: {
                    increment:
                      totalAmountPaid,
                  },

                  remainingAmount:
                    finalRemainingAmount,

                  installmentsPaid: {
                    increment:
                      installmentCount,
                  },

                  installmentsLeft:
                    finalInstallmentsLeft,

                  accumulatedGrams: {
                    increment:
                      totalGramsAdded,
                  },

                  isCompleted,
                },
              });

          // ====================================================
          // D. COUPON
          // ====================================================

          const couponCode =
            `SUV-${rateType}-${crypto
              .randomBytes(3)
              .toString("hex")
              .toUpperCase()}`;

          await tx.coupon.upsert({
            where: {
              customerSchemeId:
                customerScheme.id,
            },

            update: {
              // ------------------------------------------------
              // Weight accumulation
              // ------------------------------------------------

              totalWeightGrams:
                rateType ===
                "CASH"
                  ? undefined
                  : {
                      increment:
                        totalGramsAdded,
                    },

              // ------------------------------------------------
              // CASH value should reflect money contributed.
              // ------------------------------------------------

              totalCashValue:
                rateType ===
                "CASH"
                  ? {
                      increment:
                        totalAmountPaid,
                    }
                  : undefined,

              isActive:
                isCompleted,
            },

            create: {
              id:
                crypto.randomUUID(),

              code:
                couponCode,

              customerId:
                customerScheme
                  .customerId,

              schemeId:
                customerScheme
                  .schemeId,

              customerSchemeId:
                customerScheme.id,

              type:
                rateType,

              totalCashValue:
                rateType ===
                "CASH"
                  ? totalAmountPaid
                  : 0,

              totalWeightGrams:
                rateType ===
                "CASH"
                  ? 0
                  : totalGramsAdded,

              value:
                0,

              isActive:
                isCompleted,
            },
          });

          // ====================================================
          // E. RETURN
          // ====================================================

          return {
            updated,
            isCompleted,
          };
        },
        {
          timeout: 10000,
        }
      );

    // ==========================================================
    // 13. RESPONSE
    // ==========================================================

    return NextResponse.json(
      {
        success: true,

        status:
          "Success",

        message:
          installmentCount ===
          1
            ? "Missed installment recorded successfully."
            : `${installmentCount} missed installments recorded successfully.`,

        summary: {
          customerSchemeId:
            customerScheme.id,

          rateType,

          paymentMode:
            "OFFLINE",

          installmentsCleared:
            calculations.map(
              (
                item
              ) => ({
                id:
                  item
                    .installment
                    .id,

                installmentNumber:
                  item
                    .installment
                    .installmentNumber,

                amount:
                  item.amount,

                gramsAdded:
                  rateType ===
                  "CASH"
                    ? 0
                    : Number(
                        item
                          .gramsAdded
                          .toFixed(
                            4
                          )
                      ),
              })
            ),

          installmentCount,

          totalAmountPaid,

          rateUsed:
            rateType ===
            "CASH"
              ? null
              : rateUsed,

          totalGramsAdded:
            rateType ===
            "CASH"
              ? 0
              : Number(
                  totalGramsAdded.toFixed(
                    4
                  )
                ),

          installmentsPaid:
            result.updated
              .installmentsPaid,

          installmentsLeft:
            result.updated
              .installmentsLeft,

          remainingAmount:
            result.updated
              .remainingAmount,

          accumulatedGrams:
            Number(
              result.updated
                .accumulatedGrams
            ),

          isCompleted:
            result.updated
              .isCompleted,
        },

        data:
          result.updated,
      },
      {
        status: 200,
        headers:
          corsHeaders(),
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "[STORE MISSED PAYMENT ERROR]",
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
        headers:
          corsHeaders(),
      }
    );
  }
}