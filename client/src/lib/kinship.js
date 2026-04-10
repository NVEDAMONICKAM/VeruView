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

  stepFather:   { script: 'மாற்றானப்பன்', transliteration: 'Māṟṟāṉappaṉ', english: 'Step-Father' },
  stepMother:   { script: 'மாற்றாந்தாய்', transliteration: 'Māṟṟāntāy',   english: 'Step-Mother' },
  stepBrother:  { script: 'அண்ணன்',       transliteration: 'Aṇṇan',       english: 'Step-brother' },
  stepSister:   { script: 'அக்கா',        transliteration: 'Akkā',         english: 'Step-sister' },

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
  grandUncle:       { script: 'தாத்தா',             transliteration: 'Tāttā',       english: 'Grand-uncle' },
  grandAunt:        { script: 'பாட்டி',              transliteration: 'Pāṭṭi',       english: 'Grand-aunt' },

  fathersOlderBrother:   { script: 'பெரியப்பா', transliteration: 'Periyappā', english: "Father's Older Brother" },
  fathersYoungerBrother: { script: 'சித்தப்பா', transliteration: 'Chittappā', english: "Father's Younger Brother" },
  fathersBrother:        { script: 'சித்தப்பா', transliteration: 'Chittappā', english: "Father's Brother" },
  fathersSister:         { script: 'அத்தை',     transliteration: 'Attai',     english: "Father's Sister" },
  mothersBrother:        { script: 'மாமா',       transliteration: 'Māmā',      english: "Mother's Brother" },
  mothersOlderSister:    { script: 'பெரியம்மா',  transliteration: 'Periyammā', english: "Mother's Older Sister" },
  mothersYoungerSister:  { script: 'சித்தி',    transliteration: 'Chitti',    english: "Mother's Younger Sister" },
  mothersSister:         { script: 'சித்தி',    transliteration: 'Chitti',    english: "Mother's Sister" },

  fathersBrotherWife:        { script: 'சித்தி / பெரியம்மா', transliteration: 'Chitti / Periyammā',    english: "Father's Brother's Wife" },
  fathersOlderBrotherWife:   { script: 'பெரியம்மா',          transliteration: 'Periyammā',             english: "Father's Older Brother's Wife" },
  fathersYoungerBrotherWife: { script: 'சித்தி',              transliteration: 'Chitti',                english: "Father's Younger Brother's Wife" },
  fathersSisterHusband:      { script: 'மாமா',                transliteration: 'Māmā',                  english: "Father's Sister's Husband" },
  mothersBrotherWife:        { script: 'மாமி',                transliteration: 'Māmi',                  english: "Mother's Brother's Wife" },
  mothersSisterHusband:      { script: 'சித்தப்பா / பெரியப்பா', transliteration: 'Chittappā / Periyappā', english: "Mother's Sister's Husband" },
  mothersOlderSisterHusband: { script: 'பெரியப்பா',           transliteration: 'Periyappā',             english: "Mother's Older Sister's Husband" },
  mothersYoungerSisterHusband:{ script: 'சித்தப்பா',          transliteration: 'Chittappā',             english: "Mother's Younger Sister's Husband" },

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

  crossCousinMale:      { script: 'அத்தான்',     transliteration: 'Attān',       english: 'Cross-cousin (male)' },
  crossCousinFemale:    { script: 'மச்சினி',     transliteration: 'Macciṉi',     english: 'Cross-cousin (female)' },
  parallelCousinMale:   { script: 'சித்தன்',     transliteration: 'Chittan',     english: 'Parallel Cousin (male)' },
  parallelCousinFemale: { script: 'சித்தி மகள்', transliteration: 'Chitti Makaḷ', english: 'Parallel Cousin (female)' },

  maternalGrandmotherAmmachi:  { script: 'அம்மாச்சி', transliteration: 'Ammācci', english: 'Grandmother (maternal)' },
  paternalGrandmotherAmmachi:  { script: 'அம்மாச்சி', transliteration: 'Ammācci', english: 'Grandmother (paternal)' },
  grandmotherAmmachi:          { script: 'அம்மாச்சி', transliteration: 'Ammācci', english: 'Grandmother' },

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
// Also detects step-siblings: candidate whose only parent is persp's parent's
// non-parent spouse (BUG C fix).
// ---------------------------------------------------------------------------
function deriveSiblings(perspectiveId, adjacency, pathMap) {
  const perspParents = adjacency[perspectiveId]?.parents ?? [];
  const perspParentIds = perspParents.map((p) => p.id);
  if (perspParentIds.length === 0) return;

  // Build set of persp's parents' spouses who are NOT also direct parents of persp
  const perspParentSet = new Set(perspParentIds);
  const parentSpouseIds = new Set();
  for (const { id: pId } of perspParents) {
    adjacency[pId]?.spouses.forEach((sId) => {
      if (!perspParentSet.has(sId)) parentSpouseIds.add(sId);
    });
  }

  for (const [candidateId] of pathMap) {
    if (candidateId === perspectiveId) continue;
    const currentPath = pathMap.get(candidateId);
    // Never override 1-hop relationships (parent, child, spouse)
    if (currentPath === 'parent' || currentPath === 'child' || currentPath === 'spouse') continue;

    const candidateParentIds = adjacency[candidateId]?.parents.map((p) => p.id) ?? [];

    // Check 1: shared direct parent (biological or half-sibling)
    const hasSharedParent = perspParentIds.some((id) => candidateParentIds.includes(id));
    if (hasSharedParent) { pathMap.set(candidateId, 'sibling'); continue; }

    // Check 2: candidate's parent is a non-parent spouse of persp's parent (step-sibling)
    const isStepSibling = candidateParentIds.some((id) => parentSpouseIds.has(id));
    if (isStepSibling) { pathMap.set(candidateId, 'step_sibling'); }
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
// Cousin resolver — determines cross vs parallel cousin from adjacency map
// ---------------------------------------------------------------------------
function resolveCousin(targetPerson, perspectivePerson, adjacency) {
  const perspParents = adjacency[perspectivePerson.id]?.parents ?? [];
  for (const { id: parentId } of perspParents) {
    const parentNode = adjacency[parentId];
    if (!parentNode) continue;
    for (const { id: gpId } of (parentNode.parents ?? [])) {
      const gpNode = adjacency[gpId];
      if (!gpNode) continue;
      for (const uaId of (gpNode.children ?? [])) {
        if (uaId === parentId) continue;
        const uaNode = adjacency[uaId];
        if (!uaNode) continue;
        if (uaNode.children.includes(targetPerson.id)) {
          const parentGender = parentNode.person.gender;
          const uaGender = uaNode.person.gender;
          const isCross = parentGender && uaGender &&
            parentGender !== 'OTHER' && uaGender !== 'OTHER' &&
            parentGender !== uaGender;
          const g = targetPerson.gender;
          if (isCross) return g === 'MALE' ? 'crossCousinMale' : g === 'FEMALE' ? 'crossCousinFemale' : 'relative';
          return g === 'MALE' ? 'parallelCousinMale' : g === 'FEMALE' ? 'parallelCousinFemale' : 'relative';
        }
      }
    }
  }
  return 'cousin';
}

// ---------------------------------------------------------------------------
// Step 5 — Derive a title key from a path string + target person gender
// ---------------------------------------------------------------------------
export function deriveTitleKey(path, targetPerson, perspectivePerson, adjacency, biologicalMap, treeSettings) {
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
      // Determine paternal vs maternal by finding which of persp's parents has
      // targetPerson as their parent — that parent's gender tells us the side.
      const perspParents = adjacency[perspectivePerson?.id]?.parents ?? [];
      let bridgeGender = null;
      for (const { id: pId } of perspParents) {
        if (adjacency[pId]?.parents.some((gp) => gp.id === targetPerson.id)) {
          bridgeGender = adjacency[pId]?.person?.gender;
          break;
        }
      }
      if (gender === 'MALE') return bridgeGender === 'MALE' ? 'paternalGrandfather' : bridgeGender === 'FEMALE' ? 'maternalGrandfather' : 'grandfather';
      if (gender === 'FEMALE') {
        const variant = treeSettings?.grandmotherVariant ?? 'PATTI_BOTH';
        if (variant === 'AMMACHI_BOTH') return bridgeGender === 'MALE' ? 'paternalGrandmotherAmmachi' : bridgeGender === 'FEMALE' ? 'maternalGrandmotherAmmachi' : 'grandmotherAmmachi';
        if (variant === 'PATTI_AMMACHI') return bridgeGender === 'FEMALE' ? 'maternalGrandmotherAmmachi' : bridgeGender === 'MALE' ? 'paternalGrandmother' : 'grandmother';
        return bridgeGender === 'MALE' ? 'paternalGrandmother' : bridgeGender === 'FEMALE' ? 'maternalGrandmother' : 'grandmother';
      }
      return 'ancestor';
    }
    case 'parent.spouse': {
      // If target is NOT a direct parent of persp → step-parent
      const perspParentIds = adjacency[perspectivePerson?.id]?.parents.map((p) => p.id) ?? [];
      if (!perspParentIds.includes(targetPerson.id)) {
        return gender === 'MALE' ? 'stepFather' : gender === 'FEMALE' ? 'stepMother' : 'relative';
      }
      // Edge case: target IS a parent (reached via sibling path) — check biological
      const isBio = biologicalMap[`${targetPerson.id}:${perspectivePerson?.id}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepFather' : gender === 'FEMALE' ? 'stepMother' : 'relative';
      return gender === 'MALE' ? 'father' : gender === 'FEMALE' ? 'mother' : 'parent';
    }
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
    case 'parent.parent.spouse': {
      // Grandparent's spouse = the other grandparent — determine paternal/maternal
      const perspParents2 = adjacency[perspectivePerson?.id]?.parents ?? [];
      let bridgeGender2 = null;
      outer2: for (const { id: pId } of perspParents2) {
        for (const { id: gpId } of (adjacency[pId]?.parents ?? [])) {
          if (adjacency[gpId]?.spouses.includes(targetPerson.id)) {
            bridgeGender2 = adjacency[pId]?.person?.gender;
            break outer2;
          }
        }
      }
      if (gender === 'MALE') return bridgeGender2 === 'MALE' ? 'paternalGrandfather' : bridgeGender2 === 'FEMALE' ? 'maternalGrandfather' : 'grandfather';
      if (gender === 'FEMALE') {
        const variant = treeSettings?.grandmotherVariant ?? 'PATTI_BOTH';
        if (variant === 'AMMACHI_BOTH') return bridgeGender2 === 'MALE' ? 'paternalGrandmotherAmmachi' : bridgeGender2 === 'FEMALE' ? 'maternalGrandmotherAmmachi' : 'grandmotherAmmachi';
        if (variant === 'PATTI_AMMACHI') return bridgeGender2 === 'FEMALE' ? 'maternalGrandmotherAmmachi' : bridgeGender2 === 'MALE' ? 'paternalGrandmother' : 'grandmother';
        return bridgeGender2 === 'MALE' ? 'paternalGrandmother' : bridgeGender2 === 'FEMALE' ? 'maternalGrandmother' : 'grandmother';
      }
      return 'ancestor';
    }
    case 'parent.parent.child': {
      // Uncle/aunt — find bridge parent to determine paternal/maternal and older/younger
      const perspParents3 = adjacency[perspectivePerson?.id]?.parents ?? [];
      let bridgePerson = null;
      outer3: for (const { id: pId } of perspParents3) {
        for (const { id: gpId } of (adjacency[pId]?.parents ?? [])) {
          if (adjacency[gpId]?.children.includes(targetPerson.id)) {
            bridgePerson = adjacency[pId]?.person;
            break outer3;
          }
        }
      }
      const bGender = bridgePerson?.gender;
      const bDob = bridgePerson?.dob ? new Date(bridgePerson.dob) : null;
      const tDob = targetPerson.dob  ? new Date(targetPerson.dob)  : null;
      // isOlder: target born before bridge parent → uncle/aunt is older
      const isOlderThanBridge = bDob && tDob ? tDob < bDob : null;
      if (bGender === 'MALE') {
        if (gender === 'MALE')   return isOlderThanBridge === null ? 'fathersBrother' : isOlderThanBridge ? 'fathersOlderBrother' : 'fathersYoungerBrother';
        if (gender === 'FEMALE') return 'fathersSister';
      }
      if (bGender === 'FEMALE') {
        if (gender === 'MALE')   return 'mothersBrother';
        if (gender === 'FEMALE') return isOlderThanBridge === null ? 'mothersSister' : isOlderThanBridge ? 'mothersOlderSister' : 'mothersYoungerSister';
      }
      return gender === 'MALE' ? 'fathersBrother' : gender === 'FEMALE' ? 'fathersSister' : 'relative';
    }
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
      return resolveCousin(targetPerson, perspectivePerson, adjacency);
    case 'parent.parent.child.spouse': {
      // targetPerson is the spouse of an uncle/aunt.
      // Navigate: find which uncle/aunt is targetPerson's spouse,
      // then find which of persp's parents is the bridge sibling of that uncle/aunt.
      const perspParentsUAS = adjacency[perspectivePerson?.id]?.parents ?? [];
      let uncleAuntPersonUAS = null;
      let bridgeParentUAS = null;
      outerUAS: for (const { id: pId } of perspParentsUAS) {
        for (const { id: gpId } of (adjacency[pId]?.parents ?? [])) {
          for (const uaId of (adjacency[gpId]?.children ?? [])) {
            if (uaId === pId) continue;
            if ((adjacency[uaId]?.spouses ?? []).includes(targetPerson.id)) {
              uncleAuntPersonUAS = adjacency[uaId]?.person;
              bridgeParentUAS    = adjacency[pId]?.person;
              break outerUAS;
            }
          }
        }
      }
      if (!uncleAuntPersonUAS || !bridgeParentUAS) return 'relative';
      const bGenderUAS = bridgeParentUAS.gender;
      const uGenderUAS = uncleAuntPersonUAS.gender;
      const bDobUAS = bridgeParentUAS.dob    ? new Date(bridgeParentUAS.dob)    : null;
      const uDobUAS = uncleAuntPersonUAS.dob ? new Date(uncleAuntPersonUAS.dob) : null;
      const uaIsOlder = bDobUAS && uDobUAS ? uDobUAS < bDobUAS : null;
      if (bGenderUAS === 'MALE') {
        if (uGenderUAS === 'MALE') {
          if (uaIsOlder === null) return 'fathersBrotherWife';
          return uaIsOlder ? 'fathersOlderBrotherWife' : 'fathersYoungerBrotherWife';
        }
        if (uGenderUAS === 'FEMALE') return 'fathersSisterHusband';
      }
      if (bGenderUAS === 'FEMALE') {
        if (uGenderUAS === 'MALE') return 'mothersBrotherWife';
        if (uGenderUAS === 'FEMALE') {
          if (uaIsOlder === null) return 'mothersSisterHusband';
          return uaIsOlder ? 'mothersOlderSisterHusband' : 'mothersYoungerSisterHusband';
        }
      }
      return 'relative';
    }

    // ── Step-sibling ──────────────────────────────────────────────────────────
    case 'step_sibling':
      return gender === 'MALE' ? 'stepBrother' : gender === 'FEMALE' ? 'stepSister' : 'relative';

    // ── Sibling-in-law extensions ──────────────────────────────────────────
    // sibling's spouse's children (brother-in-law's / sister-in-law's child)
    case 'parent.child.spouse.child':
      return gender === 'MALE' ? 'nephew' : gender === 'FEMALE' ? 'niece' : 'relative';
    // nephew's / niece's spouse
    case 'parent.child.child.spouse':
      return gender === 'MALE' ? 'nephew' : gender === 'FEMALE' ? 'niece' : 'relative';
    // sibling.child.spouse (same semantics, if reached via deriveExtended path)
    case 'sibling.child.spouse':
      return gender === 'MALE' ? 'nephew' : gender === 'FEMALE' ? 'niece' : 'relative';

    // ── Spouse's extended family ───────────────────────────────────────────
    // spouse's sibling's spouse
    case 'spouse.parent.child.spouse':
      return gender === 'MALE' ? 'brotherInLaw' : gender === 'FEMALE' ? 'sisterInLaw' : 'relative';
    // spouse's sibling's children
    case 'spouse.parent.child.child':
      return gender === 'MALE' ? 'nephew' : gender === 'FEMALE' ? 'niece' : 'relative';

    // ── Grand-uncle / Grand-aunt ───────────────────────────────────────────
    // grandparent's sibling (great-grandparent's other child)
    case 'parent.parent.parent.child':
      return gender === 'MALE' ? 'grandUncle' : gender === 'FEMALE' ? 'grandAunt' : 'relative';
    // grandparent's sibling's spouse
    case 'parent.parent.parent.child.spouse':
      return gender === 'MALE' ? 'grandUncle' : gender === 'FEMALE' ? 'grandAunt' : 'relative';

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
export function computeAllKinshipTitles(perspectiveId, people, relationships, culture, treeSettings = {}) {
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

    const titleKey = deriveTitleKey(path, person, perspective, adjacency, biologicalMap, treeSettings);

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
