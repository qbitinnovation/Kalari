import { promises as fs } from "fs";
import path from "path";
import { getSeedData } from "./seedData";

type Store = Record<string, any[]>;

const storePath = path.join(process.cwd(), ".data", "kalary-store.json");

const initialStore = (): Store => {
  const seed = getSeedData();
  const now = new Date().toISOString();
  return {
    users: [
      { id: "user-admin", email: "admin@kalari.local", password: "admin123", role: "admin", full_name: "Kalari Admin", active: true, created_at: now },
      { id: "user-agent", email: "agent@kalari.local", password: "admin123", role: "agent", full_name: "Booking Agent", active: true, created_at: now },
    ],
    activities: seed.activities,
    shows: seed.shows,
    layouts: seed.layouts,
    customers: [],
    bookings: [],
    tickets: [],
    activity_logs: [],
  };
};

export const readStore = async (): Promise<Store> => {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  try {
    return JSON.parse(await fs.readFile(storePath, "utf8"));
  } catch {
    const store = initialStore();
    await writeStore(store);
    return store;
  }
};

export const writeStore = async (store: Store) => {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2));
};

export const resetLocalStore = async () => {
  const store = initialStore();
  await writeStore(store);
  return store;
};

const getValue = (row: any, key: string) => row[key] ?? (key === "id" ? row._id : undefined);
const recordId = (row: any) => row?.id || row?._id;

const attachRelations = (store: Store, collection: string, rowsOrRow: any) => {
  const rows = Array.isArray(rowsOrRow) ? rowsOrRow : rowsOrRow ? [rowsOrRow] : [];
  if (rows.length === 0) return rowsOrRow;

  if (collection === "shows") {
    const layoutsById = new Map((store.layouts || []).map((layout) => [String(recordId(layout)), layout]));
    rows.forEach((show) => {
      if (show.layout_id) show.layout = layoutsById.get(String(show.layout_id)) || null;
    });
  }

  if (collection === "bookings") {
    const showsById = new Map((store.shows || []).map((show) => [String(recordId(show)), show]));
    const customersById = new Map((store.customers || []).map((customer) => [String(recordId(customer)), customer]));
    rows.forEach((booking) => {
      if (booking.show_id) booking.show = showsById.get(String(booking.show_id)) || null;
      if (booking.customer_id) booking.customer = customersById.get(String(booking.customer_id)) || null;
    });
  }

  return rowsOrRow;
};

const matchesFilters = (row: any, filters: Record<string, any> = {}, inFilters: Record<string, any[]> = {}, rangeFilters: Record<string, any> = {}) => {
  for (const [key, value] of Object.entries(filters || {})) {
    if (getValue(row, key) !== value) return false;
  }
  for (const [key, values] of Object.entries(inFilters || {})) {
    if (!values.includes(getValue(row, key))) return false;
  }
  for (const [key, range] of Object.entries(rangeFilters || {})) {
    const value = getValue(row, key);
    if ((range as any).gte !== undefined && value < (range as any).gte) return false;
    if ((range as any).lte !== undefined && value > (range as any).lte) return false;
  }
  return true;
};

export const localQuery = async ({
  collection,
  operation = "select",
  filters = {},
  inFilters = {},
  rangeFilters = {},
  orderBy,
  limitBy,
  updatePayload,
  insertPayload,
  expectSingle,
}: any) => {
  const store = await readStore();
  store[collection] = store[collection] || [];

  if (operation === "insert") {
    const rows = (insertPayload || []).map((row: any) => ({
      id: row.id || `${collection}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...row,
    }));
    store[collection].push(...rows);
    await writeStore(store);
    return rows;
  }

  if (operation === "update") {
    let modifiedCount = 0;
    store[collection] = store[collection].map((row) => {
      if (!matchesFilters(row, filters)) return row;
      modifiedCount += 1;
      return { ...row, ...(updatePayload || {}) };
    });
    await writeStore(store);
    return { acknowledged: true, modifiedCount };
  }

  if (operation === "delete") {
    const before = store[collection].length;
    store[collection] = store[collection].filter((row) => !matchesFilters(row, filters));
    await writeStore(store);
    return { acknowledged: true, deletedCount: before - store[collection].length };
  }

  let rows = store[collection].filter((row) => matchesFilters(row, filters, inFilters, rangeFilters));
  if (orderBy?.column) {
    rows = rows.sort((a, b) => {
      const left = getValue(a, orderBy.column);
      const right = getValue(b, orderBy.column);
      if (left === right) return 0;
      return (left > right ? 1 : -1) * (orderBy.ascending === false ? -1 : 1);
    });
  }
  if (limitBy) rows = rows.slice(0, Number(limitBy));
  return attachRelations(store, collection, expectSingle ? rows[0] || null : rows);
};
