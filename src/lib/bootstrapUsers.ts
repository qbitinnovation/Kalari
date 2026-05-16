import bcrypt from "bcryptjs";
import { User } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";

const envUsers = () => {
  const users = [
    {
      email: process.env.ADMIN_EMAIL?.trim(),
      password: process.env.ADMIN_PASSWORD,
      role: "admin",
      full_name: process.env.ADMIN_FULL_NAME || "Administrator",
    },
    {
      email: process.env.STAFF_EMAIL?.trim(),
      password: process.env.STAFF_PASSWORD,
      role: "staff",
      full_name: process.env.STAFF_FULL_NAME || "Staff",
    },
  ];

  return users.filter((user) => user.email && user.password);
};

export const shouldSyncBootstrapPasswords = () =>
  ["1", "true", "yes"].includes(String(process.env.SYNC_BOOTSTRAP_PASSWORDS || "").toLowerCase());

export async function ensureMongoBootstrapUsers() {
  const UserModel = User as any;
  const syncPasswords = shouldSyncBootstrapPasswords();

  for (const user of envUsers()) {
    const existing = await UserModel.findOne({ email: user.email }).lean();
    const password_hash = await bcrypt.hash(String(user.password), 10);

    if (!existing) {
      await UserModel.create({
        email: user.email,
        password_hash,
        role: user.role,
        full_name: user.full_name,
        active: true,
        created_at: new Date().toISOString(),
      });
      continue;
    }

    if (syncPasswords) {
      await UserModel.updateOne(
        { email: user.email },
        {
          $set: {
            password_hash,
            role: user.role,
            full_name: user.full_name,
            active: true,
            updated_at: new Date().toISOString(),
          },
        }
      );
    }
  }
}

export async function ensureLocalBootstrapUsers() {
  const store = await readStore();
  store.users = store.users || [];
  const syncPasswords = shouldSyncBootstrapPasswords();

  for (const user of envUsers()) {
    const existing = store.users.find((item: any) => item.email === user.email);
    if (!existing) {
      store.users.push({
        id: `user-${user.role}-${Date.now()}`,
        email: user.email,
        password: user.password,
        role: user.role,
        full_name: user.full_name,
        active: true,
        created_at: new Date().toISOString(),
      });
      continue;
    }

    if (syncPasswords) {
      existing.password = user.password;
      existing.role = user.role;
      existing.full_name = user.full_name;
      existing.active = true;
      existing.updated_at = new Date().toISOString();
    }
  }

  await writeStore(store);
  return store;
}

export function envCredentialSummary() {
  return Object.fromEntries(envUsers().map((user) => [user.role, `${user.email} / ${user.password}`]));
}
