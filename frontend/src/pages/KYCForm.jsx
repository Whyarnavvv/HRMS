import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { FileText, Camera, CreditCard, Home, Phone, MapPin, UploadCloud, AlertCircle } from 'lucide-react';

export default function KYCForm() {
  const { user, login } = useContext(AuthContext); // We've logged in partially, but need to re-login or update user object after KYC success
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    phoneNumber: '',
    employeeId: '',
    address: '',
    bankAccount: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    department: '',
    birthDate: '',
    joiningDate: '',
    panCard: ''
  });

  const [files, setFiles] = useState({
    panCard: null,
    aadhaarFront: null,
    aadhaarBack: null,
    photo: null
  });

  const [previews, setPreviews] = useState({
    panCard: null,
    aadhaarFront: null,
    aadhaarBack: null,
    photo: null
  });

  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFiles({ ...files, [e.target.name]: file });
    
    // Generate preview
    if (file && file.type.startsWith('image/')) {
       const url = URL.createObjectURL(file);
       setPreviews(prev => ({ ...prev, [e.target.name]: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    
    // Add bankDetails as object
    const bankDetails = {
       accountHolder: formData.bankAccount,
       accountNumber: formData.accountNumber,
       ifsc: formData.ifsc,
       bankName: formData.bankName
    };
    data.append('bankDetails', JSON.stringify(bankDetails));

    Object.keys(files).forEach(key => {
      if (files[key]) data.append(key, files[key]);
    });

    try {
      await api.post('/employees/submit-kyc', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting KYC. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-12 text-center border border-white animate-fade-in">
           <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <UploadCloud size={48} />
           </div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-4">Identity Submitted!</h2>
           <p className="text-slate-500 leading-relaxed mb-10 font-medium">
              Your details have been securely uploaded to our HR department. 
              We will review your information shortly.
           </p>
           <button 
              onClick={() => {
                localStorage.removeItem('user');
                window.location.href = '/';
              }}
              className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl hover:bg-slate-800 transition shadow-xl shadow-slate-200"
           >
              Go Back to Sign In
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-white overflow-hidden animate-fade-in">
          
          <div className="bg-slate-900 p-6 sm:p-8 lg:p-12 text-white flex justify-between items-center gap-4">
             <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Employee Verification</h1>
                <p className="text-sm sm:text-base text-slate-400 font-medium">Please provide accurate information for HR approval.</p>
             </div>
             <div className="hidden sm:block p-4 bg-white/10 rounded-3xl backdrop-blur-sm border border-white/10">
                <FileText size={40} className="text-blue-400" />
             </div>
          </div>

          {error && (
             <div className="mx-4 sm:mx-8 lg:mx-12 mt-6 sm:mt-8 p-4 sm:p-5 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 font-bold text-sm">
                <AlertCircle size={20} /> {error}
             </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-10">
            
            {/* Personal & Work Info */}
            <div className="space-y-6">
               <h3 className="text-xl font-bold flex items-center gap-3 text-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Phone size={18} /></div>
                  Contact & Registry
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Phone Number</label>
                     <input type="tel" name="phoneNumber" required value={formData.phoneNumber} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" placeholder="+91 00000 00000" />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Employee ID (Allocated)</label>
                     <input type="text" name="employeeId" required value={formData.employeeId} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" placeholder="SPH-..." />
                  </div>
                  <div className="md:col-span-2">
                     <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Department</label>
                     <select 
                        name="department" required 
                        value={formData.department} onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                     >
                        <option value="">Select Department</option>
                        <option value="IT">IT</option>
                        <option value="HR">HR</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Sales">Sales</option>
                        <option value="Operations">Operations</option>
                        <option value="Finance">Finance</option>
                        <option value="Management">Management</option>
                     </select>
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Date of Birth</label>
                        <input type="date" name="birthDate" required value={formData.birthDate} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Date of Joining</label>
                        <input type="date" name="joiningDate" required value={formData.joiningDate} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
                     </div>
                  </div>
                  <div className="md:col-span-2">
                     <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">PAN Card Number</label>
                     <input type="text" name="panCard" required value={formData.panCard} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none uppercase" placeholder="ABCDE1234F" />
                  </div>
                  <div className="md:col-span-2">
                     <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Residential Address</label>
                     <textarea name="address" required value={formData.address} onChange={handleInputChange} rows="3" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" placeholder="Full permanent address..."></textarea>
                  </div>
               </div>
            </div>

            {/* Documents Upload */}
            <div className="space-y-6">
               <h3 className="text-xl font-bold flex items-center gap-3 text-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><CreditCard size={18} /></div>
                  Identification Documents
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UploadBox label="PAN Card Image" name="panCard" onChange={handleFileChange} preview={previews.panCard} />
                  <UploadBox label="Photograph" name="photo" onChange={handleFileChange} preview={previews.photo} />
                  <UploadBox label="Aadhaar Card (Front)" name="aadhaarFront" onChange={handleFileChange} preview={previews.aadhaarFront} />
                  <UploadBox label="Aadhaar Card (Back)" name="aadhaarBack" onChange={handleFileChange} preview={previews.aadhaarBack} />
               </div>
            </div>

            {/* Bank Details */}
            <div className="space-y-6">
               <h3 className="text-xl font-bold flex items-center gap-3 text-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center"><Home size={18} /></div>
                  MANDATORY: Salary Disbursement Details
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 bg-slate-50 rounded-2xl sm:rounded-[2rem] border border-slate-100">
                  <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2">Account Holder Name</label>
                     <input type="text" name="bankAccount" required value={formData.bankAccount} onChange={handleInputChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2">Bank Account Number</label>
                     <input type="text" name="accountNumber" required value={formData.accountNumber} onChange={handleInputChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2">IFSC Code</label>
                     <input type="text" name="ifsc" required value={formData.ifsc} onChange={handleInputChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2">Bank & Branch Name</label>
                     <input type="text" name="bankName" required value={formData.bankName} onChange={handleInputChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" />
                  </div>
               </div>
            </div>

            <div className="pt-6 sm:pt-8 flex justify-stretch sm:justify-end">
               <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full sm:w-auto bg-blue-600 text-white font-bold py-4 sm:py-5 px-8 sm:px-12 rounded-2xl hover:bg-blue-700 transition shadow-2xl shadow-blue-100 flex items-center justify-center gap-3 disabled:opacity-50"
               >
                  {loading ? 'Uploading Details...' : 'Submit Verification Form'}
               </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function UploadBox({ label, name, onChange, preview }) {
   return (
      <div className="group">
         <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{label}</label>
         <div className="relative">
            <input 
               type="file" 
               name={name} 
               onChange={onChange}
               required
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-8 flex flex-col items-center justify-center transition-all group-hover:border-blue-300 group-hover:bg-blue-50/50 min-h-[160px] relative overflow-hidden">
               {preview ? (
                  <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
               ) : (
                  <>
                     <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 mb-4 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                        <UploadCloud size={24} />
                     </div>
                     <p className="text-sm font-bold text-slate-500 group-hover:text-blue-600">Click to Upload</p>
                     <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">JPEG, PNG, PDF</p>
                  </>
               )}
            </div>
         </div>
      </div>
   );
}
