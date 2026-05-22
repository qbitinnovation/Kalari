import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore } from "@/lib/localStore";

const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, "").trim();
const hasPassword = (customer: any) => Boolean(customer?.password_hash || customer?.password);

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const phone = normalizePhone(String(body?.phone || ""));
    if (phone.length < 8) {
      return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    }

    await connectDB();
    const Customer = getGenericModel("customers") as any;
    const customer = await Customer.findOne({ phone }).lean();

    return NextResponse.json({
      data: {
        success: true,
        phone,
        exists: Boolean(customer),
        has_password: hasPassword(customer),
      },
    });
  } catch {
    const phone = normalizePhone(String(body?.phone || ""));
    if (phone.length < 8) {
      return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    }

    const store = await readStore();
    const customer = (store.customers || []).find((item: any) => item.phone === phone);

    return NextResponse.json({
      data: {
        success: true,
        phone,
        exists: Boolean(customer),
        has_password: hasPassword(customer),
      },
      fallback: true,
    });
  }
}
