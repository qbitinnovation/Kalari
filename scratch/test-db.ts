import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

async function test() {
  console.log("Connecting to MongoDB from MONGODB_URI...");
  try {
    const start = Date.now();
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected successfully in", Date.now() - start, "ms");
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    await mongoose.disconnect();
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

test();
