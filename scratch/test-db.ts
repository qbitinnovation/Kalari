import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://root:v9RD4tXRJNNB8hfEvwPfqPNJklUyLHCqqvVP6MLPPB7141bYeC4q7ComrJ7Zj4DJ@187.77.191.143:5454/?directConnection=true';

async function test() {
  console.log("Connecting to:", MONGODB_URI);
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
