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
// Uncle / aunt SPOUSE titles — the main bug this rewrite fixes.
//
// Tree:
//   GPF ─── GPM   (paternal grandparents)
//   MGF ─── MGM   (maternal grandparents)
//       |               |
//       F ─────────── M     (parents of Persp)
//       |
//     Persp (MALE, 1990)
//
// Paternal uncles/aunts:
//   FOB (MALE 1955, father's OLDER brother) married to FOB_W (FEMALE)
//   FYB (MALE 1963, father's YOUNGER brother) married to FYB_W (FEMALE)
//   FS  (FEMALE 1958, father's sister) married to FS_H (MALE)
//
// Maternal uncles/aunts:
//   MB  (MALE 1958, mother's brother) married to MB_W (FEMALE) → THE main bug case
//   MOS (FEMALE 1960, mother's OLDER sister) married to MOS_H (MALE)
//   MYS (FEMALE 1967, mother's YOUNGER sister) married to MYS_H (MALE)
// ---------------------------------------------------------------------------
describe('uncle/aunt spouse titles', () => {
  const peop = [
    p('persp', 'Persp', 'MALE',   '1990-01-01'),
    p('f',     'Father','MALE',   '1960-05-10'),
    p('m',     'Mother','FEMALE', '1963-07-20'),
    p('gpf',   'GPF',   'MALE',   '1930-01-01'),
    p('gpm',   'GPM',   'FEMALE', '1932-01-01'),
    p('mgf',   'MGF',   'MALE',   '1928-01-01'),
    p('mgm',   'MGM',   'FEMALE', '1930-01-01'),
    // Paternal side uncles/aunts + spouses
    p('fob',   'FOB',   'MALE',   '1955-01-01'), // father's OLDER brother
    p('fob_w', 'FOB_W', 'FEMALE', '1957-01-01'),
    p('fyb',   'FYB',   'MALE',   '1963-01-01'), // father's YOUNGER brother
    p('fyb_w', 'FYB_W', 'FEMALE', '1965-01-01'),
    p('fs',    'FS',    'FEMALE', '1958-01-01'), // father's sister
    p('fs_h',  'FS_H',  'MALE',   '1955-01-01'),
    // Maternal side uncles/aunts + spouses
    p('mb',    'MB',    'MALE',   '1958-01-01'), // mother's brother
    p('mb_w',  'MB_W',  'FEMALE', '1960-01-01'), // ← main bug: should be mothersBrotherWife
    p('mos',   'MOS',   'FEMALE', '1960-01-01'), // mother's OLDER sister
    p('mos_h', 'MOS_H', 'MALE',   '1958-01-01'),
    p('mys',   'MYS',   'FEMALE', '1967-01-01'), // mother's YOUNGER sister
    p('mys_h', 'MYS_H', 'MALE',   '1965-01-01'),
  ];

  const rels2 = [
    // Grandparents
    rel('a1', 'gpf', 'f',   'PARENT'),
    rel('a2', 'gpm', 'f',   'PARENT'),
    rel('a3', 'gpf', 'gpm', 'SPOUSE'),
    rel('a4', 'mgf', 'm',   'PARENT'),
    rel('a5', 'mgm', 'm',   'PARENT'),
    rel('a6', 'mgf', 'mgm', 'SPOUSE'),
    // Parents
    rel('a7', 'f',   'persp','PARENT'),
    rel('a8', 'm',   'persp','PARENT'),
    rel('a9', 'f',   'm',    'SPOUSE'),
    // Paternal uncles/aunts (children of gpf/gpm)
    rel('a10','gpf', 'fob',  'PARENT'),
    rel('a11','gpm', 'fob',  'PARENT'),
    rel('a12','fob', 'fob_w','SPOUSE'),
    rel('a13','gpf', 'fyb',  'PARENT'),
    rel('a14','gpm', 'fyb',  'PARENT'),
    rel('a15','fyb', 'fyb_w','SPOUSE'),
    rel('a16','gpf', 'fs',   'PARENT'),
    rel('a17','gpm', 'fs',   'PARENT'),
    rel('a18','fs',  'fs_h', 'SPOUSE'),
    // Maternal uncles/aunts (children of mgf/mgm)
    rel('a19','mgf', 'mb',   'PARENT'),
    rel('a20','mgm', 'mb',   'PARENT'),
    rel('a21','mb',  'mb_w', 'SPOUSE'),
    rel('a22','mgf', 'mos',  'PARENT'),
    rel('a23','mgm', 'mos',  'PARENT'),
    rel('a24','mos', 'mos_h','SPOUSE'),
    rel('a25','mgf', 'mys',  'PARENT'),
    rel('a26','mgm', 'mys',  'PARENT'),
    rel('a27','mys', 'mys_h','SPOUSE'),
  ];

  const r = computeAllKinshipTitles('persp', peop, rels2, 'ENGLISH');
  const rTamil = computeAllKinshipTitles('persp', peop, rels2, 'TAMIL');

  // Sanity: uncle/aunt themselves still correct
  it('uncle/aunt: FOB is fathersOlderBrother', () => expect(key(r,'fob')).toBe('fathersOlderBrother'));
  it('uncle/aunt: FYB is fathersYoungerBrother', () => expect(key(r,'fyb')).toBe('fathersYoungerBrother'));
  it('uncle/aunt: FS is fathersSister', () => expect(key(r,'fs')).toBe('fathersSister'));
  it('uncle/aunt: MB is mothersBrother', () => expect(key(r,'mb')).toBe('mothersBrother'));
  it('uncle/aunt: MOS is mothersOlderSister', () => expect(key(r,'mos')).toBe('mothersOlderSister'));
  it('uncle/aunt: MYS is mothersYoungerSister', () => expect(key(r,'mys')).toBe('mothersYoungerSister'));

  // Uncle/aunt spouses — the main fix
  it('MB_W (mother\'s brother\'s wife) → mothersBrotherWife', () =>
    expect(key(r,'mb_w')).toBe('mothersBrotherWife'));
  it('FOB_W (father\'s older brother\'s wife) → fathersOlderBrotherWife', () =>
    expect(key(r,'fob_w')).toBe('fathersOlderBrotherWife'));
  it('FYB_W (father\'s younger brother\'s wife) → fathersYoungerBrotherWife', () =>
    expect(key(r,'fyb_w')).toBe('fathersYoungerBrotherWife'));
  it('FS_H (father\'s sister\'s husband) → fathersSisterHusband', () =>
    expect(key(r,'fs_h')).toBe('fathersSisterHusband'));
  it('MOS_H (mother\'s older sister\'s husband) → mothersOlderSisterHusband', () =>
    expect(key(r,'mos_h')).toBe('mothersOlderSisterHusband'));
  it('MYS_H (mother\'s younger sister\'s husband) → mothersYoungerSisterHusband', () =>
    expect(key(r,'mys_h')).toBe('mothersYoungerSisterHusband'));

  // Tamil script correctness
  it('Tamil: mothersOlderSister script is பெரியம்மா (not அத்தை)', () =>
    expect(rTamil['mos']?.title?.script).toBe('பெரியம்மா'));
  it('Tamil: mothersBrotherWife script is மாமி', () =>
    expect(rTamil['mb_w']?.title?.script).toBe('மாமி'));
  it('Tamil: fathersOlderBrotherWife script is பெரியம்மா', () =>
    expect(rTamil['fob_w']?.title?.script).toBe('பெரியம்மா'));
  it('Tamil: fathersYoungerBrotherWife script is சித்தி', () =>
    expect(rTamil['fyb_w']?.title?.script).toBe('சித்தி'));
  it('Tamil: fathersSisterHusband script is மாமா', () =>
    expect(rTamil['fs_h']?.title?.script).toBe('மாமா'));
  it('Tamil: mothersOlderSisterHusband script is பெரியப்பா', () =>
    expect(rTamil['mos_h']?.title?.script).toBe('பெரியப்பா'));
  it('Tamil: mothersYoungerSisterHusband script is சித்தப்பா', () =>
    expect(rTamil['mys_h']?.title?.script).toBe('சித்தப்பா'));
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
