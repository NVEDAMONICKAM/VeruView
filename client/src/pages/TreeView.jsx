import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getTree,
  createPerson, updatePerson, deletePerson,
  createRelationship, updateRelationship, deleteRelationship,
  patchNodePositions,
} from '../api/client';
import TopBar from '../components/TopBar';
import TreeCanvas from '../components/TreeCanvas';
import PersonModal from '../components/PersonModal';
import RelationshipModal from '../components/RelationshipModal';
import { useHistory } from '../hooks/useHistory';
import { computeAllKinshipTitles } from '../lib/kinship';

const NODE_WIDTH  = 176;
const NODE_HEIGHT = 220;

// ---------------------------------------------------------------------------
// Spouse-children prompt — asks whether the new spouse is a parent of each
// existing child of their partner
// ---------------------------------------------------------------------------
function SpouseChildrenPrompt({ newPerson, children, onComplete, onSkip }) {
  // choices: { [childId]: 'biological' | 'step' | 'none' }
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(children.map((c) => [c.id, 'none']))
  );

  function setChoice(childId, value) {
    setChoices((prev) => ({ ...prev, [childId]: value }));
  }

  const btnBase    = 'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors';
  const btnActive  = 'bg-veru-accent text-white border-veru-accent';
  const btnPassive = 'bg-white text-gray-600 border-gray-200 hover:border-veru-mid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-earth-warmWhite rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <p className="text-sm font-semibold text-veru-dark text-center" style={{ fontFamily: 'Georgia, serif' }}>
          Does <span className="text-veru-accent">{newPerson.name}</span> have a parental relationship with any of these children?
        </p>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {children.map((child) => (
            <div key={child.id} className="space-y-1">
              <p className="text-xs font-medium text-gray-700">{child.name}</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setChoice(child.id, 'biological')}
                  className={`${btnBase} ${choices[child.id] === 'biological' ? btnActive : btnPassive}`}
                >
                  Biological
                </button>
                <button
                  type="button"
                  onClick={() => setChoice(child.id, 'step')}
                  className={`${btnBase} ${choices[child.id] === 'step' ? btnActive : btnPassive}`}
                >
                  Step-parent
                </button>
                <button
                  type="button"
                  onClick={() => setChoice(child.id, 'none')}
                  className={`${btnBase} ${choices[child.id] === 'none' ? btnActive : btnPassive}`}
                >
                  No relation
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onComplete(choices)}
            className="flex-1 py-2 text-sm font-semibold bg-veru-accent text-white rounded-xl hover:bg-veru-dark transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TreeView() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [tree,          setTree]          = useState(null);
  const [people,        setPeople]        = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [perspectiveId, setPerspectiveId] = useState(null);
  // Positions live in a ref — never in state. State updates on drag would
  // trigger re-renders → handler reference changes → layout re-runs → snap-back.
  const positionsRef = useRef({});
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [personModal,   setPersonModal]   = useState(null);
  const [relModal,      setRelModal]      = useState(null);

  // Contextual add state — set before opening PersonModal from a (+) button
  // { sourcePersonId, relType: 'SPOUSE'|'PARENT', newNodePosition }
  const [pendingRelSource,    setPendingRelSource]    = useState(null);
  // Spouse-children prompt state
  const [spouseChildPrompt,   setSpouseChildPrompt]   = useState(null);
  // { newPersonId, newPersonName, newPerson, partnerChildren: [person] }

  const { pushHistory, resetHistory, undo, redo, canUndo, canRedo } = useHistory();

  // Debounced position save — persist after drag ends
  const positionSaveTimer = useRef(null);

  // ---------------------------------------------------------------------------
  // Kinship — computed client-side
  // ---------------------------------------------------------------------------
  const kinship = useMemo(() => {
    if (!perspectiveId || !tree) return {};
    return computeAllKinshipTitles(perspectiveId, people, relationships, tree.culture);
  }, [perspectiveId, people, relationships, tree?.culture]);

  // ---------------------------------------------------------------------------
  // Load tree
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);
    positionsRef.current = {};
    getTree(id)
      .then((res) => {
        const t = res.data;
        setTree(t);
        const loadedPeople = Array.isArray(t.people)        ? t.people        : [];
        const loadedRels   = Array.isArray(t.relationships) ? t.relationships : [];
        // Load persisted positions into ref BEFORE triggering re-renders, so
        // TreeCanvas's main useEffect reads them on its first run.
        const loadedPositions =
          t.nodePositionsJson && typeof t.nodePositionsJson === 'object' && !Array.isArray(t.nodePositionsJson)
            ? t.nodePositionsJson
            : {};
        positionsRef.current = loadedPositions;
        setPeople(loadedPeople);
        setRelationships(loadedRels);
        if (loadedPeople.length > 0) setPerspectiveId(loadedPeople[0].id);
        resetHistory({ people: loadedPeople, relationships: loadedRels, nodePositions: loadedPositions });
      })
      .catch((err) => {
        if (err.response?.status === 404) navigate('/');
        else setError('Failed to load tree');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------
  function handleUndo() {
    const snap = undo();
    if (!snap) return;
    // Update ref BEFORE state so TreeCanvas's useEffect reads restored positions
    positionsRef.current = { ...(snap.nodePositions || {}) };
    setPeople(snap.people);
    setRelationships(snap.relationships);
  }

  function handleRedo() {
    const snap = redo();
    if (!snap) return;
    positionsRef.current = { ...(snap.nodePositions || {}) };
    setPeople(snap.people);
    setRelationships(snap.relationships);
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.shiftKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, canRedo]);

  // ---------------------------------------------------------------------------
  // Node position save — called by TreeCanvas after drag or auto-organise.
  // Does NOT update state (no re-render, no snap-back chain).
  // positionsRef.current is already updated by TreeCanvas before this fires.
  // ---------------------------------------------------------------------------
  const handlePositionsChange = useCallback((posMap) => {
    clearTimeout(positionSaveTimer.current);
    positionSaveTimer.current = setTimeout(() => {
      patchNodePositions(id, posMap).catch((err) =>
        console.error('Failed to persist node positions:', err)
      );
    }, 800);
  }, [id]);

  // ---------------------------------------------------------------------------
  // Stable callbacks — wrapped in useCallback so TreeCanvas handlers don't
  // change reference on every render (prevents spurious node-position resets)
  // ---------------------------------------------------------------------------
  const handleEditPerson = useCallback(
    (person) => setPersonModal({ person }),
    []
  );

  // ---------------------------------------------------------------------------
  // Person CRUD
  // ---------------------------------------------------------------------------
  async function handleSavePerson(fd) {
    let newPerson;
    let newPeople;

    if (personModal?.person) {
      const res = await updatePerson(id, personModal.person.id, fd);
      newPerson = res.data;
      newPeople = people.map((p) => (p.id === newPerson.id ? newPerson : p));
    } else {
      const res = await createPerson(id, fd);
      newPerson = res.data;
      newPeople = [...people, newPerson];
      if (people.length === 0) setPerspectiveId(newPerson.id);
    }

    setPeople(newPeople);

    // Auto-create relationship when coming from a contextual (+) button
    let newRels = relationships;

    if (pendingRelSource && newPerson && !personModal?.person) {
      const { sourcePersonId, relType, newNodePosition } = pendingRelSource;

      if (newNodePosition) {
        positionsRef.current[newPerson.id] = newNodePosition;
      }

      try {
        const relData = {
          fromPersonId: sourcePersonId,
          toPersonId:   newPerson.id,
          type:         relType === 'SPOUSE' ? 'SPOUSE' : 'PARENT',
          isBiological: true,
        };
        const relRes = await createRelationship(id, relData);
        newRels = [...relationships, relRes.data];
        setRelationships(newRels);

        // Case B: new spouse → check if source person has children and prompt
        if (relType === 'SPOUSE') {
          const partnerChildIds = new Set();
          for (const r of newRels) {
            if (r.type === 'PARENT' && r.fromPersonId === sourcePersonId) partnerChildIds.add(r.toPersonId);
            if (r.type === 'CHILD'  && r.toPersonId   === sourcePersonId) partnerChildIds.add(r.fromPersonId);
          }
          if (partnerChildIds.size > 0) {
            const partnerChildren = newPeople.filter((p) => partnerChildIds.has(p.id));
            setSpouseChildPrompt({ newPerson, partnerChildren, sourcePersonId });
          }
        }
      } catch (err) {
        console.error('Auto-relationship creation failed:', err);
      }

      setPendingRelSource(null);
    }

    pushHistory({ people: newPeople, relationships: newRels, nodePositions: { ...positionsRef.current } });
  }

  async function handleDeletePerson() {
    const personId = personModal?.person?.id;
    if (!personId) return;
    await deletePerson(id, personId);
    const newPeople = people.filter((p) => p.id !== personId);
    const newRels   = relationships.filter(
      (r) => r.fromPersonId !== personId && r.toPersonId !== personId
    );
    setPeople(newPeople);
    setRelationships(newRels);
    if (perspectiveId === personId) setPerspectiveId(newPeople[0]?.id ?? null);
    pushHistory({ people: newPeople, relationships: newRels, nodePositions: { ...positionsRef.current } });
  }

  // ---------------------------------------------------------------------------
  // Relationship CRUD
  // ---------------------------------------------------------------------------
  async function handleSaveRelationship(data) {
    // UPDATE path — editing isBiological on an existing relationship
    if (data.relId) {
      try {
        const res = await updateRelationship(id, data.relId, { isBiological: data.isBiological });
        const newRels = relationships.map((r) =>
          r.id === data.relId ? { ...r, ...res.data } : r
        );
        setRelationships(newRels);
        pushHistory({ people, relationships: newRels, nodePositions: { ...positionsRef.current } });
      } catch (err) {
        console.error('Failed to update relationship:', err);
      }
      return;
    }

    // CREATE path
    if (data.fromPersonId === data.toPersonId) return;
    const isDuplicate = relationships.some(
      (r) =>
        r.type === data.type &&
        ((r.fromPersonId === data.fromPersonId && r.toPersonId === data.toPersonId) ||
         (r.type !== 'PARENT' && r.type !== 'CHILD' &&
          r.fromPersonId === data.toPersonId && r.toPersonId === data.fromPersonId))
    );
    if (isDuplicate) return;

    const res     = await createRelationship(id, data);
    const newRels = [...relationships, res.data];
    setRelationships(newRels);
    pushHistory({ people, relationships: newRels, nodePositions: { ...positionsRef.current } });
  }

  async function handleDeleteRelationship() {
    const relId = relModal?.relationship?.relId;
    if (!relId) return;
    await deleteRelationship(id, relId);
    const newRels = relationships.filter((r) => r.id !== relId);
    setRelationships(newRels);
    pushHistory({ people, relationships: newRels, nodePositions: { ...positionsRef.current } });
  }

  const handleEdgeClick = useCallback((edgeData) => {
    if (!edgeData) return;
    setRelModal({ relationship: edgeData });
  }, []);

  // ---------------------------------------------------------------------------
  // Contextual (+) button handlers
  // ---------------------------------------------------------------------------
  // Stable callbacks — positionsRef is a ref (never changes identity), so
  // these have empty deps and never cause TreeCanvas's handlers to re-create.
  const handleAddSpouseOf = useCallback((sourcePersonId) => {
    const sourcePos = positionsRef.current[sourcePersonId];
    const newNodePosition = sourcePos
      ? { x: sourcePos.x + NODE_WIDTH + 120, y: sourcePos.y }
      : null;
    setPendingRelSource({ sourcePersonId, relType: 'SPOUSE', newNodePosition });
    setPersonModal({ person: null });
  }, []);

  const handleAddChildOf = useCallback((sourcePersonId) => {
    const sourcePos = positionsRef.current[sourcePersonId];
    const newNodePosition = sourcePos
      ? { x: sourcePos.x, y: sourcePos.y + NODE_HEIGHT + 140 }
      : null;
    setPendingRelSource({ sourcePersonId, relType: 'PARENT', newNodePosition });
    setPersonModal({ person: null });
  }, []);

  // ---------------------------------------------------------------------------
  // Drag-to-connect handler — isBiological flows from TreeCanvas's BiologicalPrompt
  // ---------------------------------------------------------------------------
  async function handleConnectionComplete({ source, target, type, isBiological = true }) {
    await handleSaveRelationship({ fromPersonId: source, toPersonId: target, type, isBiological });
  }

  // ---------------------------------------------------------------------------
  // Spouse-children prompt resolution
  // ---------------------------------------------------------------------------
  async function handleSpouseChildPromptComplete(choices) {
    if (!spouseChildPrompt) return;
    const { newPerson, partnerChildren, sourcePersonId } = spouseChildPrompt;
    setSpouseChildPrompt(null);

    let newRels = relationships;
    for (const child of partnerChildren) {
      const choice = choices[child.id];
      if (choice === 'none') continue;
      try {
        const relRes = await createRelationship(id, {
          fromPersonId: newPerson.id,
          toPersonId:   child.id,
          type:         'PARENT',
          isBiological: choice === 'biological',
        });
        newRels = [...newRels, relRes.data];
      } catch (err) {
        console.error('Failed to create parent-child relationship:', err);
      }
    }
    setRelationships(newRels);
    pushHistory({ people, relationships: newRels, nodePositions: { ...positionsRef.current } });
  }

  const perspectivePerson = people.find((p) => p.id === perspectiveId);

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------
  function SidebarContent({ onClose }) {
    return (
      <>
        <div className="p-3 border-b border-veru-light">
          <button
            onClick={() => { setPersonModal({ person: null }); onClose?.(); }}
            className="w-full bg-earth-terra hover:bg-earth-terraDark text-white text-sm font-semibold py-2.5 rounded-xl transition-colors min-h-[44px]"
          >
            + Add Person
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold px-2 py-1">
            People ({people.length})
          </p>
          {people.map((person) => (
            <button
              key={person.id}
              onClick={() => { setPerspectiveId(person.id); onClose?.(); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm mb-0.5 transition-colors flex items-center gap-2 min-h-[44px]
                ${perspectiveId === person.id
                  ? 'bg-veru-accent text-white font-semibold'
                  : 'text-gray-700 hover:bg-veru-light'
                }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0
                ${person.gender === 'MALE' ? 'bg-blue-300' : person.gender === 'FEMALE' ? 'bg-earth-rose' : 'bg-gray-300'}`}
              />
              <span className="truncate">{person.name}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-veru-light">
          <p className="text-[10px] text-gray-400 text-center leading-snug">
            Click node to switch perspective · Double-click to edit
            <br />
            Drag between nodes or use (+) to add relationships
          </p>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-veru-light">
        <div className="w-10 h-10 border-4 border-veru-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-veru-light gap-4">
        <p className="text-red-500">{error}</p>
        <Link to="/" className="text-veru-accent hover:underline text-sm">← Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-veru-light">
      <TopBar tree={tree} perspectiveName={perspectivePerson?.name} onTreeUpdate={setTree} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-52 bg-earth-warmWhite border-r border-veru-mid flex-col shadow-sm z-10 flex-shrink-0">
          <SidebarContent />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="sm:hidden fixed inset-0 z-40 flex">
            <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="w-64 bg-earth-warmWhite flex flex-col h-full shadow-xl border-l border-veru-mid">
              <div className="flex items-center justify-between px-4 py-3 border-b border-veru-light">
                <span className="text-sm font-semibold text-veru-dark">Tree Menu</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
              <SidebarContent onClose={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* Canvas */}
        <main className="flex-1 overflow-hidden">
          {people.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-8">
              <svg width="64" height="64" viewBox="0 0 64 64" className="opacity-30">
                <circle cx="32" cy="20" r="10" fill="#6BAF8C"/>
                <line x1="32" y1="30" x2="32" y2="54" stroke="#6BAF8C" strokeWidth="2"/>
                <line x1="20" y1="42" x2="44" y2="42" stroke="#6BAF8C" strokeWidth="2"/>
              </svg>
              <p className="text-veru-dark font-medium">No people in this tree yet</p>
              <p className="text-gray-400 text-sm">Tap "Add Person" to get started</p>
              <button
                onClick={() => setPersonModal({ person: null })}
                className="mt-2 bg-earth-terra hover:bg-earth-terraDark text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors min-h-[44px]"
              >
                Add First Person
              </button>
            </div>
          ) : (
            <TreeCanvas
              people={people}
              relationships={relationships}
              kinship={kinship}
              perspectiveId={perspectiveId}
              culture={tree?.culture}
              isReadOnly={false}
              onPerspectiveChange={setPerspectiveId}
              onEditPerson={handleEditPerson}
              onEdgeClick={handleEdgeClick}
              onAddSpouseOf={handleAddSpouseOf}
              onAddChildOf={handleAddChildOf}
              onConnectionComplete={handleConnectionComplete}
              positionsRef={positionsRef}
              onPositionsChange={handlePositionsChange}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          )}
        </main>

        {/* Mobile FAB */}
        <button
          className="sm:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-earth-terra hover:bg-earth-terraDark text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open tree menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7" r="3"/>
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="16" y1="11" x2="22" y2="11"/>
          </svg>
        </button>
      </div>

      {/* Modals */}
      {personModal && (
        <PersonModal
          person={personModal.person}
          onSave={handleSavePerson}
          onDelete={personModal.person ? handleDeletePerson : undefined}
          onClose={() => {
            setPersonModal(null);
            setPendingRelSource(null);
          }}
        />
      )}
      {relModal && (
        <RelationshipModal
          people={people}
          relationship={relModal.relationship}
          onSave={handleSaveRelationship}
          onDelete={handleDeleteRelationship}
          onClose={() => setRelModal(null)}
        />
      )}
      {spouseChildPrompt && (
        <SpouseChildrenPrompt
          newPerson={spouseChildPrompt.newPerson}
          children={spouseChildPrompt.partnerChildren}
          onComplete={handleSpouseChildPromptComplete}
          onSkip={() => setSpouseChildPrompt(null)}
        />
      )}
    </div>
  );
}
