import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

async function check() {
  await mongoose.connect(MONGODB_URI);
  const Model = mongoose.models.shows || mongoose.model('shows', new mongoose.Schema({}, { strict: false }), 'shows');
  const shows = await Model.find({}).limit(1);
  console.log(JSON.stringify(shows, null, 2));
  await mongoose.disconnect();
}

check();
