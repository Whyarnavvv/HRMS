import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Search,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export default function CompanyManagement() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ totalCompanies: 0, activeCompanies: 0, totalEmployees: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    gstNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India'
    },
    email: '',
    phone: '',
    website: '',
    industry: '',
    description: '',
    establishedYear: '',
    employeeCount: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [errors, setErrors] = useState({});

  // Check if user is SuperAdmin
  const isSuperAdmin = user?.role === 'SuperAdmin';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/admin');
      return;
    }
    fetchCompanies();
    fetchStats();
  }, [isSuperAdmin, navigate]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/companies');
      setCompanies(data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/companies/stats');
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }
    
    if (!formData.address.city.trim()) {
      newErrors.city = 'City is required';
    }
    
    if (!formData.address.state.trim()) {
      newErrors.state = 'State is required';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber)) {
      newErrors.gstNumber = 'Invalid GST number format';
    }
    
    if (formData.establishedYear && (formData.establishedYear < 1800 || formData.establishedYear > new Date().getFullYear())) {
      newErrors.establishedYear = 'Invalid year';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, logo: 'Only image files are allowed' }));
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, logo: 'File size must be less than 5MB' }));
        return;
      }
      
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setErrors(prev => ({ ...prev, logo: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.keys(formData).forEach(key => {
        if (typeof formData[key] === 'object') {
          Object.keys(formData[key]).forEach(subKey => {
            formDataToSend.append(`${key}.${subKey}`, formData[key][subKey]);
          });
        } else {
          formDataToSend.append(key, formData[key]);
        }
      });
      
      // Add logo file if exists
      if (logoFile) {
        formDataToSend.append('logo', logoFile);
      }
      
      if (editingCompany) {
        await api.put(`/companies/${editingCompany._id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/companies', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      resetForm();
      fetchCompanies();
      fetchStats();
    } catch (error) {
      console.error('Failed to save company:', error);
      setErrors(prev => ({ 
        ...prev, 
        submit: error.response?.data?.message || 'Failed to save company' 
      }));
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || '',
      gstNumber: company.gstNumber || '',
      address: {
        street: company.address?.street || '',
        city: company.address?.city || '',
        state: company.address?.state || '',
        postalCode: company.address?.postalCode || '',
        country: company.address?.country || 'India'
      },
      email: company.email || '',
      phone: company.phone || '',
      website: company.website || '',
      industry: company.industry || '',
      description: company.description || '',
      establishedYear: company.establishedYear || '',
      employeeCount: company.employeeCount || ''
    });
    
    setLogoPreview(company.logo ? `/uploads/${company.logo}` : '');
    setLogoFile(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await api.delete(`/companies/${deleteConfirm._id}`);
      setCompanies(prev => prev.filter(c => c._id !== deleteConfirm._id));
      setDeleteConfirm(null);
      fetchStats();
    } catch (error) {
      console.error('Failed to delete company:', error);
      alert(error.response?.data?.message || 'Failed to delete company');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      gstNumber: '',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India'
      },
      email: '',
      phone: '',
      website: '',
      industry: '',
      description: '',
      establishedYear: '',
      employeeCount: ''
    });
    setLogoFile(null);
    setLogoPreview('');
    setEditingCompany(null);
    setErrors({});
    setShowModal(false);
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">Only SuperAdmin can access Company Management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Company Management</h1>
            <p className="text-slate-600 mt-1">Manage companies and their profiles</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Company
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Companies</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalCompanies}</p>
              </div>
              <Building2 className="text-blue-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Companies</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeCompanies}</p>
              </div>
              <CheckCircle className="text-green-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Employees</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalEmployees}</p>
              </div>
              <Users className="text-purple-500" size={24} />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Companies List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">Companies</h3>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employees</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredCompanies.map((company) => (
                    <tr key={company._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {company.logo ? (
                            <img
                              src={`/uploads/${company.logo}`}
                              alt={company.name}
                              className="w-10 h-10 rounded-lg object-cover mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center mr-3">
                              <Building2 size={20} className="text-slate-400" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-slate-900">{company.name}</div>
                            <div className="text-xs text-slate-500">{company.industry}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {company.email && (
                            <div className="flex items-center gap-1">
                              <Mail size={12} className="text-slate-400" />
                              {company.email}
                            </div>
                          )}
                          {company.phone && (
                            <div className="flex items-center gap-1">
                              <Phone size={12} className="text-slate-400" />
                              {company.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            {company.address?.city}, {company.address?.state}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{company.employeeCount || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          company.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {company.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(company)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(company)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredCompanies.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Building2 className="mx-auto text-slate-400 mb-4" size={48} />
                  <p className="text-slate-600">No companies found.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-800">
                  {editingCompany ? 'Edit Company' : 'Add New Company'}
                </h2>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
                  <div className="flex items-center space-x-4">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLogoPreview('');
                            setLogoFile(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center">
                        <Building2 size={24} className="text-slate-400" />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer"
                      >
                        <Upload size={16} />
                        Choose Logo
                      </label>
                    </div>
                  </div>
                  {errors.logo && (
                    <p className="text-red-500 text-sm mt-1">{errors.logo}</p>
                  )}
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Company Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">GST Number</label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleInputChange}
                      placeholder="22AAAAA0000A1ZV"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.gstNumber && (
                      <p className="text-red-500 text-sm mt-1">{errors.gstNumber}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Street Address</label>
                    <input
                      type="text"
                      name="address.street"
                      value={formData.address.street}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">City *</label>
                      <input
                        type="text"
                        name="address.city"
                        value={formData.address.city}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      {errors.city && (
                        <p className="text-red-500 text-sm mt-1">{errors.city}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">State *</label>
                      <input
                        type="text"
                        name="address.state"
                        value={formData.address.state}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      {errors.state && (
                        <p className="text-red-500 text-sm mt-1">{errors.state}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Postal Code</label>
                      <input
                        type="text"
                        name="address.postalCode"
                        value={formData.address.postalCode}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Website</label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Industry</label>
                    <input
                      type="text"
                      name="industry"
                      value={formData.industry}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Established Year</label>
                    <input
                      type="number"
                      name="establishedYear"
                      value={formData.establishedYear}
                      onChange={handleInputChange}
                      min="1800"
                      max={new Date().getFullYear()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.establishedYear && (
                      <p className="text-red-500 text-sm mt-1">{errors.establishedYear}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Employee Count</label>
                    <input
                      type="number"
                      name="employeeCount"
                      value={formData.employeeCount}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{errors.submit}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingCompany ? 'Update Company' : 'Create Company'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Delete Company</h3>
                  <p className="text-sm text-slate-600">This action cannot be undone.</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-slate-700">
                  Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  This will only be possible if no users are associated with this company.
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
