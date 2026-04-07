import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
// Edge style definitions — edit EDGE_CONFIG to change colours/labels.
// To add a new culture's edge type, add a key here.
// ---------------------------------------------------------------------------
const EDGE_CONFIG = {
  PARENT:  { color: '#6BAF8C', label: 'Parent',  bg: 'rgba(107,175,140,0.15)' },
  CHILD:   { color: '#6BAF8C', label: 'Parent',  bg: 'rgba(107,175,140,0.15)' },
  SPOUSE:  { color: '#5BA8A0', label: 'Spouse',  bg: 'rgba(91,168,160,0.15)'  },
  SIBLING: { color: '#A0A0A0', label: 'Sibling', bg: 'rgba(160,160,160,0.15)' },
};

// ---------------------------------------------------------------------------
// Dagre auto-layout (hierarchical top-down)
// Only PARENT/CHILD edges drive the rank layout; others are cosmetic.
// ---------------------------------------------------------------------------
function computeLayout(rfNodes, rfEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  rfNodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  rfEdges
    .filter((e) => e.data?.type === 'PARENT' || e.data?.type === 'CHILD')
    .forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return rfNodes.map((n) => {
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
// Build nodes + edges from DB data.
// Labels are NOT set here — they are applied reactively in a separate effect
// keyed on activeEdgeId, so hover/tap updates don't trigger a full dagre relayout.
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
      onEditNode: handlers.onEditNode,
    },
  }));

  const seen = new Set();
  const edges = [];

  for (const rel of relationships) {
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
      // Labels start hidden — activeEdgeId effect applies them on hover/tap
      label: undefined,
      markerEnd: isHierarchical
        ? { type: MarkerType.ArrowClosed, color, width: 12, height: 12 }
        : undefined,
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Legend component — full on desktop, collapsible tooltip icon on mobile
// ---------------------------------------------------------------------------
function EdgeLegend() {
  const [open, setOpen] = useState(false);

  const entries = [
    { color: '#6BAF8C', label: 'Parent / Child' },
    { color: '#5BA8A0', label: 'Spouse / Partner' },
    { color: '#A0A0A0', label: 'Sibling' },
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
      {/* Desktop: always-visible card */}
      <div className="hidden sm:block bg-earth-warmWhite border border-veru-mid rounded-xl shadow-sm px-3 py-2.5">
        {legendContent}
      </div>

      {/* Mobile: collapsible icon button */}
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
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Track which edge is currently "active" (hovered on desktop, tapped on mobile)
  const [activeEdgeId, setActiveEdgeId] = useState(null);

  const handlers = useMemo(
    () => ({
      onClickNode: (personId) => onPerspectiveChange?.(personId),
      onEditNode:  (person)   => onEditPerson?.(person),
    }),
    [onPerspectiveChange, onEditPerson]
  );

  // Full rebuild — only on data or layout changes (not on hover)
  useEffect(() => {
    const { nodes: rawNodes, edges: rawEdges } = buildFlowElements(
      people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers
    );
    const laidOut = computeLayout(rawNodes, rawEdges);
    setNodes(laidOut);
    setEdges(rawEdges);
  }, [people, relationships, kinship, perspectiveId, culture, isReadOnly, handlers]);

  // Label patch — runs only when activeEdgeId changes.
  // Patching edges in-place avoids a full dagre relayout on every hover.
  useEffect(() => {
    setEdges((prev) =>
      prev.map((e) => {
        const cfg = EDGE_CONFIG[e.data?.type];
        const isActive = e.id === activeEdgeId;
        return {
          ...e,
          label:              isActive ? cfg?.label : undefined,
          labelStyle:          isActive ? { fill: cfg?.color, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600 } : undefined,
          // Solid white background + coloured border so the label sits clearly above the line
          labelBgStyle:        isActive ? { fill: '#ffffff', stroke: cfg?.color, strokeWidth: 1.5 } : undefined,
          labelBgPadding:      isActive ? [8, 4] : undefined,
          labelBgBorderRadius: isActive ? 12 : undefined,
        };
      })
    );
  }, [activeEdgeId]);

  // Desktop: show label on mouse enter
  const handleEdgeMouseEnter = useCallback((_evt, edge) => {
    setActiveEdgeId(edge.id);
  }, []);

  // Desktop: hide label on mouse leave
  const handleEdgeMouseLeave = useCallback(() => {
    setActiveEdgeId(null);
  }, []);

  // All devices: click/tap toggles label; if already active (desktop hover), open edit modal
  const handleEdgeClick = useCallback(
    (_evt, edge) => {
      if (activeEdgeId === edge.id) {
        // Second interaction → open edit modal (desktop) or dismiss label (mobile)
        setActiveEdgeId(null);
        if (!isReadOnly) onEdgeClick?.(edge.data);
      } else {
        // First interaction → show label badge
        setActiveEdgeId(edge.id);
      }
    },
    [activeEdgeId, isReadOnly, onEdgeClick]
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
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        // Touch: React Flow handles pinch-to-zoom and pan natively
        panOnScroll={false}
        zoomOnScroll={true}
        panOnDrag={true}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#A8D5B5" gap={24} size={1} />
        <Controls />
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
