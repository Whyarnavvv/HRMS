import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import {
  Users,
  Calendar,
  Search,
  Download,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  User,
  Building,
  TrendingUp
} from 'lucide-react';

export default function TeamAttendanceDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // State management
  const [attendanceData, setAttendanceData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateType: 'single', // 'single' or 'range'
    singleDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    department: 'all',
    employeeName: '',
    status: 'all'
  });
  
  // Summary stats
  const [summary, setSummary] = useState({
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    totalOvertimeHours: 0
  });
  
  const [isExporting, setIsExporting] = useState(false);

  // Check if user has access
  const hasAccess = ['HR', 'Admin', 'AGM', 'SuperAdmin'].includes(user?.role);

  useEffect(() => {
    if (!hasAccess) {
      navigate('/employee'); // Redirect employees
      return;
    }
    
    fetchInitialData();
  }, [hasAccess, navigate]);

  useEffect(() => {
    if (hasAccess) {
      fetchAttendanceData();
    }
  }, [filters, hasAccess]);

  const fetchInitialData = async () => {
    try {
      const [empRes] = await Promise.all([
        api.get('/employees')
      ]);
      
      setEmployees(empRes.data);
      
      // Extract unique departments
      const uniqueDepts = [...new Set(empRes.data.map(emp => emp.department).filter(Boolean))];
      setDepartments(uniqueDepts);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      
      let query = new URLSearchParams();
      
      if (filters.dateType === 'single') {
        query.append('date', filters.singleDate);
      } else {
        query.append('startDate', filters.startDate);
        query.append('endDate', filters.endDate);
      }
      
      if (filters.department !== 'all') {
        query.append('department', filters.department);
      }
      
      if (filters.employeeName) {
        query.append('search', filters.employeeName);
      }
      
      if (filters.status !== 'all') {
        query.append('status', filters.status);
      }
      
      const response = await api.get(`/attendance/team-dashboard?${query.toString()}`);
      setAttendanceData(response.data.attendance || []);
      setSummary(response.data.summary || {
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        totalOvertimeHours: 0
      });
    } catch (err) {
      console.error('Failed to fetch attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateLateArrival = (checkInTime) => {
    if (!checkInTime) return false;
    // Match the system's actual late threshold: 10:15 AM
    const checkIn = new Date(checkInTime);
    const lateThreshold = new Date(checkIn);
    lateThreshold.setHours(10, 15, 0, 0);
    return checkIn > lateThreshold;
  };

  const calculateOvertime = (checkInTime, checkOutTime) => {
    if (!checkInTime || !checkOutTime) return 0;
    
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const shiftEnd = new Date(checkIn);
    shiftEnd.setHours(18, 0, 0, 0); // 18:00 fallback
    
    if (checkOut > shiftEnd) {
      const overtimeMs = checkOut - shiftEnd;
      return overtimeMs / (1000 * 60 * 60); // Convert to hours
    }
    
    return 0;
  };

  const exportToCSV = async () => {
    if (attendanceData.length === 0) {
      alert('No data available to export');
      return;
    }

    setIsExporting(true);
    
    try {

    const headers = [
      'Employee Name',
      'Employee ID',
      'Department',
      'Designation',
      'Date',
      'Check-In Time',
      'Check-Out Time',
      'Total Hours',
      'Late Arrival',
      'Overtime Hours',
      'Status'
    ];
    
    const csvData = attendanceData.map(record => {
      const employee = record.user || {};
      const checkInTime = record.checkIn ? new Date(record.checkIn).toLocaleString() : 'N/A';
      const checkOutTime = record.checkOut ? new Date(record.checkOut).toLocaleString() : 'N/A';
      const totalHours = record.totalHours || 0;
      const lateArrival = calculateLateArrival(record.checkIn) ? 'Yes' : 'No';
      const overtime = calculateOvertime(record.checkIn, record.checkOut).toFixed(2);
      
      return [
        `"${(employee.name || 'N/A').replace(/"/g, '""')}"`, // Escape quotes in names
        `"${employee.employeeId || 'N/A'}"`,
        `"${(employee.department || 'N/A').replace(/"/g, '""')}"`,
        `"${(employee.designation || 'N/A').replace(/"/g, '""')}"`,
        `"${record.date || 'N/A'}"`,
        `"${checkInTime}"`,
        `"${checkOutTime}"`,
        totalHours,
        lateArrival,
        overtime,
        `"${record.status || 'N/A'}"`
      ];
    });
    
    // Add summary row at the end
    const summaryRow = [
      'SUMMARY',
      '',
      '',
      '',
      '',
      '',
      `"Total Hours: ${attendanceData.reduce((sum, r) => sum + (r.totalHours || 0), 0).toFixed(2)}"`,
      `"Present: ${summary.totalPresent}"`,
      `"Absent: ${summary.totalAbsent}"`,
      `"Late: ${summary.totalLate}"`,
      `"Overtime: ${summary.totalOvertimeHours.toFixed(2)}h"`,
      ''
    ];
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(',')),
      summaryRow.join(',')
    ].join('\n');
    
    // Add BOM for proper UTF-8 handling in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const dateRange = filters.dateType === 'single' 
      ? filters.singleDate 
      : `${filters.startDate}-to-${filters.endDate}`;
    a.download = `team-attendance-${dateRange}-${today}.csv`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Show success message
    alert(`Successfully exported ${attendanceData.length} attendance records to CSV`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(filters.employeeName.toLowerCase())
  );

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to access this page.</p>
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
            <h1 className="text-3xl font-bold text-slate-800">Team Attendance Dashboard</h1>
            <p className="text-slate-600 mt-1">Monitor and manage team attendance records</p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={isExporting || attendanceData.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isExporting || attendanceData.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-100'
            }`}
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download size={18} />
                Export CSV
              </>
            )}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Present</p>
                <p className="text-2xl font-bold text-green-600">{summary.totalPresent}</p>
              </div>
              <CheckCircle className="text-green-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Absent</p>
                <p className="text-2xl font-bold text-red-600">{summary.totalAbsent}</p>
              </div>
              <XCircle className="text-red-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Late</p>
                <p className="text-2xl font-bold text-amber-600">{summary.totalLate}</p>
              </div>
              <AlertCircle className="text-amber-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Overtime</p>
                <p className="text-2xl font-bold text-blue-600">{summary.totalOvertimeHours.toFixed(1)}h</p>
              </div>
              <TrendingUp className="text-blue-500" size={24} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Filter size={20} />
            Filters
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date Type</label>
              <select
                value={filters.dateType}
                onChange={(e) => setFilters({...filters, dateType: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="single">Single Date</option>
                <option value="range">Date Range</option>
              </select>
            </div>

            {/* Single Date */}
            {filters.dateType === 'single' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                <input
                  type="date"
                  value={filters.singleDate}
                  onChange={(e) => setFilters({...filters, singleDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* Date Range */}
            {filters.dateType === 'range' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({...filters, department: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Employee Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Employee Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={filters.employeeName}
                  onChange={(e) => setFilters({...filters, employeeName: e.target.value})}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
                <option value="Half-day">Half-day</option>
                <option value="Paid Leave">Paid Leave</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">Attendance Records</h3>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Check-In Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Check-Out Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Late Arrival</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Overtime</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {attendanceData.map((record) => {
                    const employee = record.user || {};
                    const isLate = calculateLateArrival(record.checkIn);
                    const overtime = calculateOvertime(record.checkIn, record.checkOut);
                    
                    return (
                      <tr key={record._id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                              {employee.name?.charAt(0) || 'N'}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-slate-900">{employee.name || 'N/A'}</div>
                              <div className="text-xs text-slate-500">{employee.employeeId || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building className="w-4 h-4 text-slate-400 mr-2" />
                            <span className="text-sm text-slate-900">{employee.department || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 text-slate-400 mr-2" />
                            <span className="text-sm text-slate-900">
                              {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 text-slate-400 mr-2" />
                            <span className="text-sm text-slate-900">
                              {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-900">{record.totalHours || 0}h</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isLate ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                              Late
                            </span>
                          ) : (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              On Time
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-900">{overtime.toFixed(1)}h</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.status === 'Present' ? 'bg-green-100 text-green-800' :
                            record.status === 'Absent' ? 'bg-red-100 text-red-800' :
                            record.status === 'Late' ? 'bg-amber-100 text-amber-800' :
                            record.status === 'Half-day' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {record.status || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {attendanceData.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Users className="mx-auto text-slate-400 mb-4" size={48} />
                  <p className="text-slate-600">No attendance records found for the selected filters.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
