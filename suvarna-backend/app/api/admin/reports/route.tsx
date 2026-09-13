import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(req: Request) {
  console.log("[ADMIN REPORTS] Request received");

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    let purchases: any[] = [];

    if (decoded.role === "ADMIN") {
      // IMPORTANT: keep Admin scope exactly as before.
      // We only expose the missing staff + exchange fields in the response below.
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        include: {
          purchases: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
            orderBy: { purchasedAt: "desc" },
          },
        },
      });

      purchases = admin?.purchases || [];
    } else {
      // Preserve your existing SUPER_ADMIN compatibility in this endpoint.
      // No super-admin report aggregation/filtering logic has been copied here.
      purchases = await prisma.purchase.findMany({
        include: {
          admin: { select: { username: true } },
          superAdmin: { select: { username: true } },
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { purchasedAt: "desc" },
      });
    }

    const rows = purchases.flatMap((purchase) => {
      const createdBy =
        purchase.admin?.username || purchase.superAdmin?.username || "SYSTEM";

      return purchase.items
        .filter((item: any) => item.product)
        .map((item: any) => ({
          id: purchase.id,
          invoice: purchase.invoice,
          paymentId: purchase.paymentId || "N/A",
          paymentStatus: purchase.paymentStatus,
          customerName: purchase.customerName,
          phoneNumber: purchase.phoneNumber,
          Address: purchase.Address || "N/A",
          emailid: purchase.emailid || "N/A",

          // Assigned staff — required by Admin report UI + receipt
          salesmanId: purchase.salesmanId || null,
          salesmanName: purchase.salesmanName || null,
          cashierId: purchase.cashierId || null,
          cashierName: purchase.cashierName || null,

          // Gold exchange jewellery — keep DB's existing legacy field names
          jewelleryexchangediscount: Number(
            purchase.jewelleryexchangediscount || 0
          ),
          excahngejewellrygrams: Number(purchase.excahngejewellrygrams || 0),
          excahngejewellryname: purchase.excahngejewellryname || null,

          // Silver exchange jewellery
          silverExchangeGrams: Number(purchase.silverExchangeGrams || 0),
          silverExchangeName: purchase.silverExchangeName || null,
          silverExchangeDiscount: Number(
            purchase.silverExchangeDiscount || 0
          ),

          // Payment split — retain both nested and flat fields for compatibility
          payments: {
            cash: Number(purchase.cashAmount || 0),
            upi: Number(purchase.upiAmount || 0),
            card: Number(purchase.cardAmount || 0),
            cheque: Number(purchase.chequeAmount || 0),
          },
          cashAmount: Number(purchase.cashAmount || 0),
          upiAmount: Number(purchase.upiAmount || 0),
          cardAmount: Number(purchase.cardAmount || 0),
          chequeAmount: Number(purchase.chequeAmount || 0),

          // Financials — preserve current Admin API aliases
          subtotal: Number(purchase.totalAmount || 0),
          totalAmount: Number(purchase.totalAmount || 0),
          cgst: Number(purchase.cgstAmount || 0),
          cgstAmount: Number(purchase.cgstAmount || 0),
          sgst: Number(purchase.sgstAmount || 0),
          sgstAmount: Number(purchase.sgstAmount || 0),
          discount: Number(purchase.discountAmount || 0),
          discountAmount: Number(purchase.discountAmount || 0),
          couponDiscount: Number(purchase.couponDiscount || 0),
          exchangeDiscount: Number(purchase.jewelleryexchangediscount || 0),
          grandTotal: Number(purchase.finalAmount || 0),
          finalAmount: Number(purchase.finalAmount || 0),

          // Item fields
          productName: item.product.name,
          grams: item.grams ?? item.product.grams,
          category: item.product.metalType,
          purity: item.product.carats,
          grossWt: item.product.grams,
          netWt: item.product.netWeight,
          va: item.product.va,
          itemCode: item.product.itemCode || "N/A",
          huid: item.product.itemCode || "N/A",
          sku: item.product.sku || "N/A",
          itemCost: Number(item.cost || 0),
          stoneWeight: Number(item.product.stoneWeight || 0),
          stoneCost: Number(item.product.stoneCost || 0),

          purchasedAt: purchase.purchasedAt,
          createdBy,
        }));
    });

    console.log("[ADMIN REPORTS] Final rows count:", rows.length);

    return new NextResponse(JSON.stringify({ purchases: rows }), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error("[ADMIN REPORTS] ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new NextResponse(
      JSON.stringify({ error: "Server error", details: errorMessage }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
