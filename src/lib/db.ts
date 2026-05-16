import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kalary-booking';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 1200,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;

// Schemas
const userSchema = new mongoose.Schema({}, { strict: false, collection: "users" });
const genericSchema = new mongoose.Schema({ id: String }, { strict: false });

export const User = mongoose.models.User || mongoose.model("User", userSchema);

export const getGenericModel = (collectionName: string) => {
  if (!collectionName || typeof collectionName !== "string") {
    throw new Error("Invalid collection");
  }
  return mongoose.models[collectionName] || mongoose.model(collectionName, genericSchema, collectionName);
};
