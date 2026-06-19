import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import {
  Package, Plus, Search, Filter, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, Eye, Pencil, Trash2, UserPlus,
  Laptop, Phone, CreditCard, MonitorSmartphone, SlidersHorizontal, X
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['Laptop', 'Desktop', 'Phone', 'SIM Card', 'ID Card', 'Access Card', 'Furniture', 'Other'];
const STATUSES = ['Available', 'Fully Assigned', 'Under Repair', 'Retired'];

const CATEGORY_STYLES = {
  'Laptop': 'bg-blue-50 text-blue-700',
  'Desktop': 'bg-indigo-50 text-indigo-700',
  'Phone': 'bg-emerald-50 text-emerald-700',
  'SIM Card': 'bg-teal-50 text-teal-700',
  'ID Card': 'bg-amber-50 text-amber-700',
  'Access Card': 'bg-orange-50 text-orange-700',
  'Furniture': 'bg-stone-50 text-stone-700',
  'Other': 'bg-slate-100 text-slate-600',
};

const STATUS_STYLES = {
  'Available': 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  'Fully Assigned': 'bg-blue-50 text-blue-700 border border-blue-100',
  'Under Repair': 'bg-amber-50 text-amber-700 border border-amber-100',
  'Retired': 'bg-red-50 text-red-600 border border-red-100',
};

const SORT_FIELDS = [
  { key: 'assetName', label: 'Asset Name' },
  { key: 'assetNumber', label: 'Asset No.' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Date Added' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-1`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function SortButton({ field, currentSort, onSort }) {
  const isActive = currentSort.replace('-', '') === field;
  const isDesc = currentSort.startsWith('-') && isActive;
  return (
    <button
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-0.5 group"
    >
      <span className={`${isActive ? 'text-blue-600' : 'text-slate-500'} group-hover:text-blue-600 transition-colors`}>
        {isActive
          ? (isDesc ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
          : <ChevronDown size={13} className="opacity-30 group-hover:opacity-70" />}
      </span>
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-slate-100 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
        <td key={i} className="px-4 py-4">
          <div className="h-3 bg-slate-100 rounded-full w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AssetManagement() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven state
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';
  const sort = searchParams.get('sort') || '-createdAt';
  const page = Number(searchParams.get('page') || 1);

  // Local UI state
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Debounce search input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      setParam({ search: searchInput, page: '1' });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setParam = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) next.delete(k); else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
  };

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/assets', {
        params: { search, category, status, sort, page, limit: 15 }
      });
      setAssets(data.assets);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, category, status, sort, page]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleSort = (field) => {
    const current = sort.replace('-', '');
    const isDesc = sort.startsWith('-');
    const next = current === field ? (isDesc ? field : `-${field}`) : `-${field}`;
    setParam({ sort: next, page: '1' });
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Delete "${asset.assetName}" (${asset.assetNumber})?`)) return;
    setDeleting(asset._id);
    try {
      await api.delete(`/assets/${asset._id}`);
      fetchAssets();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const hasActiveFilters = search || category || status;

  // Stats derived from current full-page data (approximate, from total only when no filter)
  const availableCount = assets.filter(a => a.status === 'Available').length;
  const assignedCount = assets.filter(a => a.status === 'Fully Assigned').length;
  const underRepairCount = assets.filter(a => a.status === 'Under Repair').length;

  const canWrite  = ['Admin', 'HR', 'SuperAdmin'].includes(user.role);
  const canDelete = ['Admin', 'SuperAdmin'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Asset Inventory</h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Manage and track all company assets</p>
        </div>
        {canWrite && (
          <button
            onClick={() => navigate('/admin/assets/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 transition active:scale-95 w-full sm:w-auto justify-center"
          >
            <Plus size={18} /> Add Asset
          </button>
        )}
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Assets" value={total} color="text-slate-800" />
        <StatCard label="Available" value={availableCount} color="text-emerald-600" />
        <StatCard label="Assigned" value={assignedCount} color="text-blue-600" />
        <StatCard label="Under Repair" value={underRepairCount} color="text-amber-600" />
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, number, brand, model..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border ${showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
          >
            <SlidersHorizontal size={15} />
            Filters
            {hasActiveFilters && (
              <span className="bg-white text-blue-600 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {[search, category, status].filter(Boolean).length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-100 transition"
            >
              <X size={14} /> Reset
            </button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setParam({ category: e.target.value, page: '1' })}
                className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Status</label>
              <select
                value={status}
                onChange={e => setParam({ status: e.target.value, page: '1' })}
                className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  { key: 'assetName', label: 'Asset Name' },
                  { key: 'category', label: 'Category' },
                  { key: 'brand', label: 'Brand' },
                  { key: 'modelName', label: 'Model' },
                  { key: 'assetNumber', label: 'Asset No.' },
                  { key: 'imei', label: 'IMEI', noSort: true },
                  { key: 'qty', label: 'Quantity', noSort: true },
                  { key: 'status', label: 'Status' },
                  { key: 'actions', label: 'Actions', noSort: true },
                ].map(col => (
                  <th key={col.key} className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {col.label}
                      {!col.noSort && <SortButton field={col.key} currentSort={sort} onSort={handleSort} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : assets.map(asset => (
                  <tr
                    key={asset._id}
                    className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors group"
                  >
                    {/* Asset Name */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${CATEGORY_STYLES[asset.category] || 'bg-slate-100 text-slate-500'}`}>
                          <Package size={15} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-tight">{asset.assetName}</p>
                          {asset.notes && (
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-[160px] truncate">{asset.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${CATEGORY_STYLES[asset.category] || 'bg-slate-100 text-slate-600'}`}>
                        {asset.category}
                      </span>
                    </td>

                    {/* Brand */}
                    <td className="px-4 py-4 text-sm text-slate-600 font-medium">
                      {asset.brand || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Model */}
                    <td className="px-4 py-4 text-sm text-slate-600 font-medium">
                      {asset.modelName || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Asset Number */}
                    <td className="px-4 py-4">
                      <span className="font-black text-slate-700 text-xs tracking-wider bg-slate-100 px-2.5 py-1 rounded-lg">
                        {asset.assetNumber}
                      </span>
                    </td>

                    {/* IMEI */}
                    <td className="px-4 py-4 text-xs font-medium text-slate-500 font-mono">
                      {asset.imeiNumber || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-800">{asset.availableQuantity}</span>
                        <span className="text-slate-300 text-xs">/</span>
                        <span className="text-xs font-bold text-slate-500">{asset.totalQuantity}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">avail / total</p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-bold ${STATUS_STYLES[asset.status] || 'bg-slate-100 text-slate-600'}`}>
                        {asset.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {/* View */}
                        <button
                          onClick={() => navigate(`/admin/assets/${asset._id}`)}
                          title="View Details"
                          className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Edit */}
                        {canWrite && (
                          <button
                            onClick={() => navigate(`/admin/assets/${asset._id}/edit`)}
                            title="Edit Asset"
                            className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-all"
                          >
                            <Pencil size={15} />
                          </button>
                        )}

                        {/* Assign */}
                        {canWrite && asset.availableQuantity > 0 && (
                          <button
                            onClick={() => navigate(`/admin/assets/${asset._id}?assign=1`)}
                            title="Assign Asset"
                            className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                          >
                            <UserPlus size={15} />
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(asset)}
                            disabled={deleting === asset._id}
                            title="Delete Asset"
                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              }

              {!loading && assets.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Package size={40} className="opacity-20" />
                      <p className="font-black text-sm uppercase tracking-widest">No assets found</p>
                      {hasActiveFilters && (
                        <button onClick={resetFilters} className="text-xs text-blue-600 font-bold hover:underline mt-1">
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 font-medium">
              Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, total)} of {total} assets
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setParam({ page: String(page - 1) })}
                className="p-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setParam({ page: String(p) })}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${p === page
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                  >{p}</button>
                );
              })}

              <button
                disabled={page >= totalPages}
                onClick={() => setParam({ page: String(page + 1) })}
                className="p-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
