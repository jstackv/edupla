require('dotenv').config();
const { connectDB } = require('./models/db');
const mongoose = require('mongoose');

async function migrate() {
  await connectDB();
  const db = mongoose.connection.db;

  for (const collName of ['levels', 'trades']) {
    const coll = db.collection(collName);
    const indexes = await coll.indexes();
    console.log(`\n${collName} current indexes:`, indexes.map(i => i.name));

    // Drop the old single-field unique index if it exists
    if (indexes.find(i => i.name === 'value_1')) {
      await coll.dropIndex('value_1');
      console.log(`✅ Dropped old index 'value_1' from ${collName}`);
    } else {
      console.log(`ℹ️  No old 'value_1' index found on ${collName}`);
    }
  }

  // Mongoose will auto-create the new compound indexes on next app start
  console.log('\n✅ Migration complete. Restart your server now.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });