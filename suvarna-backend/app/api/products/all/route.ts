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
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
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

    // Get branch filter from query parameters
    const { searchParams } = new URL(req.url);
    const branchFilter = searchParams.get("branch");

    // Build the where clause for product filtering
    const whereClause: any = {
      isSold: false,
    };

    // If user is ADMIN, filter by their branch (or use branchFilter if provided)
    // If user is SUPER_ADMIN, show all (unless branchFilter is explicitly provided)
    if (decoded.role === "ADMIN" && branchFilter) {
      whereClause.branchName = branchFilter;
    } else if (decoded.role === "ADMIN" && !branchFilter) {
      // For ADMIN without explicit branch filter, fetch user's branch from token
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: { branchName: true },
      });
      if (admin) {
        whereClause.branchName = admin.branchName;
      }
    } else if (decoded.role === "SUPER_ADMIN" && branchFilter) {
      // SUPER_ADMIN can request specific branch
      whereClause.branchName = branchFilter;
    }
    // If SUPER_ADMIN without filter, return all (whereClause only has isSold: false)

    // ✅ Explicitly fetch the new fields
    const products = await prisma.product.findMany({
      where: whereClause,
      select: {
        id: true,
        sku: true,
        name: true,
        metalType: true,
        grams: true,
        carats: true,
        category: true,
        bodyPart: true,
        itemCode: true,
        stoneWeight: true,
        netWeight: true,
        isSold: true,
        manufactureDate: true,
        createdAt: true,
        uniqueCode: true,
        stoneCost: true, 
        branchName: true,
        va: true,
        pieceCost: true, // <-- ADDED THIS LINE
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return new NextResponse(
      JSON.stringify({ products }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("FETCH PRODUCTS ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}