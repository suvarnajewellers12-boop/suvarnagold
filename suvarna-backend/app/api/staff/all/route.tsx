import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= GET ALL STAFF =================
export async function GET(req: Request) {
  try {
    // 🔐 Authorization
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid Token" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    // 🔐 Only SUPER_ADMIN
    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔍 Fetch all staff members (includes the 'id' field by default)
    const staff = await prisma.staff.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Aggregate salesman sales metrics
    const salesmanMetrics = await prisma.purchase.groupBy({
      by: ["salesmanId"],
      where: { salesmanId: { not: null } },
      _sum: {
        finalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // Aggregate cashier collection metrics
    const cashierMetrics = await prisma.purchase.groupBy({
      by: ["cashierId"],
      where: { cashierId: { not: null } },
      _sum: {
        cashAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // Map metrics for efficient lookup matching against staff ID (e.g. SUV7XXX)
    const salesmanMap = new Map(salesmanMetrics.map((item) => [item.salesmanId, item]));
    const cashierMap = new Map(cashierMetrics.map((item) => [item.cashierId, item]));

    const enrichedStaff = staff.map((staffMember) => {
      const sales = salesmanMap.get(staffMember.id);
      const cashier = cashierMap.get(staffMember.id);

      return {
        id: staffMember.id, // 🆔 Explicitly ensuring ID is present
        fullName: staffMember.fullName,
        dateOfJoining: staffMember.dateOfJoining,
        monthlySalary: staffMember.monthlySalary,
        gender: staffMember.gender,
        phoneNumber: staffMember.phoneNumber,
        aadharNumber: staffMember.aadharNumber,
        panCardNumber: staffMember.panCardNumber,
        nomineeName: staffMember.nomineeName,
        nomineeRelation: staffMember.nomineeRelation,
        nomineePhoneNumber: staffMember.nomineePhoneNumber,
        nomineeAddress: staffMember.nomineeAddress,
        createdAt: staffMember.createdAt,
        createdBy: staffMember.createdBy,

        // 📊 Calculated metrics
        salesAmount: sales?._sum.finalAmount ?? 0,
        salesCount: sales?._count.id ?? 0,
        cashCollected: cashier?._sum.cashAmount ?? 0,
        cashierCount: cashier?._count.id ?? 0,
      };
    });

    return new NextResponse(
      JSON.stringify({ staff: enrichedStaff }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Fetch staff error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}