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

  try {

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    // Allow only ADMIN or SUPER_ADMIN
    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    const purchases = await prisma.purchase.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        admin: true,
        superAdmin: true, // 👈 add this
      },
      orderBy: {
        purchasedAt: "desc",
      },
    });

    const rows: any[] = [];

    for (const purchase of purchases) {

      const createdBy =
        purchase.admin?.username ||
        purchase.superAdmin?.username ||
        "SYSTEM";

      for (const item of purchase.items) {
        rows.push({
          id: purchase.id,
          customer: purchase.customerName,
          phone: purchase.phoneNumber,
          product: item.product.name,
          category: item.product.metalType,
          grams: item.grams,
          total: item.cost,
          date: purchase.purchasedAt,
          createdBy: createdBy
        });
      }

    }

    return new NextResponse(
      JSON.stringify({ purchases: rows }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {

    console.error("REPORT ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }

}