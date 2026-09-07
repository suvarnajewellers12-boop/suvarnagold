import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { cors } from "@/lib/cors";

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }));
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    const { superAdminId, newPassword } = body;

    // Basic validation
    if (!superAdminId || !newPassword) {
      return cors(
        NextResponse.json(
          {
            error: "Super admin ID and new password are required",
          },
          { status: 400 }
        )
      );
    }

    if (newPassword.length < 6) {
      return cors(
        NextResponse.json(
          {
            error: "Password must be at least 6 characters",
          },
          { status: 400 }
        )
      );
    }

    // Check super admin exists
    const superAdmin = await prisma.superAdmin.findUnique({
      where: {
        id: superAdminId,
      },
    });

    if (!superAdmin) {
      return cors(
        NextResponse.json(
          {
            error: "Super admin not found",
          },
          { status: 404 }
        )
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.superAdmin.update({
      where: {
        id: superAdminId,
      },
      data: {
        password: hashedPassword,
      },
    });

    return cors(
      NextResponse.json(
        {
          success: true,
          message: "Super admin password updated successfully",
        },
        { status: 200 }
      )
    );
  } catch (error) {
    console.error("Super admin password update error:", error);

    return cors(
      NextResponse.json(
        {
          error: "Internal server error",
        },
        { status: 500 }
      )
    );
  }
}