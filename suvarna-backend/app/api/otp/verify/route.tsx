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
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    const body = await req.json();

    const { otp } = body;

    if (!otp) {
      return new NextResponse(
        JSON.stringify({ error: "OTP required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const superAdminPhone = process.env.SUPERADMIN_PHONE!;

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber: superAdminPhone,
        purpose: "discount_approval",
        isUsed: false
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!otpRecord) {
      return new NextResponse(
        JSON.stringify({ error: "OTP not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    if (otpRecord.expiresAt < new Date()) {
      return new NextResponse(
        JSON.stringify({ error: "OTP expired" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    if (otpRecord.otpCode !== otp) {

      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: {
          attempts: otpRecord.attempts + 1
        }
      });

      return new NextResponse(
        JSON.stringify({ error: "Invalid OTP" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: {
        isUsed: true,
        verifiedAt: new Date()
      }
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        message: "OTP verified successfully"
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {

    console.error("OTP VERIFY ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "OTP verification failed" }),
      { status: 500, headers: corsHeaders() }
    );

  }
}