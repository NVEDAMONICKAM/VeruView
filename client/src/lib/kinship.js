/**
 * kinship.js — Client-side kinship title calculator for VeruView
 *
 * Pure module (no side-effects, no imports). Computes kinship titles for all
 * people in a tree from a given perspective person.
 *
 * Algorithm: BFS from perspective person, tracking path types
 * ['parent','child','spouse'] for the shortest path to each reachable person.
 * Pattern-matches on pathTypes.join(',') to derive a title key.
 *
 * Key facts:
 *  - SIBLING edges are ignored; siblings are derived from shared parents
 *  - Grandparent's spouse is treated as a grandparent (the "GP spouse bug fix")
 *    pathTypes ['parent','parent','spouse'] → grandfather / grandmother
 *  - Max BFS depth: 5 hops
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

  // Aunt/Uncle spouses (Tamil cross-kinship equivalences)
  fathersBrotherWife:   { script: 'சித்தி / பெரியம்மா', transliteration: 'Chitti / Periyammā',   english: "Father's Brother's Wife" },
  fathersSisterHusband: { script: 'மாமா',                 transliteration: 'Māmā',                 english: "Father's Sister's Husband" },
  mothersBrotherWife:   { script: 'அத்தை',                transliteration: 'Attai',                english: "Mother's Brother's Wife" },
  mothersSisterHusband: { script: 'சித்தப்பா / பெரியப்பா', transliteration: 'Chittappā / Periyappā', english: "Mother's Sister's Husband" },

  husband: { script: 'கணவன்',   transliteration: 'Kaṇavan',  english: 'Husband' },
  wife:    { script: 'மனைவி',   transliteration: 'Maṉaivi',  english: 'Wife' },
  spouse:  { script: 'துணைவர்', transliteration: 'Tuṇaivar', english: 'Spouse' },

  son:      { script: 'மகன்',    transliteration: 'Makaṉ',    english: 'Son' },
  daughter: { script: 'மகள்',    transliteration: 'Makaḷ',    english: 'Daughter' },
  child:    { script: 'குழந்தை', transliteration: 'Kuḻantai', english: 'Child' },

  stepSon:      { script: 'வளர்ப்பு மகன்', transliteration: 'Valarpu Makaṉ', english: 'Step-Son' },
  stepDaughter: { script: 'வளர்ப்பு மகள்', transliteration: 'Valarpu Makaḷ', english: 'Step-Daughter' },

  grandson:      { script: 'பேரன்',          transliteration: 'Pēraṉ',         english: 'Grandson' },
  granddaughter: { script: 'பேத்தி',         transliteration: 'Pētti',         english: 'Granddaughter' },
  grandchild:    { script: 'பேர்க்குழந்தை',  transliteration: 'Pērkkuḻantai',  english: 'Grandchild' },

  greatGrandson:      { script: 'கொள்ளுப் பேரன்',  transliteration: 'Koḷḷu Pēraṉ',  english: 'Great-Grandson' },
  greatGranddaughter: { script: 'கொள்ளுப் பேத்தி', transliteration: 'Koḷḷu Pētti',  english: 'Great-Granddaughter' },

  fatherInLaw: { script: 'மாமனார்',  transliteration: 'Māmaṉār',  english: 'Father-in-law' },
  motherInLaw: { script: 'மாமியார்', transliteration: 'Māmiyār',  english: 'Mother-in-law' },

  sonInLaw:      { script: 'மாப்பிள்ளை', transliteration: 'Māppiḷḷai', english: 'Son-in-law' },
  daughterInLaw: { script: 'மருமகள்',    transliteration: 'Marumakaḷ', english: 'Daughter-in-law' },

  // In Tamil, மருமகன்/மருமகள் historically = nephew/niece (cross-cousin marriage context)
  nephew: { script: 'மருமகன்', transliteration: 'Marumakaṉ', english: 'Nephew' },
  niece:  { script: 'மருமகள்', transliteration: 'Marumakaḷ', english: 'Niece' },

  brotherInLaw: { script: 'மைத்துனன்',  transliteration: 'Maittūnaṉ', english: 'Brother-in-law' },
  sisterInLaw:  { script: 'நாத்தனார்',  transliteration: 'Nāttanār',  english: 'Sister-in-law' },

  cousin: { script: 'உறவினர் குழந்தை', transliteration: 'Uṟaviṉar Kuḻantai', english: 'Cousin' },

  relative: { script: 'உறவினர்', transliteration: 'Uṟaviṉar', english: 'Relative' },
};

// ---------------------------------------------------------------------------
// English title definitions (auto-derived from Tamil map)
// ---------------------------------------------------------------------------
const ENGLISH_TITLES = Object.fromEntries(
  Object.entries(TAMIL_TITLES).map(([k, v]) => [k, { english: v.english }])
);

export const CULTURE_TITLES = { TAMIL: TAMIL_TITLES, ENGLISH: ENGLISH_TITLES };

// ---------------------------------------------------------------------------
// Build adjacency map
// SIBLING edges are intentionally ignored — siblings derived from shared parents
// ---------------------------------------------------------------------------
export function buildAdjacencyMap(people, relationships) {
  const map = {};
  // biologicalMap: `${parentId}:${childId}` → boolean
  // true = biological, false = step-parent (only meaningful for PARENT/CHILD edges)
  const biologicalMap = {};

  for (const p of people) {
    map[p.id] = { parents: [], children: [], spouses: [] };
  }
  for (const rel of relationships) {
    const { fromPersonId: f, toPersonId: t, type, isBiological = true } = rel;
    if (!map[f] || !map[t]) continue;
    switch (type) {
      case 'PARENT':
        if (!map[f].children.includes(t)) map[f].children.push(t);
        if (!map[t].parents.includes(f))  map[t].parents.push(f);
        biologicalMap[`${f}:${t}`] = isBiological; // parent:child
        break;
      case 'CHILD':
        if (!map[f].parents.includes(t))  map[f].parents.push(t);
        if (!map[t].children.includes(f)) map[t].children.push(f);
        biologicalMap[`${t}:${f}`] = isBiological; // parent:child
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
// BFS — returns Map<personId, { pathTypes: string[], path: string[] }>
// path[0] = perspectiveId, path[last] = that person
// pathTypes[i] = relationship type from path[i] to path[i+1]
// adjacency here is the `map` object from buildAdjacencyMap (not the full {map,biologicalMap})
// ---------------------------------------------------------------------------
const MAX_HOPS = 5;

export function findShortestPaths(perspectiveId, adjacency) {
  const paths   = new Map();
  const visited = new Set([perspectiveId]);
  const queue   = [{ id: perspectiveId, pathTypes: [], path: [perspectiveId] }];

  while (queue.length > 0) {
    const { id, pathTypes, path } = queue.shift();
    if (pathTypes.length >= MAX_HOPS) continue;

    const node = adjacency[id];
    if (!node) continue;

    const enqueue = (neighborId, type) => {
      if (visited.has(neighborId)) return;
      visited.add(neighborId);
      const newPathTypes = [...pathTypes, type];
      const newPath = [...path, neighborId];
      paths.set(neighborId, { pathTypes: newPathTypes, path: newPath });
      queue.push({ id: neighborId, pathTypes: newPathTypes, path: newPath });
    };

    node.parents.forEach((nId) => enqueue(nId, 'parent'));
    node.children.forEach((nId) => enqueue(nId, 'child'));
    node.spouses.forEach((nId) => enqueue(nId, 'spouse'));
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Pattern-match pathTypes → title key
// ---------------------------------------------------------------------------
// biologicalMap: `${parentId}:${childId}` → boolean (true = biological)
// path[0] = perspectiveId, so for a `parent` hop: parentId=path[1], childId=path[0]
// For a `child` hop: parentId=path[0], childId=path[1]
export function deriveTitleKey(pathTypes, path, targetPerson, perspectivePerson, peopleMap, biologicalMap = {}) {
  const pattern = pathTypes.join(',');
  const gender  = targetPerson?.gender;

  switch (pattern) {
    // ── 1 hop ─────────────────────────────────────────────────────────────────
    case 'parent': {
      // path = [perspectiveId, parentId]
      const isBio = biologicalMap[`${path[1]}:${path[0]}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepFather' : gender === 'FEMALE' ? 'stepMother' : 'relative';
      return gender === 'MALE' ? 'father' : gender === 'FEMALE' ? 'mother' : 'parent';
    }
    case 'child': {
      // path = [perspectiveId, childId]
      const isBio = biologicalMap[`${path[0]}:${path[1]}`] !== false;
      if (!isBio) return gender === 'MALE' ? 'stepSon' : gender === 'FEMALE' ? 'stepDaughter' : 'relative';
      return gender === 'MALE' ? 'son' : gender === 'FEMALE' ? 'daughter' : 'child';
    }
    case 'spouse':
      return gender === 'MALE' ? 'husband' : gender === 'FEMALE' ? 'wife' : 'spouse';

    // ── 2 hops ────────────────────────────────────────────────────────────────
    case 'parent,parent': {
      const parent = peopleMap.get(path[1]);
      return grandparentKey(parent, targetPerson);
    }
    case 'parent,spouse':
      // Parent's spouse with no direct parent relationship to perspective → relative
      // (step-parent status is only assigned via explicit isBiological=false on a PARENT edge)
      return 'relative';
    case 'parent,child':
      return siblingKey(perspectivePerson, targetPerson);
    case 'child,child':
      return gender === 'MALE' ? 'grandson' : gender === 'FEMALE' ? 'granddaughter' : 'grandchild';
    case 'child,spouse':
      return gender === 'MALE' ? 'sonInLaw' : gender === 'FEMALE' ? 'daughterInLaw' : 'relative';
    case 'spouse,parent':
      return gender === 'MALE' ? 'fatherInLaw' : gender === 'FEMALE' ? 'motherInLaw' : 'relative';
    case 'spouse,child':
      // Spouse's child with no direct PARENT relationship to perspective → relative
      // (if a PARENT/CHILD edge with isBiological=false exists, the 1-hop `child` path wins)
      return 'relative';

    // ── 3 hops ────────────────────────────────────────────────────────────────
    case 'parent,parent,parent':
      return gender === 'MALE' ? 'greatGrandfather' : gender === 'FEMALE' ? 'greatGrandmother' : 'ancestor';
    case 'parent,parent,spouse': {
      // Grandparent's spouse = the other grandparent — THE BUG FIX
      // path: [persp, parent, grandparent, grandparent's spouse]
      const parent = peopleMap.get(path[1]);
      return grandparentKey(parent, targetPerson);
    }
    case 'parent,parent,child': {
      // Uncle / aunt
      const parent = peopleMap.get(path[1]);
      return parentSiblingKey(parent, targetPerson) ?? 'relative';
    }
    case 'parent,child,child':
      return gender === 'MALE' ? 'nephew' : gender === 'FEMALE' ? 'niece' : 'relative';
    case 'parent,child,spouse': {
      // Sibling's spouse → brother/sister in-law
      const sibling = peopleMap.get(path[2]);
      return siblingInLawKey(sibling, targetPerson);
    }
    case 'child,child,child':
      return gender === 'MALE' ? 'greatGrandson' : gender === 'FEMALE' ? 'greatGranddaughter' : 'relative';
    case 'spouse,parent,child':
      // Spouse's sibling → brother/sister in-law
      return gender === 'MALE' ? 'brotherInLaw' : gender === 'FEMALE' ? 'sisterInLaw' : 'relative';
    case 'spouse,parent,parent':
      return gender === 'MALE' ? 'grandfather' : gender === 'FEMALE' ? 'grandmother' : 'relative';

    // ── 4 hops ────────────────────────────────────────────────────────────────
    case 'parent,parent,parent,parent':
    case 'parent,parent,parent,spouse':
      return 'ancestor';
    case 'parent,parent,child,child':
      return 'cousin';
    case 'parent,parent,child,spouse': {
      // Uncle/aunt's spouse
      // path: [persp, parent, grandparent, uncle/aunt, uncle/aunt's spouse]
      const parent   = peopleMap.get(path[1]);
      const uncleAunt = peopleMap.get(path[3]);
      return uncleAuntSpouseKey(parent, uncleAunt);
    }
    case 'child,child,child,child':
      return 'relative';

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
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

function siblingKey(perspective, target) {
  if (!target) return 'relative';
  const pDob = perspective?.dob ? new Date(perspective.dob) : null;
  const tDob = target.dob       ? new Date(target.dob)      : null;
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

function parentSiblingKey(parent, sibling) {
  if (!sibling || !parent) return null;
  if (parent.gender === 'MALE') {
    if (sibling.gender === 'MALE') {
      const fDob = parent.dob  ? new Date(parent.dob)  : null;
      const sDob = sibling.dob ? new Date(sibling.dob) : null;
      const isOlderThanParent = fDob && sDob ? sDob < fDob : null;
      if (isOlderThanParent === null) return 'fathersBrother';
      return isOlderThanParent ? 'fathersOlderBrother' : 'fathersYoungerBrother';
    }
    return 'fathersSister';
  }
  if (parent.gender === 'FEMALE') {
    if (sibling.gender === 'MALE') return 'mothersBrother';
    if (sibling.gender === 'FEMALE') {
      const mDob = parent.dob  ? new Date(parent.dob)  : null;
      const sDob = sibling.dob ? new Date(sibling.dob) : null;
      const isOlderThanParent = mDob && sDob ? sDob < mDob : null;
      if (isOlderThanParent === null) return 'mothersSister';
      return isOlderThanParent ? 'mothersOlderSister' : 'mothersYoungerSister';
    }
  }
  return null;
}

function siblingInLawKey(sibling, target) {
  if (!sibling) return target?.gender === 'MALE' ? 'brotherInLaw' : 'sisterInLaw';
  // Brother's spouse = sister-in-law; Sister's spouse = brother-in-law
  if (sibling.gender === 'MALE')   return 'sisterInLaw';
  if (sibling.gender === 'FEMALE') return 'brotherInLaw';
  return target?.gender === 'MALE' ? 'brotherInLaw' : 'sisterInLaw';
}

function uncleAuntSpouseKey(parent, uncleAunt) {
  if (!parent || !uncleAunt) return 'relative';
  if (parent.gender === 'MALE') {
    return uncleAunt.gender === 'MALE' ? 'fathersBrotherWife' : 'fathersSisterHusband';
  }
  if (parent.gender === 'FEMALE') {
    return uncleAunt.gender === 'MALE' ? 'mothersBrotherWife' : 'mothersSisterHusband';
  }
  return 'relative';
}

// ---------------------------------------------------------------------------
// Main export
// Returns: { [personId]: { kinshipKey: string | null, title: object | null } }
// ---------------------------------------------------------------------------
export function computeAllKinshipTitles(perspectiveId, people, relationships, culture) {
  const titleMap    = CULTURE_TITLES[culture] ?? ENGLISH_TITLES;
  const peopleMap   = new Map(people.map((p) => [p.id, p]));
  const { map: adjacency, biologicalMap } = buildAdjacencyMap(people, relationships);
  const perspective = peopleMap.get(perspectiveId);

  if (!perspective) return {};

  const shortestPaths = findShortestPaths(perspectiveId, adjacency);
  const result = {};

  for (const person of people) {
    if (person.id === perspectiveId) {
      result[person.id] = { kinshipKey: 'self', title: null };
      continue;
    }

    const pathData = shortestPaths.get(person.id);
    if (!pathData) {
      result[person.id] = { kinshipKey: null, title: null };
      continue;
    }

    const { pathTypes, path } = pathData;
    const titleKey = deriveTitleKey(pathTypes, path, person, perspective, peopleMap, biologicalMap);

    if (!titleKey) {
      const title = titleMap['relative'] ?? null;
      result[person.id] = { kinshipKey: 'relative', title };
      continue;
    }

    const title = titleMap[titleKey] ?? null;
    result[person.id] = { kinshipKey: titleKey, title };
  }

  return result;
}
