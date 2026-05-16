import { NextRequest, NextResponse } from 'next/server';
import connectDB, { User } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { userId, newPassword } = await req.json();
    if (!userId || !newPassword) {
      return NextResponse.json({ error: "userId and newPassword are required" }, { status: 400 });
    }
    const password_hash = await bcrypt.hash(newPassword, 10);
    await (User as any).updateOne({ _id: userId }, { $set: { password_hash } });
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to change password" }, { status: 500 });
  }
}
