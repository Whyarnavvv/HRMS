import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import {
  KeyRound, Eye, EyeOff, Copy, CheckCheck, Save, Loader,
  AlertTriangle, Clock, Monitor, Smartphone, CreditCard,
  Mail, Lock, Shield, CheckCircle
} from 'lucide-react';

// ─── Credential sections — same structure as EmployeeCredentials ──────────────
const SECTIONS = [
  {
    key: 'email1',
    label: 'Official Email 1',
    icon: Mail,
    color: 'blue',
    fields: [
      { key: 'email1',         label: 'Email Address', type: 'email',    secret: false, placeholder: 'e.g. john@company.com' },
      { key: 'email1Password', label: 'Password',      type: 'password', secret: true,  placeholder: 'Email password' },
    ]
  },
  {
    key: 'email2',
    label: 'Official Email 2',
    icon: Mail,
    color: 'indigo',
    fields: [
      { key: 'email2',         label: 'Email Address', type: 'email',    secret: false, placeholder: 'e.g. john@company2.com' },
      { key: 'email2Password', label: 'Password',      type: 'password', secret: true,  placeholder: 'Email password' },
    ]
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: CreditCard,
    color: 'emerald',
    fields: [
      { key: 'crmUserId',   label: 'User ID',  type: 'text',     secret: false, placeholder: 'CRM user ID' },
      { key: 'crmPassword', label: 'Password', type: 'password', secret: true,  placeholder: 'CRM password' },
    ]
  },
  {
    key: 'laptop',
    label: 'Laptop',
    icon: Monitor,
    color: 'violet',
    fields: [
      { key: 'laptopUsername', label: 'Username', type: 'text',     secret: false, placeholder: 'Login username' },
      { key: 'laptopPassword', label: 'Password', type: 'password', secret: true,  placeholder: 'Login password' },
    ]
  },
  {
    key: 'desktop',
    label: 'Desktop',
    icon: Monitor,
    color: 'slate',
    fields: [
      { key: 'desktopUsername', label: 'Username', type: 'text',     secret: false, placeholder: 'Desktop username' },
      { key: 'desktopPassword', label: 'Password', type: 'password', secret: true,  placeholder: 'Login password' },
    ]
  },
  {
    key: 'phone',
    label: 'Phone',
    icon: Smartphone,
    color: 'rose',
    fields: [
      { key: 'phonePassword', label: 'Password / PIN', type: 'password', secret: true,  placeholder: 'Screen lock PIN or password' },
      { key: 'simNumber',     label: 'SIM Number',     type: 'text',     secret: false, placeholder: 'SIM card number' },
    ]
  },
];

const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',   icon: 'text-blue-600',   ring: 'focus:ring-blue-500/20',   badge: 'bg-blue-100 text-blue-700' },
  indigo:  { bg: 'bg-indigo-50', icon: 'text-indigo-600', ring: 'focus:ring-indigo-500/20', badge: 'bg-indigo-100 text-indigo-700' },
  emerald: { bg: 'bg-emerald-50',icon: 'text-emerald-600',ring: 'focus:ring-emerald-500/20',badge: 'bg-emerald-100 text-emerald-700' },
  violet:  { bg: 'bg-violet-50', icon: 'text-violet-600', ring: 'focus:ring-violet-500/20', badge: 'bg-violet-100 text-violet-700' },
  slate:   { bg: 'bg-slate-100', icon: 'text-slate-600',  ring: 'focus:ring-slate-500/20',  badge: 'bg-slate-100 text-slate-600' },
  rose:    { bg: 'bg-rose-50',   icon: 'text-rose-600',   ring: 'focus:ring-rose-500/20',   badge: 'bg-rose-100 text-rose-700' },
};

const inputCls = (ring) =>
  `w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold placeholder:text-slate-300 outline-none focus:ring-2 ${ring} transition-all`;

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ getValue }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      const text = await getValue();
      if (text) { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* clipboard denied */ }
  };
  return (
    <button type="button" onClick={handleCopy} title="Copy to clipboard"
      className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
      {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ─── PasswordField ────────────────────────────────────────────────────────────
function PasswordField({ field, credential, editMode, editValues, setEditValues, onReveal, revealCache, color }) {
  const [visible, setVisible] = useState(false);
  const ring = COLOR_MAP[color]?.ring || 'focus:ring-blue-500/20';
  const hasStoredValue = credential ? credential[field.key] === true : false;
  const revealedValue = revealCache[field.key];

  const handleToggle = async () => {
    if (!visible && !revealedValue && hasStoredValue) await onReveal(field.key);
    setVisible(v => !v);
  };

  const getValueForCopy = async (fk) => {
    if (!revealCache[fk] && hasStoredValue) return await onReveal(fk);
    return revealCache[fk] || '';
  };

  if (editMode) {
    return (
      <input type="text" value={editValues[field.key] || ''} onChange={e => setEditValues(p => ({ ...p, [field.key]: e.target.value }))}
        placeholder={`New ${field.label.toLowerCase()} (leave blank to keep current)`} className={inputCls(ring)} autoComplete="new-password" />
    );
  }

  if (!hasStoredValue) {
    return <div className="flex items-center py-3 px-4 bg-slate-50 rounded-2xl"><span className="text-xs text-slate-300 font-medium italic">Not set</span></div>;
  }

  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-2.5 min-w-0">
      <span className="flex-1 text-sm font-bold text-slate-800 tracking-widest truncate">
        {visible && revealedValue ? revealedValue : '●●●●●●●●'}
      </span>
      <button type="button" onClick={handleToggle} title={visible ? 'Hide' : 'Show'}
        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex-shrink-0">
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <CopyButton getValue={() => getValueForCopy(field.key)} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyCredentials() {
  const { user } = useContext(AuthContext);

  const [credential, setCredential] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [editMode, setEditMode]     = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [revealCache, setRevealCache] = useState({});
  const [revealError, setRevealError] = useState('');

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/credentials/me');
      setCredential(data.credential);
    } catch {
      setCredential(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

  const handleReveal = useCallback(async (fieldKey) => {
    setRevealError('');
    if (revealCache[fieldKey]) return revealCache[fieldKey];
    try {
      const { data } = await api.post('/credentials/me/reveal', { field: fieldKey });
      setRevealCache(prev => ({ ...prev, [fieldKey]: data.value }));
      return data.value;
    } catch (err) {
      setRevealError(err.response?.data?.message || 'Failed to reveal value');
      return null;
    }
  }, [revealCache]);

  const handleEditStart = () => {
    const prefill = {};
    if (credential) {
      ['email1', 'email2', 'crmUserId', 'laptopUsername', 'desktopUsername', 'simNumber'].forEach(k => {
        prefill[k] = credential[k] || '';
      });
    }
    setEditValues(prefill);
    setSaveError('');
    setSaveSuccess(false);
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const { data } = await api.put('/credentials/me', editValues);
      setCredential(data.credential);
      setRevealCache({});
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 rounded-2xl">
            <KeyRound size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Credentials</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Manage your work system credentials — stored encrypted and visible only to you
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
            <Shield size={12} className="text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">AES-256 Encrypted</span>
          </div>

          {saveSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle size={12} className="text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Saved</span>
            </div>
          )}

          {!editMode ? (
            <button onClick={handleEditStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition shadow-sm">
              <Lock size={14} /> Edit Credentials
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditMode(false); setSaveError(''); }}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50">
                {saving ? <><Loader size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Privacy notice ── */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
        <Shield size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-blue-700 leading-relaxed">
          Your credentials are encrypted with AES-256-GCM. HR and Admin can view your credentials if needed for IT support.
          Every view and change is audit-logged. Leave a password field blank when editing to keep the existing value.
        </p>
      </div>

      {/* ── Error banners ── */}
      {saveError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-600">
          <AlertTriangle size={14} /> {saveError}
        </div>
      )}
      {revealError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-600">
          <AlertTriangle size={14} /> {revealError}
        </div>
      )}

      {/* ── Credential sections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const colors = COLOR_MAP[section.color] || COLOR_MAP.blue;

          return (
            <div key={section.key} className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50">
                <div className={`p-2.5 ${colors.bg} rounded-xl`}>
                  <Icon size={16} className={colors.icon} />
                </div>
                <h3 className="font-black text-slate-800 text-sm">{section.label}</h3>
                {/* Filled indicator dots */}
                <div className="ml-auto flex items-center gap-1">
                  {section.fields.map(f => {
                    const hasVal = credential
                      ? (f.secret ? credential[f.key] === true : !!credential[f.key])
                      : false;
                    return <div key={f.key} title={f.label} className={`w-2 h-2 rounded-full ${hasVal ? 'bg-emerald-400' : 'bg-slate-200'}`} />;
                  })}
                </div>
              </div>

              {/* Fields */}
              <div className="p-6 space-y-4">
                {section.fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      {field.label}
                      {field.secret && (
                        <span className={`ml-2 px-2 py-0.5 rounded text-[9px] font-black ${colors.badge}`}>ENCRYPTED</span>
                      )}
                    </label>

                    {field.secret ? (
                      <PasswordField
                        field={field} credential={credential} editMode={editMode}
                        editValues={editValues} setEditValues={setEditValues}
                        onReveal={handleReveal} revealCache={revealCache} color={section.color}
                      />
                    ) : (
                      editMode ? (
                        <input type={field.type} value={editValues[field.key] || ''}
                          onChange={e => setEditValues(p => ({ ...p, [field.key]: e.target.value }))}
                          placeholder={field.placeholder} className={inputCls(colors.ring)} />
                      ) : (
                        <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-2.5">
                          <span className={`flex-1 text-sm font-bold truncate ${credential?.[field.key] ? 'text-slate-800' : 'text-slate-300 italic font-normal'}`}>
                            {credential?.[field.key] || 'Not set'}
                          </span>
                          {credential?.[field.key] && (
                            <CopyButton getValue={async () => credential[field.key]} />
                          )}
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Last updated ── */}
      {credential?.updatedAt && (
        <p className="text-[11px] text-slate-400 font-medium px-1 flex items-center gap-1.5">
          <Clock size={12} />
          Last updated {new Date(credential.updatedAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </p>
      )}
    </div>
  );
}
