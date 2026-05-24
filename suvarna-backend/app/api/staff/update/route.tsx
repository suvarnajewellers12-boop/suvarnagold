import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= UPDATE STAFF =================
export async function PUT(req: Request) {
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

    // 🔐 Only SUPER_ADMIN can update staff
    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await req.json();

    const {
      staffId,
      fullName,
      dateOfJoining,
      monthlySalary,
      gender,
      phoneNumber,
      aadharNumber,
      panCardNumber,
      nomineeName,
      nomineeRelation,
      nomineePhoneNumber,
      nomineeAddress,
    } = body;

    if (!staffId) {
      return new NextResponse(
        JSON.stringify({ error: "Staff ID is required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔍 Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!existingStaff) {
      return new NextResponse(
        JSON.stringify({ error: "Staff member not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    // 🔍 Check for duplicate phone/aadhar (excluding current staff)
    const duplicateCheck = await prisma.staff.findFirst({
      where: {
        AND: [
          { id: { not: staffId } },
          {
            OR: [
              phoneNumber ? { phoneNumber } : {},
              aadharNumber ? { aadharNumber } : {},
              nomineePhoneNumber ? { nomineePhoneNumber } : {},
              panCardNumber ? { panCardNumber } : {},
            ],
          },
        ],
      },
    });

    if (duplicateCheck) {
      return new NextResponse(
        JSON.stringify({
          error: "Phone, Aadhar, Nominee Phone, or Pan Card already exists",
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔄 Update staff record
    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: {
        ...(fullName && { fullName }),
        ...(dateOfJoining && { dateOfJoining: new Date(dateOfJoining) }),
        ...(monthlySalary && { monthlySalary: parseFloat(monthlySalary) }),
        ...(gender && { gender }),
        ...(phoneNumber && { phoneNumber }),
        ...(aadharNumber && { aadharNumber }),
        ...(panCardNumber !== undefined && { panCardNumber: panCardNumber || null }),
        ...(nomineeName && { nomineeName }),
        ...(nomineeRelation && { nomineeRelation }),
        ...(nomineePhoneNumber && { nomineePhoneNumber }),
        ...(nomineeAddress && { nomineeAddress }),
      },
    });

    return new NextResponse(
      JSON.stringify({ message: "Staff updated successfully", staff: updatedStaff }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Update staff error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
