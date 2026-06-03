import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api, { baseURL } from '../utils/axios';
import { UploadCloud, CheckCircle, Clock, FileText, AlertCircle, Lock, RefreshCw, X } from 'lucide-react';

const DOC_FIELDS = [
  { key: 'marksheet', label: '10th / 12th Marksheet' },
  { key: 'graduationDegree', label: 'Graduation Degree' },
  { key: 'aadhaarCardFront', label: 'Aadhaar Card (Front)' },
  { key: 'aadhaarCardBack', label: 'Aadhaar Card (Back)' },
  { key: 'panCardDoc', label: 'PAN Card' },
  { key: 'previousOrgDoc', label: 'Previous Organization Document' },
  { key: 'bankPassbook', label: 'Bank Passbook' }
];

const MAX_SIZE = 1.5 * 1024 * 1024;

export default function DocumentUpload({ employee, onUploaded }) {
  const { user } = useContext(AuthContext);
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState({});
  const [requestingReupload, setRequestingReupload] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(null); // { key, file, previewUrl }

  if (!employee?.isIdVerified) return null;

  const docs = employee?.documents || {};
  const uploadStatus = employee?.documentUploadStatus || {};

  const isLocked = (key) => {
    const s = uploadStatus[key];
    return s?.is_uploaded && !s?.reupload_allowed;
  };

  const handleFileSelect = (key, e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const allowed = /\.(pdf|jpg|jpeg|png)$/i;
    if (!allowed.test(file.name)) {
      setErrors(prev => ({ ...prev, [key]: 'Only PDF, JPG, PNG files are accepted.' }));
      return;
    }
    if (file.size > MAX_SIZE) {
      setErrors(prev => ({ ...prev, [key]: 'File must be less than 1.5 MB.' }));
      return;
    }
    setErrors(prev => ({ ...prev, [key]: '' }));

    // Build preview URL for image types; PDF gets null (show file name instead)
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setConfirmModal({ key, file, previewUrl });
  };

  const handleConfirmUpload = async () => {
    const { key, file } = confirmModal;
    setConfirmModal(null);
    setFiles(prev => ({ ...prev, [key]: file }));

    setUploading(prev => ({ ...prev, [key]: true }));
    setGlobalError('');
    setGlobalSuccess('');
    try {
      const formData = new FormData();
      formData.append(key, file);
      const { data } = await api.post('/employees/upload-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFiles(prev => ({ ...prev, [key]: null }));
      if (onUploaded) onUploaded(data.documents, data.documentUploadStatus);
      setGlobalSuccess('Document uploaded successfully.');
    } catch (err) {
      setGlobalError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRequestReupload = async (key) => {
    setRequestingReupload(prev => ({ ...prev, [key]: true }));
    setGlobalError('');
    setGlobalSuccess('');
    try {
      await api.post('/employees/reupload-request', { documentKey: key });
      setGlobalSuccess('Re-upload request submitted. Awaiting HR approval.');
    } catch (err) {
      setGlobalError(err.response?.data?.message || 'Failed to submit re-upload request.');
    } finally {
      setRequestingReupload(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-200/60 p-5 sm:p-8 lg:p-10 space-y-6">
      <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><FileText size={20} /></div>
        Employment Documents
      </h3>

      {globalError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold">
          <AlertCircle size={16} /> {globalError}
        </div>
      )}
      {globalSuccess && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-sm font-bold">
          <CheckCircle size={16} /> {globalSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DOC_FIELDS.map(({ key, label }) => {
          const existing = docs[key];
          const isPdf = existing?.toLowerCase().endsWith('.pdf');
          const locked = isLocked(key);
          const isUploading = uploading[key];
          const fieldError = errors[key];

          return (
            <div key={key} className="border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-600 uppercase tracking-wider">{label}</p>
                <div className="flex items-center gap-2">
                  {locked && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                      <Lock size={9} /> Locked
                    </span>
                  )}
                  {existing ? (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                      <CheckCircle size={10} /> Uploaded
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full uppercase">
                      <Clock size={10} /> Pending
                    </span>
                  )}
                </div>
              </div>

              {existing && (
                <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 h-24 flex items-center justify-center">
                  {isPdf ? (
                    <a href={`${baseURL}${existing}`} target="_blank" rel="noreferrer"
                      className="text-xs font-bold text-blue-600 flex items-center gap-2 hover:underline">
                      <FileText size={16} /> View PDF
                    </a>
                  ) : (
                    <img src={`${baseURL}${existing}`} alt={label}
                      className="h-full w-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  )}
                </div>
              )}

              <div className="space-y-2">
                {!locked ? (
                  <>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={isUploading}
                      onChange={(e) => handleFileSelect(key, e)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-600 hover:file:bg-blue-50 hover:file:text-blue-600 cursor-pointer disabled:opacity-50"
                    />
                    {fieldError && <p className="text-[10px] text-red-500 font-bold">{fieldError}</p>}
                    {!fieldError && <p className="text-[10px] text-slate-400">PDF, JPG, PNG • Max 1.5 MB</p>}
                    {isUploading && (
                      <div className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl">
                        <UploadCloud size={14} className="animate-bounce" /> Uploading...
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleRequestReupload(key)}
                    disabled={requestingReupload[key]}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-amber-50 hover:text-amber-600 transition disabled:opacity-50"
                  >
                    <RefreshCw size={13} />
                    {requestingReupload[key] ? 'Requesting...' : 'Request Re-upload'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pre-Upload Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Confirm Document Upload</h2>
              <button onClick={() => setConfirmModal(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Preview */}
              <div className="rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 h-48 flex items-center justify-center">
                {confirmModal.previewUrl ? (
                  <img src={confirmModal.previewUrl} alt="Preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FileText size={32} />
                    <p className="text-xs font-bold">{confirmModal.file.name}</p>
                    <p className="text-[10px] text-slate-300">PDF Preview not available</p>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-amber-700 leading-relaxed">
                  Are you sure this document is correct? You will not be able to re-upload without HR approval.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition"
                >
                  ❌ Cancel
                </button>
                <button
                  onClick={handleConfirmUpload}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                >
                  ✅ Confirm Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
