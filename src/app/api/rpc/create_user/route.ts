import { NextRequest, NextResponse } from 'next/server';
import connectDB, { User } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { readStore, writeStore } from '@/lib/localStore';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { p_email, p_password, p_role, p_full_name, p_commission_percentage } = await req.json();

    if (!p_email || !p_password) {
      return NextResponse.json({ data: { success: false, error: "Email and password are required" } }, { status: 400 });
    }

    const existing = await (User as any).findOne({ email: p_email }).lean();
    if (existing) {
      return NextResponse.json({ data: { success: false, error: "A user with this email already exists" } });
    }

    const password_hash = await bcrypt.hash(p_password, 10);
    const user = await (User as any).create({
      email: p_email,
      password_hash,
      role: p_role || "staff",
      full_name: p_full_name || "",
      commission_percentage: p_commission_percentage ? Number(p_commission_percentage) : 0,
      active: true,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      data: {
        success: true,
        user: {
          id: String(user._id),
          email: user.email,
          role: user.role,
          full_name: user.full_name
        }
      }
    });
  } catch (error: any) {
    const { p_email, p_password, p_role, p_full_name, p_commission_percentage } = await req.json().catch(() => ({}));
    if (!p_email || !p_password) {
      return NextResponse.json({ data: { success: false, error: "Email and password are required" } }, { status: 400 });
    }
    const store = await readStore();
    store.users = store.users || [];
    if (store.users.some((user: any) => user.email === p_email)) {
      return NextResponse.json({ data: { success: false, error: "A user with this email already exists" } });
    }
    store.users.push({
      id: `user-${Date.now()}`,
      email: p_email,
      password: p_password,
      role: p_role || "staff",
      full_name: p_full_name || "",
      commission_percentage: p_commission_percentage ? Number(p_commission_percentage) : 0,
      active: true,
      created_at: new Date().toISOString(),
    });
    await writeStore(store);
    return NextResponse.json({ data: { success: true }, fallback: true });
  }
}
