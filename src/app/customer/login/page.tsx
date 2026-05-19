"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Phone, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui";

type CustomerSession = {
  id: string;
  name: string;
  phone: string;
  email?: string;
};

const SESSION_KEY = "kalari_customer";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) router.replace("/customer");
  }, [router]);

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/customer/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send OTP.");
      setDebugOtp(payload.data?.debug_otp || "");
      setStep("otp");
      setNotice("OTP sent. Use the code below in development.");
    } catch (error: any) {
      setNotice(error.message || "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data?.customer) throw new Error(payload.error || "OTP verification failed.");
      const customer: CustomerSession = payload.data.customer;
      localStorage.setItem(SESSION_KEY, JSON.stringify(customer));
      router.replace("/customer");
    } catch (error: any) {
      setNotice(error.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f3eb] pt-24 text-stone-950">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section>
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-950">
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              Secure phone login
            </div>
            <h1 className="text-5xl font-black leading-tight sm:text-6xl">Your Kalari bookings, tickets, and requests.</h1>
            <p className="mt-5 max-w-xl text-lg font-medium leading-8 text-stone-600">
              Sign in with the same phone number used while booking to view QR tickets, print confirmations, and request cancellations.
            </p>
          </div>
        </section>

        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              {step === "phone" ? <Phone className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-2xl font-black">{step === "phone" ? "Customer Login" : "Verify OTP"}</h2>
              <p className="text-sm font-semibold text-stone-500">{step === "phone" ? "Enter your booking phone number" : `Code sent to ${phone}`}</p>
            </div>
          </div>

          {notice && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{notice}</div>}
          {debugOtp && step === "otp" && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900">
              Development OTP: {debugOtp}
            </div>
          )}

          {step === "phone" ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <Input
                variant="public"
                label="Phone number"
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="+91 98765 43210"
                required
              />
              <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-6 py-4 font-black text-white transition hover:bg-stone-800 disabled:opacity-50">
                {loading ? "Sending..." : "Send OTP"}
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold">OTP code</span>
                <input
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-4 py-3 text-center text-2xl font-black tracking-widest outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="123456"
                  required
                />
              </label>
              <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-4 font-black text-stone-950 transition hover:bg-amber-400 disabled:opacity-50">
                {loading ? "Checking..." : "View My Bookings"}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => { setStep("phone"); setOtp(""); setDebugOtp(""); }} className="w-full rounded-lg px-4 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50">
                Use another phone number
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
