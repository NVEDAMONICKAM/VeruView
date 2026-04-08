/**
 * kinship.js — Cultural kinship title calculator for VeruView
 *
 * Traverses the entire relationship graph via BFS from the perspective person,
 * deriving kinship titles for every reachable person — not just direct edges.
 * Siblings are derived from shared parents (no SIBLING edge required).
 *
 * HOW TO ADD A NEW CULTURE (e.g. Hindi, Telugu, Malayalam):
 *  1. Add a new entry to CULTURE_TITLES below with the same keys as TAMIL_TITLES.
 *  2. Add the new culture value to the Culture enum in schema.prisma.
 *  3. That's it — the kinship graph logic is culture-agnostic.
 */

// ---------------------------------------------------------------------------
// Tamil kinship title definitions (relative to perspective person)
// ---------------------------------------------------------------------------
const TAMIL_TITLES = {
  father:               { script: 'அப்பா',      transliteration: 'Appā',        english: 'Father' },
  mother:               { script: 'அம்மா',      transliteration: 'Ammā',        english: 'Mother' },

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

  grandson:             { script: 'பேரன்',         transliteration: 'Pēraṉ',       english: 'Grandson' },
  granddaughter:        { script: 'பேத்தி',        transliteration: 'Pētti',       english: 'Granddaughter' },
  grandchild:           { script: 'பேர்க்குழந்தை', transliteration: 'Pērkkuḻantai', english: 'Grandchild' },

  fatherInLaw:          { script: 'மாமனார்',       transliteration: 'Māmaṉār',     english: 'Father-in-law' },
  motherInLaw:          { script: 'மாமியார்',      transliteration: 'Māmiyār',     english: 'Mother-in-law' },

  sonInLaw:             { script: 'மாப்பிள்ளை',   transliteration: 'Māppiḷḷai',  english: 'Son-in-law' },
  daughterInLaw:        { script: 'மருமகள்',       transliteration: 'Marumakaḷ',  english: 'Daughter-in-law' },

  relative:             { script: 'உறவினர்',       transliteration: 'Uṟaviṉar',   english: 'Relative' },
};

// ---------------------------------------------------------------------------
// English-only title definitions
// ---------------------------------------------------------------------------
const ENGLISH_TITLES = {
  father:               { english: 'Father' },
  mother:               { english: 'Mother' },
  olderBrother:         { english: 'Older Brother' },
  youngerBrother:       { english: 'Younger Brother' },
  brother:              { english: 'Brother' },
  olderSister:          { english: 'Older Sister' },
  youngerSister:        { english: 'Younger Sister' },
  sister:               { english: 'Sister' },
  paternalGrandfather:  { english: 'Grandfather (Paternal)' },
  paternalGrandmother:  { english: 'Grandmother (Paternal)' },
  maternalGrandfather:  { english: 'Grandfather (Maternal)' },
  maternalGrandmother:  { english: 'Grandmother (Maternal)' },
  grandfather:          { english: 'Grandfather' },
  grandmother:          { english: 'Grandmother' },
  fathersOlderBrother:  { english: "Father's Older Brother" },
  fathersYoungerBrother:{ english: "Father's Younger Brother" },
  fathersBrother:       { english: "Father's Brother" },
  fathersSister:        { english: "Father's Sister" },
  mothersBrother:       { english: "Mother's Brother" },
  mothersOlderSister:   { english: "Mother's Older Sister" },
  mothersYoungerSister: { english: "Mother's Younger Sister" },
  mothersSister:        { english: "Mother's Sister" },
  husband:              { english: 'Husband' },
  wife:                 { english: 'Wife' },
  spouse:               { english: 'Spouse' },
  son:                  { english: 'Son' },
  daughter:             { english: 'Daughter' },
  child:                { english: 'Child' },
  grandson:             { english: 'Grandson' },
  granddaughter:        { english: 'Granddaughter' },
  grandchild:           { english: 'Grandchild' },
  fatherInLaw:          { english: 'Father-in-law' },
  motherInLaw:          { english: 'Mother-in-law' },
  sonInLaw:             { english: 'Son-in-law' },
  daughterInLaw:        { english: 'Daughter-in-law' },
  relative:             { english: 'Relative' },
};

const CULTURE_TITLES = {
  TAMIL:   TAMIL_TITLES,
  ENGLISH: ENGLISH_TITLES,
};

// ---------------------------------------------------------------------------
// Graph builder — SIBLING edges are ignored (siblings derived from shared parents)
// ---------------------------------------------------------------------------
function buildGraph(people, relationships) {
  const graph = {};

  for (const person of people) {
    graph[person.id] = { person, parents: [], children: [], spouses: [] };
  }

  for (const rel of relationships) {
    const { fromPersonId, toPersonId, type } = rel;
    const from = graph[fromPersonId];
    const to   = graph[toPersonId];
    if (!from || !to) continue;

    switch (type) {
      case 'PARENT':
        from.children.push(toPersonId);
        to.parents.push(fromPersonId);
        break;
      case 'CHILD':
        from.parents.push(toPersonId);
        to.children.push(fromPersonId);
        break;
      case 'SPOUSE':
        from.spouses.push(toPersonId);
        to.spouses.push(fromPersonId);
        break;
      // SIBLING edges deliberately ignored — derived from shared parents
    }
  }

  return graph;
}

// ---------------------------------------------------------------------------
// BFS kinship computation — derives titles for all reachable people
// ---------------------------------------------------------------------------
function computeKinshipBFS(graph, perspectiveId) {
  const result  = {};
  const assigned = new Set();

  const perspNode = graph[perspectiveId];
  if (!perspNode) return result;

  const perspPerson = perspNode.person;
  assigned.add(perspectiveId);
  result[perspectiveId] = 'self';

  // ── PASS 1: Immediate family ───────────────────────────────────────────────

  for (const parentId of perspNode.parents) {
    if (assigned.has(parentId)) continue;
    assigned.add(parentId);
    const p = graph[parentId]?.person;
    result[parentId] = p?.gender === 'MALE' ? 'father' : 'mother';
  }

  for (const childId of perspNode.children) {
    if (assigned.has(childId)) continue;
    assigned.add(childId);
    const p = graph[childId]?.person;
    result[childId] = p?.gender === 'MALE' ? 'son'
                    : p?.gender === 'FEMALE' ? 'daughter' : 'child';
  }

  for (const spouseId of perspNode.spouses) {
    if (assigned.has(spouseId)) continue;
    assigned.add(spouseId);
    const p = graph[spouseId]?.person;
    result[spouseId] = p?.gender === 'MALE' ? 'husband'
                     : p?.gender === 'FEMALE' ? 'wife' : 'spouse';
  }

  // Siblings: derived from shared parents (no SIBLING edge needed)
  for (const parentId of perspNode.parents) {
    const parentNode = graph[parentId];
    if (!parentNode) continue;
    for (const sibId of parentNode.children) {
      if (sibId === perspectiveId || assigned.has(sibId)) continue;
      assigned.add(sibId);
      result[sibId] = siblingKey(perspPerson, graph[sibId]?.person);
    }
  }

  // ── PASS 2: Two-hop relatives ──────────────────────────────────────────────

  // Grandparents (via each parent)
  for (const parentId of perspNode.parents) {
    const parentNode = graph[parentId];
    if (!parentNode) continue;
    const parentPerson = parentNode.person;
    for (const gpId of parentNode.parents) {
      if (assigned.has(gpId)) continue;
      assigned.add(gpId);
      result[gpId] = grandparentKey(parentPerson, graph[gpId]?.person);
    }
  }

  // In-laws (via each spouse's parents)
  for (const spouseId of perspNode.spouses) {
    const spouseNode = graph[spouseId];
    if (!spouseNode) continue;
    for (const ilId of spouseNode.parents) {
      if (assigned.has(ilId)) continue;
      assigned.add(ilId);
      const p = graph[ilId]?.person;
      result[ilId] = p?.gender === 'MALE' ? 'fatherInLaw' : 'motherInLaw';
    }
  }

  // Grandchildren (via each child's children)
  for (const childId of perspNode.children) {
    const childNode = graph[childId];
    if (!childNode) continue;
    for (const gcId of childNode.children) {
      if (assigned.has(gcId)) continue;
      assigned.add(gcId);
      const p = graph[gcId]?.person;
      result[gcId] = p?.gender === 'MALE' ? 'grandson'
                   : p?.gender === 'FEMALE' ? 'granddaughter' : 'grandchild';
    }
  }

  // Children's spouses (son/daughter-in-law)
  for (const childId of perspNode.children) {
    const childNode = graph[childId];
    if (!childNode) continue;
    for (const csId of childNode.spouses) {
      if (assigned.has(csId)) continue;
      assigned.add(csId);
      const p = graph[csId]?.person;
      result[csId] = p?.gender === 'MALE' ? 'sonInLaw'
                   : p?.gender === 'FEMALE' ? 'daughterInLaw' : 'relative';
    }
  }

  // ── PASS 3: Three-hop relatives ────────────────────────────────────────────

  // Uncles / Aunts: perspective's parent → grandparent → grandparent's other children
  for (const parentId of perspNode.parents) {
    const parentNode = graph[parentId];
    if (!parentNode) continue;
    const parentPerson = parentNode.person;
    for (const gpId of parentNode.parents) {
      const gpNode = graph[gpId];
      if (!gpNode) continue;
      for (const uncleAuntId of gpNode.children) {
        if (uncleAuntId === parentId || assigned.has(uncleAuntId)) continue;
        assigned.add(uncleAuntId);
        const key = parentSiblingKey(parentPerson, graph[uncleAuntId]?.person);
        if (key) result[uncleAuntId] = key;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Full reachability BFS — used for 'relative' fallback
// ---------------------------------------------------------------------------
function findReachable(graph, startId) {
  const reachable = new Set();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = graph[id];
    if (!node) continue;
    for (const nId of [...node.parents, ...node.children, ...node.spouses]) {
      if (!reachable.has(nId)) queue.push(nId);
    }
  }
  return reachable;
}

// ---------------------------------------------------------------------------
// Helper: sibling key with older/younger distinction via DOB
// ---------------------------------------------------------------------------
function siblingKey(perspective, target) {
  if (!target) return 'relative';
  const pDob = perspective?.dob ? new Date(perspective.dob) : null;
  const tDob = target.dob      ? new Date(target.dob)      : null;
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
// Helper: grandparent key (paternal vs maternal based on parent's gender)
// ---------------------------------------------------------------------------
function grandparentKey(parent, grandparent) {
  if (!grandparent) return 'relative';
  const isPaternalLine = parent?.gender === 'MALE';
  if (grandparent.gender === 'MALE') {
    return isPaternalLine ? 'paternalGrandfather' : 'maternalGrandfather';
  }
  if (grandparent.gender === 'FEMALE') {
    return isPaternalLine ? 'paternalGrandmother' : 'maternalGrandmother';
  }
  return isPaternalLine ? 'grandfather' : 'grandmother';
}

// ---------------------------------------------------------------------------
// Helper: uncle/aunt key based on which parent's side and relative age
// ---------------------------------------------------------------------------
function parentSiblingKey(parent, sibling) {
  if (!sibling) return null;

  if (parent?.gender === 'MALE') {
    if (sibling.gender === 'MALE') {
      const fDob = parent.dob  ? new Date(parent.dob)  : null;
      const sDob = sibling.dob ? new Date(sibling.dob) : null;
      const isOlderThanFather = fDob && sDob ? sDob < fDob : null;
      if (isOlderThanFather === null) return 'fathersBrother';
      return isOlderThanFather ? 'fathersOlderBrother' : 'fathersYoungerBrother';
    }
    return 'fathersSister';
  }

  if (parent?.gender === 'FEMALE') {
    if (sibling.gender === 'MALE') return 'mothersBrother';
    if (sibling.gender === 'FEMALE') {
      const mDob = parent.dob  ? new Date(parent.dob)  : null;
      const sDob = sibling.dob ? new Date(sibling.dob) : null;
      const isOlderThanMother = mDob && sDob ? sDob < mDob : null;
      if (isOlderThanMother === null) return 'mothersSister';
      return isOlderThanMother ? 'mothersOlderSister' : 'mothersYoungerSister';
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main export: compute all kinship titles for a tree given a perspective person
// ---------------------------------------------------------------------------
function computeKinship(people, relationships, perspectiveId, culture, titleOverrides = []) {
  const graph = buildGraph(people, relationships);

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

  const titleMap    = CULTURE_TITLES[culture] || ENGLISH_TITLES;
  const kinshipMap  = computeKinshipBFS(graph, perspectiveId);
  const reachable   = findReachable(graph, perspectiveId);
  const result      = {};

  for (const person of people) {
    if (person.id === perspectiveId) {
      result[person.id] = { kinshipKey: 'self', title: null };
      continue;
    }

    const key = kinshipMap[person.id];

    if (!key) {
      // Reachable but path not modelled → 'relative' fallback
      if (reachable.has(person.id)) {
        const title = overrideMap['relative'] || titleMap['relative'] || null;
        result[person.id] = { kinshipKey: 'relative', title };
      } else {
        result[person.id] = { kinshipKey: null, title: null };
      }
      continue;
    }

    const title = overrideMap[key] || titleMap[key] || null;
    result[person.id] = { kinshipKey: key, title };
  }

  return result;
}

module.exports = { computeKinship, buildGraph, CULTURE_TITLES };
