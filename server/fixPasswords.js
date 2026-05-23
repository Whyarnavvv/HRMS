const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected. Scanning all users...\n');

  const raw = mongoose.connection.collection('users');
  const users = await raw.find({}).toArray();
  console.log(`Total users found: ${users.length}\n`);

  let fixed = 0;
  for (const u of users) {
    const pw = u.password || '';
    const isHash = pw.startsWith('$2b$') || pw.startsWith('$2a$');

    if (!isHash) {
      // If the stored value looks like a real password, hash it. Otherwise default to password123.
      const plaintext = (pw.length > 0 && pw.length < 60) ? pw : 'password123';
      const newHash = await bcrypt.hash(plaintext, 10);
      await raw.updateOne({ _id: u._id }, { $set: { password: newHash } });
      console.log(`🔧 Fixed : ${u.email}  (stored plain text → re-hashed)`);
      fixed++;
    } else {
      console.log(`✅ OK    : ${u.email}  (already a bcrypt hash)`);
    }
  }

  console.log(`\n🏁 Done. Fixed ${fixed} user(s).`);
  if (fixed > 0) {
    console.log('\n⚠️  IMPORTANT: Any user whose password was plain text has been hashed using their stored value.');
    console.log('   If you do not know their original password, you may need to reset it manually.');
  }
  mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
