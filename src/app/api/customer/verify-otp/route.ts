import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";

const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, "").trim();
const recordId = (record: any) => String(record?.id || record?._id || "");
const createToken = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
const tokenExpiry = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();
const hasPassword = (customer: any) => Boolean(customer?.password_hash || customer?.password);

const customerPayload = (customer: any) => ({
  id: recordId(customer),
  name: customer?.name || "Guest Customer",
  phone: customer?.phone || "",
  email: customer?.email || "",
});

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const phone = normalizePhone(String(body?.phone || ""));
    const code = String(body?.code || "").trim();
    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
    }

    await connectDB();
    const Otp = getGenericModel("customer_otps") as any;
    const Customer = getGenericModel("customers") as any;
    const otp = await Otp.findOne({ phone, code, used: false }).sort({ created_at: -1 }).lean();
    if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    await Otp.updateOne({ _id: otp._id }, { $set: { used: true, used_at: new Date().toISOString() } });
    let customer = await Customer.findOne({ phone }).lean();
    const registrationToken = createToken();
    if (!customer) {
      customer = await Customer.create({
        name: "Guest Customer",
        phone,
        email: "",
        phone_verified: true,
        registration_token: registrationToken,
        registration_token_expires_at: tokenExpiry(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (!hasPassword(customer)) {
      await Customer.updateOne(
        { _id: customer._id },
        {
          $set: {
            phone_verified: true,
            registration_token: registrationToken,
            registration_token_expires_at: tokenExpiry(),
            updated_at: new Date().toISOString(),
          },
        }
      );
      customer = await Customer.findOne({ phone }).lean();
    } else {
      await Customer.updateOne({ _id: customer._id }, { $set: { phone_verified: true, updated_at: new Date().toISOString() } });
    }

    const passwordReady = hasPassword(customer);
    return NextResponse.json({
      data: {
        success: true,
        mode: passwordReady ? "login" : "register",
        customer: passwordReady ? customerPayload(customer) : undefined,
        registration_token: passwordReady ? undefined : (customer?.registration_token || registrationToken),
      },
    });
  } catch {
    const phone = normalizePhone(String(body?.phone || ""));
    const code = String(body?.code || "").trim();
    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
    }

    const store = await readStore();
    store.customer_otps = store.customer_otps || [];
    store.customers = store.customers || [];

    const otpIndex = store.customer_otps.findIndex((otp: any) => otp.phone === phone && otp.code === code && !otp.used);
    const otp = otpIndex >= 0 ? store.customer_otps[otpIndex] : null;
    if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    store.customer_otps[otpIndex] = { ...otp, used: true, used_at: new Date().toISOString() };
    let customer = store.customers.find((item: any) => item.phone === phone);
    const registrationToken = createToken();
    if (!customer) {
      customer = {
        id: `customer-${Date.now()}`,
        name: "Guest Customer",
        phone,
        email: "",
        phone_verified: true,
        registration_token: registrationToken,
        registration_token_expires_at: tokenExpiry(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.customers.push(customer);
    } else if (!hasPassword(customer)) {
      customer.phone_verified = true;
      customer.registration_token = registrationToken;
      customer.registration_token_expires_at = tokenExpiry();
      customer.updated_at = new Date().toISOString();
    } else {
      customer.phone_verified = true;
      customer.updated_at = new Date().toISOString();
    }
    await writeStore(store);

    const passwordReady = hasPassword(customer);
    return NextResponse.json({
      data: {
        success: true,
        mode: passwordReady ? "login" : "register",
        customer: passwordReady ? customerPayload(customer) : undefined,
        registration_token: passwordReady ? undefined : customer.registration_token,
      },
      fallback: true,
    });
  }
}
