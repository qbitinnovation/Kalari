import { NextRequest, NextResponse } from 'next/server';
import connectDB, { User } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { readStore } from '@/lib/localStore';
import { ensureLocalBootstrapUsers, ensureMongoBootstrapUsers } from '@/lib/bootstrapUsers';

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    await connectDB();
    await ensureMongoBootstrapUsers();
    const { p_email: email, p_password: password } = body;

    const user = await (User as any).findOne({ email }).lean();
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const hash = user.password_hash || user.password;
    if (!hash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      data: {
        success: true,
        user: {
          id: String(user._id),
          email: user.email,
          role: user.role || "staff",
          full_name: user.full_name || ""
        }
      }
    });
  } catch (error: any) {
    const { p_email: email, p_password: password } = body || await req.json().catch(() => ({}));
    await ensureLocalBootstrapUsers();
    const store = await readStore();
    const user = store.users.find((item: any) => item.email === email && item.password === password);
    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    return NextResponse.json({
      data: {
        success: true,
        user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name || "" },
      },
      fallback: true,
    });
  }
}
