import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { useContext } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDetailAdmin from './pages/EmployeeDetailAdmin';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminLayout from './components/AdminLayout';
import AddEmployee from './pages/AddEmployee';
import Attendance from './pages/Attendance';
import TaskManagement from './pages/TaskManagement';
import EmployeeManagement from './pages/EmployeeManagement';
import Payroll from './pages/Payroll';
import AttendanceManagement from './pages/AttendanceManagement';
import Leaderboard from './pages/Leaderboard';
import KPIManagement from './pages/KPIManagement';

import ManagerDashboard from './pages/ManagerDashboard';
import KYCForm from './pages/KYCForm';
import VerificationPending from './pages/VerificationPending';
import PasswordSetup from './pages/PasswordSetup';
import HolidayManagement from './pages/HolidayManagement';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import GeofenceManagement from './pages/GeofenceManagement';
import WFHRequest from './pages/WFHRequest';
import WFHApprovals from './pages/WFHApprovals';
import ScreenTimeDashboard from './pages/ScreenTimeDashboard';
import AuditLogs from './pages/AuditLogs';
import TeamAttendanceDashboard from './pages/TeamAttendanceDashboard';
import CompanyManagement from './pages/CompanyManagement';
import CounsellingDashboard from './pages/CounsellingDashboard';
import VerificationQueue from './pages/VerificationQueue';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  if (!user) return <Navigate to="/" />;

  // KYC logic for Employees
  if (user.role === 'Employee' && user.kycStatus !== 'Approved') {
    if ((user.kycStatus === 'Incomplete' || user.kycStatus === 'Rejected') && location.pathname !== '/kyc-submission') {
      return <Navigate to="/kyc-submission" />;
    }
    if (user.kycStatus === 'Pending' && location.pathname !== '/verification-pending') {
      return <Navigate to="/verification-pending" />;
    }
    // If already on the correct page, or if it's an allowed role mismatch (handled below)
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

const RoleBasedRedirect = () => {
  const { user } = useContext(AuthContext);
  if (!user) return <Login />;

  if (user.kycStatus === 'Incomplete') return <Navigate to="/kyc-submission" />;
  if (user.kycStatus === 'Pending') return <Navigate to="/verification-pending" />;
  if (user.kycStatus === 'Rejected') return <Navigate to="/kyc-submission" />;

  if (user.role === 'Counselling Team') return <Navigate to="/counselling" />;
  if (user.role === 'Manager') return <Navigate to="/admin/manager-dashboard" />;
  if (['Admin', 'HR', 'AGM', 'SuperAdmin'].includes(user.role)) return <Navigate to="/admin" />;
  return <Navigate to="/employee" />;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RoleBasedRedirect />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-password/:token" element={<PasswordSetup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/kyc-submission" element={
          <ProtectedRoute><KYCForm /></ProtectedRoute>
        } />

        <Route path="/verification-pending" element={
          <ProtectedRoute><VerificationPending /></ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin']}><AdminLayout /></ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="manager-dashboard" element={<ManagerDashboard />} />
          <Route path="add-employee" element={<AddEmployee />} />
          <Route path="employee/:id" element={<EmployeeDetailAdmin />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="manage-attendance" element={<AttendanceManagement />} />
          <Route path="tasks" element={<TaskManagement />} />
          <Route path="employees" element={<EmployeeManagement />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="my-payroll" element={<Payroll personal={true} />} />
          <Route path="holidays" element={<HolidayManagement />} />
          <Route path="geofences" element={<GeofenceManagement />} />
          <Route path="wfh-approvals" element={<WFHApprovals />} />
          <Route path="screen-time" element={<ScreenTimeDashboard />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="kpi-management" element={<KPIManagement />} />
          <Route path="profile" element={<EmployeeDetailAdmin />} />
          <Route path="wfh-request" element={<WFHRequest />} />
          <Route path="team-attendance" element={<TeamAttendanceDashboard />} />
          <Route path="companies" element={<CompanyManagement />} />
          <Route path="counselling" element={<CounsellingDashboard />} />
          <Route path="verification-queue" element={<VerificationQueue />} />
        </Route>


        <Route path="/employee" element={
          <ProtectedRoute allowedRoles={['Employee', 'Manager', 'HR', 'Admin', 'AGM', 'SuperAdmin']}><AdminLayout /></ProtectedRoute>
        }>
          <Route index element={<EmployeeDashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="tasks" element={<TaskManagement />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="screen-time" element={<ScreenTimeDashboard />} />
          <Route path="wfh-request" element={<WFHRequest />} />
        </Route>

        {/* Counselling Team standalone layout */}
        <Route path="/counselling" element={
          <ProtectedRoute allowedRoles={['Counselling Team', 'SuperAdmin']}><AdminLayout /></ProtectedRoute>
        }>
          <Route index element={<CounsellingDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;


