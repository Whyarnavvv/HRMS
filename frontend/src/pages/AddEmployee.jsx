import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { ArrowLeft, Camera, Building2 } from 'lucide-react';

export default function AddEmployee() {
  const navigate = useNavigate();
  const [newEmp, setNewEmp] = useState({ 
    name: '', 
    email: '', 
    employeeId: '', 
    phoneNumber: '',
    role: 'Employee',
    department: '',
    designation: '',
    company: ''
  });
  const [companies, setCompanies] = useState([]);
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/employees/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const handlePhoto = (e) => {
      const file = e.target.files[0];
      if (file) {
          setProfilePic(file);
          setPreview(URL.createObjectURL(file));
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData();
    Object.keys(newEmp).forEach(key => formData.append(key, newEmp[key]));
    if (profilePic) formData.append('profilePic', profilePic);
    
    try {
      await api.post('/employees', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/admin/employees');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add employee');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
       {/* Header */}
       <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
           <button onClick={() => navigate('/admin')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', color: '#0f172a' }}>
              <ArrowLeft size={24} />
           </button>
           <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Add Employee</h1>
              <p style={{ color: '#64748b', margin: 0 }}>Register a new team member in the KPI system.</p>
           </div>
       </div>

       {/* Form Card */}
       <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} className="sm:p-10">
          <h3 style={{ color: '#0f172a', marginBottom: '0.25rem' }}>Employee Details</h3>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '2rem' }}>Enter the basic information and profile photo.</p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

             {/* Photo Uploader */}
             <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', backgroundColor: '#f8fafc', marginBottom: '1rem' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justify: 'center', margin: '0 auto 1.5rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                   {preview ? <img src={preview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={32} color="#94a3b8" />}
                </div>
                <label style={{ border: '1px solid #e2e8f0', background: 'white', color: '#0f172a', display: 'inline-block', marginBottom: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '14px' }}>
                   Upload Photo
                   <input type="file" accept="image/jpeg, image/png, image/webp" style={{ display: 'none' }} onChange={handlePhoto} />
                </label>
                <div style={{ color: '#94a3b8', fontSize: '12px' }}>JPG, PNG, WEBP up to 5MB</div>
             </div>

             {/* Inputs */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6" style={{ marginBottom: '1rem' }}>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>Full Name</label>
                   <input required value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} placeholder="Jane Doe" style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }} />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>Employee ID</label>
                   <input value={newEmp.employeeId} onChange={e => setNewEmp({...newEmp, employeeId: e.target.value})} placeholder="EMP-001" style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }} />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>Email Address</label>
                   <input type="email" required value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} placeholder="jane.doe@company.com" style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }} />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>Phone Number</label>
                   <input value={newEmp.phoneNumber} onChange={e => setNewEmp({...newEmp, phoneNumber: e.target.value})} placeholder="+1 (555) 000-0000" style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }} />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>Role</label>
                   <select value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})} style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }}>
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="HR">HR</option>
                      <option value="AGM">AGM</option>
                      <option value="Counselling Team">Counselling Team</option>
                   </select>
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>Department</label>
                   <select value={newEmp.department} onChange={e => setNewEmp({...newEmp, department: e.target.value})} style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }}>
                      <option value="">Select Department</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Admission">Admission</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Counselling">Counselling</option>
                      <option value="Management">Management</option>
                   </select>
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>Designation</label>
                   <input value={newEmp.designation} onChange={e => setNewEmp({...newEmp, designation: e.target.value})} placeholder="Software Engineer, Manager, etc." style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }} />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#0f172a', marginBottom: '0.5rem' }}>
                      <Building2 size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      Company
                   </label>
                   <select value={newEmp.company} onChange={e => setNewEmp({...newEmp, company: e.target.value})} style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem', borderRadius: '8px', width: '100%' }}>
                      <option value="">Select Company</option>
                      {companies.map(company => (
                         <option key={company._id} value={company._id}>
                            {company.name}
                         </option>
                      ))}
                   </select>
                </div>
             </div>

             {/* Action Buttons */}
             <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
                <button type="button" onClick={() => navigate('/admin')} style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '0.5rem 1rem', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>{loading ? 'Saving...' : 'Add Employee'}</button>
             </div>

          </form>
       </div>
    </div>
  )
}
