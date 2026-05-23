require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');
const User = require('./models/User');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const seedSuperAdmin = async () => {
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@sph.local';
  const password = process.env.SUPERADMIN_PASSWORD || 'ChangeMe@123';
  const name = process.env.SUPERADMIN_NAME || 'Super Admin';

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in server/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      password,
      role: 'SuperAdmin',
      isEmailVerified: true,
      kycStatus: 'Approved',
      isActive: 'Active'
    });
    console.log(`SuperAdmin created: ${email}`);
  } else {
    user.name = name;
    user.role = 'SuperAdmin';
    user.password = password;
    user.isEmailVerified = true;
    user.kycStatus = 'Approved';
    user.isActive = 'Active';
    await user.save();
    console.log(`SuperAdmin updated: ${email}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
};

seedSuperAdmin().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
