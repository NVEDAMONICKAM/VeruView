import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useEdgesState,
  useNodesState,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import PersonNode from './PersonNode';

const NODE_WIDTH  = 176;
const NODE_HEIGHT = 220;

const nodeTypes = { person: PersonNode };

// ---------------------------------------------------------------------------
// Edge style definitions — SIBLING removed (derived from shared parents)
// ---------------------------------------------------------------------------
const EDGE_CONFIG = {
  PARENT: { color: '#6BAF8C', label: 'Parent',  bg: 'rgba(107,175,140,0.15)' },
  CHILD:  { color: '#6BAF8C', label: 'Parent',  bg: 'rgba(107,175,140,0.15)' },
  SPOUSE: { color: '#5BA8A0', label: 'Spouse',  bg: 'rgba(91,168,160,0.15)'  },
};

// ---------------------------------------------------------------------------
// Dagre auto-layout. Stored positions (externalPositions) take priority.
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
        : n.position,
    };
  });
}

// ---------------------------------------------------------------------------
// Build nodes + edges — SIBLING edges filtered out
// ---------------------------------------------------------------------------
function buildFlowElements(people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers) {
  const nodes = people.map((person, i) => ({
    id: person.id,
    type: 'person',
    position: { x: (i % 5) * (NODE_WIDTH + 60), y: Math.floor(i / 5) * (NODE_HEIGHT + 80) },
    data: {
      person,
      kinship: kinship?.[person.id] ?? null,
      culture,
      isPerspective: person.id === perspectiveId,
      isReadOnly,
      onClickNode: handlers.onClickNode,
      onEditNode:  handlers.onEditNode,
    },
  }));

  const seen  = new Set();
  const edges = [];

  for (const rel of relationships) {
    // Skip sibling edges entirely
    if (rel.type === 'SIBLING') continue;

    const pairKey = [rel.fromPersonId, rel.toPersonId].sort().join(':') + ':' + rel.type;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const isHierarchical = rel.type === 'PARENT' || rel.type === 'CHILD';
    const [src, tgt] =
      rel.type === 'PARENT' ? [rel.fromPersonId, rel.toPersonId] :
      rel.type === 'CHILD'  ? [rel.toPersonId,   rel.fromPersonId] :
      [rel.fromPersonId, rel.toPersonId];

    const { color } = EDGE_CONFIG[rel.type] ?? EDGE_CONFIG.PARENT;

    edges.push({
      id: rel.id,
      source: src,
      target: tgt,
      type: isHierarchical ? 'smoothstep' : 'straight',
      animated: false,
      data: { type: rel.type, relId: rel.id },
      style: { stroke: color, strokeWidth: 2 },
      label: undefined,
      markerEnd: isHierarchical
        ? { type: MarkerType.ArrowClosed, color, width: 12, height: 12 }
        : undefined,
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Legend — Sibling entry removed
// ---------------------------------------------------------------------------
function EdgeLegend() {
  const [open, setOpen] = useState(false);

  const entries = [
    { color: '#6BAF8C', label: 'Parent / Child' },
    { color: '#5BA8A0', label: 'Spouse / Partner' },
  ];

  const legendContent = (
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
        {legendContent}
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
            {legendContent}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Undo / Redo toolbar buttons
// ---------------------------------------------------------------------------
function UndoRedoButtons({ onUndo, onRedo, canUndo, canRedo }) {
  const btnBase =
    'w-11 h-11 rounded-full flex items-center justify-center border transition-colors shadow-sm';
  const btnActive =
    'bg-earth-warmWhite border-veru-mid text-veru-dark hover:bg-veru-light hover:border-veru-accent';
  const btnDisabled =
    'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed';

  return (
    <div className="flex gap-2">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        className={`${btnBase} ${canUndo ? btnActive : btnDisabled}`}
      >
        {/* Counter-clockwise arrow */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
        className={`${btnBase} ${canRedo ? btnActive : btnDisabled}`}
      >
        {/* Clockwise arrow */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </button>
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
  const [activeEdgeId, setActiveEdgeId]  = useState(null);

  // Keep a ref so the layout effect can always read the latest positions
  // without needing them in its dependency array (avoids re-running on drag).
  const externalPositionsRef = useRef(externalPositions);
  externalPositionsRef.current = externalPositions;

  const handlers = useMemo(
    () => ({
      onClickNode: (personId) => onPerspectiveChange?.(personId),
      onEditNode:  (person)   => onEditPerson?.(person),
    }),
    [onPerspectiveChange, onEditPerson]
  );

  // Full rebuild on data changes (uses latest external positions via ref)
  useEffect(() => {
    const { nodes: rawNodes, edges: rawEdges } = buildFlowElements(
      people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers
    );
    const laidOut = computeLayout(rawNodes, rawEdges, externalPositionsRef.current);
    setNodes(laidOut);
    setEdges(rawEdges);
  }, [people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers]);

  // Apply restored positions (undo/redo) without full dagre re-run
  useEffect(() => {
    if (Object.keys(externalPositions).length === 0) return;
    setNodes((prev) =>
      prev.map((n) =>
        externalPositions[n.id] ? { ...n, position: externalPositions[n.id] } : n
      )
    );
  }, [externalPositions]);

  // Label patch on hover/tap — runs only when activeEdgeId changes
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

  // Capture node positions after drag so TreeView can include them in snapshots
  const handleNodeDragStop = useCallback(
    (_evt, _node, allNodes) => {
      const posMap = {};
      allNodes.forEach((n) => { posMap[n.id] = n.position; });
      onPositionsChange?.(posMap);
    },
    [onPositionsChange]
  );

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
        nodeTypes={nodeTypes}
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

        {/* Undo / Redo buttons — top-right */}
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

        <Panel position="bottom-left">
          <EdgeLegend />
        </Panel>

        <MiniMap
          nodeColor={(n) => n.data?.isPerspective ? '#6BAF8C' : '#D4EDDA'}
          maskColor="rgba(212, 237, 218, 0.6)"
        />
      </ReactFlow>
    </div>
  );
}
