import React, { useEffect, useRef, useState } from 'react';
import InitialsAvatar from './InitialsAvatar';

export default function PersonModal({ person, onSave, onDelete, onClose }) {
  const isEdit = Boolean(person);
  const [name,         setName]         = useState(person?.name ?? '');
  const [dob,          setDob]          = useState(person?.dob ? new Date(person.dob).toISOString().slice(0, 10) : '');
  const [gender,       setGender]       = useState(person?.gender ?? 'OTHER');
  const [photoPreview, setPhotoPreview] = useState(person?.photoUrl ?? null);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [error,        setError]        = useState('');
  const fileRef  = useRef();
  const sheetRef = useRef();

  useEffect(() => {
    sheetRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('gender', gender);
      if (dob) fd.append('dob', dob);
      if (photoFile) fd.append('photo', photoFile);
      await onSave(fd);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save person');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove ${person.name} from the tree? This cannot be undone.`)) return;
    setDeleting(true);
    try { await onDelete(); onClose(); }
    catch { setError('Failed to delete person'); }
    finally { setDeleting(false); }
  }

  return (
    /*
     * Layout:
     *   Mobile  (< sm): fixed to bottom, slides up, full-width, rounded top corners
     *   Desktop (≥ sm): centered dialog, max-w-md, rounded all corners
     */
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-black/40 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="bg-earth-warmWhite w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl outline-none max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-veru-light">
          <h2 className="text-lg font-semibold text-veru-dark" style={{ fontFamily: 'Georgia, serif' }}>
            {isEdit ? 'Edit Person' : 'Add Person'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">
            ×
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="group relative"
              title="Tap to upload photo"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-veru-mid group-hover:opacity-80 transition-opacity" />
              ) : (
                <InitialsAvatar name={name || '?'} size={80} />
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium">
                Change
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-gray-400">Tap photo to upload (max 5 MB)</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-veru-accent focus:ring-1 focus:ring-veru-accent"
              placeholder="e.g. Murugan Selvam"
              autoFocus
            />
          </div>

          {/* Date of birth */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-veru-accent focus:ring-1 focus:ring-veru-accent"
            />
          </div>

          {/* Gender — 44px min tap target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <div className="flex gap-2">
              {['MALE', 'FEMALE', 'OTHER'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors min-h-[44px]
                    ${gender === g
                      ? 'bg-veru-accent text-white border-veru-accent'
                      : 'bg-veru-light text-veru-dark border-veru-mid hover:bg-veru-mid'
                    }`}
                >
                  {g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other'}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2 pb-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2.5 min-h-[44px] text-sm font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg transition-colors"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            )}
            <div className="flex-1 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 min-h-[44px] text-sm font-semibold bg-earth-terra hover:bg-earth-terraDark text-white rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Person'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
