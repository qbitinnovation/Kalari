const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Razorpay = require("razorpay");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

let razorpayClient = null;
function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayClient;
}

const userSchema = new mongoose.Schema({}, { strict: false, collection: "users" });
const genericSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", userSchema);

const getGenericModel = (collectionName) => {
  if (!collectionName || typeof collectionName !== "string") {
    throw new Error("Invalid collection");
  }
  return mongoose.models[collectionName] || mongoose.model(collectionName, genericSchema, collectionName);
};

const applyFilters = (query, filters = {}, inFilters = {}, rangeFilters = {}) => {
  Object.entries(filters || {}).forEach(([key, value]) => {
    query.where(key).equals(value);
  });

  Object.entries(inFilters || {}).forEach(([key, values]) => {
    query.where(key).in(values);
  });

  Object.entries(rangeFilters || {}).forEach(([key, range]) => {
    if (range.gte !== undefined) {
      query.where(key).gte(range.gte);
    }
    if (range.lte !== undefined) {
      query.where(key).lte(range.lte);
    }
  });

  return query;
};

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

/** Create users from env on first run. Login always uses MongoDB + bcrypt, not .env at request time. */
async function ensureBootstrapUsers() {
  const syncPw = ["1", "true", "yes"].includes(String(process.env.SYNC_BOOTSTRAP_PASSWORDS || "").toLowerCase());

  const seeds = [
    {
      email: process.env.ADMIN_EMAIL?.trim(),
      password: process.env.ADMIN_PASSWORD,
      role: "admin",
      name: process.env.ADMIN_FULL_NAME || "Administrator",
    },
    {
      email: process.env.STAFF_EMAIL?.trim(),
      password: process.env.STAFF_PASSWORD,
      role: "staff",
      name: process.env.STAFF_FULL_NAME || "Staff",
    },
  ];

  for (const { email, password, role, name } of seeds) {
    if (!email || password === undefined || password === null || password === "") continue;

    const password_hash = await bcrypt.hash(String(password), 10);
    const existing = await User.findOne({ email }).lean();

    if (!existing) {
      await User.create({
        email,
        password_hash,
        role,
        full_name: name,
        active: true,
        created_at: new Date().toISOString(),
      });
      console.log(`Bootstrap: created ${role} login for ${email} (from .env)`);
      continue;
    }

    if (syncPw) {
      await User.updateOne(
        { email },
        { $set: { password_hash, role, ...(name ? { full_name: name } : {}) } }
      );
      console.log(`Bootstrap: reset password for ${email} (SYNC_BOOTSTRAP_PASSWORDS)`);
    }
  }
}

app.post("/api/rpc/authenticate_user", async (req, res) => {
  try {
    const email = req.body.p_email;
    const password = req.body.p_password;

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const hash = user.password_hash || user.password;
    if (!hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({
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
  } catch (error) {
    return res.status(500).json({ error: error.message || "Authentication failed" });
  }
});

app.post("/api/rpc/create_user", async (req, res) => {
  try {
    const { p_email, p_password, p_role, p_full_name } = req.body;

    if (!p_email || !p_password) {
      return res.status(400).json({ data: { success: false, error: "Email and password are required" } });
    }

    const existing = await User.findOne({ email: p_email }).lean();
    if (existing) {
      return res.json({ data: { success: false, error: "A user with this email already exists" } });
    }

    const password_hash = await bcrypt.hash(p_password, 10);
    await User.create({
      email: p_email,
      password_hash,
      role: p_role || "staff",
      full_name: p_full_name || "",
      commission_percentage: req.body.p_commission_percentage ? Number(req.body.p_commission_percentage) : 0,
      active: true,
      created_at: new Date().toISOString()
    });

    return res.json({ data: { success: true } });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create user" });
  }
});

app.post("/api/rpc/change_password", async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: "userId and newPassword are required" });
    }
    const password_hash = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: userId }, { $set: { password_hash } });
    return res.json({ data: { success: true } });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to change password" });
  }
});

app.post("/api/query", async (req, res) => {
  try {
    const {
      collection,
      operation = "select",
      filters,
      inFilters,
      rangeFilters,
      orderBy,
      limitBy,
      updatePayload,
      insertPayload,
      expectSingle
    } = req.body;

    const Model = getGenericModel(collection);

    if (operation === "insert") {
      const docs = await Model.insertMany(insertPayload || []);
      return res.json({ data: docs });
    }

    if (operation === "update") {
      const result = await Model.updateMany(filters || {}, { $set: updatePayload || {} });
      return res.json({ data: result });
    }

    if (operation === "delete") {
      const result = await Model.deleteMany(filters || {});
      return res.json({ data: result });
    }

    let query = Model.find();
    query = applyFilters(query, filters, inFilters, rangeFilters);

    if (orderBy?.column) {
      query = query.sort({ [orderBy.column]: orderBy.ascending === false ? -1 : 1 });
    }
    if (limitBy) {
      query = query.limit(Number(limitBy));
    }

    const docs = await query.lean();
    return res.json({ data: expectSingle ? docs[0] || null : docs });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Query failed" });
  }
});

// ── Razorpay: Create Order ──────────────────────────────────────────────────
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({
        error: "Payments not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env",
      });
    }
    const { amount, currency = "INR", receipt } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    });
    return res.json({ data: order });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create order" });
  }
});

// ── Razorpay: Verify Payment ────────────────────────────────────────────────
app.post("/api/payment/verify", async (req, res) => {
  try {
    if (!getRazorpay()) {
      return res.status(503).json({
        error: "Payments not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env",
      });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment fields" });
    }
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed", valid: false });
    }
    return res.json({ data: { valid: true, payment_id: razorpay_payment_id } });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Verification failed" });
  }
});

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set. Add it to backend/.env (see backend/.env.example).");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 })
  .then(async () => {
    await ensureBootstrapUsers();
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    const msg = String(error.message || "");
    if (msg.includes("querySrv") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      console.error(`
  SRV/DNS or network issue (common with mongodb+srv:// on some networks).
  • Atlas: Database → Connect → Drivers → use the standard connection string (not SRV), or allow 0.0.0.0/0 under Network Access for dev.
  • Local MongoDB: MONGODB_URI=mongodb://127.0.0.1:27017/kalari_booking
  • Try another network/VPN off, or set DNS to 8.8.8.8 / 1.1.1.1`);
    }
    process.exit(1);
  });
