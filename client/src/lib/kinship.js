/**
 * kinship.js — Client-side kinship title calculator for VeruView (v2)
 *
 * Pure module: no side-effects, no imports.
 *
 * Algorithm:
 *  1. Build a family map (parents / children / spouses per person)
 *  2. BFS from the perspective person, tracking the shortest path to every
 *     other reachable person as a dot-joined string (e.g. "parent.parent.child")
 *  3. Post-BFS sibling pass — derive siblings from shared parents (catches
 *     cases where the BFS path is longer than "parent.child" due to graph shape)
 *  4. Post-BFS niece/nephew + sibling-in-law pass
 *  5. Map each path string to a title key, then look up the culture title
 *
 * Relationship type semantics (DB schema):
 *   PARENT  : fromPersonId IS A PARENT OF toPersonId
 *   CHILD   : fromPersonId IS A CHILD OF toPersonId
 *   SPOUSE  : bidirectional
 *   SIBLING : ignored — siblings derived from shared parents
 */

// ---------------------------------------------------------------------------
// Tamil kinship title definitions
// ---------------------------------------------------------------------------
const TAMIL_TITLES = {
  father:  { script: 'அப்பா',    transliteration: 'Appā',    english: 'Father' },
  mother:  { script: 'அம்மா',    transliteration: 'Ammā',    english: 'Mother' },
  parent:  { script: 'பெற்றோர்', transliteration: 'Peṯṯōr',  english: 'Parent' },

  stepFather: { script: 'மாற்றானப்பன்', transliteration: 'Māṟṟāṉappaṉ', english: 'Step-Father' },
  stepMother: { script: 'மாற்றாந்தாய்', transliteration: 'Māṟṟāntāy',   english: 'Step-Mother' },

  olderBrother:   { script: 'அண்ணன்',  transliteration: 'Aṇṇan',     english: 'Older Brother' },
  youngerBrother: { script: 'தம்பி',    transliteration: 'Tambi',     english: 'Younger Brother' },
  brother:        { script: 'சகோதரன்', transliteration: 'Sakōtaran', english: 'Brother' },
  olderSister:    { script: 'அக்கா',   transliteration: 'Akkā',      english: 'Older Sister' },
  youngerSister:  { script: 'தங்கை',   transliteration: 'Taṅkai',    english: 'Younger Sister' },
  sister:         { script: 'சகோதரி',  transliteration: 'Sakōtari',  english: 'Sister' },

  paternalGrandfather: { script: 'தாத்தா', transliteration: 'Tāttā', english: 'Grandfather (Paternal)' },
  paternalGrandmother: { script: 'பாட்டி', transliteration: 'Pāṭṭi', english: 'Grandmother (Paternal)' },
  maternalGrandfather: { script: 'தாத்தா', transliteration: 'Tāttā', english: 'Grandfather (Maternal)' },
  maternalGrandmother: { script: 'பாட்டி', transliteration: 'Pāṭṭi', english: 'Grandmother (Maternal)' },
  grandfather:         { script: 'தாத்தா', transliteration: 'Tāttā', english: 'Grandfather' },
  grandmother:         { script: 'பாட்டி', transliteration: 'Pāṭṭi', english: 'Grandmother' },

  greatGrandfather: { script: 'கொள்ளுத் தாத்தா', transliteration: 'Koḷḷu Tāttā', english: 'Great-Grandfather' },
  greatGrandmother: { script: 'கொள்ளுப் பாட்டி',  transliteration: 'Koḷḷu Pāṭṭi', english: 'Great-Grandmother' },
  ancestor:         { script: 'முன்னோர்',           transliteration: 'Muṉṉōr',      english: 'Ancestor' },

  fathersOlderBrother:   { script: 'பெரியப்பா', transliteration: 'Periyappā', english: "Father's Older Brother" },
  fathersYoungerBrother: { script: 'சித்தப்பா', transliteration: 'Chittappā', english: "Father's Younger Brother" },
  fathersBrother:        { script: 'சித்தப்பா', transliteration: 'Chittappā', english: "Father's Brother" },
  fathersSister:         { script: 'அத்தை',     transliteration: 'Attai',     english: "Father's Sister" },
  mothersBrother:        { script: 'மாமா',       transliteration: 'Māmā',      english: "Mother's Brother" },
  mothersOlderSister:    { script: 'அத்தை',     transliteration: 'Attai',     english: "Mother's Older Sister" },
  mothersYoungerSister:  { script: 'சித்தி',    transliteration: 'Chitti',    english: "Mother's Younger Sister" },
  mothersSister:         { script: 'சித்தி',    transliteration: 'Chitti',    english: "Mother's Sister" },

  fathersBrotherWife:   { script: 'சித்தி / பெரியம்மா', transliteration: 'Chitti / Periyammā',    english: "Father's Brother's Wife" },
  fathersSisterHusband: { script: 'மாமா',                 transliteration: 'Māmā',                  english: "Father's Sister's Husband" },
  mothersBrotherWife:   { script: 'அத்தை',                transliteration: 'Attai',                 english: "Mother's Brother's Wife" },
  mothersSisterHusband: { script: 'சித்தப்பா / பெரியப்பா', transliteration: 'Chittappā / Periyappā', english: "Mother's Sister's Husband" },

  husband: { script: 'கணவன்',   transliteration: 'Kaṇavan',  english: 'Husband' },
  wife:    { script: 'மனைவி',   transliteration: 'Maṉaivi',  english: 'Wife' },
  spouse:  { script: 'துணைவர்', transliteration: 'Tuṇaivar', english: 'Spouse' },

  son:      { script: 'மகன்',    transliteration: 'Makaṉ',    english: 'Son' },
  daughter: { script: 'மகள்',    transliteration: 'Makaḷ',    english: 'Daughter' },
  child:    { script: 'குழந்தை', transliteration: 'Kuḻantai', english: 'Child' },

  stepSon:      { script: 'வளர்ப்பு மகன்', transliteration: 'Valarpu Makaṉ', english: 'Step-Son' },
  stepDaughter: { script: 'வளர்ப்பு மகள்', transliteration: 'Valarpu Makaḷ', english: 'Step-Daughter' },

  grandson:      { script: 'பேரன்',         transliteration: 'Pēraṉ',        english: 'Grandson' },
  granddaughter: { script: 'பேத்தி',        transliteration: 'Pētti',        english: 'Granddaughter' },
  grandchild:    { script: 'பேர்க்குழந்தை', transliteration: 'Pērkkuḻantai', english: 'Grandchild' },

  greatGrandson:      { script: 'கொள்ளுப் பேரன்',  transliteration: 'Koḷḷu Pēraṉ', english: 'Great-Grandson' },
  greatGranddaughter: { script: 'கொள்ளுப் பேத்தி', transliteration: 'Koḷḷu Pētti',  english: 'Great-Granddaughter' },

  fatherInLaw: { script: 'மாமனார்',  transliteration: 'Māmaṉār', english: 'Father-in-law' },
  motherInLaw: { script: 'மாமியார்', transliteration: 'Māmiyār', english: 'Mother-in-law' },

  sonInLaw:      { script: 'மாப்பிள்ளை', transliteration: 'Māppiḷḷai', english: 'Son-in-law' },
  daughterInLaw: { script: 'மருமகள்',    transliteration: 'Marumakaḷ', english: 'Daughter-in-law' },

  nephew: { script: 'மருமகன்', transliteration: 'Marumakaṉ', english: 'Nephew' },
  niece:  { script: 'மருமகள்', transliteration: 'Marumakaḷ', english: 'Niece' },

  brotherInLaw: { script: 'மைத்துனன்', transliteration: 'Maittūnaṉ', english: 'Brother-in-law' },
  sisterInLaw:  { script: 'நாத்தனார்', transliteration: 'Nāttanār',  english: 'Sister-in-law' },

  cousin: { script: 'உறவினர் குழந்தை', transliteration: 'Uṟaviṉar Kuḻantai', english: 'Cousin' },

  relative: { script: 'உறவினர்', transliteration: 'Uṟaviṉar', english: 'Relative' },
};

const ENGLISH_TITLES = Object.fromEntries(
  Object.entries(TAMIL_TITLES).map(([k, v]) => [k, { english: v.english }])
);

export const CULTURE_TITLES = { TAMIL: TAMIL_TITLES, ENGLISH: ENGLISH_TITLES };

// ---------------------------------------------------------------------------
// Step 1 — Build a rich adjacency structure
// Returns { map, biologicalMap }
//   map[id] = { person, parents: [{id, isBiological}], children: [id], spouses: [id] }
//   biologicalMap['parentId:childId'] = boolean
// ---------------------------------------------------------------------------
export function buildAdjacencyMap(people, relationships) {
  const map = {};
  const biologicalMap = {};

  for (const p of people) {
    map[p.id] = { person: p, parents: [], children: [], spouses: [] };
  }

  for (const rel of relationships) {
    const { fromPersonId: f, toPersonId: t, type, isBiological = true } = rel;
    if (!map[f] || !map[t]) continue;

    switch (type) {
      case 'PARENT':
        // f is parent of t
        if (!map[f].children.includes(t)) map[f].children.push(t);
        if (!map[t].parents.find((p) => p.id === f)) map[t].parents.push({ id: f, isBiological });
        biologicalMap[`${f}:${t}`] = isBiological;
        break;
      case 'CHILD':
        // f is child of t → t is parent of f
        if (!map[t].children.includes(f)) map[t].children.push(f);
        if (!map[f].parents.find((p) => p.id === t)) map[f].parents.push({ id: t, isBiological });
        biologicalMap[`${t}:${f}`] = isBiological;
        break;
      case 'SPOUSE':
        if (!map[f].spouses.includes(t)) map[f].spouses.push(t);
        if (!map[t].spouses.includes(f)) map[t].spouses.push(f);
        break;
    }
  }

  return { map, biologicalMap };
}

// ---------------------------------------------------------------------------
// Step 2 — BFS with path tracking (max 6 hops)
// Returns Map<personId, pathString>
// pathString is dot-joined edge types e.g. "parent.parent.child"
// ---------------------------------------------------------------------------
const MAX_HOPS = 6;

export function findShortestPaths(perspectiveId, adjacency) {
  const pathMap = new Map();
  const visited = new Set([perspectiveId]);
  const queue   = [{ id: perspectiveId, path: '', depth: 0 }];

  pathMap.set(perspectiveId, 'self');

  while (queue.length > 0) {
    const { id, path, depth } = queue.shift();
    if (depth >= MAX_HOPS) continue;

    const node = adjacency[id];
    if (!node) continue;

    const enqueue = (neighborId, edgeType) => {
      if (visited.has(neighborId)) return;
      visited.add(neighborId);
      const newPath = path === '' ? edgeType : `${path}.${edgeType}`;
      pathMap.set(neighborId, newPath);
      queue.push({ id: neighborId, path: newPath, depth: depth + 1 });
    };

    node.parents.forEach((p) => enqueue(p.id, 'parent'));
    node.children.forEach((cId) => enqueue(cId, 'child'));
    node.spouses.forEach((sId) => enqueue(sId, 'spouse'));
  }

  return pathMap;
}

// ---------------------------------------------------------------------------
// Step 3 — Derive siblings via shared parents (post-BFS)
// Overrides any longer BFS path with the canonical 'sibling' path.
// Shorter/more-specific paths (parent, child, spouse) are never overridden.
// ---------------------------------------------------------------------------
function deriveSiblings(perspectiveId, adjacency, pathMap) {
  const perspParentIds = adjacency[perspectiveId]?.parents.map((p) => p.id) ?? [];
  if (perspParentIds.length === 0) return;

  for (const [candidateId] of pathMap) {
    if (candidateId === perspectiveId) continue;
    const currentPath = pathMap.get(candidateId);
    // Never override 1-hop relationships (parent, child, spouse)
    if (currentPath === 'parent' || currentPath === 'child' || currentPath === 'spouse') continue;

    const candidateParentIds = adjacency[candidateId]?.parents.map((p) => p.id) ?? [];
    const hasSharedParent = perspParentIds.some((id) => candidateParentIds.includes(id));
    if (hasSharedParent) {
      pathMap.set(candidateId, 'sibling');
    }
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Derive niece/nephew and sibling-in-law (post-BFS)
// Only fills in entries not already present with a specific path.
// ---------------------------------------------------------------------------
function deriveExtended(perspectiveId, adjacency, pathMap) {
  // For each person we know is a sibling, their children are niece/nephew
  // and their spouses are sibling-in-law.
  for (const [personId, path] of pathMap) {
    if (path !== 'sibling') continue;
    const sibNode = adjacency[personId];
    if (!sibNode) continue;

    // Sibling's children → niece / nephew
    for (const childId of sibNode.children) {
      if (!pathMap.has(childId)) {
        pathMap.set(childId, 'sibling.child');
      }
    }
    // Sibling's spouses → sibling-in-law
    for (const spouseId of sibNode.spouses) {
      if (!pathMap.has(spouseId)) {
        pathMap.set(spouseId, 'sibling.spouse');
      }
    }
  }

  // For each child's spouse's siblings → also reachable
  for (const [personId, path] of pathMap) {
    if (path !== 'child') continue;
    const childNode = adjacency[personId];
    if (!childNode) continue;
    for (const spouseId of childNode.spouses) {
      const spouseNode = adjacency[spouseId];
      if (!spouseNode) continue;
      if (!pathMap.has(spouseId)) {
        pathMap.set(spouseId, 'child.spouse');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Derive a title key from a path string + target person gender
// ---------------------------------------------------------------------------
export function deriveTitleKey(path, targetPerson, perspectivePerson, adjacency, biologicalMap) {
  const gender = targetPerson?.gender;

  switch (path) {
    // ── 1 hop ─────────────────────────────────────────────────────────────
    case 'parent': {
      // Find isBiological for this parent edge
      const perspId = perspectivePerson?.id;
      const parentId = targetPerson?.id;
      const isBio = biologicalMap[`${parentId}:${perspId}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepFather' : gender === 'FEMALE' ? 'stepMother' : 'relative';
      return gender === 'MALE' ? 'father' : gender === 'FEMALE' ? 'mother' : 'parent';
    }
    case 'child': {
      const perspId = perspectivePerson?.id;
      const childId = targetPerson?.id;
      const isBio = biologicalMap[`${perspId}:${childId}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepSon' : gender === 'FEMALE' ? 'stepDaughter' : 'relative';
      return gender === 'MALE' ? 'son' : gender === 'FEMALE' ? 'daughter' : 'child';
    }
    case 'spouse':
      return gender === 'MALE' ? 'husband' : gender === 'FEMALE' ? 'wife' : 'spouse';

    // ── Derived sibling ────────────────────────────────────────────────────
    case 'sibling':
      return siblingKey(perspectivePerson, targetPerson);

    // ── 2 hops ────────────────────────────────────────────────────────────
    case 'parent.parent': {
      // Need to know which parent is the bridge to determine paternal/maternal
      const perspParents = adjacency[perspectivePerson?.id]?.parents ?? [];
      // We can't know which parent is the bridge from just the path string,
      // so use a generic grandparent key (paternal/maternal is best-effort via gender)
      return grandparentKeyByGender(gender);
    }
    case 'parent.spouse':
      // Parent's spouse = step-parent figure (treated as father/mother)
      return gender === 'MALE' ? 'father' : gender === 'FEMALE' ? 'mother' : 'parent';
    case 'parent.child':
      // Reached via BFS — likely a sibling (same parent); use sibling key
      return siblingKey(perspectivePerson, targetPerson);
    case 'child.child':
      return gender === 'MALE' ? 'grandson' : gender === 'FEMALE' ? 'granddaughter' : 'grandchild';
    case 'child.spouse':
      return gender === 'MALE' ? 'sonInLaw' : gender === 'FEMALE' ? 'daughterInLaw' : 'relative';
    case 'spouse.parent':
      return gender === 'MALE' ? 'fatherInLaw' : gender === 'FEMALE' ? 'motherInLaw' : 'relative';
    case 'spouse.child':
      // Spouse's child without explicit parent edge = step-child context
      return 'relative';

    // ── 3 hops ────────────────────────────────────────────────────────────
    case 'parent.parent.parent':
      return gender === 'MALE' ? 'greatGrandfather' : gender === 'FEMALE' ? 'greatGrandmother' : 'ancestor';
    case 'parent.parent.spouse':
      // Grandparent's spouse = the other grandparent (KEY FIX)
      return grandparentKeyByGender(gender);
    case 'parent.parent.child':
      // Uncle / aunt — path via grandparent's other child; can't reliably know
      // which parent is the bridge here so fall back to generic uncle/aunt key
      return gender === 'MALE' ? 'fathersBrother' : gender === 'FEMALE' ? 'fathersSister' : 'relative';
    case 'parent.spouse.parent':
      return gender === 'MALE' ? 'fatherInLaw' : gender === 'FEMALE' ? 'motherInLaw' : 'relative';
    case 'parent.child.child':
      return gender === 'MALE' ? 'nephew' : gender === 'FEMALE' ? 'niece' : 'relative';
    case 'parent.child.spouse':
      return gender === 'MALE' ? 'brotherInLaw' : gender === 'FEMALE' ? 'sisterInLaw' : 'relative';
    case 'sibling.child':
      return gender === 'MALE' ? 'nephew' : gender === 'FEMALE' ? 'niece' : 'relative';
    case 'sibling.spouse':
      return gender === 'MALE' ? 'brotherInLaw' : gender === 'FEMALE' ? 'sisterInLaw' : 'relative';
    case 'child.child.child':
      return gender === 'MALE' ? 'greatGrandson' : gender === 'FEMALE' ? 'greatGranddaughter' : 'relative';
    case 'spouse.parent.child':
      return gender === 'MALE' ? 'brotherInLaw' : gender === 'FEMALE' ? 'sisterInLaw' : 'relative';
    case 'spouse.parent.parent':
      return gender === 'MALE' ? 'grandfather' : gender === 'FEMALE' ? 'grandmother' : 'relative';
    case 'spouse.parent.spouse':
      return gender === 'MALE' ? 'fatherInLaw' : gender === 'FEMALE' ? 'motherInLaw' : 'relative';

    // ── 4 hops ────────────────────────────────────────────────────────────
    case 'parent.parent.parent.parent':
    case 'parent.parent.parent.spouse':
    case 'parent.parent.spouse.parent':
      return 'ancestor';
    case 'parent.parent.child.child':
      return 'cousin';
    case 'parent.parent.child.spouse':
      return 'relative';

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function grandparentKeyByGender(gender) {
  if (gender === 'MALE')   return 'grandfather';
  if (gender === 'FEMALE') return 'grandmother';
  return 'ancestor';
}

function siblingKey(perspective, target) {
  if (!target) return 'relative';
  const pDob = perspective?.dob ? new Date(perspective.dob) : null;
  const tDob = target.dob       ? new Date(target.dob)      : null;
  // isOlder: target is older than perspective → target born before perspective
  const isOlder = pDob && tDob ? tDob < pDob : null;

  if (target.gender === 'MALE') {
    if (isOlder === null) return 'brother';
    return isOlder ? 'olderBrother' : 'youngerBrother';
  }
  if (target.gender === 'FEMALE') {
    if (isOlder === null) return 'sister';
    return isOlder ? 'olderSister' : 'youngerSister';
  }
  return 'relative';
}

// ---------------------------------------------------------------------------
// Main export
// Returns { [personId]: { kinshipKey: string | null, title: object | null } }
// ---------------------------------------------------------------------------
export function computeAllKinshipTitles(perspectiveId, people, relationships, culture) {
  const titleMap  = CULTURE_TITLES[culture] ?? ENGLISH_TITLES;
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const { map: adjacency, biologicalMap } = buildAdjacencyMap(people, relationships);
  const perspective = peopleMap.get(perspectiveId);

  if (!perspective) return {};

  // BFS
  const pathMap = findShortestPaths(perspectiveId, adjacency);

  // Post-BFS sibling derivation via shared parents
  deriveSiblings(perspectiveId, adjacency, pathMap);

  // Post-BFS extended derivation (niece/nephew, sibling-in-law)
  deriveExtended(perspectiveId, adjacency, pathMap);

  const result = {};

  for (const person of people) {
    if (person.id === perspectiveId) {
      result[person.id] = { kinshipKey: 'self', title: null };
      continue;
    }

    const path = pathMap.get(person.id);

    if (!path || path === 'self') {
      // Not reachable from perspective
      result[person.id] = { kinshipKey: null, title: null };
      continue;
    }

    const titleKey = deriveTitleKey(path, person, perspective, adjacency, biologicalMap);

    if (!titleKey) {
      // Reachable but path not specifically modelled → relative
      const title = titleMap['relative'] ?? null;
      result[person.id] = { kinshipKey: 'relative', title };
      continue;
    }

    const title = titleMap[titleKey] ?? null;
    result[person.id] = { kinshipKey: titleKey, title };
  }

  return result;
}
