import { NextRequest, NextResponse } from 'next/server';
import { getRazorpay } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return NextResponse.json({
        error: "Payments not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables",
      }, { status: 503 });
    }

    const { amount, currency = "INR", receipt } = await req.json();
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create order" }, { status: 500 });
  }
}
