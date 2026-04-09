import { describe, it, expect } from 'vitest';
import { computeAllKinshipTitles } from './kinship';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function p(id, name, gender, dob = null) {
  return { id, name, gender, dob };
}

function rel(id, fromPersonId, toPersonId, type) {
  return { id, fromPersonId, toPersonId, type };
}

function key(result, personId) {
  return result[personId]?.kinshipKey ?? null;
}

// ---------------------------------------------------------------------------
// Fixture: a small family tree
//
//   GGF ─── GGM  (great-grandparents, paternal)
//        |
//   GPF ─── GPM  (grandparents, paternal)
//        |
//    F ──┬── M   (parents; M's side: MGPF ─ MGPM → MB, MS)
//        |
//   Persp ─── SP  (perspective person + spouse)
//        |
//     S1(M)  S2(F)  (children)
//
//   Persp also has sibling SIB (older, male)
// ---------------------------------------------------------------------------
const people = [
  p('persp', 'Perspective', 'MALE',   '1990-01-01'),
  p('sp',    'Spouse',      'FEMALE', '1992-03-15'),
  p('f',     'Father',      'MALE',   '1960-05-10'),
  p('m',     'Mother',      'FEMALE', '1963-07-20'),
  p('gpf',   'Pat.GrandFa', 'MALE',   '1930-02-01'),
  p('gpm',   'Pat.GrandMa', 'FEMALE', '1932-04-01'),
  p('mgpf',  'Mat.GrandFa', 'MALE',   '1928-06-01'),
  p('mgpm',  'Mat.GrandMa', 'FEMALE', '1930-09-01'),
  p('ggf',   'GreatGrandFa','MALE',   '1900-01-01'),
  p('ggm',   'GreatGrandMa','FEMALE', '1902-01-01'),
  p('sib',   'OlderBrother','MALE',   '1985-03-01'), // older than persp
  p('sib2',  'YoungSister', 'FEMALE', '1995-06-01'), // younger than persp
  p('s1',    'Son',         'MALE',   '2015-01-01'),
  p('s2',    'Daughter',    'FEMALE', '2018-01-01'),
  p('uncle', 'PatUncle',    'MALE',   '1958-01-01'), // father's older brother
  p('aunt',  'MatAunt',     'FEMALE', '1961-01-01'), // mother's older sister
  p('flaw',  'FatherInLaw', 'MALE',   '1960-01-01'),
  p('mlaw',  'MotherInLaw', 'FEMALE', '1962-01-01'),
  p('silh',  'SibInLaw',    'MALE',   '1983-01-01'), // sib2's husband → brother-in-law
  p('cspouse','ChildSpouse','FEMALE',  '2013-01-01'), // s1's wife → daughter-in-law
  p('cousin', 'Cousin',     'MALE',   '1991-01-01'),
  p('stepf',  'StepFather', 'MALE',   '1955-01-01'), // mother's spouse (after father, hypothetically)
  p('nephew', 'Nephew',     'MALE',   '2010-01-01'), // sib's son
];

const rels = [
  // Grandparents (paternal)
  rel('r1',  'gpf',  'f',     'PARENT'),
  rel('r2',  'gpm',  'f',     'PARENT'),
  rel('r3',  'gpf',  'gpm',   'SPOUSE'),
  // Great-grandparents (paternal)
  rel('r4',  'ggf',  'gpf',   'PARENT'),
  rel('r5',  'ggm',  'gpf',   'PARENT'),
  // Grandparents (maternal)
  rel('r6',  'mgpf', 'm',     'PARENT'),
  rel('r7',  'mgpm', 'm',     'PARENT'),
  // Parents
  rel('r8',  'f',    'persp', 'PARENT'),
  rel('r9',  'm',    'persp', 'PARENT'),
  rel('r10', 'f',    'm',     'SPOUSE'),
  // Spouse + in-laws
  rel('r11', 'persp','sp',    'SPOUSE'),
  rel('r12', 'flaw', 'sp',    'PARENT'),
  rel('r13', 'mlaw', 'sp',    'PARENT'),
  // Children
  rel('r14', 'persp','s1',    'PARENT'),
  rel('r15', 'persp','s2',    'PARENT'),
  // Sibling (shared parent f/m → sib)
  rel('r16', 'f',    'sib',   'PARENT'),
  rel('r17', 'm',    'sib',   'PARENT'),
  rel('r18', 'f',    'sib2',  'PARENT'),
  rel('r19', 'm',    'sib2',  'PARENT'),
  // Uncle (father's OLDER brother — born 1958 vs father born 1960)
  rel('r20', 'gpf',  'uncle', 'PARENT'),
  // Aunt (mother's sister)
  rel('r21', 'mgpf', 'aunt',  'PARENT'),
  rel('r22', 'mgpm', 'aunt',  'PARENT'),
  // sibling-in-law: sib2's husband
  rel('r23', 'sib2', 'silh',  'SPOUSE'),
  // child's spouse: s1's wife
  rel('r24', 's1',   'cspouse','SPOUSE'),
  // cousin: uncle's child
  rel('r25', 'uncle','cousin','PARENT'),
  // stepfather: m's other spouse (hypothetical)
  rel('r26', 'm',    'stepf', 'SPOUSE'),
  // nephew: sib's son
  rel('r27', 'sib',  'nephew','PARENT'),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('computeAllKinshipTitles', () => {
  const result = computeAllKinshipTitles('persp', people, rels, 'ENGLISH');

  it('self has kinshipKey "self" and null title', () => {
    expect(result['persp'].kinshipKey).toBe('self');
    expect(result['persp'].title).toBeNull();
  });

  it('identifies father correctly', () => {
    expect(key(result, 'f')).toBe('father');
  });

  it('identifies mother correctly', () => {
    expect(key(result, 'm')).toBe('mother');
  });

  it('identifies husband / wife', () => {
    expect(key(result, 'sp')).toBe('wife');
  });

  it('identifies son and daughter', () => {
    expect(key(result, 's1')).toBe('son');
    expect(key(result, 's2')).toBe('daughter');
  });

  it('identifies older and younger siblings by DOB', () => {
    expect(key(result, 'sib')).toBe('olderBrother');   // born 1985 < persp 1990
    expect(key(result, 'sib2')).toBe('youngerSister'); // born 1995 > persp 1990
  });

  it('identifies paternal grandparents', () => {
    expect(key(result, 'gpf')).toBe('paternalGrandfather');
    expect(key(result, 'gpm')).toBe('paternalGrandmother');
  });

  it('identifies maternal grandparents', () => {
    expect(key(result, 'mgpf')).toBe('maternalGrandfather');
    expect(key(result, 'mgpm')).toBe('maternalGrandmother');
  });

  it('BUG FIX — grandparent spouse treated as grandparent, NOT step-parent', () => {
    // ggm is gpf's spouse (great-grandmother). gpf → gpm SPOUSE relationship.
    // Already covered above (gpm is paternal grandmother via SPOUSE edge).
    // Test: gpm is reached via persp→f→gpf→gpm (parent,parent,spouse) → paternalGrandmother
    expect(key(result, 'gpm')).toBe('paternalGrandmother');
  });

  it('identifies great-grandparents', () => {
    expect(key(result, 'ggf')).toBe('greatGrandfather');
    expect(key(result, 'ggm')).toBe('greatGrandmother');
  });

  it("identifies father's older brother as fathersOlderBrother", () => {
    // uncle born 1958, father born 1960 → uncle is older
    expect(key(result, 'uncle')).toBe('fathersOlderBrother');
  });

  it("identifies mother's sister", () => {
    // aunt via mgpf/mgpm → maternal side
    expect(key(result, 'aunt')).toBe('mothersOlderSister'); // born 1961 vs mother 1963 → older
  });

  it('identifies father-in-law and mother-in-law', () => {
    expect(key(result, 'flaw')).toBe('fatherInLaw');
    expect(key(result, 'mlaw')).toBe('motherInLaw');
  });

  it('identifies son-in-law and daughter-in-law', () => {
    expect(key(result, 'cspouse')).toBe('daughterInLaw');
  });

  it('identifies sibling\'s spouse as in-law (sister\'s husband → brotherInLaw)', () => {
    expect(key(result, 'silh')).toBe('brotherInLaw');
  });

  it('identifies cousin (parent,parent,child,child)', () => {
    expect(key(result, 'cousin')).toBe('cousin');
  });

  it('identifies step-parent (parent\'s spouse who is not a parent)', () => {
    expect(key(result, 'stepf')).toBe('stepFather');
  });

  it('identifies nephew (sibling\'s child)', () => {
    expect(key(result, 'nephew')).toBe('nephew');
  });

  it('returns null for unconnected person', () => {
    const isolated = [...people, p('iso', 'Isolated', 'MALE')];
    const r2 = computeAllKinshipTitles('persp', isolated, rels, 'ENGLISH');
    expect(key(r2, 'iso')).toBeNull();
  });

  it('returns Tamil script for TAMIL culture', () => {
    const tamil = computeAllKinshipTitles('persp', people, rels, 'TAMIL');
    expect(tamil['f'].title?.script).toBe('அப்பா');
    expect(tamil['m'].title?.script).toBe('அம்மா');
    expect(tamil['gpf'].title?.script).toBe('தாத்தா');
    expect(tamil['gpm'].title?.script).toBe('பாட்டி');
  });

  it('handles empty people array without crashing', () => {
    const r = computeAllKinshipTitles('persp', [], [], 'ENGLISH');
    expect(r).toEqual({});
  });

  it('handles unknown perspectiveId without crashing', () => {
    const r = computeAllKinshipTitles('nobody', people, rels, 'ENGLISH');
    expect(r).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 4-person minimal family — focuses on step-parent and BUG-C (step-sibling
// detection via parent-spouse chain)
//
//   PAPA ─┬─ MAMA
//   (PARENT)KID   STEP(PARENT)
//
//  KID's only parent is PAPA; STEP's only parent is MAMA.
//  PAPA ↔ MAMA are spouses.
//  From KID's perspective: MAMA = step-mother, STEP = older step-sister.
// ---------------------------------------------------------------------------
describe('4-person minimal family (step-parent + step-sibling BUG C)', () => {
  const papa = p('papa', 'Papa', 'MALE',   '1960-01-01');
  const mama = p('mama', 'Mama', 'FEMALE', '1965-01-01');
  const kid  = p('kid',  'Kid',  'MALE',   '1990-01-01');
  const step = p('step', 'Step', 'FEMALE', '1988-06-01'); // older than kid

  const people4 = [papa, mama, kid, step];
  const rels4 = [
    rel('x1', 'papa', 'kid',  'PARENT'),
    rel('x2', 'mama', 'step', 'PARENT'),
    rel('x3', 'papa', 'mama', 'SPOUSE'),
  ];

  const r4 = computeAllKinshipTitles('kid', people4, rels4, 'ENGLISH');

  it('4p: identifies biological father', () => {
    expect(key(r4, 'papa')).toBe('father');
  });

  it('4p: step-mother — parent\'s spouse who is NOT a direct parent', () => {
    expect(key(r4, 'mama')).toBe('stepMother');
  });

  it('4p: BUG C — step-sibling detected via parent-spouse-child chain', () => {
    // step is mama's child; mama is papa's spouse; papa is kid's parent
    // they share no direct parent → step is a step-sibling
    expect(key(r4, 'step')).toBe('olderSister');
  });

  // Order variant: relationships listed in reverse order
  it('4p: order-invariant — same result when rels are reversed', () => {
    const r4rev = computeAllKinshipTitles('kid', [...people4].reverse(), [...rels4].reverse(), 'ENGLISH');
    expect(key(r4rev, 'papa')).toBe('father');
    expect(key(r4rev, 'mama')).toBe('stepMother');
    expect(key(r4rev, 'step')).toBe('olderSister');
  });

  // CHILD edge direction instead of PARENT
  it('4p: order-invariant — CHILD edges give same result as PARENT edges', () => {
    const relsChild = [
      rel('x1c', 'kid',  'papa', 'CHILD'),
      rel('x2c', 'step', 'mama', 'CHILD'),
      rel('x3c', 'papa', 'mama', 'SPOUSE'),
    ];
    const r4c = computeAllKinshipTitles('kid', people4, relsChild, 'ENGLISH');
    expect(key(r4c, 'papa')).toBe('father');
    expect(key(r4c, 'mama')).toBe('stepMother');
    expect(key(r4c, 'step')).toBe('olderSister');
  });

  // Paternal grandparent via paternal bridge
  it('4p: paternal grandfather identified correctly', () => {
    const gf  = p('gf',  'Grandpa', 'MALE', '1930-01-01');
    const dad = p('dad', 'Dad',     'MALE', '1960-01-01');
    const ch  = p('ch',  'Child',   'MALE', '1990-01-01');
    const rg = [
      rel('g1', 'gf',  'dad', 'PARENT'),
      rel('g2', 'dad', 'ch',  'PARENT'),
    ];
    const rg4 = computeAllKinshipTitles('ch', [gf, dad, ch], rg, 'ENGLISH');
    expect(key(rg4, 'gf')).toBe('paternalGrandfather');
  });

  // Maternal grandmother identified correctly
  it('4p: maternal grandmother identified correctly', () => {
    const gm  = p('gm',  'Grandma', 'FEMALE', '1930-01-01');
    const mom = p('mom', 'Mom',     'FEMALE', '1960-01-01');
    const ch  = p('ch',  'Child',   'MALE',   '1990-01-01');
    const rg = [
      rel('g1', 'gm',  'mom', 'PARENT'),
      rel('g2', 'mom', 'ch',  'PARENT'),
    ];
    const rg4 = computeAllKinshipTitles('ch', [gm, mom, ch], rg, 'ENGLISH');
    expect(key(rg4, 'gm')).toBe('maternalGrandmother');
  });

  // Edge: both biological parents — neither should be step
  it('4p: both biological parents are NOT step-parents', () => {
    const rBio = [
      rel('b1', 'papa', 'kid',  'PARENT'),
      rel('b2', 'mama', 'kid',  'PARENT'),
      rel('b3', 'papa', 'mama', 'SPOUSE'),
    ];
    const r4b = computeAllKinshipTitles('kid', people4, rBio, 'ENGLISH');
    expect(key(r4b, 'papa')).toBe('father');
    expect(key(r4b, 'mama')).toBe('mother');  // biological, not step
  });

  // Edge: isolated person in tree has no kinship key
  it('4p: isolated person in tree has null kinship key', () => {
    const iso = p('iso', 'Isolated', 'MALE');
    const r4i = computeAllKinshipTitles('kid', [...people4, iso], rels4, 'ENGLISH');
    expect(key(r4i, 'iso')).toBeNull();
  });
});
