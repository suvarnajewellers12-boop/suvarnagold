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
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    const purchases = await prisma.goldPurchase.aggregate({
      _sum: { grams: true },
    });

    const jobworks = await prisma.goldJobWork.aggregate({
      _sum: { goldGivenGrams: true },
    });

    const purchased = purchases._sum.grams || 0;
    const given = jobworks._sum.goldGivenGrams || 0;

    const remaining = purchased - given;

    return new NextResponse(
      JSON.stringify({
        purchased,
        givenForMaking: given,
        remaining,
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {

    return new NextResponse(
      JSON.stringify({ error: "Failed to calculate balance" }),
      { status: 500, headers: corsHeaders() }
    );

  }

}