"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Ticket,
  WalletCards,
} from "lucide-react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { db } from "@/lib/database";
import {
  formatDisplayDateValue,
  formatDisplayTimeValue,
} from "@/components/ui/date-utils";
import {
  ARENA_TOP_LABEL,
  arrowForArenaSide,
  alignClassForArenaSide,
  groupSeatsByArenaSide,
  getSymmetricArenaSections,
  sideLabelForArenaSide,
  type ArenaSide,
} from "@/lib/arenaLayout";
import {
  createBookingReference,
  createTicketCodes,
  getAvailabilityLabel,
  getRecordId,
  isActiveBookingReservation,
  isShowBookableAt,
  parseSeatCodes,
} from "@/lib/booking";
import { buildShowAgentCommissionFields } from "@/lib/agentCommission";
import { isActivityPubliclyBookable, isActivityPubliclyVisible } from "@/lib/activityAvailability";
import { Input, IndianPhoneField } from "@/components/ui";
import { getIndianMobileDigits } from "@/lib/indianPhone";
import {
  getBookingCustomerErrors,
  hasBookingCustomerErrors,
  normalizeBookingPhone,
} from "@/lib/bookingCustomer";
const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface Show {
  id: string;
  _id?: string;
  title: string;
  date: string;
  time: string;
  price: number;
  image?: string;
  description?: string;
  status: string;
  booked_count?: number;
  available_count?: number;
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";
  layout?: { structure: any };
}

interface Activity {
  id: string;
  _id?: string;
  slug?: string;
  title: string;
  category?: string;
  location?: string;
  duration?: string;
  price: number;
  booking_price?: number;
  image?: string;
  description?: string;
  status?: string;
  booking_status?: "ACTIVE" | "PAUSED";
  daily_capacity?: number;
}

interface SeatOption {
  id: string;
  label: string;
  row: string;
  section: string;
}

interface BookingForm {
  name: string;
  phone: string;
  email: string;
}

type CustomerSession = {
  id: string;
  name: string;
  phone: string;
  email?: string;
};

type PaymentMethod = "razorpay" | "cod";
type Step = "show" | "seats" | "details" | "payment" | "success";

const CUSTOMER_SESSION_KEY = "kalari_customer";
const PENDING_BOOKING_KEY = "kalari_pending_booking";

const stepLabels: { id: Step; label: string }[] = [
  { id: "show", label: "Show" },
  { id: "seats", label: "Seats" },
  { id: "details", label: "Guest" },
  { id: "payment", label: "Payment" },
];

const fallbackBookingImage =
  "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1800&q=88";

const activityRouteId = (activity: Activity) =>
  encodeURIComponent(String(activity.slug || activity.id || activity._id || ""));

const BookingContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedShowId = searchParams.get("show");
  const preselectedActivityId = searchParams.get("activity");
  const preselectedDate = searchParams.get("date") || "";
  const validPreselectedShowId =
    preselectedShowId &&
    preselectedShowId !== "undefined" &&
    preselectedShowId !== "null"
      ? preselectedShowId
      : "";
  const [shows, setShows] = useState<Show[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set());
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("show");
  const [form, setForm] = useState<BookingForm>({
    name: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState<Partial<BookingForm>>({});
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "COD_PENDING">(
    "PAID",
  );
  const [ticketCodes, setTicketCodes] = useState<string[]>([]);
  const [showsLoading, setShowsLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [linkedShowAgent, setLinkedShowAgent] = useState<any>(null);
  const selectedShowIdRef = useRef("");

  useEffect(() => {
    const loadLinkedAgent = async () => {
      const agentId = String((selectedShow as any)?.agent_id || "");
      if (!agentId) {
        setLinkedShowAgent(null);
        return;
      }
      const { data } = await db.from("agents").select("*").eq("id", agentId).single();
      setLinkedShowAgent(data || null);
    };
    void loadLinkedAgent();
  }, [selectedShow]);

  useEffect(() => {
    fetchShows();
    fetchActivities();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) {
      setAuthChecked(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CustomerSession;
      if (!parsed?.id || !parsed?.phone) {
        localStorage.removeItem(CUSTOMER_SESSION_KEY);
        setAuthChecked(true);
        return;
      }
      setCustomerSession(parsed);
      setForm({
        name: parsed.name && parsed.name !== "Guest Customer" ? parsed.name : "",
        phone: getIndianMobileDigits(parsed.phone || ""),
        email: parsed.email || "",
      });
      setAuthChecked(true);
    } catch {
      localStorage.removeItem(CUSTOMER_SESSION_KEY);
      setAuthChecked(true);
    }
  }, [router]);

  useEffect(() => {
    const showId = selectedShow ? getRecordId(selectedShow) : "";
    selectedShowIdRef.current = showId;
    setBookedSeats(new Set());
    if (showId) fetchBookedSeats(showId);
  }, [selectedShow]);

  useEffect(() => {
    if (!validPreselectedShowId || shows.length === 0) return;

    const show = shows.find(
      (item) => getRecordId(item) === validPreselectedShowId,
    );
    if (!show) return;

    if (selectedShow && getRecordId(selectedShow) === getRecordId(show)) return;

    setSelectedShow(show);
    setSelectedSeats([]);
    setStep("seats");
  }, [selectedShow, shows, validPreselectedShowId]);

  useEffect(() => {
    if (!authChecked || !customerSession || shows.length === 0) return;

    const rawPending = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!rawPending) return;

    try {
      const pending = JSON.parse(rawPending);
      const show = shows.find((item) => getRecordId(item) === pending.showId);
      if (!show) return;

      setSelectedShow(show);
      setSelectedSeats(Array.isArray(pending.selectedSeats) ? pending.selectedSeats : []);
      setStep("details");
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
    } catch {
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
    }
  }, [authChecked, customerSession, shows]);

  const fetchShows = async () => {
    setShowsLoading(true);
    let query = db
      .from("shows")
      .select("*, layout:layouts(*)")
      .in("status", ["ACTIVE"])
      .gte("date", new Date().toISOString().split("T")[0]);

    const { data, error } = await query.order("date", { ascending: true });

    if (error) setNotice(error.message || "Unable to load shows.");
    setShows(
      (data || []).filter(
        (show: Show) =>
          isShowBookableAt(show) &&
          show.availability_status !== "SOLD_OUT" &&
          Number(show.available_count ?? 1) > 0,
      ),
    );
    setShowsLoading(false);
  };

  const fetchActivities = async () => {
    setActivitiesLoading(true);
    try {
      const response = await fetch("/api/activities?status=ACTIVE");
      const payload = await response.json().catch(() => ({}));
      setActivities(
        (payload?.data || []).filter((activity: Activity) =>
          isActivityPubliclyVisible(activity),
        ),
      );
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchBookedSeats = async (showId: string) => {
    const { data } = await db
      .from("bookings")
      .select("seat_code")
      .eq("show_id", showId)
      .in("status", ["CONFIRMED", "HELD"]);

    const nextBooked = new Set<string>();
    data?.forEach((booking: any) => {
      if (isActiveBookingReservation(booking))
        parseSeatCodes(booking.seat_code).forEach((seat) =>
          nextBooked.add(seat),
        );
    });
    if (selectedShowIdRef.current !== showId) return;
    setBookedSeats(nextBooked);
  };

  const seats = useMemo<SeatOption[]>(() => {
    if (!selectedShow?.layout?.structure?.sections) return [];
    const generated: SeatOption[] = [];

    getSymmetricArenaSections(selectedShow.layout.structure.sections).forEach(
      (section: any) => {
        const sectionName = String(section.name || "Main");
        const prefix = sectionName.charAt(0).toUpperCase();

        if (Array.isArray(section.rows)) {
          section.rows.forEach((row: any, rowIndex: number) => {
            const rowLetter = String.fromCharCode(65 + rowIndex);
            for (let index = 1; index <= Number(row.seats || 0); index += 1) {
              generated.push({
                id: `${sectionName}-${rowLetter}-${index}`,
                label: `${prefix}${rowLetter}${index}`,
                row: rowLetter,
                section: sectionName,
              });
            }
          });
          return;
        }

        for (
          let rowIndex = 1;
          rowIndex <= Number(section.rows || 0);
          rowIndex += 1
        ) {
          const rowLetter = String.fromCharCode(64 + rowIndex);
          for (
            let index = 1;
            index <= Number(section.seatsPerRow || 0);
            index += 1
          ) {
            generated.push({
              id: `${sectionName}-${rowLetter}-${index}`,
              label: `${prefix}${rowLetter}${index}`,
              row: rowLetter,
              section: sectionName,
            });
          }
        }
      },
    );

    return generated;
  }, [selectedShow]);

  const sectionNames = Array.from(new Set(seats.map((seat) => seat.section)));
  const totalTickets = selectedSeats.length;
  const selectedSeatLabels = selectedSeats
    .map((id) => seats.find((seat) => seat.id === id)?.label || id)
    .join(", ");
  const totalAmount = selectedShow
    ? totalTickets * Number(selectedShow.price || 0)
    : 0;
  const activeIndex = stepLabels.findIndex((item) => item.id === step);
  const goBackFromCurrentStep = () => {
    if (step === "seats") setStep("show");
    if (step === "details") setStep("seats");
    if (step === "payment") setStep("details");
  };
  const toggleSeat = (seatId: string) => {
    if (bookedSeats.has(seatId)) return;
    setSelectedSeats((current) =>
      current.includes(seatId)
        ? current.filter((id) => id !== seatId)
        : [...current, seatId],
    );
  };

  const getRowsForSection = (section: string) => {
    return seats
      .filter((seat) => seat.section === section)
      .reduce<Record<string, SeatOption[]>>((grouped, seat) => {
        grouped[seat.row] = grouped[seat.row] || [];
        grouped[seat.row].push(seat);
        return grouped;
      }, {});
  };

  const renderSeatButton = (
    seat: SeatOption,
    dense = false,
    side: ArenaSide = "top",
  ) => {
    const blockedSeats = selectedShow?.layout?.structure?.blockedSeats || [];
    const isBooked = bookedSeats.has(seat.id) || blockedSeats.includes(seat.id);
    const isSelected = selectedSeats.includes(seat.id);
    const facingClass =
      side === "bottom"
        ? "rotate-180"
        : side === "left"
          ? "-rotate-90"
          : side === "right"
            ? "rotate-90"
            : "";
    const sizeClass = "h-6 w-7";
    const seatTone = isBooked
      ? {
          shell: "border-red-200 bg-red-50 opacity-70",
          back: "border-red-200 bg-red-100",
          base: "border-red-200 bg-red-100",
          legs: "bg-red-200",
        }
      : isSelected
        ? {
            shell: "border-amber-700/50 bg-amber-50 shadow-md",
            back: "border-amber-700/50 bg-amber-400",
            base: "border-amber-700/50 bg-amber-500",
            legs: "bg-amber-700/60",
          }
        : {
            shell:
              "border-[#5d7892]/35 bg-sky-50 hover:border-emerald-500 hover:bg-emerald-50",
            back: "border-[#49687f] bg-[#8db5d4]",
            base: "border-[#49687f] bg-[#6f9fc2]",
            legs: "bg-[#49687f]",
          };
    return (
      <button
        key={seat.id}
        onClick={() => toggleSeat(seat.id)}
        disabled={isBooked}
        aria-label={`${seat.label} seat`}
        title={seat.label}
        className={`${sizeClass} ${facingClass} relative rounded-[5px] border transition ${isBooked ? "cursor-not-allowed" : ""} ${seatTone.shell}`}
      >
        <span
          className={`absolute left-1/2 top-[2px] h-[12px] w-[17px] -translate-x-1/2 rounded-t-[5px] rounded-b-[3px] border ${seatTone.back}`}
        />
        <span
          className={`absolute bottom-[4px] left-1/2 h-[4px] w-[20px] -translate-x-1/2 rounded-[2px] border ${seatTone.base}`}
        />
        <span
          className={`absolute bottom-[1px] left-[6px] h-[4px] w-[2px] rounded-full ${seatTone.legs}`}
        />
        <span
          className={`absolute bottom-[1px] right-[6px] h-[4px] w-[2px] rounded-full ${seatTone.legs}`}
        />
      </button>
    );
  };

  const arenaSeatGroups = useMemo(
    () => groupSeatsByArenaSide(seats, getRowsForSection),
    [seats],
  );

  const renderGuestSeatGroup = (rows: SeatOption[][], side: ArenaSide) => {
    if (rows.length === 0) return null;
    const isSide = side === "left" || side === "right";
    const sideRows = isSide && side === "left" ? [...rows].reverse() : rows;
    const maxSeatsInSide = isSide
      ? Math.max(...sideRows.map((row) => row.length))
      : 0;

    const renderSideColumns = () => (
      <div
        className="grid h-full content-center justify-center gap-1"
        style={{
          gridTemplateColumns: `repeat(${sideRows.length}, minmax(21px, 25px))`,
        }}
      >
        {sideRows.map((rowSeats, rowIndex) => (
          <div
            key={`${side}-${rowSeats[0]?.row || rowIndex}`}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-center text-[10px] font-bold leading-none text-stone-400">
              {rowSeats[0]?.row || String.fromCharCode(65 + rowIndex)}
            </span>
            {Array.from({ length: maxSeatsInSide }, (_, seatIndex) => {
              const centeredOffset = Math.floor(
                (maxSeatsInSide - rowSeats.length) / 2,
              );
              const seat =
                seatIndex >= centeredOffset &&
                seatIndex < centeredOffset + rowSeats.length
                  ? rowSeats[seatIndex - centeredOffset]
                  : undefined;
              return seat ? (
                renderSeatButton(seat, true, side)
              ) : (
                <span
                  key={`${side}-${rowIndex}-${seatIndex}`}
                  className="h-6 w-7"
                />
              );
            })}
          </div>
        ))}
      </div>
    );

    const compactWrapperClass =
      side === "top" || side === "bottom"
        ? "mx-auto w-fit max-w-full"
        : "w-[128px] sm:w-[134px] lg:w-[140px]";

    return (
      <div
        className={`rounded-lg border border-stone-200 bg-white/80 px-3 py-2.5 shadow-sm ${compactWrapperClass}`}
      >
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-stone-500 sm:text-xs">
            {sideLabelForArenaSide(side)}
          </h3>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-black text-stone-600 ring-1 ring-stone-200 sm:py-1 sm:text-xs">
            {arrowForArenaSide(side)}
          </span>
        </div>
        <div className="overflow-visible pb-1">
          {isSide ? (
            renderSideColumns()
          ) : (
            <div className="mx-auto min-w-max space-y-1.5">
              {rows.map((rowSeats, index) => (
                <div
                  key={`${side}-${rowSeats[0]?.row || index}`}
                  className={`flex items-center gap-1.5 ${alignClassForArenaSide(side)}`}
                >
              <span className="w-4 shrink-0 text-center text-[10px] font-bold text-stone-400">
                    {rowSeats[0]?.row || String.fromCharCode(65 + index)}
                  </span>
                  {rowSeats.map((seat) => renderSeatButton(seat, false, side))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGuestKalariSeatMap = () => {
    const renderArenaCenter = () => (
      <div className="flex flex-col items-center justify-center gap-1.5">
        <div className="relative flex aspect-square w-[320px] items-center justify-center overflow-hidden rounded-lg border-[3px] border-[#8b5a2b]/30 bg-[#b8793b] shadow-inner sm:w-[340px] lg:w-[360px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#d6a15f_0%,#b8793b_42%,#8b5a2b_100%)]" />
          <div className="absolute inset-3 rounded-lg border border-[#f3d6a3]/35" />
          <div className="absolute h-[72%] w-1 rotate-45 rounded-full bg-[#6f3f1c]/45" />
          <div className="absolute h-[72%] w-1 -rotate-45 rounded-full bg-[#6f3f1c]/45" />
          <div className="absolute h-12 w-12 rounded-full border-2 border-[#f3d6a3]/40" />
          <div className="absolute h-2.5 w-2.5 rounded-full bg-[#f3d6a3]/80" />
        </div>
        <div className="text-center text-[10px] font-black uppercase tracking-widest text-stone-500">
          Ankathattu
        </div>
      </div>
    );

    return (
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-stone-950">
              Kalari arena seating
            </h3>
            <p className="mt-1 text-sm font-medium text-stone-500">
              {ARENA_TOP_LABEL} performance square.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-white px-3 py-1 text-stone-600 ring-1 ring-stone-200">
              Available
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
              Selected
            </span>
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-500">
              Booked
            </span>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="mx-auto min-w-[820px] w-fit space-y-2 rounded-lg bg-[#f7f3eb] p-3 ring-1 ring-stone-200 sm:min-w-[880px] sm:space-y-2.5 sm:p-3">
            <div>{renderGuestSeatGroup(arenaSeatGroups.top, "top")}</div>
            <div className="grid grid-cols-[max-content_320px_max-content] items-center justify-center gap-3 sm:grid-cols-[max-content_340px_max-content] lg:grid-cols-[max-content_360px_max-content]">
              <div className="self-stretch">
                {renderGuestSeatGroup(arenaSeatGroups.left, "left")}
              </div>
              {renderArenaCenter()}
              <div className="self-stretch">
                {renderGuestSeatGroup(arenaSeatGroups.right, "right")}
              </div>
            </div>
            <div>{renderGuestSeatGroup(arenaSeatGroups.bottom, "bottom")}</div>
          </div>
        </div>
      </div>
    );
  };

  const validateDetails = () => {
    const nextErrors = getBookingCustomerErrors({
      name: form.name,
      phone: form.phone,
      email: form.email,
    });
    setErrors(nextErrors);
    return !hasBookingCustomerErrors(nextErrors);
  };

  const syncCustomerProfile = async (customerId: string) => {
    const name = form.name.trim();
    const phone = normalizeBookingPhone(form.phone);
    const email = form.email.trim();
    const now = new Date().toISOString();
    await db.from("customers").update({ name, phone, email, updated_at: now }).eq("id", customerId);
    if (customerSession) {
      const nextSession = { ...customerSession, name, phone, email: email || undefined };
      localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(nextSession));
      setCustomerSession(nextSession);
    }
  };

  const getUnavailableSeats = async () => {
    if (!selectedShow) return new Set<string>();
    const { data } = await db
      .from("bookings")
      .select("seat_code")
      .eq("show_id", getRecordId(selectedShow))
      .in("status", ["CONFIRMED", "HELD"]);

    const unavailable = new Set<string>();
    data?.forEach((booking: any) => {
      if (isActiveBookingReservation(booking))
        parseSeatCodes(booking.seat_code).forEach((seat) =>
          unavailable.add(seat),
        );
    });
    setBookedSeats(unavailable);
    return unavailable;
  };

  const verifySeatAvailability = async () => {
    if (!selectedShow) return false;
    if (!isShowBookableAt(selectedShow)) {
      setNotice("Booking is closed because this show time has passed.");
      setSelectedShow(null);
      setStep("show");
      await fetchShows();
      return false;
    }

    const unavailable = await getUnavailableSeats();
    const conflicts = selectedSeats.filter((seat) => unavailable.has(seat));
    if (conflicts.length) {
      setNotice(
        `These seats were just booked: ${conflicts.join(", ")}. Choose another seat.`,
      );
      setSelectedSeats((current) =>
        current.filter((seat) => !unavailable.has(seat)),
      );
      return false;
    }
    return true;
  };

  const findOrCreateCustomer = async () => {
    const name = form.name.trim();
    const phone = normalizeBookingPhone(form.phone);
    const email = form.email.trim();

    if (customerSession?.id) {
      await syncCustomerProfile(customerSession.id);
      return customerSession.id;
    }

    const { data: existingCustomers } = await db
      .from("customers")
      .select("*")
      .eq("phone", phone);
    if (existingCustomers?.[0]) {
      const customerId = getRecordId(existingCustomers[0]);
      await db.from("customers").update({ name, email, updated_at: new Date().toISOString() }).eq("id", customerId);
      return customerId;
    }

    const now = new Date().toISOString();
    const { data: customers, error } = await db.from("customers").insert([
      {
        name,
        phone,
        email,
        created_at: now,
        updated_at: now,
      },
    ]);

    if (error || !customers?.[0])
      throw new Error(error?.message || "Could not create customer.");
    return getRecordId(customers[0]);
  };

  const saveBooking = async (
    paymentId: string,
    method: PaymentMethod,
    status: "PAID" | "COD_PENDING",
    razorpayOrderId?: string,
  ) => {
    if (!selectedShow) throw new Error("No show selected.");
    if (!(await verifySeatAvailability()))
      throw new Error("Selected seats are no longer available.");

    const customerId = await findOrCreateCustomer();
    const now = new Date().toISOString();
    const bookingReference = createBookingReference(new Date(now));

    const seatCodesToSave = selectedSeats;
    const generatedTicketCodes = createTicketCodes(
      seatCodesToSave.length,
      new Date(now),
    );

    const commissionFields = buildShowAgentCommissionFields(
      selectedShow,
      totalAmount,
      new Date(now),
      linkedShowAgent,
    );

    const { data: bookings, error: bookingError } = await db
      .from("bookings")
      .insert([
        {
          booking_reference: bookingReference,
          show_id: getRecordId(selectedShow),
          booking_type: "SHOW",
          seat_code: JSON.stringify(seatCodesToSave),
          booked_by: customerSession?.name || form.name.trim(),
          customer_id: customerId,
          booking_time: now,
          status: "CONFIRMED",
          payment_id: paymentId,
          razorpay_payment_id: method === "razorpay" ? paymentId : null,
          razorpay_order_id: razorpayOrderId || null,
          payment_method: method === "cod" ? "COD" : "RAZORPAY",
          payment_status: status,
          total_amount: totalAmount,
          ...commissionFields,
          cancellation_status: "NONE",
        },
      ]);

    if (bookingError || !bookings?.[0])
      throw new Error(bookingError?.message || "Booking could not be saved.");
    const savedBookingId = getRecordId(bookings[0]);

    const generatedTickets = seatCodesToSave.map((seatCode, index) => ({
      booking_id: savedBookingId,
      show_id: getRecordId(selectedShow),
      seat_code: seatCode,
      ticket_code: generatedTicketCodes[index],
      price: Number(selectedShow.price || 0),
      generated_by: customerSession?.name || form.name.trim(),
      generated_at: now,
      status: "ACTIVE",
    }));

    const { error: ticketError } = await db
      .from("tickets")
      .insert(generatedTickets);

    if (ticketError)
      throw new Error(ticketError.message || "Tickets could not be created.");
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "NEW_BOOKING",
        module: "BOOKING",
        title: "New website booking",
        message: `${bookingReference} was booked for ${selectedShow.title}.`,
        severity: "SUCCESS",
        entity_type: "booking",
        entity_id: savedBookingId,
        action_url: "/admin/tickets",
        metadata: {
          booking_reference: bookingReference,
          show_id: getRecordId(selectedShow),
        },
      }),
    }).catch(() => null);
    setBookingId(savedBookingId);
    setBookingReference(bookingReference);
    setTicketCodes(generatedTickets.map((ticket) => ticket.ticket_code));
    setPaymentStatus(status);
    setStep("success");
  };

  const createPaymentHold = async () => {
    if (!selectedShow) throw new Error("No show selected.");
    const response = await fetch("/api/booking-holds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId: getRecordId(selectedShow),
        seatCodes: selectedSeats,
        form: { ...form, customerId: customerSession?.id },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.data?.hold_token)
      throw new Error(payload.error || "Could not hold selected seats.");
    return payload.data;
  };

  const releasePaymentHold = async (token: string) => {
    if (!token) return;
    await fetch("/api/booking-holds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RELEASE", holdToken: token }),
    }).catch(() => null);
  };

  const confirmPaymentHold = async (
    token: string,
    paymentId: string,
    razorpayOrderId: string,
    razorpaySignature: string,
  ) => {
    const response = await fetch("/api/booking-holds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CONFIRM",
        holdToken: token,
        paymentId,
        razorpayOrderId,
        razorpaySignature,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.data?.booking)
      throw new Error(payload.error || "Paid booking could not be confirmed.");
    const booking = payload.data.booking;
    const generatedTickets = payload.data.tickets || [];
    setBookingId(getRecordId(booking));
    setBookingReference(booking.booking_reference || "");
    setTicketCodes(generatedTickets.map((ticket: any) => ticket.ticket_code));
    setPaymentStatus("PAID");
    setStep("success");
  };

  const payWithRazorpay = async () => {
    if (!selectedShow || !validateDetails()) return;
    if (!RAZORPAY_KEY_ID) {
      setNotice(
        "Razorpay key is missing. Add NEXT_PUBLIC_RAZORPAY_KEY_ID or choose COD.",
      );
      return;
    }

    setLoading(true);
    setNotice("");
    let activeHoldToken = "";
    let verifiedPayment = false;
    try {
      if (!(await verifySeatAvailability())) return;
      if (!(await loadRazorpayScript()))
        throw new Error("Could not load Razorpay checkout.");
      const hold = await createPaymentHold();
      activeHoldToken = hold.hold_token;
      setNotice(
        `Your selection is held for ${hold.hold_minutes || 10} minutes while payment completes.`,
      );

      const orderResponse = await fetch(`/api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount,
          currency: "INR",
          receipt: hold.booking_reference || `booking_${Date.now()}`,
        }),
      });
      const orderPayload = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || !orderPayload.data?.id)
        throw new Error(
          orderPayload.error || "Could not create Razorpay order.",
        );

      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: RAZORPAY_KEY_ID,
          amount: orderPayload.data.amount,
          currency: orderPayload.data.currency,
          name: "Experience Booking",
          description: `${selectedShow.title} - ${selectedSeats.length} ticket(s)`,
          order_id: orderPayload.data.id,
          prefill: {
            name: form.name.trim(),
            email: form.email.trim(),
            contact: form.phone.trim(),
          },
          theme: { color: "#f59e0b" },
          handler: async (response: any) => {
            try {
              const verifyResponse = await fetch(`/api/payment/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });
              const verifyPayload = await verifyResponse
                .json()
                .catch(() => ({}));
              if (!verifyResponse.ok || !verifyPayload.data?.valid)
                return reject(
                  new Error(
                    verifyPayload.error || "Payment verification failed.",
                  ),
                );
              verifiedPayment = true;
              await confirmPaymentHold(
                activeHoldToken,
                response.razorpay_payment_id,
                response.razorpay_order_id,
                response.razorpay_signature,
              );
              activeHoldToken = "";
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: {
            confirm_close: true,
            ondismiss: () => reject(new Error("Payment cancelled.")),
          },
        });
        checkout.open();
      });
    } catch (error: any) {
      if (activeHoldToken && !verifiedPayment) {
        await releasePaymentHold(activeHoldToken);
        await fetchBookedSeats(getRecordId(selectedShow));
      }
      setNotice(
        error?.message === "Payment cancelled."
          ? "Payment cancelled. Your temporary hold was released."
          : error?.message || "Payment failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const reserveWithCod = async () => {
    if (!selectedShow || !validateDetails()) return;
    setLoading(true);
    setNotice("");
    try {
      await saveBooking(`COD-${Date.now()}`, "cod", "COD_PENDING");
    } catch (error: any) {
      setNotice(error?.message || "Could not reserve tickets with COD.");
    } finally {
      setLoading(false);
    }
  };

  const requireLoginForSelection = () => {
    if (!selectedShow) return;
    sessionStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify({
        showId: getRecordId(selectedShow),
        selectedSeats,
      }),
    );
    const showId = encodeURIComponent(getRecordId(selectedShow));
    router.push(`/customer/login?redirect=${encodeURIComponent(`/book?show=${showId}`)}`);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f3eb] text-stone-950 print:bg-white">
      <div className="min-h-screen min-w-0 print:block print:min-h-0">
        <section className="min-w-0 overflow-x-hidden bg-[#f7f3eb] lg:h-screen lg:overflow-y-auto print:h-auto print:bg-white print:overflow-visible">
          <div className="mx-auto w-full max-w-[1480px] min-w-0 px-4 py-5 sm:px-6 lg:px-10 print:max-w-none print:p-0">
            <div className="print:hidden">
            {step === "show" || !selectedShow ? (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                    Kovalam, Kerala
                  </p>
                  <h2 className="text-3xl font-bold text-stone-950">
                    Book your experience
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-stone-700 shadow-sm">
                  <Ticket className="h-4 w-4 text-amber-600" />
                  Instant ticket
                </div>
              </div>
            ) : (
              <div className="sticky top-0 z-50 -mx-4 mb-5 border-b border-stone-200 bg-[#f7f3eb]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
                <div className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={goBackFromCurrentStep}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-stone-700 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50"
                      aria-label="Back"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                        Kovalam, Kerala
                      </p>
                      <h2 className="text-2xl font-bold text-stone-950 sm:text-3xl">
                        Book your experience
                      </h2>
                    </div>
                  </div>
                  <div className="w-full rounded-lg bg-white px-5 py-4 shadow-sm ring-1 ring-stone-200 sm:w-auto sm:min-w-[420px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold" title={selectedShow.title}>
                          {selectedShow.title}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-600">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" /> {formatDisplayDateValue(selectedShow.date)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-4 w-4" /> {formatDisplayTimeValue(selectedShow.time)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> Kovalam
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-stone-500">{totalTickets} ticket(s)</div>
                        <div className="text-2xl font-bold text-amber-700">Rs. {totalAmount}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5 grid w-full grid-cols-2 gap-2 overflow-hidden rounded-lg bg-white p-2 shadow-sm sm:grid-cols-4">
              {stepLabels.map((item, index) => {
                const done = activeIndex > index || step === "success";
                const active = activeIndex === index;
                return (
                  <div
                    key={item.id}
                    className={`min-w-0 rounded-lg px-1.5 py-3 text-center text-xs font-bold sm:px-2 ${done ? "bg-emerald-600 text-white" : active ? "bg-amber-400 text-stone-950" : "bg-stone-100 text-stone-500"}`}
                  >
                    <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/40">
                      {done ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="block truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
            </div>

            {notice && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 print:hidden">
                {notice}
              </div>
            )}

            {step === "show" && (
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                {showsLoading || activitiesLoading ? (
                  <div className="md:col-span-2 rounded-lg border border-stone-200 bg-white p-10 text-center text-stone-600 shadow-sm">
                    Loading bookable experiences...
                  </div>
                ) : shows.filter(
                    (show) => !preselectedDate || show.date === preselectedDate,
                  ).length === 0 &&
                  activities.filter((activity) =>
                    !preselectedActivityId || getRecordId(activity) === preselectedActivityId || activity.slug === preselectedActivityId
                  ).length === 0 ? (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center text-stone-600">
                    No shows or activities available right now.
                  </div>
                ) : (
                  <>
                    {shows
                      .filter(
                        (show) => !preselectedDate || show.date === preselectedDate,
                      )
                      .map((show) => (
                      <button
                        key={getRecordId(show)}
                        onClick={() => {
                          if (show.availability_status !== "SOLD_OUT") {
                            selectedShowIdRef.current = getRecordId(show);
                            setSelectedShow(show);
                            setBookedSeats(new Set());
                            setSelectedSeats([]);
                            setStep("seats");
                          }
                        }}
                        disabled={show.availability_status === "SOLD_OUT"}
                        className="group flex h-full min-h-[445px] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-white text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 md:max-w-none"
                      >
                        <img
                          src={show.image || fallbackBookingImage}
                          alt={show.title}
                          className="h-40 w-full object-cover object-[50%_68%] transition duration-500 group-hover:scale-105"
                        />
                        <div className="flex flex-1 flex-col p-5">
                          <div className="mb-3 grid grid-cols-2 gap-2 text-xs font-bold sm:flex sm:flex-wrap">
                            <span className="truncate rounded-full bg-emerald-50 px-3 py-1 text-center text-emerald-800 sm:text-left">
                              Kalari Show
                            </span>
                            <span
                              className={`truncate rounded-full px-3 py-1 text-center sm:text-left ${show.availability_status === "SOLD_OUT" ? "bg-red-50 text-red-800" : show.availability_status === "FILLING_FAST" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                            >
                              {getAvailabilityLabel(
                                show.availability_status || "AVAILABLE",
                              )}
                            </span>
                            <span className="truncate rounded-full bg-stone-100 px-3 py-1 text-center text-stone-800 sm:text-left">
                              {formatDisplayDateValue(show.date)}
                            </span>
                            <span className="truncate rounded-full bg-sky-50 px-3 py-1 text-center text-sky-800 sm:text-left">
                              {formatDisplayTimeValue(show.time)}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold leading-snug">
                            {show.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-stone-600">
                            {show.description ||
                              "Reserved seating for an authentic Kalari live show."}
                          </p>
                          <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                            <span className="text-2xl font-bold">
                              Rs. {show.price}
                            </span>
                            <span
                              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white ${show.availability_status === "SOLD_OUT" ? "bg-stone-400" : "bg-stone-950"}`}
                            >
                              {show.availability_status === "SOLD_OUT"
                                ? "Sold Out"
                                : "Select"}{" "}
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </button>
                      ))}
                    {activities
                      .filter((activity) =>
                        !preselectedActivityId || getRecordId(activity) === preselectedActivityId || activity.slug === preselectedActivityId
                      )
                      .map((activity) => {
                        const href = `/activities/${activityRouteId(activity)}/book${preselectedDate ? `?date=${encodeURIComponent(preselectedDate)}` : ""}`;
                        return (
                          <button
                            key={getRecordId(activity)}
                            onClick={() => router.push(href)}
                            className="group flex h-full min-h-[445px] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-white text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-xl md:max-w-none"
                          >
                            <img
                              src={activity.image || fallbackBookingImage}
                              alt={activity.title}
                              className="h-40 w-full object-cover object-[50%_68%] transition duration-500 group-hover:scale-105"
                            />
                            <div className="flex flex-1 flex-col p-5">
                              <div className="mb-3 grid grid-cols-2 gap-2 text-xs font-bold sm:flex sm:flex-wrap">
                                <span className="truncate rounded-full bg-amber-50 px-3 py-1 text-center text-amber-800 sm:text-left">
                                  Activity
                                </span>
                                <span className="truncate rounded-full bg-emerald-50 px-3 py-1 text-center text-emerald-800 sm:text-left">
                                  Available
                                </span>
                                <span className="truncate rounded-full bg-stone-100 px-3 py-1 text-center text-stone-800 sm:text-left">
                                  {preselectedDate ? formatDisplayDateValue(preselectedDate) : "Choose date"}
                                </span>
                                <span className="truncate rounded-full bg-sky-50 px-3 py-1 text-center text-sky-800 sm:text-left">
                                  General admission
                                </span>
                              </div>
                              <h3 className="text-xl font-bold leading-snug">
                                {activity.title}
                              </h3>
                              <p className="mt-2 text-sm leading-6 text-stone-600">
                                {activity.description || "Daily activity booking with general admission tickets."}
                              </p>
                              <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                                <span className="text-2xl font-bold">
                                  Rs. {activity.booking_price || activity.price}
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-stone-950 px-4 py-3 text-sm font-bold text-white">
                                  Select <ArrowRight className="h-4 w-4" />
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </>
                )}
              </div>
            )}

            {step === "seats" && selectedShow && (
              <div className="pb-6">
                <div key={getRecordId(selectedShow)}>
                  {renderGuestKalariSeatMap()}
                </div>

                <div className="sticky bottom-0 z-50 -mx-4 mt-5 border-t border-stone-200 bg-[#f7f3eb]/95 px-4 py-4 shadow-none backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
                  <PrimaryButton
                    disabled={totalTickets === 0}
                    onClick={() => {
                      if (customerSession) setStep("details");
                      else requireLoginForSelection();
                    }}
                  >
                    Continue with {totalTickets} ticket(s)
                  </PrimaryButton>
                </div>
              </div>
            )}

            {step === "details" && selectedShow && (
              <div className="pb-24 sm:pb-0">
                <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-stone-200">
                  <div className="mb-5">
                    <h3 className="text-2xl font-bold text-stone-950">
                      Guest details
                    </h3>
                    <p className="mt-1 text-sm font-medium text-stone-500">
                      Name and mobile are required. Email is optional.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <Input
                      variant="public"
                      label="Full name"
                      value={form.name}
                      onChange={(name) => setForm({ ...form, name })}
                      placeholder="Enter your full name"
                      required
                      error={errors.name}
                      inputClassName="rounded-lg border border-stone-200 px-4 py-3 font-semibold"
                    />
                    <IndianPhoneField
                      variant="public"
                      label="Mobile number"
                      value={form.phone}
                      onChange={(phone) => setForm({ ...form, phone })}
                      required
                      error={errors.phone}
                    />
                    <Input
                      variant="public"
                      label="Email (optional)"
                      type="email"
                      value={form.email}
                      onChange={(email) => setForm({ ...form, email })}
                      placeholder="you@example.com"
                      error={errors.email}
                      inputClassName="rounded-lg border border-stone-200 px-4 py-3 font-semibold"
                    />
                  </div>
                </div>
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:relative sm:inset-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                  <PrimaryButton
                    onClick={() => {
                      if (validateDetails()) setStep("payment");
                    }}
                  >
                    Continue to payment
                  </PrimaryButton>
                </div>
              </div>
            )}

            {step === "payment" && selectedShow && (
              <div className="pb-24 sm:pb-0">
                <div className="mb-5">
                  <h3 className="text-2xl font-bold text-stone-950">
                    Payment
                  </h3>
                  <p className="mt-1 text-sm font-medium text-stone-500">
                    Choose how you want to confirm this booking.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PaymentCard
                    active={paymentMethod === "razorpay"}
                    icon={<CreditCard className="h-7 w-7 text-amber-600" />}
                    title="Razorpay"
                    text="Pay now with UPI, cards, wallets, or netbanking."
                    onClick={() => setPaymentMethod("razorpay")}
                  />
                  <PaymentCard
                    active={paymentMethod === "cod"}
                    icon={<WalletCards className="h-7 w-7 text-emerald-700" />}
                    title="COD"
                    text="Reserve now and pay at the venue counter."
                    onClick={() => setPaymentMethod("cod")}
                  />
                </div>
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:relative sm:inset-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                  <PrimaryButton
                    disabled={loading}
                    dark
                    onClick={
                      paymentMethod === "razorpay"
                        ? payWithRazorpay
                        : reserveWithCod
                    }
                  >
                    {loading
                      ? "Processing..."
                      : paymentMethod === "razorpay"
                        ? `Pay Rs. ${totalAmount}`
                        : "Reserve with COD"}
                  </PrimaryButton>
                </div>
              </div>
            )}

            {step === "success" && selectedShow && (
              <>
                <BookingPrintTicket
                  bookingReference={bookingReference || bookingId}
                  showTitle={selectedShow.title}
                  date={formatDisplayDateValue(selectedShow.date, "N/A")}
                  time={formatDisplayTimeValue(selectedShow.time, "N/A")}
                  guestName={form.name.trim() || customerSession?.name || "Guest"}
                  admissionLabel="Seats"
                  admissionValue={selectedSeatLabels}
                  quantity={`${totalTickets} ticket(s)`}
                  total={`Rs. ${totalAmount}`}
                  payment={
                    paymentStatus === "PAID"
                      ? "Paid via Razorpay"
                      : "COD pending"
                  }
                  qrValue={bookingReference || bookingId}
                />
                <div className="rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-stone-200 print:hidden">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>
                  <h2 className="mt-5 text-3xl font-bold">Booking confirmed</h2>
                  <p className="mt-2 text-stone-600">
                    Show this confirmation at the venue.
                  </p>
                  <div className="mt-6 grid gap-3 rounded-lg bg-stone-50 p-4 text-left text-sm sm:grid-cols-2">
                    <Info
                      label="Booking Ref"
                      value={bookingReference || bookingId}
                      mono
                    />
                    <Info
                      label="Payment"
                      value={
                        paymentStatus === "PAID"
                          ? "Paid via Razorpay"
                          : "COD pending"
                      }
                    />
                    <Info label="Guest" value={form.name.trim() || customerSession?.name || "Guest"} />
                    <Info label="Total" value={`Rs. ${totalAmount}`} />
                    <div className="sm:col-span-2">
                      <Info label="Seats" value={selectedSeatLabels} />
                    </div>
                    {ticketCodes.length > 0 && (
                      <div className="sm:col-span-2">
                        <Info
                          label="Ticket Codes"
                          value={ticketCodes.join(", ")}
                          mono
                        />
                      </div>
                    )}
                  </div>
                  <div className="mx-auto mt-6 flex w-fit rounded-lg bg-white p-3 shadow-sm">
                    <QRCode value={bookingReference || bookingId} size={132} />
                  </div>
                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <button
                      onClick={() => window.print()}
                      className="rounded-lg bg-emerald-700 px-6 py-3 font-bold text-white"
                    >
                      Print ticket
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="rounded-lg bg-stone-950 px-6 py-3 font-bold text-white"
                    >
                      Book another ticket
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

const PublicBooking: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-950 text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
};

const BookingPrintTicket = ({
  bookingReference,
  showTitle,
  date,
  time,
  guestName,
  admissionLabel,
  admissionValue,
  quantity,
  total,
  payment,
  qrValue,
}: {
  bookingReference: string;
  showTitle: string;
  date: string;
  time: string;
  guestName: string;
  admissionLabel: string;
  admissionValue: string;
  quantity: string;
  total: string;
  payment: string;
  qrValue: string;
}) => (
  <section className="hidden print:block">
    <div className="mx-auto w-[180mm] rounded-lg border border-stone-300 p-8 text-stone-950">
      <div className="flex items-start justify-between gap-8 border-b border-stone-200 pb-5">
        <div className="flex items-start gap-4">
          <img
            src="/logo.png"
            alt="Kovalam Kalari"
            className="h-16 w-16 rounded object-contain"
          />
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-amber-700">
              Kovalam Kalari
            </div>
            <h1 className="mt-3 text-3xl font-black leading-tight">
              {showTitle}
            </h1>
            <p className="mt-2 font-mono text-sm font-black text-stone-500">
              {bookingReference}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 p-3">
          <QRCode value={qrValue} size={118} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-5 text-sm">
        <PrintField label="Guest" value={guestName} />
        <PrintField label="Payment" value={payment} />
        <PrintField label="Date" value={date} />
        <PrintField label="Time" value={time} />
        <PrintField label={admissionLabel} value={admissionValue} />
        <PrintField label="Quantity" value={quantity} />
        <PrintField label="Total" value={total} />
        <PrintField label="QR Value" value={qrValue} mono />
      </div>
    </div>
  </section>
);

const PrintField = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div>
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
      {label}
    </div>
    <div className={`mt-1 text-base font-black ${mono ? "font-mono" : ""}`}>
      {value}
    </div>
  </div>
);

const PaymentCard: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}> = ({ active, icon, title, text, onClick }) => (
  <button
    onClick={onClick}
    className={`rounded-lg bg-white p-5 text-left shadow-sm ring-2 transition ${active ? "ring-amber-400" : "ring-stone-200 hover:ring-stone-300"}`}
  >
    {icon}
    <h4 className="mt-4 text-lg font-bold">{title}</h4>
    <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
  </button>
);

const PrimaryButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dark?: boolean;
}> = ({ children, onClick, disabled, dark }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5 ${dark ? "bg-stone-950 text-white hover:bg-stone-800" : "bg-amber-400 text-stone-950 hover:bg-amber-300"}`}
  >
    {children}
    <ArrowRight className="h-5 w-5" />
  </button>
);

const Info: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div>
    <span className="block text-xs font-bold uppercase tracking-wider text-stone-500">
      {label}
    </span>
    <span
      className={`mt-1 block font-bold text-stone-950 ${mono ? "font-mono" : ""}`}
    >
      {value}
    </span>
  </div>
);

export default PublicBooking;
