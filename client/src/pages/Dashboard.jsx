import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTrees, createTree, deleteTree, logout } from '../api/client';
import { useAuth } from '../context/AuthContext';
import VeruViewLogo from '../components/VeruViewLogo';

function TreeCard({ tree, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${tree.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await onDelete(tree.id); }
    catch { setDeleting(false); }
  }

  return (
    <Link
      to={`/tree/${tree.id}`}
      className="group relative block bg-earth-warmWhite rounded-2xl border-2 border-veru-mid hover:border-veru-accent shadow-sm hover:shadow-lg transition-all p-5"
    >
      {/* Leaf motif */}
      <svg className="absolute top-3 right-3 opacity-20 group-hover:opacity-40 transition-opacity" width="40" height="40" viewBox="0 0 40 40">
        <path d="M20,2 Q30,10 30,20 Q30,30 20,38 Q10,30 10,20 Q10,10 20,2Z" fill="#6BAF8C"/>
        <line x1="20" y1="38" x2="20" y2="10" stroke="#6BAF8C" strokeWidth="1.5"/>
        <line x1="20" y1="20" x2="14" y2="15" stroke="#6BAF8C" strokeWidth="1"/>
        <line x1="20" y1="25" x2="26" y2="20" stroke="#6BAF8C" strokeWidth="1"/>
      </svg>

      <div className="pr-8">
        <h3 className="font-semibold text-veru-dark text-base truncate" style={{ fontFamily: 'Georgia, serif' }}>
          {tree.name}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full
            ${tree.culture === 'TAMIL'
              ? 'bg-veru-accent text-white'
              : 'bg-veru-light text-veru-dark border border-veru-mid'
            }`}>
            {tree.culture === 'TAMIL' ? 'தமிழ் Tamil' : 'English'}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Created {new Date(tree.createdAt).toLocaleDateString()}
        </p>
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute bottom-4 right-4 text-gray-300 hover:text-red-400 transition-colors text-sm opacity-0 group-hover:opacity-100"
        title="Delete tree"
      >
        {deleting ? '…' : '🗑'}
      </button>
    </Link>
  );
}

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCulture, setNewCulture] = useState('ENGLISH');
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    getTrees()
      .then((res) => setTrees(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) { setFormError('Please enter a tree name'); return; }
    setCreating(true);
    setFormError('');
    try {
      const res = await createTree({ name: newName.trim(), culture: newCulture });
      navigate(`/tree/${res.data.id}`);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create tree');
      setCreating(false);
    }
  }

  async function handleDelete(treeId) {
    await deleteTree(treeId);
    setTrees((prev) => prev.filter((t) => t.id !== treeId));
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-veru-light via-white to-veru-mid">
      {/* Header */}
      <header className="bg-earth-warmWhite border-b border-veru-mid shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <VeruViewLogo size={36} />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">
              Hi, <strong>{user?.name}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-veru-dark border border-gray-200 hover:border-veru-mid rounded-full px-3 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-veru-dark" style={{ fontFamily: 'Georgia, serif' }}>
              Your Family Trees
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {trees.length === 0 ? 'Create your first tree to get started' : `${trees.length} tree${trees.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError(''); }}
            className="flex items-center gap-2 bg-earth-terra hover:bg-earth-terraDark text-white text-sm font-semibold px-4 py-2 min-h-[44px] rounded-xl transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            New Tree
          </button>
        </div>

        {/* New tree form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-earth-warmWhite rounded-2xl border-2 border-veru-accent shadow-lg p-5 mb-6">
            <h2 className="font-semibold text-veru-dark mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              New Family Tree
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                placeholder="e.g. Murugan Family Tree"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-veru-accent"
              />
              <select
                value={newCulture}
                onChange={(e) => setNewCulture(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-veru-accent"
              >
                <option value="ENGLISH">English labels</option>
                <option value="TAMIL">Tamil labels (தமிழ்)</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-earth-terra hover:bg-earth-terraDark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
            {formError && <p className="mt-2 text-sm text-red-500">{formError}</p>}
          </form>
        )}

        {/* Trees grid */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-veru-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            {/* Empty state illustration */}
            <svg width="80" height="80" viewBox="0 0 80 80" className="mb-4 opacity-40">
              <line x1="40" y1="50" x2="40" y2="25" stroke="#6BAF8C" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="40" y1="32" x2="28" y2="20" stroke="#6BAF8C" strokeWidth="2" strokeLinecap="round"/>
              <line x1="40" y1="32" x2="52" y2="20" stroke="#6BAF8C" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="40" cy="20" r="4" fill="#6BAF8C"/>
              <circle cx="27" cy="16" r="3" fill="#A8D5B5"/>
              <circle cx="53" cy="16" r="3" fill="#A8D5B5"/>
              <line x1="40" y1="50" x2="32" y2="63" stroke="#6BAF8C" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              <line x1="40" y1="50" x2="40" y2="65" stroke="#6BAF8C" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              <line x1="40" y1="50" x2="48" y2="63" stroke="#6BAF8C" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <p className="text-veru-dark font-medium">No trees yet</p>
            <p className="text-gray-400 text-sm mt-1">Click "New Tree" to plant your first one</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trees.map((tree) => (
              <TreeCard key={tree.id} tree={tree} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
