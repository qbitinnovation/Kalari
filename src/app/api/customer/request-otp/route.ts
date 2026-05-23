import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";

const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, "").trim();
const createOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const phone = normalizePhone(String(body?.phone || ""));
    if (phone.length < 8) {
      return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    }

    const code = createOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await connectDB();
    const Otp = getGenericModel("customer_otps") as any;
    await Otp.updateMany({ phone, used: false }, { $set: { used: true } });
    await Otp.create({
      phone,
      code,
      used: false,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      data: {
        success: true,
        expires_at: expiresAt,
        debug_otp: code,
      },
    });
  } catch {
    const phone = normalizePhone(String(body?.phone || ""));
    if (phone.length < 8) {
      return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    }

    const store = await readStore();
    store.customer_otps = store.customer_otps || [];
    store.customer_otps = store.customer_otps.map((otp: any) =>
      otp.phone === phone && !otp.used ? { ...otp, used: true } : otp
    );

    const code = createOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    store.customer_otps.push({
      id: `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phone,
      code,
      used: false,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
    await writeStore(store);

    return NextResponse.json({
      data: {
        success: true,
        expires_at: expiresAt,
        debug_otp: code,
      },
      fallback: true,
    });
  }
}
