import mongoose from 'mongoose';
import { getSeedData } from '../src/lib/seedData';

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const genericSchema = new mongoose.Schema({ id: String }, { strict: false });

async function seed() {
  console.log("Connecting to MongoDB from MONGODB_URI...");
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully");
    
    const data = getSeedData();
    const collections = ['activities', 'shows', 'layouts'];
    
    for (const col of collections) {
      console.log(`Seeding ${col}...`);
      const Model = mongoose.models[col] || mongoose.model(col, genericSchema, col);
      await Model.deleteMany({});
      const rows = (data as any)[col];
      if (rows && rows.length > 0) {
        await Model.insertMany(rows.map((row: any) => ({
          ...row,
          created_at: row.created_at || new Date().toISOString()
        })));
      }
      console.log(`Seeded ${col}: ${await Model.countDocuments()} rows`);
    }

    console.log("Seed completed successfully!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Seed failed:", err);
  }
}

seed();
