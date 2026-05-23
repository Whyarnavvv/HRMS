const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({ email: { $in: ['hr@studypalacehub.com', 'agm@studypalacehub.com'] } }, 'email role name');
    console.log('--- SEEDED USERS ---');
    users.forEach(u => console.log(`${u.name} (${u.role}): ${u.email}`));
    console.log('-------------------');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
