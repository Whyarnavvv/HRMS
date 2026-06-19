import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/axios';
import { ArrowLeft, Package, Save, Loader } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['Laptop', 'Desktop', 'Phone', 'SIM Card', 'ID Card', 'Access Card', 'Furniture', 'Other'];

const EMPTY_FORM = {
  assetNumber:   '',
  assetName:     '',
  category:      '',
  brand:         '',
  modelName:     '',
  imeiNumber:    '',
  totalQuantity: '1',
  status:        'Available',
  purchaseDate:  '',
  vendorName:    '',
  warrantyExpiry: '',
  purchasePrice:  '',
  notes:         '',
};

// ─── Shared field components ──────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function Field({ children }) {
  return <div>{children}</div>;
}

const inputCls = "w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all";

// ─── AssetForm (shared by Add & Edit) ────────────────────────────────────────
function AssetForm({ initialData, onSubmit, submitting, title, subtitle }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialData || EMPTY_FORM);

  // Sync if parent passes fresh initialData (edit mode fetches async)
  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.assetNumber.trim())  return alert('Asset number is required');
    if (!form.assetName.trim())    return alert('Asset name is required');
    if (!form.category)            return alert('Please select a category');
    const qty = Number(form.totalQuantity);
    if (!Number.isFinite(qty) || qty < 1) return alert('Quantity must be at least 1');
    onSubmit(form);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin/assets')}
          className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition shadow-sm"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Identity Card ── */}
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-50">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Package size={18} /></div>
            <h2 className="font-black text-slate-800">Asset Identity</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field>
              <Label required>Asset Number</Label>
              <input
                value={form.assetNumber}
                onChange={e => set('assetNumber', e.target.value.toUpperCase())}
                placeholder="e.g. LAP-001"
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">Must be unique — auto-uppercased</p>
            </Field>

            <Field>
              <Label required>Asset Name</Label>
              <input
                value={form.assetName}
                onChange={e => set('assetName', e.target.value)}
                placeholder="e.g. Dell Latitude 5420"
                className={inputCls}
              />
            </Field>

            <Field>
              <Label required>Category</Label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className={inputCls}
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field>
              <Label>Brand</Label>
              <input
                value={form.brand}
                onChange={e => set('brand', e.target.value)}
                placeholder="e.g. Dell, Apple, Samsung"
                className={inputCls}
              />
            </Field>

            <Field>
              <Label>Model Name</Label>
              <input
                value={form.modelName}
                onChange={e => set('modelName', e.target.value)}
                placeholder="e.g. Latitude 5420"
                className={inputCls}
              />
            </Field>

            {/* IMEI Number — optional for all asset types */}
            <Field>
              <Label>IMEI Number</Label>
              <input
                value={form.imeiNumber}
                onChange={e => set('imeiNumber', e.target.value)}
                placeholder="e.g. 123456789012345"
                maxLength={20}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">Optional · Must be unique if provided</p>
            </Field>

            <Field>
              <Label required>Total Quantity</Label>
              <input
                type="number"
                min="1"
                value={form.totalQuantity}
                onChange={e => set('totalQuantity', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field>
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className={inputCls}
              >
                <option value="Available">Available</option>
                <option value="Under Repair">Under Repair</option>
                <option value="Retired">Retired</option>
              </select>
            </Field>
          </div>
        </div>

        {/* ── Procurement Card ── */}
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="pb-2 border-b border-slate-50">
            <h2 className="font-black text-slate-800">Procurement Details</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">All fields optional</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field>
              <Label>Vendor Name</Label>
              <input
                value={form.vendorName}
                onChange={e => set('vendorName', e.target.value)}
                placeholder="Supplier or vendor name"
                className={inputCls}
              />
            </Field>

            <Field>
              <Label>Purchase Price (₹)</Label>
              <input
                type="number"
                min="0"
                value={form.purchasePrice}
                onChange={e => set('purchasePrice', e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>

            <Field>
              <Label>Purchase Date</Label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={e => set('purchaseDate', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field>
              <Label>Warranty Expiry</Label>
              <input
                type="date"
                value={form.warrantyExpiry}
                onChange={e => set('warrantyExpiry', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field>
              <Label>Notes</Label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Any additional remarks..."
                className={`${inputCls} resize-none sm:col-span-2`}
              />
            </Field>
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="flex flex-col sm:flex-row gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/assets')}
            className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 transition active:scale-95 disabled:opacity-60 order-1 sm:order-2"
          >
            {submitting
              ? <><Loader size={16} className="animate-spin" /> Saving...</>
              : <><Save size={16} /> Save Asset</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Add Asset Page ───────────────────────────────────────────────────────────
export function AddAsset() {
  const navigate    = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      const payload = {
        assetNumber:    form.assetNumber.trim(),
        assetName:      form.assetName.trim(),
        category:       form.category,
        brand:          form.brand?.trim() || undefined,
        modelName:      form.modelName?.trim() || undefined,
        imeiNumber:     form.imeiNumber?.trim() || undefined,
        totalQuantity:  Number(form.totalQuantity),
        status:         form.status,
        vendorName:     form.vendorName?.trim() || undefined,
        purchasePrice:  form.purchasePrice ? Number(form.purchasePrice) : undefined,
        purchaseDate:   form.purchaseDate   || undefined,
        warrantyExpiry: form.warrantyExpiry || undefined,
        notes:          form.notes?.trim()  || undefined,
      };
      await api.post('/assets', payload);
      navigate('/admin/assets');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AssetForm
      onSubmit={handleSubmit}
      submitting={submitting}
      title="Add New Asset"
      subtitle="Register a new company asset in the inventory"
    />
  );
}

// ─── Edit Asset Page ──────────────────────────────────────────────────────────
export function EditAsset() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/assets/${id}`);
        const a = data.asset;
        setInitialData({
          assetNumber:    a.assetNumber   || '',
          assetName:      a.assetName     || '',
          category:       a.category      || '',
          brand:          a.brand         || '',
          modelName:      a.modelName     || '',
          imeiNumber:     a.imeiNumber    || '',
          totalQuantity:  String(a.totalQuantity ?? 1),
          status:         a.status        || 'Available',
          vendorName:     a.vendorName    || '',
          purchasePrice:  a.purchasePrice != null ? String(a.purchasePrice) : '',
          purchaseDate:   a.purchaseDate  ? a.purchaseDate.split('T')[0] : '',
          warrantyExpiry: a.warrantyExpiry ? a.warrantyExpiry.split('T')[0] : '',
          notes:          a.notes         || '',
        });
      } catch (err) {
        alert('Failed to load asset');
        navigate('/admin/assets');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      const payload = {
        assetNumber:    form.assetNumber.trim(),
        assetName:      form.assetName.trim(),
        category:       form.category,
        brand:          form.brand?.trim()      || undefined,
        modelName:      form.modelName?.trim()  || undefined,
        imeiNumber:     form.imeiNumber?.trim() || undefined,
        totalQuantity:  Number(form.totalQuantity),
        status:         form.status,
        vendorName:     form.vendorName?.trim() || undefined,
        purchasePrice:  form.purchasePrice ? Number(form.purchasePrice) : undefined,
        purchaseDate:   form.purchaseDate   || undefined,
        warrantyExpiry: form.warrantyExpiry || undefined,
        notes:          form.notes?.trim()  || undefined,
      };
      await api.patch(`/assets/${id}`, payload);
      navigate(`/admin/assets/${id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update asset');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Asset...</p>
      </div>
    </div>
  );

  return (
    <AssetForm
      initialData={initialData}
      onSubmit={handleSubmit}
      submitting={submitting}
      title="Edit Asset"
      subtitle="Update the asset details below"
    />
  );
}
