/** In Next.js App Router, /api is relative to the same origin. */
export const API_URL = "/api";

function networkErrorMessage(): string {
  return "Cannot reach the API. Check your internet connection and ensure the server is running.";
}

type OrderConfig = { column: string; ascending?: boolean };

class QueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private collection: string;
  private filters: Record<string, any>;
  private inFilters: Record<string, any[]>;
  private rangeFilters: Record<string, { gte?: any; lte?: any }>;
  private orderBy: OrderConfig | null;
  private limitBy: number | null;
  private selectFields: string | null;
  private updatePayload: Record<string, any> | null;
  private insertPayload: any[] | null;
  private operation: "select" | "insert" | "update" | "delete";
  private expectSingle: boolean;

  constructor(collection: string) {
    this.collection = collection;
    this.filters = {};
    this.inFilters = {};
    this.rangeFilters = {};
    this.orderBy = null;
    this.limitBy = null;
    this.selectFields = null;
    this.updatePayload = null;
    this.insertPayload = null;
    this.operation = "select";
    this.expectSingle = false;
  }

  select(fields = "*") {
    this.selectFields = fields;
    if (this.operation === "select") this.operation = "select";
    return this;
  }
  eq(column: string, value: any) { this.filters[column] = value; return this; }
  in(column: string, values: any[]) { this.inFilters[column] = values; return this; }
  gte(column: string, value: any) { this.rangeFilters[column] = { ...(this.rangeFilters[column] || {}), gte: value }; return this; }
  lte(column: string, value: any) { this.rangeFilters[column] = { ...(this.rangeFilters[column] || {}), lte: value }; return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: options?.ascending }; return this; }
  limit(count: number) { this.limitBy = count; return this; }
  single() { this.expectSingle = true; return this; }
  insert(payload: any | any[]) { this.operation = "insert"; this.insertPayload = Array.isArray(payload) ? payload : [payload]; return this; }
  update(payload: Record<string, any>) { this.operation = "update"; this.updatePayload = payload; return this; }
  delete() { this.operation = "delete"; return this; }

  async execute() {
    try {
      const response = await fetch(`${API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: this.collection,
          operation: this.operation,
          filters: this.filters,
          inFilters: this.inFilters,
          rangeFilters: this.rangeFilters,
          orderBy: this.orderBy,
          limitBy: this.limitBy,
          selectFields: this.selectFields,
          updatePayload: this.updatePayload,
          insertPayload: this.insertPayload,
          expectSingle: this.expectSingle
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { data: null, error: { message: (payload as any).error || "Request failed" } };
      }
      return { data: payload.data, error: null };
    } catch (e) {
      const isNetwork = e instanceof TypeError;
      return {
        data: null,
        error: { message: isNetwork ? networkErrorMessage() : String((e as Error).message) }
      };
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled || undefined, onrejected || undefined);
  }
}

export const db = {
  from(collection: string) {
    return new QueryBuilder(collection);
  },
  async rpc(fn: string, params: Record<string, any>) {
    try {
      const response = await fetch(`${API_URL}/rpc/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { data: null, error: { message: (payload as any).error || "RPC failed" } };
      }
      return { data: payload.data, error: null };
    } catch (e) {
      const isNetwork = e instanceof TypeError;
      return {
        data: null,
        error: { message: isNetwork ? networkErrorMessage() : String((e as Error).message) }
      };
    }
  },
  auth: {
    async getUser() {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem("kalari_user") : null;
        const user = raw ? JSON.parse(raw) : null;
        return { data: { user }, error: null };
      } catch (error: any) {
        return { data: { user: null }, error: { message: error.message || "Failed to get user" } };
      }
    },
    async updateUser({ password }: { password: string }) {
      const raw = typeof window !== 'undefined' ? localStorage.getItem("kalari_user") : null;
      const user = raw ? JSON.parse(raw) : null;
      if (!user?.id) {
        return { data: null, error: { message: "User not found" } };
      }
      return db.rpc("change_password", { userId: user.id, newPassword: password });
    }
  }
};

export interface Layout {
  id: string;
  name: string;
  structure: any;
  created_at: string;
}

export interface Show {
  id: string;
  _id?: string;
  title: string;
  date: string;
  time: string;
  price: number;
  image?: string;
  description?: string;
  type?: 'KALARI';
  capacity?: number;
  layout_id?: string;
  agent_id?: string;
  agent_commission_percentage?: number;
  active: boolean;
  status?: "ACTIVE" | "HOUSE_FULL" | "SHOW_STARTED" | "SHOW_DONE";
  booked_count?: number;
  available_count?: number;
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";
  created_at: string;
  layout?: Layout;
}

export interface Agent {
  id: string;
  _id?: string;
  agent_code?: string;
  name: string;
  phone: string;
  email?: string;
  commission_notification_method?: "SMS" | "EMAIL";
  remaining_amount_notification_method?: "SMS" | "EMAIL";
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
  payout_method?: "BANK" | "GPAY";
  gpay_phone?: string;
  payout_frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  active: boolean;
  created_at: string;
  updated_at?: string;
  full_name?: string;
  commission_percentage?: number;
}

export interface Vendor {
  id: string;
  _id?: string;
  vendor_code?: string;
  name: string;
  phone: string;
  email?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
  payout_method?: "BANK" | "GPAY";
  gpay_phone?: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Seat {
  id: string;
  layout_id: string;
  section: string;
  row: string;
  seat_number: string;
  position: { x: number; y: number };
  price: number;
}

export interface Customer {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  password_hash?: string;
  phone_verified?: boolean;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration?: string;
  start_date?: string;
  end_date?: string;
  price: number;
  booking_price?: number;
  daily_capacity?: number;
  booking_status?: "ACTIVE" | "PAUSED";
  vendor_id?: string;
  platform_commission_percentage?: number;
  rating?: number;
  review_count?: number;
  image?: string;
  description?: string;
  status?: "ACTIVE" | "DRAFT" | "COMPLETED";
  featured?: boolean;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: string;
  _id?: string;
  booking_reference?: string;
  show_id?: string;
  activity_id?: string;
  booking_date?: string;
  booking_type?: "SHOW" | "ACTIVITY";
  seat_id?: string;
  seat_code: string;
  booked_by: string;
  customer_id?: string;
  agent_id?: string;
  agent_commission_percentage?: number;
  commission_amount?: number;
  commission_status?: "UNPAID" | "PAID";
  commission_period_key?: string;
  commission_paid_at?: string;
  commission_paid_by?: string;
  vendor_id?: string;
  platform_commission_percentage?: number;
  platform_commission_amount?: number;
  vendor_payout_amount?: number;
  vendor_payout_status?: "UNPAID" | "PAID";
  vendor_payout_period_key?: string;
  vendor_payout_paid_at?: string;
  vendor_payout_paid_by?: string;
  payment_method?: string;
  payment_status?: "PAID" | "COD_PENDING" | "PAYMENT_PENDING" | "FAILED" | "REFUNDED";
  payment_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  total_amount?: number;
  booking_time: string;
  status: "CONFIRMED" | "HELD" | "CANCELLED" | "EXPIRED";
  hold_token?: string;
  hold_expires_at?: string;
  cancellation_requested?: boolean;
  cancellation_reason?: string;
  cancellation_requested_at?: string;
  cancellation_status?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  cancellation_reviewed_at?: string;
  cancellation_reviewed_by?: string;
  commission_clawback_required?: boolean;
  vendor_payout_clawback_required?: boolean;
  commission_amount_at_cancel?: number;
  vendor_payout_amount_at_cancel?: number;
  customer?: Customer;
  show?: Show;
  activity?: Activity;
}

export interface Ticket {
  id: string;
  _id?: string;
  booking_id: string;
  show_id?: string;
  activity_id?: string;
  booking_type?: "SHOW" | "ACTIVITY";
  seat_id?: string;
  seat_code: string;
  ticket_code: string;
  price: number;
  generated_by: string;
  generated_at: string;
  status: "ACTIVE" | "COMPLETED" | "REVOKED";
  show?: Show;
  activity?: Activity;
  booking?: Booking;
}

export interface Notification {
  id: string;
  _id?: string;
  type: string;
  module: string;
  title: string;
  message: string;
  target_roles: ("admin" | "staff" | "agent")[];
  read_by?: string[];
  toast_shown_by?: string[];
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  severity?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface ContactMessage {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  source?: string;
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  admin_note?: string;
  created_at: string;
  updated_at?: string;
}

export interface PackageItem {
  id: string;
  _id?: string;
  title: string;
  slug: string;
  image: string;
  summary: string;
  description?: string;
  price: number;
  duration: string;
  group_size: string;
  location: string;
  status: "DRAFT" | "PUBLISHED";
  featured?: boolean;
  sort_order?: number;
  created_at: string;
  updated_at?: string;
}

export interface BlogPost {
  id: string;
  _id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  image: string;
  author?: string;
  tags?: string[];
  status: "DRAFT" | "PUBLISHED";
  published_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface GalleryItem {
  id: string;
  _id?: string;
  title: string;
  media_type: "IMAGE" | "VIDEO";
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  status: "DRAFT" | "PUBLISHED";
  sort_order?: number;
  created_at: string;
  updated_at?: string;
}

export interface Review {
  id: string;
  _id?: string;
  customer_name: string;
  rating: number;
  comment: string;
  target_type: "SHOW" | "ACTIVITY" | "GENERAL";
  target_id?: string;
  status: "PENDING" | "PUBLISHED" | "REJECTED" | "HIDDEN";
  source: "ADMIN" | "CUSTOMER";
  created_at: string;
  updated_at?: string;
}
