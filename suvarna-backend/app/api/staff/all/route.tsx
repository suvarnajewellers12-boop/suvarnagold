import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// Always resolve staff credentials and assignments from the current database.
export const dynamic = "force-dynamic";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Cache-Control": "no-store",
  };
}

function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

type RangeType = "day" | "week" | "month" | "overall" | "custom";

const INDIA_OFFSET = "+05:30";

function parseIndiaStart(dateString: string) {
  return new Date(`${dateString}T00:00:00.000${INDIA_OFFSET}`);
}

function parseIndiaEnd(dateString: string) {
  return new Date(`${dateString}T23:59:59.999${INDIA_OFFSET}`);
}

function datePartsInIndia(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
  };
}

function formatDateOnly(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysToDateOnly(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return formatDateOnly(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

function getPeriod(
  range: RangeType,
  from: string | null,
  to: string | null
) {
  if (range === "overall") {
    return {
      range,
      from: null as Date | null,
      to: null as Date | null,
      label: "Overall",
    };
  }

  if (range === "custom") {
    if (!from || !to) {
      throw new Error("Custom range requires both from and to dates");
    }

    const start = parseIndiaStart(from);
    const end = parseIndiaEnd(to);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    ) {
      throw new Error("Invalid custom date range");
    }

    return {
      range,
      from: start,
      to: end,
      label: `${from} to ${to}`,
    };
  }

  const todayParts = datePartsInIndia();
  const today = formatDateOnly(
    todayParts.year,
    todayParts.month,
    todayParts.day
  );

  if (range === "day") {
    return {
      range,
      from: parseIndiaStart(today),
      to: parseIndiaEnd(today),
      label: `Today (${today})`,
    };
  }

  if (range === "week") {
    // Current calendar week, Monday → Sunday, in Asia/Kolkata.
    const weekdayOrder: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };

    const offsetFromMonday = weekdayOrder[todayParts.weekday] ?? 0;
    const weekStart = addDaysToDateOnly(today, -offsetFromMonday);
    const weekEnd = addDaysToDateOnly(weekStart, 6);

    return {
      range,
      from: parseIndiaStart(weekStart),
      to: parseIndiaEnd(weekEnd),
      label: `This Week (${weekStart} to ${weekEnd})`,
    };
  }

  // month
  const firstDay = formatDateOnly(
    todayParts.year,
    todayParts.month,
    1
  );

  const nextMonthYear =
    todayParts.month === 12
      ? todayParts.year + 1
      : todayParts.year;

  const nextMonth =
    todayParts.month === 12
      ? 1
      : todayParts.month + 1;

  const nextMonthFirst = formatDateOnly(
    nextMonthYear,
    nextMonth,
    1
  );

  const lastDay = addDaysToDateOnly(nextMonthFirst, -1);

  return {
    range: "month" as const,
    from: parseIndiaStart(firstDay),
    to: parseIndiaEnd(lastDay),
    label: `This Month (${firstDay} to ${lastDay})`,
  };
}

// ================= GET ALL STAFF + FILTERED PERFORMANCE =================
export async function GET(req: Request) {
  try {
    // ─────────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");

    const match = /^Bearer\s+(\S+)$/i.exec(authHeader ?? "");
    if (!match) return json({ error: "Unauthorized" }, 401);

    let decoded;
    try {
      decoded = await verifyToken(match[1]);
    } catch {
      return json({ error: "Invalid Token" }, 401);
    }

    if (!decoded || typeof decoded !== "object") {
      return json({ error: "Invalid Token" }, 401);
    }
    if (!("role" in decoded) || decoded.role !== "SUPER_ADMIN") {
      return json({ error: "Forbidden" }, 403);
    }

    // ─────────────────────────────────────────────
    // DATE FILTER
    // ─────────────────────────────────────────────
    const url = new URL(req.url);

    const rawRange = (url.searchParams.get("range") || "month").toLowerCase();

    const allowedRanges: RangeType[] = [
      "day",
      "week",
      "month",
      "overall",
      "custom",
    ];

    if (!allowedRanges.includes(rawRange as RangeType)) {
      return json(
        {
          error:
            "Invalid range. Use day, week, month, overall, or custom.",
        },
        400
      );
    }

    const range = rawRange as RangeType;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let period;

    try {
      period = getPeriod(range, from, to);
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid date filter",
        },
        400
      );
    }

    const purchaseWhere: any = {
      paymentStatus: "SUCCESS",
    };

    if (period.from && period.to) {
      purchaseWhere.purchasedAt = {
        gte: period.from,
        lte: period.to,
      };
    }

    // ─────────────────────────────────────────────
    // STAFF
    // ─────────────────────────────────────────────
    const staff = await prisma.staff.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        fullName: true,
        dateOfJoining: true,
        monthlySalary: true,
        gender: true,
        phoneNumber: true,
        aadharNumber: true,
        panCardNumber: true,
        nomineeName: true,
        nomineeRelation: true,
        nomineePhoneNumber: true,
        nomineeAddress: true,
        createdAt: true,
        createdBy: true,
        roles: true,
        branch: true,
        // Server-side only: derive setup status and never serialize this field.
        passwordHash: true,
      },
    });

    // ─────────────────────────────────────────────
    // SALESMAN METRICS
    // ─────────────────────────────────────────────
    const salesmanMetrics = await prisma.purchase.groupBy({
      by: ["salesmanId"],
      where: {
        ...purchaseWhere,
        salesmanId: {
          not: null,
        },
      },
      _sum: {
        finalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // ─────────────────────────────────────────────
    // CASHIER / COLLECTION METRICS
    // ─────────────────────────────────────────────
    const cashierMetrics = await prisma.purchase.groupBy({
      by: ["cashierId"],
      where: {
        ...purchaseWhere,
        cashierId: {
          not: null,
        },
      },
      _sum: {
        cashAmount: true,
        upiAmount: true,
        cardAmount: true,
        chequeAmount: true,
      },
      _count: {
        id: true,
      },
    });

    const salesmanMap = new Map(
      salesmanMetrics.map((item) => [
        item.salesmanId,
        item,
      ])
    );

    const cashierMap = new Map(
      cashierMetrics.map((item) => [
        item.cashierId,
        item,
      ])
    );

    const enrichedStaff = staff.map((staffMember) => {
      const sales = salesmanMap.get(staffMember.id);
      const cashier = cashierMap.get(staffMember.id);

      const cashCollected =
        cashier?._sum.cashAmount ?? 0;

      const upiCollected =
        cashier?._sum.upiAmount ?? 0;

      const cardCollected =
        cashier?._sum.cardAmount ?? 0;

      const chequeCollected =
        cashier?._sum.chequeAmount ?? 0;

      const totalCollected =
        cashCollected +
        upiCollected +
        cardCollected +
        chequeCollected;

      // Status describes setup only; the current schema cannot tell when
      // a password changed or whether it is still the initial employee ID.
      const hasPassword = typeof staffMember.passwordHash === "string" &&
        staffMember.passwordHash.length > 0;

      return {
        id: staffMember.id,
        fullName: staffMember.fullName,
        dateOfJoining: staffMember.dateOfJoining,
        monthlySalary: staffMember.monthlySalary,
        gender: staffMember.gender,
        phoneNumber: staffMember.phoneNumber,
        aadharNumber: staffMember.aadharNumber,
        panCardNumber: staffMember.panCardNumber,
        nomineeName: staffMember.nomineeName,
        nomineeRelation: staffMember.nomineeRelation,
        nomineePhoneNumber: staffMember.nomineePhoneNumber,
        nomineeAddress: staffMember.nomineeAddress,
        createdAt: staffMember.createdAt,
        createdBy: staffMember.createdBy,

        // Keep the plural roles array for the frontend multi-select.
        roles: staffMember.roles ?? [],
        branch: staffMember.branch ?? null,
        hasPassword,
        passwordStatus: hasPassword ? "SET" : "NOT_SET",

        // Salesman metrics
        salesAmount:
          sales?._sum.finalAmount ?? 0,

        salesCount:
          sales?._count.id ?? 0,

        // Cashier / settlement collection metrics
        cashCollected,
        upiCollected,
        cardCollected,
        chequeCollected,
        totalCollected,

        // Number of successful invoices handled as cashier
        cashierCount:
          cashier?._count.id ?? 0,
      };
    });

    // ─────────────────────────────────────────────
    // OVERALL SUMMARY FOR THIS PERIOD
    // ─────────────────────────────────────────────
    const summary = enrichedStaff.reduce(
      (acc, member) => {
        acc.salesAmount += Number(member.salesAmount) || 0;
        acc.salesCount += Number(member.salesCount) || 0;
        acc.cashCollected += Number(member.cashCollected) || 0;
        acc.upiCollected += Number(member.upiCollected) || 0;
        acc.cardCollected += Number(member.cardCollected) || 0;
        acc.chequeCollected += Number(member.chequeCollected) || 0;
        acc.totalCollected += Number(member.totalCollected) || 0;
        acc.cashierCount += Number(member.cashierCount) || 0;
        return acc;
      },
      {
        salesAmount: 0,
        salesCount: 0,
        cashCollected: 0,
        upiCollected: 0,
        cardCollected: 0,
        chequeCollected: 0,
        totalCollected: 0,
        cashierCount: 0,
      }
    );

    return json({
      staff: enrichedStaff,

      period: {
        range: period.range,
        label: period.label,
        from: period.from?.toISOString() ?? null,
        to: period.to?.toISOString() ?? null,
        timezone: "Asia/Kolkata",
      },

      summary,
    });
  } catch (error) {
    console.error("Fetch staff operation failed");

    return json(
      {
        error: "Internal Server Error",
      },
      500
    );
  }
}
