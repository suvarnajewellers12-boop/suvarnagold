import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

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

// ================= CREATE STAFF =================
export async function POST(req: Request) {
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

    // 🔐 Only SUPER_ADMIN can create staff
    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await req.json();

    const {
      fullName,
      dateOfJoining,
      monthlySalary,
      gender,
      phoneNumber,
      aadharNumber,
    } = body;

    if (
      !fullName ||
      !dateOfJoining ||
      !monthlySalary ||
      !gender ||
      !phoneNumber ||
      !aadharNumber
    ) {
      return new NextResponse(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔍 Check duplicates
    const existing = await prisma.staff.findFirst({
      where: {
        OR: [
          { phoneNumber },
          { aadharNumber },
        ],
      },
    });

    if (existing) {
      return new NextResponse(
        JSON.stringify({ error: "Phone or Aadhar already exists" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const staff = await prisma.staff.create({
      data: {
        fullName,
        dateOfJoining: new Date(dateOfJoining),
        monthlySalary: parseFloat(monthlySalary),
        gender,
        phoneNumber,
        aadharNumber,
        createdBy: decoded.id, // SuperAdmin ID
      },
    });

    return new NextResponse(
      JSON.stringify({ message: "Staff created successfully", staff }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Create staff error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}