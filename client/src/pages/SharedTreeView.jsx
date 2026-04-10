import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import dagre from 'dagre';
import { getSharedTree, getSharedKinship, duplicateTree } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import TreeCanvas from '../components/TreeCanvas';
import InfoGuide from '../components/InfoGuide';
import VeruViewLogo from '../components/VeruViewLogo';

const NODE_W = 176;
const NODE_H = 220;

// Compute a dagre auto-layout and return { [id]: {x, y} }
function computeAutoLayout(people, relationships) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });
  people.forEach((p) => g.setNode(p.id, { width: NODE_W, height: NODE_H }));
  relationships
    .filter((r) => r.type === 'PARENT' || r.type === 'CHILD')
    .forEach((r) => {
      const [src, tgt] = r.type === 'PARENT'
        ? [r.fromPersonId, r.toPersonId]
        : [r.toPersonId, r.fromPersonId];
      g.setEdge(src, tgt);
    });
  dagre.layout(g);
  const positions = {};
  people.forEach((p) => {
    const pos = g.node(p.id);
    if (pos) positions[p.id] = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
  });
  return positions;
}

// ---------------------------------------------------------------------------
// Duplicate modal — Flow A (logged in)
// ---------------------------------------------------------------------------
function DuplicateModal({ treeName, shareToken, onClose, onSuccess }) {
  const [nameInput, setNameInput] = useState(`${treeName} (copy)`);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleConfirm() {
    setSaving(true);
    setErr('');
    try {
      const res = await duplicateTree(shareToken, nameInput.trim() || nameInput);
      onSuccess(res.data.treeId);
    } catch {
      setErr('Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-earth-warmWhite rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-veru-dark text-center" style={{ fontFamily: 'Georgia, serif' }}>
          Duplicate this tree?
        </h2>
        <p className="text-sm text-gray-600 text-center">
          A copy of <span className="font-medium text-gray-800">"{treeName}"</span> will be added
          to your profile. You can edit it freely without affecting the original.
        </p>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Name for your copy</label>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            className="w-full border border-veru-mid rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-veru-accent bg-white"
          />
        </div>
        {err && <p className="text-xs text-red-500 text-center">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !nameInput.trim()}
            className="flex-1 py-2.5 rounded-xl bg-veru-accent text-white text-sm font-semibold hover:bg-veru-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Duplicating…' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth prompt modal — Flow B (not logged in)
// ---------------------------------------------------------------------------
function AuthPromptModal({ shareToken, onClose }) {
  const returnUrl = `/share/${shareToken}?duplicateOnLoad=true`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-earth-warmWhite rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-veru-dark text-center" style={{ fontFamily: 'Georgia, serif' }}>
          Create an account to duplicate this tree
        </h2>
        <p className="text-sm text-gray-600 text-center">
          Sign up for free to save a copy of this tree to your own profile and start adding your family.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Link
            to={`/register?redirect=${encodeURIComponent(returnUrl)}`}
            className="w-full py-2.5 rounded-xl bg-veru-accent text-white text-sm font-semibold text-center hover:bg-veru-dark transition-colors"
          >
            Create account
          </Link>
          <Link
            to={`/login?redirect=${encodeURIComponent(returnUrl)}`}
            className="w-full py-2.5 rounded-xl border border-veru-mid text-veru-dark text-sm font-semibold text-center hover:bg-veru-light transition-colors"
          >
            Log in
          </Link>
          <button
            onClick={onClose}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success toast
// ---------------------------------------------------------------------------
function Toast({ message }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-veru-dark text-white text-sm px-5 py-3 rounded-full shadow-lg">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SharedTreeView
// ---------------------------------------------------------------------------
export default function SharedTreeView() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tree, setTree] = useState(null);
  const [kinship, setKinship] = useState({});
  const [perspectiveId, setPerspectiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  // Duplicate flow state
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [authModal, setAuthModal] = useState(false);
  const [toast, setToast] = useState('');

  // Viewer's local positions (never saved to backend)
  const positionsRef = useRef({});

  // Load shared tree
  useEffect(() => {
    getSharedTree(token)
      .then((res) => {
        const t = res.data;
        const people = Array.isArray(t.people) ? t.people : [];
        const relationships = Array.isArray(t.relationships) ? t.relationships : [];
        setTree({ ...t, people, relationships });
        if (people.length > 0) {
          setPerspectiveId(people[0].id);
          // Always open shared trees in auto-organised layout
          positionsRef.current = computeAutoLayout(people, relationships);
        }
      })
      .catch(() => setError('This share link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-trigger duplicate modal when ?duplicateOnLoad=true and user is logged in
  useEffect(() => {
    if (!tree || authLoading) return;
    if (searchParams.get('duplicateOnLoad') === 'true' && user) {
      setDuplicateModal(true);
    }
  }, [tree, user, authLoading, searchParams]);

  // Load kinship when perspective changes
  useEffect(() => {
    if (!perspectiveId || !tree) return;
    getSharedKinship(token, perspectiveId)
      .then((res) => setKinship(res.data))
      .catch(() => {});
  }, [perspectiveId, tree?.culture]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  function handleDuplicateClick() {
    if (!user) {
      setAuthModal(true);
    } else {
      setDuplicateModal(true);
    }
  }

  function handleDuplicateSuccess(treeId) {
    setDuplicateModal(false);
    showToast('Tree duplicated! You can now edit your own copy.');
    setTimeout(() => navigate(`/trees/${treeId}`), 1500);
  }

  const perspectivePerson = tree?.people.find((p) => p.id === perspectiveId);
  const isOwnTree = user && tree && tree.ownerId === user.id;

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-veru-light">
        <div className="w-10 h-10 border-4 border-veru-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-veru-light gap-6 p-4">
        <VeruViewLogo size={48} />
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold text-veru-dark" style={{ fontFamily: 'Georgia, serif' }}>
            This link is no longer valid
          </h1>
          <p className="text-sm text-gray-500">
            The family tree you're looking for may have been deleted or the link may have expired.
          </p>
        </div>
        <Link
          to="/"
          className="px-5 py-2.5 bg-veru-accent text-white text-sm font-semibold rounded-xl hover:bg-veru-dark transition-colors"
        >
          Go to VeruView
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-veru-light">
      <TopBar
        tree={tree}
        perspectiveName={perspectivePerson?.name}
        isReadOnly={true}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — people list + duplicate button */}
        <aside className="w-48 bg-earth-warmWhite border-r border-veru-mid flex flex-col z-10 flex-shrink-0">
          {/* Duplicate / own-tree CTA */}
          <div className="p-3 border-b border-veru-light">
            {isOwnTree ? (
              <Link
                to={`/trees/${tree.id}`}
                className="block text-center text-xs font-medium text-veru-accent hover:text-veru-dark transition-colors py-1"
              >
                This is your tree — view it in your profile →
              </Link>
            ) : (
              <button
                onClick={handleDuplicateClick}
                className="w-full flex items-center justify-center gap-1.5 bg-veru-accent hover:bg-veru-dark text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2z"/>
                  <path d="M2 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1h-1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1V4H2z"/>
                </svg>
                Duplicate to my profile
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 pt-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold px-2 pb-1">
              People
            </p>
            {tree?.people.map((person) => (
              <button
                key={person.id}
                onClick={() => setPerspectiveId(person.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm mb-0.5 transition-colors flex items-center gap-2 truncate
                  ${perspectiveId === person.id
                    ? 'bg-veru-accent text-white font-semibold'
                    : 'text-gray-700 hover:bg-veru-light'
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0
                    ${person.gender === 'MALE' ? 'bg-blue-300' : person.gender === 'FEMALE' ? 'bg-pink-300' : 'bg-gray-300'}`}
                />
                <span className="truncate">{person.name}</span>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-veru-light">
            <Link
              to="/"
              className="block text-center text-xs text-veru-accent hover:text-veru-dark font-medium"
            >
              Build your own tree →
            </Link>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          {tree?.people.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400">This tree has no people yet.</p>
            </div>
          ) : (
            <TreeCanvas
              people={tree?.people ?? []}
              relationships={tree?.relationships ?? []}
              kinship={kinship}
              perspectiveId={perspectiveId}
              culture={tree?.culture}
              isReadOnly={true}
              onPerspectiveChange={setPerspectiveId}
              positionsRef={positionsRef}
              onGuideOpen={() => setGuideOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Guide drawer */}
      {guideOpen && (
        <InfoGuide
          culture={tree?.culture ?? 'ENGLISH'}
          onClose={() => setGuideOpen(false)}
        />
      )}

      {/* Duplicate modal (logged in) */}
      {duplicateModal && tree && (
        <DuplicateModal
          treeName={tree.name}
          shareToken={token}
          onClose={() => setDuplicateModal(false)}
          onSuccess={handleDuplicateSuccess}
        />
      )}

      {/* Auth prompt modal (not logged in) */}
      {authModal && (
        <AuthPromptModal
          shareToken={token}
          onClose={() => setAuthModal(false)}
        />
      )}

      {/* Success toast */}
      {toast && <Toast message={toast} />}
    </div>
  );
}
