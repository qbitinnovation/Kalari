"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { IndianPhoneField, Input } from "@/components/ui";
import {
  formatIndianMobileDisplay,
  formatIndianMobileForStorage,
  getIndianMobileDigits,
  getIndianMobileValidationError,
} from "@/lib/indianPhone";
import {
  getBookingEmailError,
  getBookingNameError,
} from "@/lib/bookingCustomer";

type CustomerSession = {
  id: string;
  name: string;
  phone: string;
  email?: string;
};

type LoginStep =
  | "phone"
  | "choice"
  | "send-otp"
  | "otp"
  | "password"
  | "set-password";

const SESSION_KEY = "kalari_customer";

const safeRedirectPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/customer";
  if (value.startsWith("/admin")) return "/customer";
  return value;
};

export default function CustomerLoginPage() {
  const router = useRouter();
  const [redirectPath, setRedirectPath] = useState("/customer");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [registrationName, setRegistrationName] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationNameError, setRegistrationNameError] = useState("");
  const [registrationEmailError, setRegistrationEmailError] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [step, setStep] = useState<LoginStep>("phone");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const nextRedirect = safeRedirectPath(new URLSearchParams(window.location.search).get("redirect"));
    setRedirectPath(nextRedirect);
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) router.replace(nextRedirect);
  }, [router]);

  const storeSession = (customer: CustomerSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(customer));
    router.replace(redirectPath);
  };

  const getApiPhone = () => formatIndianMobileForStorage(phone);
  const phoneLabel = formatIndianMobileDisplay(phone) || phone;

  const sendOtp = async (
    nextNotice = "OTP sent. Use the test code shown below.",
  ) => {
    const response = await fetch("/api/customer/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: getApiPhone() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not send OTP.");
    setDebugOtp(payload.data?.debug_otp || "");
    setStep("otp");
    setNotice(nextNotice);
  };

  const checkPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextPhoneError = getIndianMobileValidationError(phone, true);
    setPhoneError(nextPhoneError);
    if (nextPhoneError) return;

    setLoading(true);
    setNotice("");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setDebugOtp("");
    setRegistrationToken("");
    try {
      const formattedPhone = formatIndianMobileForStorage(phone);
      const response = await fetch("/api/customer/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Could not check this phone number.");

      setPhone(getIndianMobileDigits(payload.data.phone));
      setHasPassword(Boolean(payload.data.has_password));
      if (payload.data.exists) {
        setStep("choice");
        setNotice(
          payload.data.has_password
            ? "Choose how you want to continue."
            : "Verify OTP once to set your password.",
        );
      } else {
        setStep("send-otp");
        setNotice("Create your account with OTP verification.");
      }
    } catch (error: any) {
      setNotice(error.message || "Could not check this phone number.");
    } finally {
      setLoading(false);
    }
  };

  const startOtpLogin = async () => {
    setLoading(true);
    setNotice("");
    try {
      await sendOtp(
        hasPassword
          ? "OTP sent for login."
          : "OTP sent. Verify to set your password.",
      );
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
        body: JSON.stringify({ phone: getApiPhone(), code: otp }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "OTP verification failed.");

      if (payload.data?.mode === "register") {
        setRegistrationToken(payload.data.registration_token || "");
        setRegistrationName("");
        setRegistrationEmail("");
        setRegistrationNameError("");
        setRegistrationEmailError("");
        setPassword("");
        setConfirmPassword("");
        setStep("set-password");
        setNotice(
          "Phone verified. Enter your name and set a password to finish account setup.",
        );
        return;
      }

      if (!payload.data?.customer) throw new Error("OTP verification failed.");
      storeSession(payload.data.customer);
    } catch (error: any) {
      setNotice(error.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const passwordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/customer/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: getApiPhone(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data?.customer)
        throw new Error(payload.error || "Password login failed.");
      storeSession(payload.data.customer);
    } catch (error: any) {
      setNotice(error.message || "Password login failed.");
    } finally {
      setLoading(false);
    }
  };

  const setCustomerPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextNameError = getBookingNameError(registrationName);
    const nextEmailError = getBookingEmailError(registrationEmail);
    setRegistrationNameError(nextNameError);
    setRegistrationEmailError(nextEmailError);
    if (nextNameError || nextEmailError) return;

    setLoading(true);
    setNotice("");
    try {
      if (password.length < 6)
        throw new Error("Password must be at least 6 characters.");
      if (password !== confirmPassword)
        throw new Error("Passwords do not match.");

      const response = await fetch("/api/customer/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: getApiPhone(),
          password,
          registration_token: registrationToken,
          name: registrationName.trim(),
          email: registrationEmail.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data?.customer)
        throw new Error(payload.error || "Could not set password.");
      storeSession(payload.data.customer);
    } catch (error: any) {
      setNotice(error.message || "Could not set password.");
    } finally {
      setLoading(false);
    }
  };

  const resetPhone = () => {
    setStep("phone");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setDebugOtp("");
    setNotice("");
    setPhoneError("");
    setRegistrationToken("");
    setRegistrationName("");
    setRegistrationEmail("");
    setRegistrationNameError("");
    setRegistrationEmailError("");
  };

  const title =
    step === "phone"
      ? "Login"
      : step === "choice"
        ? "Continue Login"
        : step === "send-otp"
          ? "Send OTP"
          : step === "password"
            ? "Enter Password"
            : step === "set-password"
              ? "Set Password"
              : "Verify OTP";

  const subtitle =
    step === "phone"
      ? "Please enter your mobile number"
      : step === "choice"
        ? `Choose a login method for ${phoneLabel}`
        : step === "send-otp"
          ? `Send a verification code to ${phoneLabel}`
          : step === "password"
            ? `Password login for ${phoneLabel}`
            : step === "set-password"
              ? "Enter your name and create a password"
              : `Code sent to ${phoneLabel}`;

  return (
    <main className="min-h-screen bg-[#f7f3eb] pt-24 text-stone-950">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section>
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              Secure login
            </div>
            <h1 className="text-5xl font-black leading-tight sm:text-6xl">
              Your bookings, tickets, and requests.
            </h1>
            <p className="mt-5 max-w-xl text-lg font-medium leading-8 text-stone-600">
              Use your booking mobile number to view tickets, manage bookings,
              and request cancellations.
            </p>
          </div>
        </section>

        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              {step === "phone" ? (
                <Phone className="h-6 w-6" />
              ) : step === "set-password" || step === "password" ? (
                <KeyRound className="h-6 w-6" />
              ) : (
                <CheckCircle2 className="h-6 w-6" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black">{title}</h2>
              <p className="text-sm font-semibold text-stone-500">{subtitle}</p>
            </div>
          </div>

          {notice && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              {notice}
            </div>
          )}
          {debugOtp && step === "otp" && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900">
              Test OTP: {debugOtp}
            </div>
          )}

          {step === "phone" && (
            <form onSubmit={checkPhone} className="space-y-4">
              <IndianPhoneField
                variant="public"
                label="Mobile number"
                value={phone}
                onChange={(nextPhone) => {
                  setPhone(nextPhone);
                  if (phoneError) setPhoneError(getIndianMobileValidationError(nextPhone, true));
                }}
                error={phoneError}
                required
              />
              <button
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-6 py-4 font-black text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                {loading ? "Checking..." : "Continue"}
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>
          )}

          {step === "choice" && (
            <div className="space-y-3">
              <button
                onClick={startOtpLogin}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-4 font-black text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {loading
                  ? "Sending..."
                  : hasPassword
                    ? "Login with OTP"
                    : "Verify OTP"}
                <ShieldCheck className="h-5 w-5" />
              </button>
              {hasPassword && (
                <button
                  onClick={() => {
                    setPassword("");
                    setStep("password");
                    setNotice("");
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-6 py-4 font-black text-white transition hover:bg-stone-800"
                >
                  Login with Password
                  <Lock className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={resetPhone}
                className="w-full rounded-lg px-4 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50"
              >
                Use another mobile number
              </button>
            </div>
          )}

          {step === "send-otp" && (
            <div className="space-y-3">
              <button
                onClick={startOtpLogin}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-4 font-black text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send OTP"}
                <ShieldCheck className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={resetPhone}
                className="w-full rounded-lg px-4 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50"
              >
                Use another mobile number
              </button>
            </div>
          )}

          {step === "otp" && (
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
              <button
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-4 font-black text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {loading ? "Checking..." : "Verify OTP"}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={resetPhone}
                className="w-full rounded-lg px-4 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50"
              >
                Use another mobile number
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={passwordLogin} className="space-y-4">
              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
              <button
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-6 py-4 font-black text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                {loading ? "Signing in..." : "View My Bookings"}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="w-full rounded-lg px-4 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50"
              >
                Choose another login method
              </button>
            </form>
          )}

          {step === "set-password" && (
            <form onSubmit={setCustomerPassword} className="space-y-4">
              <Input
                variant="public"
                label="Full name"
                value={registrationName}
                onChange={(name) => {
                  setRegistrationName(name);
                  if (registrationNameError) setRegistrationNameError(getBookingNameError(name));
                }}
                placeholder="Enter your full name"
                required
                error={registrationNameError}
                inputClassName="rounded-lg border border-stone-200 px-4 py-3 font-semibold"
              />
              <Input
                variant="public"
                label="Email (optional)"
                type="email"
                value={registrationEmail}
                onChange={(email) => {
                  setRegistrationEmail(email);
                  if (registrationEmailError) setRegistrationEmailError(getBookingEmailError(email));
                }}
                placeholder="you@example.com"
                error={registrationEmailError}
                inputClassName="rounded-lg border border-stone-200 px-4 py-3 font-semibold"
              />
              <PasswordField
                label="Create password"
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
              <button
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-6 py-4 font-black text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Finish Account Setup"}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={resetPhone}
                className="w-full rounded-lg px-4 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50"
              >
                Start again
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-stone-200 px-4 py-3 pr-12 font-bold outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="Minimum 6 characters"
          required
          minLength={6}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-950"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
