import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://root:v9RD4tXRJNNB8hfEvwPfqPNJklUyLHCqqvVP6MLPPB7141bYeC4q7ComrJ7Zj4DJ@187.77.191.143:5454/?directConnection=true';

async function check() {
  await mongoose.connect(MONGODB_URI);
  const Model = mongoose.models.shows || mongoose.model('shows', new mongoose.Schema({}, { strict: false }), 'shows');
  const shows = await Model.find({}).limit(1);
  console.log(JSON.stringify(shows, null, 2));
  await mongoose.disconnect();
}

check();
