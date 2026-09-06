import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT,OPTIONS",
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

// ================= CORS PREFLIGHT =================
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ==================================================
// UPDATE CUSTOMER DETAILS FOR ONE PURCHASE
//
// PUT /api/reports/purchases/update/:id
//
// body:
// {
//   customerName: "Customer Name",
//   phoneNumber: "9876543210",
//   emailid: "customer@gmail.com",
//   Address: "Customer address"
// }
// ==================================================
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ================= AUTHORIZATION =================
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Unauthorized" },
        401
      );
    }

    const token = authHeader.slice(7).trim();

    let decoded: any;

    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.error(
        "[CUSTOMER UPDATE] Token verification failed:",
        error
      );

      return jsonResponse(
        { error: "Invalid token" },
        401
      );
    }

    if (
      decoded.role !== "ADMIN" &&
      decoded.role !== "SUPER_ADMIN"
    ) {
      return jsonResponse(
        { error: "Forbidden" },
        403
      );
    }

    // ================= PURCHASE ID =================
    const { id } = await params;

    if (!id?.trim()) {
      return jsonResponse(
        { error: "Purchase ID is required" },
        400
      );
    }

    // ================= REQUEST BODY =================
    let body: any;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid JSON body" },
        400
      );
    }

    const {
      customerName,
      phoneNumber,
      emailid,
      Address,
    } = body;

    // ================= VALIDATION =================

    const cleanName =
      typeof customerName === "string"
        ? customerName.trim()
        : "";

    const cleanPhone =
      typeof phoneNumber === "string"
        ? phoneNumber.replace(/\D/g, "").trim()
        : "";

    const cleanEmail =
      typeof emailid === "string"
        ? emailid.trim()
        : "";

    const cleanAddress =
      typeof Address === "string"
        ? Address.trim()
        : "";

    if (!cleanName) {
      return jsonResponse(
        { error: "Customer name is required" },
        400
      );
    }

    if (!cleanPhone) {
      return jsonResponse(
        { error: "Phone number is required" },
        400
      );
    }

    // Assuming Indian 10-digit customer phone number
    if (cleanPhone.length !== 10) {
      return jsonResponse(
        {
          error:
            "Phone number must contain exactly 10 digits",
        },
        400
      );
    }

    // Email is optional.
    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return jsonResponse(
        { error: "Invalid email address" },
        400
      );
    }

    // ================= CHECK PURCHASE =================
    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          invoice: true,
          customerName: true,
          phoneNumber: true,
          emailid: true,
          Address: true,
        },
      });

    if (!purchase) {
      return jsonResponse(
        { error: "Purchase not found" },
        404
      );
    }

    // ================= UPDATE =================
    const updatedPurchase =
      await prisma.purchase.update({
        where: {
          id,
        },
        data: {
          customerName: cleanName,
          phoneNumber: cleanPhone,

          // Store null instead of empty strings
          emailid:
            cleanEmail.length > 0
              ? cleanEmail
              : null,

          Address:
            cleanAddress.length > 0
              ? cleanAddress
              : null,
        },
        select: {
          id: true,
          invoice: true,
          customerName: true,
          phoneNumber: true,
          emailid: true,
          Address: true,
          purchasedAt: true,
        },
      });

    console.log(
      `[CUSTOMER UPDATE] Purchase ${id} / ${purchase.invoice} updated by ${decoded.role} ${decoded.id}`
    );

    return jsonResponse(
      {
        success: true,
        message:
          "Customer details updated successfully",
        customer: {
          id: updatedPurchase.id,
          invoice: updatedPurchase.invoice,

          customerName:
            updatedPurchase.customerName,

          phoneNumber:
            updatedPurchase.phoneNumber,

          emailid:
            updatedPurchase.emailid,

          Address:
            updatedPurchase.Address,
        },
      },
      200
    );
  } catch (error) {
    console.error(
      "[CUSTOMER UPDATE] Error:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    return jsonResponse(
      {
        error: "Internal Server Error",
        details: errorMessage,
      },
      500
    );
  }
}