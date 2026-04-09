/**
 * kinship.js — Server-side kinship title calculator for VeruView (v2)
 *
 * Computes kinship titles for all people in a tree from a given perspective
 * person. Used for the shared (read-only) tree API endpoint.
 *
 * Algorithm:
 *  1. Build family map: parents / children / spouses per person
 *  2. BFS from perspective person tracking shortest dot-joined path string
 *  3. Post-BFS sibling derivation via shared parents
 *  4. Post-BFS niece/nephew + sibling-in-law derivation
 *  5. Map paths to title keys, apply culture titles + user overrides
 *
 * Relationship type semantics (DB schema):
 *   PARENT  : fromPersonId IS A PARENT OF toPersonId
 *   CHILD   : fromPersonId IS A CHILD OF toPersonId
 *   SPOUSE  : bidirectional
 *   SIBLING : ignored — siblings derived from shared parents
 *
 * HOW TO ADD A NEW CULTURE:
 *  1. Add an entry to CULTURE_TITLES with the same keys as TAMIL_TITLES.
 *  2. Add the value to the Culture enum in schema.prisma.
 */

// ---------------------------------------------------------------------------
// Tamil kinship title definitions
// ---------------------------------------------------------------------------
const TAMIL_TITLES = {
  father:               { script: 'அப்பா',      transliteration: 'Appā',        english: 'Father' },
  mother:               { script: 'அம்மா',      transliteration: 'Ammā',        english: 'Mother' },
  parent:               { script: 'பெற்றோர்',    transliteration: 'Peṯṯōr',      english: 'Parent' },

  stepFather:           { script: 'மாற்றானப்பன்', transliteration: 'Māṟṟāṉappaṉ', english: 'Step-Father' },
  stepMother:           { script: 'மாற்றாந்தாய்', transliteration: 'Māṟṟāntāy',   english: 'Step-Mother' },

  olderBrother:         { script: 'அண்ணன்',     transliteration: 'Aṇṇan',       english: 'Older Brother' },
  youngerBrother:       { script: 'தம்பி',       transliteration: 'Tambi',       english: 'Younger Brother' },
  brother:              { script: 'சகோதரன்',     transliteration: 'Sakōtaran',   english: 'Brother' },
  olderSister:          { script: 'அக்கா',       transliteration: 'Akkā',        english: 'Older Sister' },
  youngerSister:        { script: 'தங்கை',       transliteration: 'Taṅkai',      english: 'Younger Sister' },
  sister:               { script: 'சகோதரி',      transliteration: 'Sakōtari',    english: 'Sister' },

  paternalGrandfather:  { script: 'தாத்தா',      transliteration: 'Tāttā',       english: 'Grandfather (Paternal)' },
  paternalGrandmother:  { script: 'பாட்டி',       transliteration: 'Pāṭṭi',       english: 'Grandmother (Paternal)' },
  maternalGrandfather:  { script: 'தாத்தா',      transliteration: 'Tāttā',       english: 'Grandfather (Maternal)' },
  maternalGrandmother:  { script: 'பாட்டி',       transliteration: 'Pāṭṭi',       english: 'Grandmother (Maternal)' },
  grandfather:          { script: 'தாத்தா',      transliteration: 'Tāttā',       english: 'Grandfather' },
  grandmother:          { script: 'பாட்டி',       transliteration: 'Pāṭṭi',       english: 'Grandmother' },

  greatGrandfather:     { script: 'கொள்ளுத் தாத்தா', transliteration: 'Koḷḷu Tāttā', english: 'Great-Grandfather' },
  greatGrandmother:     { script: 'கொள்ளுப் பாட்டி',  transliteration: 'Koḷḷu Pāṭṭi', english: 'Great-Grandmother' },
  ancestor:             { script: 'முன்னோர்',        transliteration: 'Muṉṉōr',      english: 'Ancestor' },

  fathersOlderBrother:  { script: 'பெரியப்பா',   transliteration: 'Periyappā',   english: "Father's Older Brother" },
  fathersYoungerBrother:{ script: 'சித்தப்பா',   transliteration: 'Chittappā',   english: "Father's Younger Brother" },
  fathersBrother:       { script: 'சித்தப்பா',   transliteration: 'Chittappā',   english: "Father's Brother" },
  fathersSister:        { script: 'அத்தை',       transliteration: 'Attai',       english: "Father's Sister" },

  mothersBrother:       { script: 'மாமா',         transliteration: 'Māmā',        english: "Mother's Brother" },
  mothersOlderSister:   { script: 'அத்தை',       transliteration: 'Attai',       english: "Mother's Older Sister" },
  mothersYoungerSister: { script: 'சித்தி',       transliteration: 'Chitti',      english: "Mother's Younger Sister" },
  mothersSister:        { script: 'சித்தி',       transliteration: 'Chitti',      english: "Mother's Sister" },

  husband:              { script: 'கணவன்',        transliteration: 'Kaṇavan',     english: 'Husband' },
  wife:                 { script: 'மனைவி',        transliteration: 'Maṉaivi',     english: 'Wife' },
  spouse:               { script: 'துணைவர்',      transliteration: 'Tuṇaivar',    english: 'Spouse' },

  son:                  { script: 'மகன்',         transliteration: 'Makaṉ',       english: 'Son' },
  daughter:             { script: 'மகள்',          transliteration: 'Makaḷ',       english: 'Daughter' },
  child:                { script: 'குழந்தை',       transliteration: 'Kuḻantai',    english: 'Child' },

  stepSon:              { script: 'வளர்ப்பு மகன்', transliteration: 'Valarpu Makaṉ', english: 'Step-Son' },
  stepDaughter:         { script: 'வளர்ப்பு மகள்', transliteration: 'Valarpu Makaḷ', english: 'Step-Daughter' },

  grandson:             { script: 'பேரன்',         transliteration: 'Pēraṉ',       english: 'Grandson' },
  granddaughter:        { script: 'பேத்தி',        transliteration: 'Pētti',       english: 'Granddaughter' },
  grandchild:           { script: 'பேர்க்குழந்தை', transliteration: 'Pērkkuḻantai', english: 'Grandchild' },

  greatGrandson:        { script: 'கொள்ளுப் பேரன்',  transliteration: 'Koḷḷu Pēraṉ', english: 'Great-Grandson' },
  greatGranddaughter:   { script: 'கொள்ளுப் பேத்தி', transliteration: 'Koḷḷu Pētti',  english: 'Great-Granddaughter' },

  fatherInLaw:          { script: 'மாமனார்',       transliteration: 'Māmaṉār',     english: 'Father-in-law' },
  motherInLaw:          { script: 'மாமியார்',      transliteration: 'Māmiyār',     english: 'Mother-in-law' },

  sonInLaw:             { script: 'மாப்பிள்ளை',   transliteration: 'Māppiḷḷai',  english: 'Son-in-law' },
  daughterInLaw:        { script: 'மருமகள்',       transliteration: 'Marumakaḷ',  english: 'Daughter-in-law' },

  nephew:               { script: 'மருமகன்',       transliteration: 'Marumakaṉ',  english: 'Nephew' },
  niece:                { script: 'மருமகள்',       transliteration: 'Marumakaḷ',  english: 'Niece' },

  brotherInLaw:         { script: 'மைத்துனன்',    transliteration: 'Maittūnaṉ',  english: 'Brother-in-law' },
  sisterInLaw:          { script: 'நாத்தனார்',    transliteration: 'Nāttanār',   english: 'Sister-in-law' },

  cousin:               { script: 'உறவினர் குழந்தை', transliteration: 'Uṟaviṉar Kuḻantai', english: 'Cousin' },

  relative:             { script: 'உறவினர்',       transliteration: 'Uṟaviṉar',   english: 'Relative' },
};

const ENGLISH_TITLES = Object.fromEntries(
  Object.entries(TAMIL_TITLES).map(([k, v]) => [k, { english: v.english }])
);

const CULTURE_TITLES = { TAMIL: TAMIL_TITLES, ENGLISH: ENGLISH_TITLES };

// ---------------------------------------------------------------------------
// Step 1 — Build family map
// Returns { map, biologicalMap }
// ---------------------------------------------------------------------------
function buildGraph(people, relationships) {
  const map = {};
  const biologicalMap = {};

  for (const p of people) {
    map[p.id] = { person: p, parents: [], children: [], spouses: [] };
  }

  for (const rel of relationships) {
    const { fromPersonId: f, toPersonId: t, type, isBiological = true } = rel;
    const from = map[f];
    const to   = map[t];
    if (!from || !to) continue;

    switch (type) {
      case 'PARENT':
        if (!from.children.includes(t)) from.children.push(t);
        if (!to.parents.find((p) => p.id === f)) to.parents.push({ id: f, isBiological });
        biologicalMap[`${f}:${t}`] = isBiological;
        break;
      case 'CHILD':
        if (!to.children.includes(f)) to.children.push(f);
        if (!from.parents.find((p) => p.id === t)) from.parents.push({ id: t, isBiological });
        biologicalMap[`${t}:${f}`] = isBiological;
        break;
      case 'SPOUSE':
        if (!from.spouses.includes(t)) from.spouses.push(t);
        if (!to.spouses.includes(f))   to.spouses.push(f);
        break;
      // SIBLING deliberately ignored — derived from shared parents
    }
  }

  return { graph: map, biologicalMap };
}

// ---------------------------------------------------------------------------
// Step 2 — BFS with path tracking (max 6 hops)
// Returns Map<personId, pathString>
// ---------------------------------------------------------------------------
const MAX_HOPS = 6;

function bfsKinship(graph, perspectiveId) {
  const pathMap = new Map();
  const visited = new Set([perspectiveId]);
  const queue   = [{ id: perspectiveId, path: '', depth: 0 }];

  pathMap.set(perspectiveId, 'self');

  while (queue.length > 0) {
    const { id, path, depth } = queue.shift();
    if (depth >= MAX_HOPS) continue;

    const node = graph[id];
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
// Also detects step-siblings: candidate whose only parent is persp's parent's
// non-parent spouse (BUG C fix).
// ---------------------------------------------------------------------------
function deriveSiblings(perspectiveId, graph, pathMap) {
  const perspParents = graph[perspectiveId]?.parents ?? [];
  const perspParentIds = perspParents.map((p) => p.id);
  if (perspParentIds.length === 0) return;

  // Build set of persp's parents' spouses who are NOT also direct parents of persp
  const perspParentSet = new Set(perspParentIds);
  const parentSpouseIds = new Set();
  for (const { id: pId } of perspParents) {
    graph[pId]?.spouses.forEach((sId) => {
      if (!perspParentSet.has(sId)) parentSpouseIds.add(sId);
    });
  }

  for (const [candidateId] of pathMap) {
    if (candidateId === perspectiveId) continue;
    const currentPath = pathMap.get(candidateId);
    if (currentPath === 'parent' || currentPath === 'child' || currentPath === 'spouse') continue;

    const candidateParentIds = (graph[candidateId]?.parents ?? []).map((p) => p.id);

    // Check 1: shared direct parent
    const hasSharedParent = perspParentIds.some((id) => candidateParentIds.includes(id));
    if (hasSharedParent) { pathMap.set(candidateId, 'sibling'); continue; }

    // Check 2: candidate's parent is a non-parent spouse of persp's parent (step-sibling)
    const isStepSibling = candidateParentIds.some((id) => parentSpouseIds.has(id));
    if (isStepSibling) { pathMap.set(candidateId, 'sibling'); }
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Derive niece/nephew and sibling-in-law (post-BFS)
// ---------------------------------------------------------------------------
function deriveExtended(graph, pathMap) {
  for (const [personId, path] of pathMap) {
    if (path !== 'sibling') continue;
    const sibNode = graph[personId];
    if (!sibNode) continue;
    for (const childId of sibNode.children) {
      if (!pathMap.has(childId)) pathMap.set(childId, 'sibling.child');
    }
    for (const spouseId of sibNode.spouses) {
      if (!pathMap.has(spouseId)) pathMap.set(spouseId, 'sibling.spouse');
    }
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Title key from path string
// ---------------------------------------------------------------------------
function deriveTitleKey(path, targetPerson, perspectivePerson, biologicalMap, graph) {
  const gender = targetPerson?.gender;

  switch (path) {
    case 'parent': {
      const isBio = biologicalMap[`${targetPerson.id}:${perspectivePerson.id}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepFather' : gender === 'FEMALE' ? 'stepMother' : 'relative';
      return gender === 'MALE' ? 'father' : gender === 'FEMALE' ? 'mother' : 'parent';
    }
    case 'child': {
      const isBio = biologicalMap[`${perspectivePerson.id}:${targetPerson.id}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepSon' : gender === 'FEMALE' ? 'stepDaughter' : 'relative';
      return gender === 'MALE' ? 'son' : gender === 'FEMALE' ? 'daughter' : 'child';
    }
    case 'spouse':
      return gender === 'MALE' ? 'husband' : gender === 'FEMALE' ? 'wife' : 'spouse';

    case 'sibling':
      return siblingKey(perspectivePerson, targetPerson);

    case 'parent.parent': {
      // Determine paternal vs maternal by finding which of persp's parents has
      // targetPerson as their parent — that parent's gender tells us the side.
      const perspParents = graph[perspectivePerson?.id]?.parents ?? [];
      let bridgeGender = null;
      for (const { id: pId } of perspParents) {
        if (graph[pId]?.parents.some((gp) => gp.id === targetPerson.id)) {
          bridgeGender = graph[pId]?.person?.gender;
          break;
        }
      }
      if (gender === 'MALE')   return bridgeGender === 'MALE' ? 'paternalGrandfather' : bridgeGender === 'FEMALE' ? 'maternalGrandfather' : 'grandfather';
      if (gender === 'FEMALE') return bridgeGender === 'MALE' ? 'paternalGrandmother' : bridgeGender === 'FEMALE' ? 'maternalGrandmother' : 'grandmother';
      return 'ancestor';
    }
    case 'parent.spouse': {
      // If target is NOT a direct parent of persp → step-parent
      const perspParentIds = (graph[perspectivePerson?.id]?.parents ?? []).map((p) => p.id);
      if (!perspParentIds.includes(targetPerson.id)) {
        return gender === 'MALE' ? 'stepFather' : gender === 'FEMALE' ? 'stepMother' : 'relative';
      }
      const isBio = biologicalMap[`${targetPerson.id}:${perspectivePerson?.id}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepFather' : gender === 'FEMALE' ? 'stepMother' : 'relative';
      return gender === 'MALE' ? 'father' : gender === 'FEMALE' ? 'mother' : 'parent';
    }
    case 'parent.child':
      return siblingKey(perspectivePerson, targetPerson);
    case 'child.child':
      return gender === 'MALE' ? 'grandson' : gender === 'FEMALE' ? 'granddaughter' : 'grandchild';
    case 'child.spouse':
      return gender === 'MALE' ? 'sonInLaw' : gender === 'FEMALE' ? 'daughterInLaw' : 'relative';
    case 'spouse.parent':
      return gender === 'MALE' ? 'fatherInLaw' : gender === 'FEMALE' ? 'motherInLaw' : 'relative';
    case 'spouse.child':
      return 'relative';

    case 'parent.parent.parent':
      return gender === 'MALE' ? 'greatGrandfather' : gender === 'FEMALE' ? 'greatGrandmother' : 'ancestor';
    case 'parent.parent.spouse': {
      // Grandparent's spouse = the other grandparent — determine paternal/maternal
      const perspParents2 = graph[perspectivePerson?.id]?.parents ?? [];
      let bridgeGender2 = null;
      outer2: for (const { id: pId } of perspParents2) {
        for (const { id: gpId } of (graph[pId]?.parents ?? [])) {
          if (graph[gpId]?.spouses.includes(targetPerson.id)) {
            bridgeGender2 = graph[pId]?.person?.gender;
            break outer2;
          }
        }
      }
      if (gender === 'MALE')   return bridgeGender2 === 'MALE' ? 'paternalGrandfather' : bridgeGender2 === 'FEMALE' ? 'maternalGrandfather' : 'grandfather';
      if (gender === 'FEMALE') return bridgeGender2 === 'MALE' ? 'paternalGrandmother' : bridgeGender2 === 'FEMALE' ? 'maternalGrandmother' : 'grandmother';
      return 'ancestor';
    }
    case 'parent.parent.child': {
      // Uncle/aunt — find bridge parent to determine paternal/maternal and older/younger
      const perspParents3 = graph[perspectivePerson?.id]?.parents ?? [];
      let bridgePerson = null;
      outer3: for (const { id: pId } of perspParents3) {
        for (const { id: gpId } of (graph[pId]?.parents ?? [])) {
          if (graph[gpId]?.children.includes(targetPerson.id)) {
            bridgePerson = graph[pId]?.person;
            break outer3;
          }
        }
      }
      const bGender = bridgePerson?.gender;
      const bDob = bridgePerson?.dob ? new Date(bridgePerson.dob) : null;
      const tDob = targetPerson.dob  ? new Date(targetPerson.dob)  : null;
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

    case 'parent.parent.parent.parent':
    case 'parent.parent.parent.spouse':
    case 'parent.parent.spouse.parent':
      return 'ancestor';
    case 'parent.parent.child.child':
      return 'cousin';

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
  const tDob = target.dob      ? new Date(target.dob)       : null;
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
// Main export: compute all kinship titles for a tree
// Returns { [personId]: { kinshipKey: string | null, title: object | null } }
// ---------------------------------------------------------------------------
function computeKinship(people, relationships, perspectiveId, culture, titleOverrides = []) {
  const { graph, biologicalMap } = buildGraph(people, relationships);

  const overrideMap = {};
  for (const ov of titleOverrides) {
    if (ov.culture === culture) {
      overrideMap[ov.relationshipKey] = {
        script: ov.script,
        transliteration: ov.transliteration,
        english: ov.english,
      };
    }
  }

  const titleMap       = CULTURE_TITLES[culture] || ENGLISH_TITLES;
  const perspectivePerson = graph[perspectiveId]?.person;
  if (!perspectivePerson) return {};

  // BFS
  const pathMap = bfsKinship(graph, perspectiveId);

  // Post-BFS sibling derivation
  deriveSiblings(perspectiveId, graph, pathMap);

  // Post-BFS extended derivation
  deriveExtended(graph, pathMap);

  const result = {};

  for (const person of people) {
    if (person.id === perspectiveId) {
      result[person.id] = { kinshipKey: 'self', title: null };
      continue;
    }

    const path = pathMap.get(person.id);

    if (!path || path === 'self') {
      result[person.id] = { kinshipKey: null, title: null };
      continue;
    }

    const titleKey = deriveTitleKey(path, person, perspectivePerson, biologicalMap, graph);

    if (!titleKey) {
      // Reachable but not specifically modelled → relative
      const title = overrideMap['relative'] || titleMap['relative'] || null;
      result[person.id] = { kinshipKey: 'relative', title };
      continue;
    }

    const title = overrideMap[titleKey] || titleMap[titleKey] || null;
    result[person.id] = { kinshipKey: titleKey, title };
  }

  return result;
}

module.exports = { computeKinship, buildGraph, CULTURE_TITLES };
