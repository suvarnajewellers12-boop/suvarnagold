import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PATCH,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN" && decoded.role !== "ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { orderId, ...fields } = body;

    if (!orderId) {
      return new NextResponse(JSON.stringify({ error: "Order ID is required" }), { status: 400, headers: corsHeaders() });
    }

    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      return new NextResponse(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders() });
    }

    if (existing.status === "DELIVERED") {
      return new NextResponse(
        JSON.stringify({ error: "Cannot edit an order that has already been delivered" }),
        { status: 409, headers: corsHeaders() }
      );
    }

    // NOTE: advanceCash intentionally excluded — it is only ever changed via /api/gold/order/payment
    const editable = [
      "customerName", "phoneNumber", "itemName", "itemDescription",
      "metalType", "purity", "liveRate", "netWeight", "stoneWeight",
      "vaPercentage", "stoneCost", "discountAmount",
      "exchangeJewelleryName", "exchangeJewelleryGrams", "deadlineDate",
      "weightAdjustmentGrams", "adjustmentCost", "status",
    ];

    const merged: any = { ...existing };
    for (const key of editable) {
      if (fields[key] !== undefined && fields[key] !== null && fields[key] !== "") {
        merged[key] = fields[key];
      }
    }

    const liveRate = parseFloat(merged.liveRate) || 0;
    const netWeight = parseFloat(merged.netWeight) || 0;
    const stoneWeight = parseFloat(merged.stoneWeight) || 0;
    const vaPercentage = parseFloat(merged.vaPercentage) || 0;
    const stoneCost = parseFloat(merged.stoneCost) || 0;
    const discountAmount = parseFloat(merged.discountAmount) || 0;
    const weightAdjustmentGrams = parseFloat(merged.weightAdjustmentGrams) || 0;
    const adjustmentCost = parseFloat(merged.adjustmentCost) || 0;

    const finalWeight = netWeight + weightAdjustmentGrams;
    const grossWeight = finalWeight + stoneWeight;

    const goldValue = finalWeight * liveRate;
    const vaAmount = goldValue * (vaPercentage / 100);
    const subtotalBeforeDisc = goldValue + vaAmount + stoneCost + adjustmentCost;
    const subtotalAfterDisc = Math.max(0, subtotalBeforeDisc - discountAmount);
    const gstAmount = subtotalAfterDisc * 0.03;
    const totalAmount = subtotalAfterDisc + gstAmount;
    const originalCartValue = subtotalBeforeDisc + subtotalBeforeDisc * 0.03;

    // advanceCash is untouched by edit — recompute balance against what's already been paid
    const balanceAmount = Math.max(0, totalAmount - existing.advanceCash);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        customerName: merged.customerName,
        phoneNumber: merged.phoneNumber,
        itemName: merged.itemName,
        itemDescription: merged.itemDescription,
        metalType: merged.metalType,
        purity: merged.purity,
        liveRate,
        netWeight,
        stoneWeight,
        grossWeight,
        vaPercentage,
        stoneCost,
        discountAmount,
        exchangeJewelleryName: merged.exchangeJewelleryName,
        exchangeJewelleryGrams: parseFloat(merged.exchangeJewelleryGrams) || 0,
        deadlineDate: fields.deadlineDate ? new Date(fields.deadlineDate) : existing.deadlineDate,
        weightAdjustmentGrams,
        adjustmentCost,
        gst: gstAmount,
        totalAmount,
        originalCartValue,
        balanceAmount,
        status: fields.status || existing.status,
      },
      select: {
        id: true,
        orderId: true,
        customerName: true,
        phoneNumber: true,
        itemName: true,
        itemDescription: true,
        metalType: true,
        purity: true,
        liveRate: true,
        stoneWeight: true,
        netWeight: true,
        grossWeight: true,
        vaPercentage: true,
        stoneCost: true,
        gst: true,
        originalCartValue: true,
        exchangeJewelleryName: true,
        exchangeJewelleryGrams: true,
        totalAmount: true,
        advanceCash: true,
        discountAmount: true,
        balanceAmount: true,
        weightAdjustmentGrams: true,
        adjustmentCost: true,
        deadlineDate: true,
        createdAt: true,
        createdBy: true,
        status: true,
        jobWorkId: true,
        payments: {
          select: { id: true, amount: true, note: true, paidAt: true, createdBy: true, createdAt: true },
          orderBy: { paidAt: "asc" },
        },
      },
    });

    return new NextResponse(
      JSON.stringify({ success: true, message: "Order updated", order: updatedOrder }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error("EDIT_ORDER_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to update order", details: error.message }),
      { status: 500, headers: corsHeaders() }
    );
  }
}