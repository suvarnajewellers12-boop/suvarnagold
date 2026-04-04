import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import nodemailer from "nodemailer";

// 1. Move transporter outside to keep the connection warm
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_ID,
    pass: process.env.GMAIL_PASSWORD,
  },
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);

    const superAdminEmail = process.env.GMAIL_ID!; // Or the specific recipient email
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save to Database
    await prisma.otpVerification.create({
      data: {
        phoneNumber: process.env.SUPERADMIN_PHONE || "N/A", // Kept for schema compatibility
        otpCode,
        purpose: "discount_approval",
        requestedById: user.id,
        expiresAt,
      },
    });

    const message = `Your Suvarna verification OTP is ${otpCode} for discount approval.`;

    // 2. CRITICAL FIX: Use AWAIT here. 
    // This ensures the email is handed off to the Gmail SMTP server before the function ends.
    await transporter.sendMail({
      from: `"Suvarna Jewellers" <${process.env.GMAIL_ID}>`,
      to: superAdminEmail,
      subject: "Discount Approval Request - OTP",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #333;">Discount Approval OTP</h2>
          <p style="font-size: 16px;">A discount request has been initiated.</p>
          <div style="background: #f4f4f4; padding: 10px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
            ${otpCode}
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">Requested by: User ID ${user.id}</p>
          <p style="color: #999; font-size: 12px;">This code expires in 5 minutes.</p>
        </div>
      `,
    });

    return NextResponse.json(
      { success: true, message: "OTP sent to Email" },
      { headers: corsHeaders() }
    );

  } catch (error) {
    console.error("OTP ERROR:", error);
    return NextResponse.json(
      { error: "Failed to process request" }, 
      { status: 500, headers: corsHeaders() }
    );
  }
}