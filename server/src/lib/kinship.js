/**
 * kinship.js — Cultural kinship title calculator for VeruView
 *
 * Given a "perspective" person and all people+relationships in a tree,
 * this module returns a kinship key for each person (e.g. "father", "olderSister")
 * and then maps that key to a culture-specific display title.
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
  father:               { script: 'அப்பா',      transliteration: 'Appā',       english: 'Father' },
  mother:               { script: 'அம்மா',      transliteration: 'Ammā',       english: 'Mother' },

  olderBrother:         { script: 'அண்ணன்',     transliteration: 'Aṇṇan',      english: 'Older Brother' },
  youngerBrother:       { script: 'தம்பி',       transliteration: 'Tambi',      english: 'Younger Brother' },
  brother:              { script: 'சகோதரன்',     transliteration: 'Sakōtaran',  english: 'Brother' }, // fallback when DOB unknown
  olderSister:          { script: 'அக்கா',       transliteration: 'Akkā',       english: 'Older Sister' },
  youngerSister:        { script: 'தங்கை',       transliteration: 'Taṅkai',     english: 'Younger Sister' },
  sister:               { script: 'சகோதரி',      transliteration: 'Sakōtari',   english: 'Sister' },  // fallback

  // Paternal grandparents
  paternalGrandfather:  { script: 'தாத்தா',      transliteration: 'Tāttā',      english: 'Grandfather (Paternal)' },
  paternalGrandmother:  { script: 'பாட்டி',       transliteration: 'Pāṭṭi',      english: 'Grandmother (Paternal)' },
  // Maternal grandparents
  maternalGrandfather:  { script: 'தாத்தா',      transliteration: 'Tāttā',      english: 'Grandfather (Maternal)' },
  maternalGrandmother:  { script: 'பாட்டி',       transliteration: 'Pāṭṭi',      english: 'Grandmother (Maternal)' },
  grandfather:          { script: 'தாத்தா',      transliteration: 'Tāttā',      english: 'Grandfather' }, // fallback
  grandmother:          { script: 'பாட்டி',       transliteration: 'Pāṭṭi',      english: 'Grandmother' }, // fallback

  // Father's siblings
  fathersOlderBrother:  { script: 'பெரியப்பா',   transliteration: 'Periyappā',  english: "Father's Older Brother" },
  fathersYoungerBrother:{ script: 'சித்தப்பா',   transliteration: 'Chittappā',  english: "Father's Younger Brother" },
  fathersBrother:       { script: 'சித்தப்பா',   transliteration: 'Chittappā',  english: "Father's Brother" }, // fallback
  fathersSister:        { script: 'அத்தை',       transliteration: 'Attai',      english: "Father's Sister" },

  // Mother's siblings
  mothersBrother:       { script: 'மாமா',         transliteration: 'Māmā',       english: "Mother's Brother" },
  mothersOlderSister:   { script: 'அத்தை',       transliteration: 'Attai',      english: "Mother's Older Sister" },
  mothersYoungerSister: { script: 'சித்தி',       transliteration: 'Chitti',     english: "Mother's Younger Sister" },
  mothersSister:        { script: 'சித்தி',       transliteration: 'Chitti',     english: "Mother's Sister" }, // fallback

  // Spouse
  husband:              { script: 'கணவன்',        transliteration: 'Kaṇavan',    english: 'Husband' },
  wife:                 { script: 'மனைவி',        transliteration: 'Maṉaivi',    english: 'Wife' },
  spouse:               { script: 'துணைவர்',      transliteration: 'Tuṇaivar',   english: 'Spouse' }, // fallback

  // Children
  son:                  { script: 'மகன்',         transliteration: 'Makaṉ',      english: 'Son' },
  daughter:             { script: 'மகள்',          transliteration: 'Makaḷ',      english: 'Daughter' },
  child:                { script: 'குழந்தை',       transliteration: 'Kuḻantai',   english: 'Child' }, // fallback

  // Grandchildren
  grandson:             { script: 'பேரன்',         transliteration: 'Pēraṉ',      english: 'Grandson' },
  granddaughter:        { script: 'பேத்தி',        transliteration: 'Pētti',      english: 'Granddaughter' },

  // In-laws
  fatherInLaw:          { script: 'மாமனார்',       transliteration: 'Māmaṉār',    english: 'Father-in-law' },
  motherInLaw:          { script: 'மாமியார்',      transliteration: 'Māmiyār',    english: 'Mother-in-law' },
};

// ---------------------------------------------------------------------------
// English-only title definitions (just English labels, no script/transliteration)
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
  fatherInLaw:          { english: 'Father-in-law' },
  motherInLaw:          { english: 'Mother-in-law' },
};

// Registry of all supported cultures.
// To add a new culture, add its title map here using the same keys.
const CULTURE_TITLES = {
  TAMIL: TAMIL_TITLES,
  ENGLISH: ENGLISH_TITLES,
};

// ---------------------------------------------------------------------------
// Graph builder — converts flat DB arrays into adjacency structure
// ---------------------------------------------------------------------------
function buildGraph(people, relationships) {
  const graph = {};

  for (const person of people) {
    graph[person.id] = {
      person,
      parents: [],   // parent person IDs
      children: [],  // child person IDs
      spouses: [],   // spouse person IDs
      siblings: [],  // sibling person IDs
    };
  }

  for (const rel of relationships) {
    const { fromPersonId, toPersonId, type } = rel;
    const from = graph[fromPersonId];
    const to = graph[toPersonId];

    if (!from || !to) continue;

    switch (type) {
      case 'PARENT':
        // fromPerson IS A PARENT OF toPerson
        from.children.push(toPersonId);
        to.parents.push(fromPersonId);
        break;
      case 'CHILD':
        // fromPerson IS A CHILD OF toPerson
        from.parents.push(toPersonId);
        to.children.push(fromPersonId);
        break;
      case 'SPOUSE':
        from.spouses.push(toPersonId);
        to.spouses.push(fromPersonId);
        break;
      case 'SIBLING':
        from.siblings.push(toPersonId);
        to.siblings.push(fromPersonId);
        break;
    }
  }

  return graph;
}

// ---------------------------------------------------------------------------
// Kinship key calculator
// Returns a key like "father", "olderSister", "paternalGrandfather" etc.
// Returns null if relationship is too distant or unrecognised.
// Returns "self" for the perspective person themselves.
// ---------------------------------------------------------------------------
function getKinshipKey(graph, perspectiveId, targetId) {
  if (perspectiveId === targetId) return 'self';

  const pNode = graph[perspectiveId];
  const tNode = graph[targetId];
  if (!pNode || !tNode) return null;

  const pPerson = pNode.person;
  const tPerson = tNode.person;

  // ── DIRECT PARENT ──────────────────────────────────────────────────────────
  if (pNode.parents.includes(targetId)) {
    return tPerson.gender === 'MALE' ? 'father' : 'mother';
  }

  // ── DIRECT CHILD ───────────────────────────────────────────────────────────
  if (pNode.children.includes(targetId)) {
    if (tPerson.gender === 'MALE') return 'son';
    if (tPerson.gender === 'FEMALE') return 'daughter';
    return 'child';
  }

  // ── SPOUSE ─────────────────────────────────────────────────────────────────
  if (pNode.spouses.includes(targetId)) {
    if (tPerson.gender === 'MALE') return 'husband';
    if (tPerson.gender === 'FEMALE') return 'wife';
    return 'spouse';
  }

  // ── SIBLING ────────────────────────────────────────────────────────────────
  if (pNode.siblings.includes(targetId)) {
    return siblingKey(pPerson, tPerson);
  }

  // ── TWO-HOP RELATIONSHIPS (via parents) ────────────────────────────────────
  for (const parentId of pNode.parents) {
    const parentNode = graph[parentId];
    if (!parentNode) continue;
    const parentPerson = parentNode.person;

    // Grandparent (parent's parent)
    if (parentNode.parents.includes(targetId)) {
      return grandparentKey(parentPerson, tPerson);
    }

    // Uncle / Aunt (parent's sibling)
    if (parentNode.siblings.includes(targetId)) {
      return parentSiblingKey(parentPerson, tPerson);
    }
  }

  // ── IN-LAWS (spouse's parent) ──────────────────────────────────────────────
  for (const spouseId of pNode.spouses) {
    const spouseNode = graph[spouseId];
    if (!spouseNode) continue;

    if (spouseNode.parents.includes(targetId)) {
      return tPerson.gender === 'MALE' ? 'fatherInLaw' : 'motherInLaw';
    }
  }

  // ── GRANDCHILDREN (child's child) ──────────────────────────────────────────
  for (const childId of pNode.children) {
    const childNode = graph[childId];
    if (!childNode) continue;

    if (childNode.children.includes(targetId)) {
      if (tPerson.gender === 'MALE') return 'grandson';
      if (tPerson.gender === 'FEMALE') return 'granddaughter';
      return 'grandchild';
    }
  }

  return null; // relationship too distant or not modelled yet
}

// ---------------------------------------------------------------------------
// Helper: sibling key with older/younger distinction via DOB
// ---------------------------------------------------------------------------
function siblingKey(perspective, target) {
  const pDob = perspective.dob ? new Date(perspective.dob) : null;
  const tDob = target.dob ? new Date(target.dob) : null;

  // target is "older" if their date of birth is earlier than perspective's
  const isOlder = pDob && tDob ? tDob < pDob : null;

  if (target.gender === 'MALE') {
    if (isOlder === null) return 'brother';
    return isOlder ? 'olderBrother' : 'youngerBrother';
  }
  if (target.gender === 'FEMALE') {
    if (isOlder === null) return 'sister';
    return isOlder ? 'olderSister' : 'youngerSister';
  }
  return 'sibling';
}

// ---------------------------------------------------------------------------
// Helper: grandparent key (paternal vs maternal based on parent's gender)
// ---------------------------------------------------------------------------
function grandparentKey(parent, grandparent) {
  const isPaternalLine = parent.gender === 'MALE';
  if (grandparent.gender === 'MALE') {
    return isPaternalLine ? 'paternalGrandfather' : 'maternalGrandfather';
  }
  if (grandparent.gender === 'FEMALE') {
    return isPaternalLine ? 'paternalGrandmother' : 'maternalGrandmother';
  }
  return 'grandparent';
}

// ---------------------------------------------------------------------------
// Helper: uncle/aunt key based on which parent's side and relative age
// ---------------------------------------------------------------------------
function parentSiblingKey(parent, sibling) {
  if (parent.gender === 'MALE') {
    // Father's side
    if (sibling.gender === 'MALE') {
      // Is sibling older or younger than the father?
      const fDob = parent.dob ? new Date(parent.dob) : null;
      const sDob = sibling.dob ? new Date(sibling.dob) : null;
      const isOlderThanFather = fDob && sDob ? sDob < fDob : null;
      if (isOlderThanFather === null) return 'fathersBrother';
      return isOlderThanFather ? 'fathersOlderBrother' : 'fathersYoungerBrother';
    }
    return 'fathersSister';
  }

  if (parent.gender === 'FEMALE') {
    // Mother's side
    if (sibling.gender === 'MALE') return 'mothersBrother';
    if (sibling.gender === 'FEMALE') {
      const mDob = parent.dob ? new Date(parent.dob) : null;
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

  // Build override map: { [relationshipKey]: { script, transliteration, english } }
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

  const titleMap = CULTURE_TITLES[culture] || ENGLISH_TITLES;
  const result = {};

  for (const person of people) {
    const key = getKinshipKey(graph, perspectiveId, person.id);
    if (!key || key === 'self') {
      result[person.id] = { kinshipKey: key || null, title: null };
      continue;
    }

    // User overrides take priority
    const title = overrideMap[key] || titleMap[key] || null;
    result[person.id] = { kinshipKey: key, title };
  }

  return result;
}

module.exports = { computeKinship, getKinshipKey, buildGraph, CULTURE_TITLES };
