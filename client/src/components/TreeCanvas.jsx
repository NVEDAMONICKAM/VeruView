import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useEdgesState,
  useNodesState,
  useReactFlow,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import PersonNode from './PersonNode';

const NODE_WIDTH  = 176;
const NODE_HEIGHT = 220;

const nodeTypes = { person: PersonNode };

const EDGE_CONFIG = {
  PARENT: { color: '#6BAF8C', label: 'Parent' },
  CHILD:  { color: '#6BAF8C', label: 'Parent' },
  SPOUSE: { color: '#5BA8A0', label: 'Spouse' },
};

// Connection types — labels are dynamically built using person names in ConnectionTypePopup

// ---------------------------------------------------------------------------
// Dagre layout — only assigns positions for nodes NOT in externalPositions
// ---------------------------------------------------------------------------
function computeLayout(rfNodes, rfEdges, externalPositions = {}) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  rfNodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  rfEdges
    .filter((e) => e.data?.type === 'PARENT' || e.data?.type === 'CHILD')
    .forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return rfNodes.map((n) => {
    if (externalPositions[n.id]) {
      return { ...n, position: externalPositions[n.id] };
    }
    const pos = g.node(n.id);
    return {
      ...n,
      position: pos
        ? { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 }
        : (n.position ?? { x: 0, y: 0 }),
    };
  });
}

// ---------------------------------------------------------------------------
// Build ReactFlow nodes + edges (SIBLING filtered out)
// positions — current known positions used to assign correct left/right for spouse edges
// ---------------------------------------------------------------------------
function buildFlowElements(people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers, positions = {}) {
  const nodes = people.map((person, i) => ({
    id:   person.id,
    type: 'person',
    position: { x: (i % 5) * (NODE_WIDTH + 60), y: Math.floor(i / 5) * (NODE_HEIGHT + 80) },
    data: {
      person,
      kinship:       kinship?.[person.id] ?? null,
      culture,
      isPerspective: person.id === perspectiveId,
      isReadOnly,
      onClickNode:   handlers.onClickNode,
      onEditNode:    handlers.onEditNode,
      onAddSpouse:   isReadOnly ? undefined : handlers.onAddSpouse,
      onAddChild:    isReadOnly ? undefined : handlers.onAddChild,
    },
  }));

  const seen  = new Set();
  const edges = [];

  for (const rel of relationships) {
    if (rel.type === 'SIBLING') continue;

    const pairKey = [rel.fromPersonId, rel.toPersonId].sort().join(':') + ':' + rel.type;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const isHierarchical = rel.type === 'PARENT' || rel.type === 'CHILD';
    const isSpouse       = rel.type === 'SPOUSE';

    let src, tgt, sourceHandle, targetHandle, edgeType;

    if (isHierarchical) {
      // Parent is always source (bottom), child is target (top)
      [src, tgt] =
        rel.type === 'PARENT' ? [rel.fromPersonId, rel.toPersonId] :
                                [rel.toPersonId,   rel.fromPersonId];
      sourceHandle = 'bottom';
      targetHandle = 'top';
      edgeType     = 'default';
    } else {
      // SPOUSE: leftmost person as source (right handle) → rightmost as target (left handle)
      const fPos = positions[rel.fromPersonId];
      const tPos = positions[rel.toPersonId];
      const fromIsLeft = !fPos || !tPos || fPos.x <= tPos.x;
      src = fromIsLeft ? rel.fromPersonId : rel.toPersonId;
      tgt = fromIsLeft ? rel.toPersonId   : rel.fromPersonId;
      sourceHandle = 'right';
      targetHandle = 'left';
      edgeType     = 'straight';
    }

    const { color } = EDGE_CONFIG[rel.type] ?? EDGE_CONFIG.PARENT;

    edges.push({
      id:           rel.id,
      source:       src,
      target:       tgt,
      sourceHandle,
      targetHandle,
      type:         edgeType,
      animated:     false,
      data:         { type: rel.type, relId: rel.id, isBiological: rel.isBiological ?? true, fromPersonId: rel.fromPersonId, toPersonId: rel.toPersonId },
      style:        { stroke: color, strokeWidth: 2 },
      label:        undefined,
      markerEnd:    isHierarchical
        ? { type: MarkerType.ArrowClosed, color, width: 12, height: 12 }
        : undefined,
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Edge legend
// ---------------------------------------------------------------------------
function EdgeLegend() {
  const [open, setOpen] = useState(false);
  const entries = [
    { color: '#6BAF8C', label: 'Parent / Child' },
    { color: '#5BA8A0', label: 'Spouse / Partner' },
  ];
  const content = (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
        Relationships
      </p>
      {entries.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="block h-0.5 w-5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[11px] text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <div className="hidden sm:block bg-earth-warmWhite border border-veru-mid rounded-xl shadow-sm px-3 py-2.5">
        {content}
      </div>
      <div className="sm:hidden relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 bg-earth-warmWhite border border-veru-mid rounded-full shadow-sm flex items-center justify-center text-veru-dark text-sm font-bold"
          aria-label="Show relationship legend"
        >
          ℹ
        </button>
        {open && (
          <div className="absolute bottom-11 left-0 bg-earth-warmWhite border border-veru-mid rounded-xl shadow-lg px-3 py-2.5 w-44 z-50">
            {content}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Undo / Redo buttons
// ---------------------------------------------------------------------------
function UndoRedoButtons({ onUndo, onRedo, canUndo, canRedo }) {
  const btnBase     = 'w-11 h-11 rounded-full flex items-center justify-center border transition-colors shadow-sm';
  const btnActive   = 'bg-earth-warmWhite border-veru-mid text-veru-dark hover:bg-veru-light hover:border-veru-accent';
  const btnDisabled = 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed';
  return (
    <div className="flex gap-2">
      <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"
        className={`${btnBase} ${canUndo ? btnActive : btnDisabled}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>
      <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo"
        className={`${btnBase} ${canRedo ? btnActive : btnDisabled}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-organise button — must be inside <ReactFlow> to access useReactFlow
// ---------------------------------------------------------------------------
function AutoOrganisePanel({ nodes, edges, onSetNodes, onPositionsChange, onResetLayout }) {
  const { fitView } = useReactFlow();

  function organise() {
    onResetLayout?.();                      // clear manual flag + saved positions
    const laidOut = computeLayout(nodes, edges, {});
    const posMap  = {};
    laidOut.forEach((n) => { posMap[n.id] = n.position; });
    onSetNodes(laidOut);
    onPositionsChange?.(posMap);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }

  return (
    <button
      onClick={organise}
      className="px-3 py-2 bg-earth-warmWhite border border-veru-mid text-veru-dark text-xs font-semibold rounded-xl shadow-sm hover:bg-veru-light hover:border-veru-accent transition-colors"
      title="Re-run auto layout"
    >
      Auto-organise
    </button>
  );
}

// ---------------------------------------------------------------------------
// Connection type popup — shown after drag-to-connect, uses real person names
// ---------------------------------------------------------------------------
function ConnectionTypePopup({ connection, people, onConfirm, onCancel }) {
  const peopleMap = Object.fromEntries(people.map((p) => [p.id, p]));
  const A = peopleMap[connection.source]?.name ?? 'Person A';
  const B = peopleMap[connection.target]?.name ?? 'Person B';

  const options = [
    { type: 'PARENT', label: `${A} is parent of ${B}` },
    { type: 'CHILD',  label: `${B} is parent of ${A}` },
    { type: 'SPOUSE', label: `${A} and ${B} are partners` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-earth-warmWhite rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-3">
        <p className="text-sm font-semibold text-veru-dark text-center" style={{ fontFamily: 'Georgia, serif' }}>
          Connect {A} and {B}
        </p>
        <div className="space-y-2 pt-1">
          {options.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onConfirm(type)}
              className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 hover:border-veru-accent hover:bg-veru-light text-sm text-gray-700 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 pt-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Biological / Step-parent prompt — shown after PARENT or CHILD connection type chosen
// ---------------------------------------------------------------------------
function BiologicalPrompt({ connection, people, onConfirm, onCancel }) {
  const peopleMap  = Object.fromEntries(people.map((p) => [p.id, p]));
  const isParent   = connection.type === 'PARENT';
  const parentName = peopleMap[isParent ? connection.source : connection.target]?.name ?? '…';
  const childName  = peopleMap[isParent ? connection.target : connection.source]?.name ?? '…';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-earth-warmWhite rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-3">
        <p className="text-sm font-semibold text-veru-dark text-center" style={{ fontFamily: 'Georgia, serif' }}>
          Parental relationship type
        </p>
        <p className="text-xs text-gray-500 text-center">
          Is <span className="font-medium text-gray-800">{parentName}</span> a biological or step-parent of{' '}
          <span className="font-medium text-gray-800">{childName}</span>?
        </p>
        <div className="space-y-2 pt-1">
          <button
            onClick={() => onConfirm(true)}
            className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 hover:border-veru-accent hover:bg-veru-light text-sm text-gray-700 transition-colors"
          >
            Biological parent
          </button>
          <button
            onClick={() => onConfirm(false)}
            className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 hover:border-veru-accent hover:bg-veru-light text-sm text-gray-700 transition-colors"
          >
            Step-parent
          </button>
        </div>
        <button onClick={onCancel} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 pt-1">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main TreeCanvas component
// ---------------------------------------------------------------------------
export default function TreeCanvas({
  people = [],
  relationships = [],
  kinship = {},
  perspectiveId,
  culture,
  isReadOnly = false,
  onPerspectiveChange,
  onEditPerson,
  onEdgeClick,
  onAddSpouseOf,
  onAddChildOf,
  onConnectionComplete,
  // Undo / redo
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  // Node position persistence
  externalPositions = {},
  onPositionsChange,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeEdgeId,       setActiveEdgeId]       = useState(null);
  const [pendingConnection,  setPendingConnection]   = useState(null);
  // pendingBioConnection holds a confirmed type (PARENT/CHILD) waiting for biological choice
  const [pendingBioConnection, setPendingBioConnection] = useState(null);

  // Local position ref — the definitive source of truth for node positions.
  // Updated SYNCHRONOUSLY on drag stop (before any React re-render), so if a
  // rebuild effect fires afterwards it always reads the post-drag positions.
  // Also synced from externalPositions on initial load and undo/redo.
  const localPositionsRef = useRef({});

  // First-layout flag — fires onPositionsChange once to seed TreeView state
  const firstLayoutRef = useRef(true);

  // hasUserMovedNodes — when true, rebuilds preserve user-placed positions
  // instead of re-running dagre layout (prevents consecutive-drag snap-back)
  const hasUserMovedNodes = useRef(false);

  const handlers = useMemo(
    () => ({
      onClickNode: (personId) => onPerspectiveChange?.(personId),
      onEditNode:  (person)   => onEditPerson?.(person),
      onAddSpouse: (personId) => onAddSpouseOf?.(personId),
      onAddChild:  (personId) => onAddChildOf?.(personId),
    }),
    [onPerspectiveChange, onEditPerson, onAddSpouseOf, onAddChildOf]
  );

  // ── Sync local position ref from external (initial load, undo/redo) ─────────
  // externalPositions comes from TreeView state (loaded from DB or history snapshot).
  // We merge it into our local ref so the rebuild effect always has up-to-date positions,
  // then apply it to rendered nodes immediately.
  useEffect(() => {
    if (Object.keys(externalPositions).length === 0) return;
    localPositionsRef.current = { ...localPositionsRef.current, ...externalPositions };
    setNodes((prev) =>
      prev.map((n) =>
        externalPositions[n.id] ? { ...n, position: externalPositions[n.id] } : n
      )
    );
  }, [externalPositions]);

  // ── Full rebuild when people/relationships/display data changes ────────────
  // When user has manually dragged nodes (hasUserMovedNodes), we update node
  // data but PRESERVE positions from localPositionsRef — no dagre layout.
  // This prevents consecutive-drag snap-back caused by re-renders triggered by
  // kinship/perspective/handlers updates immediately after a drag.
  useEffect(() => {
    if (people.length === 0) {
      firstLayoutRef.current = true;
      hasUserMovedNodes.current = false;
      localPositionsRef.current = {};
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: rawNodes, edges: rawEdges } = buildFlowElements(
      people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers, localPositionsRef.current
    );

    if (hasUserMovedNodes.current) {
      // Preserve all user-placed positions; only compute layout for brand-new nodes
      const saved = localPositionsRef.current;
      const newNodes = rawNodes.filter((n) => !saved[n.id]);
      let extraPositions = {};
      if (newNodes.length > 0) {
        const partial = computeLayout(rawNodes, rawEdges, saved);
        newNodes.forEach((n) => {
          const laid = partial.find((l) => l.id === n.id);
          if (laid) extraPositions[n.id] = laid.position;
        });
      }
      setNodes(rawNodes.map((n) => ({
        ...n,
        position: saved[n.id] ?? extraPositions[n.id] ?? n.position,
      })));
      setEdges(rawEdges);
    } else {
      const laidOut = computeLayout(rawNodes, rawEdges, localPositionsRef.current);
      setNodes(laidOut);
      setEdges(rawEdges);
      // On first layout with data, publish positions so TreeView can persist them.
      if (firstLayoutRef.current) {
        firstLayoutRef.current = false;
        const posMap = {};
        laidOut.forEach((n) => { posMap[n.id] = n.position; });
        localPositionsRef.current = posMap;
        onPositionsChange?.(posMap);
      }
    }
  }, [people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers]);

  // ── Edge hover label ───────────────────────────────────────────────────────
  useEffect(() => {
    setEdges((prev) =>
      prev.map((e) => {
        const cfg      = EDGE_CONFIG[e.data?.type];
        const isActive = e.id === activeEdgeId;
        return {
          ...e,
          label:               isActive ? cfg?.label : undefined,
          labelStyle:          isActive ? { fill: cfg?.color, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600 } : undefined,
          labelBgStyle:        isActive ? { fill: '#ffffff', stroke: cfg?.color, strokeWidth: 1.5 } : undefined,
          labelBgPadding:      isActive ? [8, 4] : undefined,
          labelBgBorderRadius: isActive ? 12 : undefined,
        };
      })
    );
  }, [activeEdgeId]);

  const handleEdgeMouseEnter = useCallback((_evt, edge) => setActiveEdgeId(edge.id), []);
  const handleEdgeMouseLeave = useCallback(() => setActiveEdgeId(null), []);

  const handleEdgeClick = useCallback(
    (_evt, edge) => {
      if (activeEdgeId === edge.id) {
        setActiveEdgeId(null);
        if (!isReadOnly) onEdgeClick?.(edge.data);
      } else {
        setActiveEdgeId(edge.id);
      }
    },
    [activeEdgeId, isReadOnly, onEdgeClick]
  );

  // ── Drag-to-connect ────────────────────────────────────────────────────────
  const handleConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      setPendingConnection(connection);
    },
    []
  );

  const handleConnectionConfirm = useCallback(
    (type) => {
      if (!pendingConnection) return;
      if (type === 'PARENT' || type === 'CHILD') {
        // Need to ask biological vs step before completing
        setPendingBioConnection({ source: pendingConnection.source, target: pendingConnection.target, type });
        setPendingConnection(null);
      } else {
        onConnectionComplete?.({ source: pendingConnection.source, target: pendingConnection.target, type, isBiological: true });
        setPendingConnection(null);
      }
    },
    [pendingConnection, onConnectionComplete]
  );

  const handleBioConfirm = useCallback(
    (isBiological) => {
      if (!pendingBioConnection) return;
      onConnectionComplete?.({ ...pendingBioConnection, isBiological });
      setPendingBioConnection(null);
    },
    [pendingBioConnection, onConnectionComplete]
  );

  // ── Drag-stop: update local ref IMMEDIATELY then propagate ────────────────
  // Updating localPositionsRef.current synchronously (before any React re-render)
  // means that if a rebuild useEffect fires right after (because callback prop
  // references changed), it reads the post-drag positions — no snap-back.
  const handleNodeDragStop = useCallback(
    (_evt, _node, allNodes) => {
      const posMap = {};
      allNodes.forEach((n) => { posMap[n.id] = n.position; });
      localPositionsRef.current = posMap;   // synchronous — always current
      hasUserMovedNodes.current = true;     // guard subsequent rebuilds
      onPositionsChange?.(posMap);          // async — propagates to TreeView state
    },
    [onPositionsChange]
  );

  // Called by AutoOrganisePanel to reset manual positions and re-run full layout
  const handleResetLayout = useCallback(() => {
    hasUserMovedNodes.current = false;
    localPositionsRef.current = {};
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        onEdgeClick={handleEdgeClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={isReadOnly ? undefined : handleConnect}
        nodeTypes={nodeTypes}
        connectionMode="loose"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        panOnScroll={false}
        zoomOnScroll={true}
        panOnDrag={true}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#A8D5B5" gap={24} size={1} />
        <Controls />

        {/* Undo / Redo — top-right */}
        {!isReadOnly && (
          <Panel position="top-right">
            <UndoRedoButtons
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </Panel>
        )}

        {/* Auto-organise — top-left */}
        {!isReadOnly && (
          <Panel position="top-left">
            <AutoOrganisePanel
              nodes={nodes}
              edges={edges}
              onSetNodes={setNodes}
              onPositionsChange={onPositionsChange}
              onResetLayout={handleResetLayout}
            />
          </Panel>
        )}

        <Panel position="bottom-left">
          <EdgeLegend />
        </Panel>

        <MiniMap
          nodeColor={(n) => n.data?.isPerspective ? '#6BAF8C' : '#D4EDDA'}
          maskColor="rgba(212, 237, 218, 0.6)"
        />
      </ReactFlow>

      {/* Drag-to-connect type picker */}
      {pendingConnection && !isReadOnly && (
        <ConnectionTypePopup
          connection={pendingConnection}
          people={people}
          onConfirm={handleConnectionConfirm}
          onCancel={() => setPendingConnection(null)}
        />
      )}

      {/* Biological / step-parent picker (shown after PARENT or CHILD is chosen) */}
      {pendingBioConnection && !isReadOnly && (
        <BiologicalPrompt
          connection={pendingBioConnection}
          people={people}
          onConfirm={handleBioConfirm}
          onCancel={() => setPendingBioConnection(null)}
        />
      )}
    </div>
  );
}
