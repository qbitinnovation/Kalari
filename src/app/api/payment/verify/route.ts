import { NextRequest, NextResponse } from 'next/server';
import { getRazorpay } from '@/lib/razorpay';
import crypto from 'crypto';
import { createNotification } from '@/lib/notificationStore';

export async function POST(req: NextRequest) {
  try {
    if (!getRazorpay()) {
      return NextResponse.json({
        error: "Payments not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables",
      }, { status: 503 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await createNotification({
        type: "PAYMENT_FAILURE",
        module: "PAYMENT",
        title: "Payment verification failed",
        message: `Razorpay verification failed for order ${razorpay_order_id}.`,
        severity: "ERROR",
        action_url: "/admin/tickets",
        metadata: { razorpay_order_id, razorpay_payment_id },
      });
      return NextResponse.json({ error: "Payment verification failed", valid: false }, { status: 400 });
    }

    return NextResponse.json({ data: { valid: true, payment_id: razorpay_payment_id } });
  } catch (error: any) {
    await createNotification({
      type: "PAYMENT_FAILURE",
      module: "PAYMENT",
      title: "Payment verification error",
      message: error.message || "Payment verification failed.",
      severity: "ERROR",
      action_url: "/admin/tickets",
    });
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}
