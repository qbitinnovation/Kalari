import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";
import {
  getBookingEmailError,
  getBookingNameError,
} from "@/lib/bookingCustomer";

const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, "").trim();
const recordId = (record: any) => String(record?.id || record?._id || "");

const customerPayload = (customer: any) => ({
  id: recordId(customer),
  name: customer?.name || "",
  phone: customer?.phone || "",
  email: customer?.email || "",
});

const tokenValid = (customer: any, token: string) =>
  customer?.registration_token &&
  customer.registration_token === token &&
  new Date(customer.registration_token_expires_at || 0).getTime() > Date.now();

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const phone = normalizePhone(String(body?.phone || ""));
    const password = String(body?.password || "");
    const registrationToken = String(body?.registration_token || "");
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const nameError = getBookingNameError(name);
    const emailError = getBookingEmailError(email);
    if (!phone || password.length < 6 || !registrationToken) {
      return NextResponse.json({ error: "Phone, verified token, and a 6+ character password are required" }, { status: 400 });
    }
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    await connectDB();
    const Customer = getGenericModel("customers") as any;
    const customer = await Customer.findOne({ phone }).lean();
    if (!customer || !tokenValid(customer, registrationToken)) {
      return NextResponse.json({ error: "Password setup session expired. Please verify OTP again." }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await Customer.updateOne(
      { _id: customer._id },
      {
        $set: {
          name,
          email,
          password_hash: passwordHash,
          phone_verified: true,
          password_set_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        $unset: {
          registration_token: "",
          registration_token_expires_at: "",
        },
      }
    );
    const updated = await Customer.findOne({ phone }).lean();

    return NextResponse.json({ data: { success: true, customer: customerPayload(updated) } });
  } catch {
    const phone = normalizePhone(String(body?.phone || ""));
    const password = String(body?.password || "");
    const registrationToken = String(body?.registration_token || "");
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const nameError = getBookingNameError(name);
    const emailError = getBookingEmailError(email);
    if (!phone || password.length < 6 || !registrationToken) {
      return NextResponse.json({ error: "Phone, verified token, and a 6+ character password are required" }, { status: 400 });
    }
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    const store = await readStore();
    store.customers = store.customers || [];
    const customer = store.customers.find((item: any) => item.phone === phone);
    if (!customer || !tokenValid(customer, registrationToken)) {
      return NextResponse.json({ error: "Password setup session expired. Please verify OTP again." }, { status: 401 });
    }

    customer.name = name;
    customer.email = email;
    customer.password_hash = await bcrypt.hash(password, 10);
    customer.phone_verified = true;
    customer.password_set_at = new Date().toISOString();
    customer.updated_at = new Date().toISOString();
    delete customer.registration_token;
    delete customer.registration_token_expires_at;
    await writeStore(store);

    return NextResponse.json({ data: { success: true, customer: customerPayload(customer) }, fallback: true });
  }
}
