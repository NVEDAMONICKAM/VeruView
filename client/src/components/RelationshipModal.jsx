import React, { useEffect, useRef, useState } from 'react';

const TYPES = [
  {
    value: 'PARENT',
    label: 'Parent → Child',
    desc: '"From" person is the PARENT of "To" person',
  },
  {
    value: 'CHILD',
    label: 'Child → Parent',
    desc: '"From" person is the CHILD of "To" person',
  },
  {
    value: 'SPOUSE',
    label: 'Spouse',
    desc: 'The two people are spouses (bidirectional)',
  },
];

/**
 * RelationshipModal — create or edit a relationship.
 *
 * Props:
 *   people        — array of all person objects in the tree
 *   relationship  — existing relationship edge data (null = add mode)
 *                   { relId, type, isBiological, fromPersonId, toPersonId }
 *   onSave        — ({ fromPersonId, toPersonId, type, isBiological, relId? }) => Promise<void>
 *   onDelete      — () => Promise<void>
 *   onClose       — () => void
 */
export default function RelationshipModal({ people, relationship, onSave, onDelete, onClose }) {
  const isEdit = Boolean(relationship);
  const [fromId,       setFromId]       = useState(relationship?.fromPersonId ?? '');
  const [toId,         setToId]         = useState(relationship?.toPersonId   ?? '');
  const [type,         setType]         = useState(relationship?.type         ?? 'PARENT');
  const [isBiological, setIsBiological] = useState(relationship?.isBiological ?? true);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [error,        setError]        = useState('');

  const modalRef = useRef();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const showBioToggle = (type === 'PARENT' || type === 'CHILD');

  async function handleSave(e) {
    e.preventDefault();
    if (!fromId || !toId) { setError('Select both people'); return; }
    if (fromId === toId)  { setError('Cannot create a self-relationship'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        fromPersonId: fromId,
        toPersonId:   toId,
        type,
        isBiological: showBioToggle ? isBiological : true,
        relId:        relationship?.relId ?? undefined,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save relationship');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Remove this relationship?')) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError('Failed to delete relationship');
    } finally {
      setDeleting(false);
    }
  }

  const personOptions = people.map((p) => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div ref={modalRef} className="bg-earth-warmWhite rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-veru-light">
          <h2 className="text-lg font-semibold text-veru-dark" style={{ fontFamily: 'Georgia, serif' }}>
            {isEdit ? 'Edit Relationship' : 'Add Relationship'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* From person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Person</label>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              disabled={isEdit}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:border-veru-accent"
            >
              <option value="">— select —</option>
              {personOptions}
            </select>
          </div>

          {/* Relationship type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Type</label>
            <div className="space-y-2">
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${type === t.value
                      ? 'border-veru-accent bg-veru-light'
                      : 'border-gray-200 hover:border-veru-mid'
                    }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    disabled={isEdit}
                    className="mt-0.5 accent-veru-accent"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Biological / Step toggle — only for parent-child relationships */}
          {showBioToggle && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parental role</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsBiological(true)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors
                    ${isBiological
                      ? 'bg-veru-accent text-white'
                      : 'bg-white text-gray-600 hover:bg-veru-light'
                    }`}
                >
                  Biological parent
                </button>
                <button
                  type="button"
                  onClick={() => setIsBiological(false)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors border-l border-gray-200
                    ${!isBiological
                      ? 'bg-veru-accent text-white'
                      : 'bg-white text-gray-600 hover:bg-veru-light'
                    }`}
                >
                  Step-parent
                </button>
              </div>
            </div>
          )}

          {/* To person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Person</label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              disabled={isEdit}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:border-veru-accent"
            >
              <option value="">— select —</option>
              {personOptions}
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg transition-colors"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            )}
            <div className="flex-1 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-veru-accent hover:bg-veru-dark text-white rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Relationship'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
