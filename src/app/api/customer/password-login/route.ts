import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore } from "@/lib/localStore";

const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, "").trim();
const recordId = (record: any) => String(record?.id || record?._id || "");

const customerPayload = (customer: any) => ({
  id: recordId(customer),
  name: customer?.name || "Guest Customer",
  phone: customer?.phone || "",
  email: customer?.email || "",
});

const comparePassword = async (password: string, stored: string) => {
  if (!stored) return false;
  if (stored.startsWith("$2")) return bcrypt.compare(password, stored);
  return password === stored;
};

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const phone = normalizePhone(String(body?.phone || ""));
    const password = String(body?.password || "");
    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
    }

    await connectDB();
    const Customer = getGenericModel("customers") as any;
    const customer = await Customer.findOne({ phone }).lean();
    if (!customer) return NextResponse.json({ error: "No customer account found" }, { status: 404 });

    const valid = await comparePassword(password, customer.password_hash || customer.password);
    if (!valid) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

    return NextResponse.json({ data: { success: true, customer: customerPayload(customer) } });
  } catch {
    const phone = normalizePhone(String(body?.phone || ""));
    const password = String(body?.password || "");
    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
    }

    const store = await readStore();
    const customer = (store.customers || []).find((item: any) => item.phone === phone);
    if (!customer) return NextResponse.json({ error: "No customer account found" }, { status: 404 });

    const valid = await comparePassword(password, customer.password_hash || customer.password);
    if (!valid) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

    return NextResponse.json({ data: { success: true, customer: customerPayload(customer) }, fallback: true });
  }
}
