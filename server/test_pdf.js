const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config();
const { getPayrollById, getPayrollPDF } = require('./controllers/payrollController');
const Payroll = require('./models/Payroll');
const User = require('./models/User');

const test = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const payrolls = await Payroll.find().limit(1);
  if (!payrolls.length) {
    console.log('No payrolls found.');
    process.exit(0);
  }
  
  const payroll = payrolls[0];
  console.log('Testing PDF for payroll:', payroll._id);
  
  try {
    const req = { params: { id: payroll._id }, user: { role: 'Admin', _id: 'fake' } };
    const res = {
      setHeader: (k, v) => console.log(`Header: ${k} = ${v}`),
      send: (buf) => {
        console.log(`Success! Buffer size: ${buf.length}`);
        process.exit(0);
      },
      status: (code) => {
        return {
          json: (err) => {
            console.error('Error Status:', code, err);
            process.exit(1);
          }
        }
      }
    };
    
    await getPayrollPDF(req, res);
  } catch(e) {
    console.error('Crash:', e);
    process.exit(1);
  }
};

test();
