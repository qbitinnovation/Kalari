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
  type?: 'KALARI' | 'EVENT';
  capacity?: number;
  layout_id?: string;
  active: boolean;
  status?: "ACTIVE" | "HOUSE_FULL" | "SHOW_STARTED" | "SHOW_DONE";
  booked_count?: number;
  available_count?: number;
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";
  created_at: string;
  layout?: Layout;
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
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  _id?: string;
  show_id: string;
  seat_id?: string;
  seat_code: string;
  booked_by: string;
  customer_id?: string;
  agent_id?: string;
  commission_amount?: number;
  payment_method?: string;
  payment_status?: "PAID" | "COD_PENDING" | "FAILED" | "REFUNDED";
  payment_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  total_amount?: number;
  booking_time: string;
  status: "CONFIRMED" | "CANCELLED";
  customer?: Customer;
  show?: Show;
}

export interface Ticket {
  id: string;
  _id?: string;
  booking_id: string;
  show_id: string;
  seat_id: string;
  seat_code: string;
  ticket_code: string;
  price: number;
  generated_by: string;
  generated_at: string;
  status: "ACTIVE" | "COMPLETED" | "REVOKED";
}
