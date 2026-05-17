import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import nodemailer from "nodemailer";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

/**
 * POST /api/coupon/preclose
 *
 * Step 1 — Send OTP:   body = { couponId }
 * Step 2 — Verify OTP: body = { couponId, otp }
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const user: any = verifyToken(token);

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { couponId, otp } = body;

    if (!couponId) {
      return NextResponse.json({ error: "couponId is required" }, { status: 400, headers: corsHeaders() });
    }

    // ── Validate coupon exists and is pre-close eligible ──────────────
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        customerScheme: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404, headers: corsHeaders() });
    }

    if (coupon.isUsed) {
      return NextResponse.json({ error: "Coupon is already redeemed" }, { status: 400, headers: corsHeaders() });
    }

    if (coupon.isPreClosed) {
      return NextResponse.json({ error: "Coupon is already pre-closed" }, { status: 400, headers: corsHeaders() });
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 1 — No OTP in body: generate and send OTP
    // ════════════════════════════════════════════════════════════════════
    if (!otp) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await prisma.otpVerification.create({
        data: {
          phoneNumber: process.env.SUPERADMIN_PHONE || "N/A",
          otpCode,
          purpose: "preclose_approval",
          requestedById: user.id,
          expiresAt,
        },
      });

      const adminEmail = process.env.GMAIL_ID!;
      await transporter.sendMail({
        from: `"Suvarna Jewellers" <${process.env.GMAIL_ID}>`,
        to: adminEmail,
        subject: `Pre-Close Coupon Approval – ${coupon.code}`,
        html: `
          <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e5c97e; border-radius: 8px; max-width: 480px;">
            <h2 style="color: #78350f;">Scheme Pre-Closure Request</h2>
            <p style="font-size: 15px; color: #333;">
              A <strong>pre-close request</strong> has been initiated for the following coupon:
            </p>
            <table style="width:100%; font-size: 13px; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 6px; color: #666;">Coupon Code</td>
                <td style="padding: 6px; font-weight: bold;">${coupon.code}</td>
              </tr>
              <tr style="background:#fef9ec;">
                <td style="padding: 6px; color: #666;">Customer</td>
                <td style="padding: 6px;">${coupon.customer.name} (${coupon.customer.phone})</td>
              </tr>
              <tr>
                <td style="padding: 6px; color: #666;">Weight (g)</td>
                <td style="padding: 6px;">${coupon.totalWeightGrams}g</td>
              </tr>
              <tr style="background:#fef9ec;">
                <td style="padding: 6px; color: #666;">Cash Value</td>
                <td style="padding: 6px;">₹${coupon.totalCashValue.toLocaleString()}</td>
              </tr>
            </table>
            <p style="font-size: 13px; color: #555;">
              <strong>Note:</strong> Pre-closing will force-complete the scheme.
              The customer will <u>NOT receive VA or additional-month benefits</u>.
              Only accumulated grams/cash will be credited.
            </p>
            <div style="background: #f4f4f4; padding: 14px; font-size: 28px; font-weight: bold; text-align: center;
                        letter-spacing: 10px; margin: 20px 0; border-radius: 6px; color: #78350f;">
              ${otpCode}
            </div>
            <p style="color: #999; font-size: 11px;">This OTP expires in 5 minutes. Requested by: User ID ${user.id}</p>
          </div>
        `,
      });

      return NextResponse.json(
        { success: true, message: "OTP sent to admin email" },
        { headers: corsHeaders() }
      );
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 2 — OTP provided: verify and execute pre-close
    // ════════════════════════════════════════════════════════════════════
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber: process.env.SUPERADMIN_PHONE || "N/A",
        purpose: "preclose_approval",
        isUsed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json({ error: "OTP not found. Please request a new OTP." }, { status: 404, headers: corsHeaders() });
    }

    if (otpRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400, headers: corsHeaders() });
    }

    if (otpRecord.otpCode !== String(otp)) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400, headers: corsHeaders() });
    }

    // OTP is valid — mark it used
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true, verifiedAt: new Date() },
    });

    // Execute pre-close in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark coupon as pre-closed and active (ready to redeem)
      await tx.coupon.update({
        where: { id: couponId },
        data: {
          isPreClosed: true,
          preClosedAt: new Date(),
          isActive: true,   // makes it redeemable
        },
      });

      // 2. Force-complete the linked CustomerScheme (if any)
      if (coupon.customerSchemeId) {
        await tx.customerScheme.update({
          where: { id: coupon.customerSchemeId },
          data: { isCompleted: true },
        });
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: "Scheme pre-closed successfully. Coupon is now active for redemption without VA/additional-month benefits.",
        couponCode: coupon.code,
      },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error("Pre-close error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
