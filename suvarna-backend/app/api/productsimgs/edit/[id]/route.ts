// app/api/productsimgs/edit/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    // Check product exists
    const existing = await prisma.productImgs.findUnique({
      where: { id: (await params).id },
    });

    if (!existing) {
      return new NextResponse(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    // Parse multipart form (supports optional new image)
    const formData = await req.formData();

    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const weight = formData.get("weight") as string | null;
    const imageFile = formData.get("image") as File | null;
    const metalType = formData.get("metalType") as string | null;
    const carats = formData.get("carats") as string | null;

    // Build update payload — only update fields that were sent
    const updateData: Record<string, unknown> = {};

    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (weight) updateData.weight = parseFloat(weight);
    if (metalType) updateData.metalType = metalType;  // ✅ add this
    if (carats) updateData.carats = carats;
    // If a new image was uploaded, convert and store it
    if (imageFile && imageFile.size > 0) {
      if (!imageFile.type.startsWith("image/")) {
        return new NextResponse(
          JSON.stringify({ error: "Uploaded file must be an image" }),
          { status: 400, headers: corsHeaders() }
        );
      }
      const arrayBuffer = await imageFile.arrayBuffer();
      updateData.image = Buffer.from(arrayBuffer);
      updateData.mimeType = imageFile.type;
    }

    if (Object.keys(updateData).length === 0) {
      return new NextResponse(
        JSON.stringify({ error: "No fields provided to update" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const updated = await prisma.productImgs.update({
      where: { id: (await params).id },
      data: updateData,
    });

    return new NextResponse(
      JSON.stringify({
        message: "Product updated successfully",
        product: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          weight: updated.weight,
          metalType: updated.metalType,
          carats: updated.carats,
          // Return updated image as base64 so UI can re-render immediately
          image:
            updated.image && updated.image.length > 0
              ? `data:${updated.mimeType ?? "image/jpeg"};base64,${Buffer.from(updated.image).toString("base64")}`
              : null,
        },
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Edit error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to update product" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}