import { useState, useEffect, useContext } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import {
  FileBarChart2, Download, Filter, SlidersHorizontal, X,
  Package, Users, Wrench, AlertOctagon, KeyRound,
  FileText, FileSpreadsheet, File, Loader, CheckCircle,
  ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Report definitions ───────────────────────────────────────────────────────
const REPORTS = [
  {
    key:         'asset-inventory',
    title:       'Asset Inventory Report',
    description: 'Complete list of all company assets with status, quantities, procurement details, and assigned counts.',
    icon:        Package,
    iconBg:      'bg-blue-50',
    iconColor:   'text-blue-600',
    roles:       ['Admin', 'HR', 'AGM', 'SuperAdmin'],
    filters:     ['category', 'status', 'dateRange'],
  },
  {
    key:         'employee-asset',
    title:       'Employee Asset Report',
    description: 'All asset assignments per employee — active, returned, and overdue — with return condition.',
    icon:        Users,
    iconBg:      'bg-indigo-50',
    iconColor:   'text-indigo-600',
    roles:       ['Admin', 'HR', 'AGM', 'SuperAdmin'],
    filters:     ['employee', 'department', 'category', 'dateRange'],
  },
  {
    key:         'damaged',
    title:       'Damaged Asset Report',
    description: 'Assets returned with a Damaged condition — useful for tracking repair costs and replacements.',
    icon:        Wrench,
    iconBg:      'bg-amber-50',
    iconColor:   'text-amber-600',
    roles:       ['Admin', 'HR', 'AGM', 'SuperAdmin'],
    filters:     ['employee', 'department', 'category', 'dateRange'],
  },
  {
    key:         'lost',
    title:       'Lost Asset Report',
    description: 'Assets reported as lost — inventory was permanently reduced for each record here.',
    icon:        AlertOctagon,
    iconBg:      'bg-red-50',
    iconColor:   'text-red-600',
    roles:       ['Admin', 'HR', 'AGM', 'SuperAdmin'],
    filters:     ['employee', 'department', 'category', 'dateRange'],
  },
  {
    key:         'credential-audit',
    title:       'Credential Audit Report',
    description: 'Full audit trail of credential creations, updates, and views — with IP address and actor info.',
    icon:        KeyRound,
    iconBg:      'bg-slate-100',
    iconColor:   'text-slate-700',
    roles:       ['Admin', 'HR', 'SuperAdmin'],
    filters:     ['employee', 'department', 'credentialAction', 'dateRange'],
  },
];

const FORMATS = [
  { key: 'excel', label: 'Excel',  icon: FileSpreadsheet, ext: '.xlsx', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  { key: 'csv',   label: 'CSV',    icon: FileText,        ext: '.csv',  color: 'text-blue-700   bg-blue-50   border-blue-200   hover:bg-blue-100'   },
  { key: 'pdf',   label: 'PDF',    icon: File,            ext: '.pdf',  color: 'text-red-700    bg-red-50    border-red-200    hover:bg-red-100'    },
];

const ASSET_STATUSES = ['Available', 'Fully Assigned', 'Under Repair', 'Retired'];
const CREDENTIAL_ACTIONS = [
  { value: 'CREATED',        label: 'Created' },
  { value: 'UPDATED',        label: 'Updated' },
  { value: 'FIELD_REVEALED', label: 'Viewed' },
  { value: 'DELETED',        label: 'Deleted' },
];

const inputCls = 'w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none';
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5';

// ─── Filter panel ─────────────────────────────────────────────────────────────
function FilterPanel({ report, filters, setFilters, filterData }) {
  const { employees, departments, categories } = filterData;

  const set = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));
  const clearAll = () => setFilters({});
  const activeCount = Object.values(filters).filter(Boolean).length;

  const showEmployee  = report.filters.includes('employee');
  const showDept      = report.filters.includes('department');
  const showCategory  = report.filters.includes('category');
  const showStatus    = report.filters.includes('status');
  const showCredAction= report.filters.includes('credentialAction');
  const showDate      = report.filters.includes('dateRange');

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <Filter size={11} /> Filters
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{activeCount}</span>
          )}
        </p>
        {activeCount > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 transition">
            <X size={10} /> Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {showEmployee && (
          <div>
            <label className={labelCls}>Employee</label>
            <select value={filters.employeeId || ''} onChange={e => set('employeeId', e.target.value)} className={inputCls}>
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e._id} value={e._id}>
                  {e.name}{e.employeeId ? ` (${e.employeeId})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {showDept && (
          <div>
            <label className={labelCls}>Department</label>
            <select value={filters.department || ''} onChange={e => set('department', e.target.value)} className={inputCls}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {showCategory && (
          <div>
            <label className={labelCls}>Asset Category</label>
            <select value={filters.category || ''} onChange={e => set('category', e.target.value)} className={inputCls}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {showStatus && (
          <div>
            <label className={labelCls}>Asset Status</label>
            <select value={filters.status || ''} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="">All Statuses</option>
              {ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {showCredAction && (
          <div>
            <label className={labelCls}>Credential Event</label>
            <select value={filters.action || ''} onChange={e => set('action', e.target.value)} className={inputCls}>
              <option value="">All Events</option>
              {CREDENTIAL_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        )}

        {showDate && (
          <>
            <div>
              <label className={labelCls}>From Date</label>
              <input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>To Date</label>
              <input type="date" value={filters.dateTo || ''} min={filters.dateFrom || ''} onChange={e => set('dateTo', e.target.value)} className={inputCls} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Single report card ───────────────────────────────────────────────────────
function ReportCard({ report, filterData, userRole }) {
  const [expanded, setExpanded]   = useState(false);
  const [filters, setFilters]     = useState({});
  const [downloading, setDownloading] = useState(null); // 'excel'|'csv'|'pdf'
  const [lastExport, setLastExport]   = useState(null);

  // Role check — credential audit is HR/Admin/SuperAdmin only
  if (!report.roles.includes(userRole)) return null;

  const buildParams = (format) => {
    const p = new URLSearchParams({ format });
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  };

  const handleDownload = async (format) => {
    setDownloading(format);
    try {
      const res = await api.get(`/reports/${report.key}?${buildParams(format)}`, {
        responseType: 'blob'
      });

      const formatMeta = FORMATS.find(f => f.key === format);
      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');

      // Try to get filename from Content-Disposition header
      const cd   = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^";\n]+)"?/);
      a.href     = url;
      a.download = match ? match[1] : `${report.key}_report${formatMeta.ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExport({ format, time: new Date() });
    } catch (err) {
      alert(err.response?.data?.message || `Failed to generate ${format.toUpperCase()} report`);
    } finally {
      setDownloading(null);
    }
  };

  const Icon = report.icon;
  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden transition-all ${
      expanded ? 'border-blue-200 shadow-md' : 'border-slate-100 hover:shadow-md'
    }`}>
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-4 p-6 text-left"
      >
        <div className={`p-3 rounded-2xl flex-shrink-0 ${report.iconBg}`}>
          <Icon size={20} className={report.iconColor} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-800">{report.title}</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5 line-clamp-1">{report.description}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {activeFilters > 0 && (
            <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {activeFilters} filter{activeFilters > 1 ? 's' : ''}
            </span>
          )}
          {lastExport && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-emerald-600">
              <CheckCircle size={11} /> {lastExport.format.toUpperCase()} exported
            </span>
          )}
          {expanded
            ? <ChevronUp   size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />
          }
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-slate-50 pt-4">
          <p className="text-sm text-slate-500 font-medium">{report.description}</p>

          {/* Filter panel */}
          <FilterPanel
            report={report}
            filters={filters}
            setFilters={setFilters}
            filterData={filterData}
          />

          {/* Export buttons */}
          <div>
            <p className={labelCls}>Export Format</p>
            <div className="flex flex-wrap gap-3">
              {FORMATS.map(fmt => {
                const FmtIcon = fmt.icon;
                const isLoading = downloading === fmt.key;
                return (
                  <button
                    key={fmt.key}
                    onClick={() => handleDownload(fmt.key)}
                    disabled={!!downloading}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm border transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 ${fmt.color}`}
                  >
                    {isLoading
                      ? <Loader size={15} className="animate-spin" />
                      : <FmtIcon size={15} />
                    }
                    {isLoading ? 'Generating...' : `Download ${fmt.label}`}
                    {!isLoading && <span className="text-[10px] font-black opacity-60">{fmt.ext}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Last export confirmation */}
          {lastExport && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-xl">
              <CheckCircle size={13} />
              Last exported as {lastExport.format.toUpperCase()} at{' '}
              {lastExport.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AssetReports() {
  const { user } = useContext(AuthContext);
  const [filterData, setFilterData] = useState({ employees: [], departments: [], categories: [] });
  const [loadingFilters, setLoadingFilters] = useState(true);

  useEffect(() => {
    api.get('/reports/filters')
      .then(({ data }) => setFilterData(data))
      .catch(() => {})
      .finally(() => setLoadingFilters(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl">
              <FileBarChart2 size={20} className="text-white" />
            </div>
            Reports
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5 ml-14">
            Generate and export asset and credential reports with custom filters
          </p>
        </div>

        {/* Format legend */}
        <div className="flex items-center gap-2 flex-wrap">
          {FORMATS.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black ${f.color}`}>
                <Icon size={12} /> {f.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
        <SlidersHorizontal size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-blue-700 leading-relaxed">
          Expand any report card to configure filters and choose your export format.
          All reports are generated in real-time from live data.
          <span className="font-black"> Excel and CSV</span> are best for further analysis.
          <span className="font-black"> PDF</span> is formatted for printing and sharing.
        </p>
      </div>

      {/* ── Report cards ── */}
      {loadingFilters ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[2rem] border border-slate-100 p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded-full w-1/3" />
                  <div className="h-3 bg-slate-100 rounded-full w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {REPORTS.map(report => (
            <ReportCard
              key={report.key}
              report={report}
              filterData={filterData}
              userRole={user.role}
            />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-slate-400 font-medium text-center flex items-center justify-center gap-1.5">
        <FileBarChart2 size={11} />
        Reports are generated from live data and are confidential. Do not share externally without authorization.
      </p>
    </div>
  );
}
