import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= CREATE CUSTOMER + ASSIGN SCHEMES =================
export async function POST(req: Request) {
  try {
    // 🔐 AUTHORIZATION
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

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔹 BODY
    const body = await req.json();

    const {
      name,
      username,
      password,
      phone,
      schemeIds, // array of scheme ids
    } = body;

    if (!name || !username || !password || !phone) {
      return new NextResponse(
        JSON.stringify({ error: "All required fields must be provided" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 Create Customer
    const customer = await prisma.customer.create({
      data: {
        name,
        username,
        password: hashedPassword,
        phone,
      },
    });

    // 🔹 Assign Schemes (if provided)
    if (schemeIds && Array.isArray(schemeIds) && schemeIds.length > 0) {
      for (const schemeId of schemeIds) {
        const scheme = await prisma.scheme.findUnique({
          where: { id: schemeId },
        });

        if (!scheme) continue;

        const totalAmount =
          scheme.monthlyAmount * scheme.durationMonths;

        await prisma.customerScheme.create({
          data: {
            customerId: customer.id,
            schemeId: scheme.id,
            remainingAmount: totalAmount,
            installmentsLeft: scheme.durationMonths,
          },
        });
      }
    }

    return new NextResponse(
      JSON.stringify({
        message: "Customer created and schemes assigned successfully",
        customerId: customer.id,
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("Customer create error:", error);

    if (error.code === "P2002") {
      return new NextResponse(
        JSON.stringify({ error: "Username already exists" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}