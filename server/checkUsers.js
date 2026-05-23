const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const User = require('./models/User');
    try {
      await User.create([
        { role: 'Admin', name: 'HR Manager', email: 'hr@studypalacehub.com', password: 'password123' }
      ]);
      console.log('Seeded successfully!');
    } catch(e) {
      console.error('SEED ERROR MESSAGE:', e.message);
    }
    process.exit(0);
  });
