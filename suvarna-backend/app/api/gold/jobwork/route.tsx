import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {

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

    const body = await req.json();

    const jobwork = await prisma.goldJobWork.create({
      data: {
        companyName: body.companyName,
        productType: body.productType,
        goldGivenType: body.goldGivenType,
        goldGivenGrams: body.goldGivenGrams,
        makingCharge: body.makingCharge,
        dateGiven: new Date(body.dateGiven),
        notes: body.notes,
        createdBy: decoded.id,
      },
    });

    return new NextResponse(
      JSON.stringify({ jobwork }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
      console.error("JOBWORK STATUS ERROR:", error);


    return new NextResponse(
      JSON.stringify({ error: "Failed to create job work" }),
      { status: 500, headers: corsHeaders() }
    );

  }

}