const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); // DNS override fix

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');

    const accounts = [
      { role: 'Admin', name: 'System Admin', email: 'admin@studypalacehub.com', password: 'adminpassword123', kycStatus: 'Approved', isEmailVerified: true },
      { role: 'HR', name: 'HR Manager', email: 'hr@studypalacehub.com', password: 'password123', kycStatus: 'Approved', isEmailVerified: true },
      { role: 'Admin', name: 'Assistant General Manager', email: 'agm@studypalacehub.com', password: 'password123', kycStatus: 'Approved', isEmailVerified: true }
    ];


    for (const acc of accounts) {
      const exists = await User.findOne({ email: acc.email });
      if (!exists) {
        await User.create(acc);
        console.log(`✅ Created ${acc.name}: ${acc.email} // Password: ${acc.password}`);
      } else {
        console.log(`ℹ️ ${acc.name} already exists: ${acc.email}`);
      }
    }

    console.log('Seeding process completed.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error seeding:', e.message);
    process.exit(1);
  }
}

seed();
