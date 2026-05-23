const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

(async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected\n');

    const users = await User.find({}, { name: 1, email: 1, role: 1, password: 1 });
    console.log(`📋 Users in DB (${users.length} total):`);

    for (const u of users) {
      const hash = u.password || '';
      const isValidHash = hash.startsWith('$2b$') || hash.startsWith('$2a$');
      console.log(`\n  👤 ${u.name} (${u.role})`);
      console.log(`     Email   : ${u.email}`);
      console.log(`     Password: ${hash.substring(0, 20)}... (valid bcrypt hash: ${isValidHash})`);

      if (isValidHash) {
        const match = await bcrypt.compare('password123', hash);
        console.log(`     'password123' matches: ${match}`);
      } else {
        console.log(`     ⚠️  Password is NOT a bcrypt hash — stored as plain text!`);
        console.log(`     Fixing now...`);
        u.password = await bcrypt.hash('password123', 10);
        await u.save({ validateBeforeSave: false });
        // save bypasses pre-hook for direct update; use updateOne instead
        await User.updateOne({ _id: u._id }, { $set: { password: u.password } });
        console.log(`     ✅ Password re-hashed and saved.`);
      }
    }

    if (users.length === 0) {
      console.log('  ⚠️  No users found! Seeding admin accounts...');
      const hash = await bcrypt.hash('password123', 10);
      await User.insertMany([
        { role: 'Admin', name: 'HR Manager', email: 'hr@studypalacehub.com', password: hash },
        { role: 'Admin', name: 'Assistant General Manager', email: 'agm@studypalacehub.com', password: hash }
      ]);
      console.log('  ✅ Admin accounts seeded.');
    }

    console.log('\n✅ Diagnosis complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
