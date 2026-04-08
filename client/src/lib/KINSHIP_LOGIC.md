# Kinship Logic — VeruView

## Overview

`kinship.js` is a pure, side-effect-free module that computes kinship titles for every person in a family tree relative to a chosen **perspective person**.

It runs entirely on the client (no server call needed) and is culture-aware: currently supports `TAMIL` and `ENGLISH`.

---

## Algorithm: Path-based BFS

### 1. Build adjacency map

`buildAdjacencyMap(people, relationships)` — converts the flat relationship list into a graph:

```
{ [personId]: { parents: [], children: [], spouses: [] } }
```

**SIBLING edges are ignored** — siblings are derived implicitly from shared parents.

### 2. BFS from perspective

`findShortestPaths(perspectiveId, adjacency)` — runs BFS from the perspective person, tracking the **shortest path** to every reachable person as a list of step types:

```
pathTypes: ['parent', 'parent', 'spouse']   // grandmother's path
path:      [perspId, fatherId, gpId, gmId]  // actual person IDs visited
```

Max depth: **5 hops**. If a person is reachable by multiple paths, only the shortest is used (BFS guarantee).

### 3. Pattern matching → title key

`deriveTitleKey(pathTypes, path, targetPerson, perspectivePerson, peopleMap)` — switches on `pathTypes.join(',')` to return a title key string.

---

## Path Patterns → Title Keys

| Pattern | Title |
|---|---|
| `parent` | father / mother |
| `child` | son / daughter |
| `spouse` | husband / wife |
| `parent,parent` | grandfather / grandmother (paternal or maternal) |
| `parent,spouse` | stepFather / stepMother |
| `parent,child` | olderBrother / youngerBrother / olderSister / youngerSister |
| `child,child` | grandson / granddaughter |
| `child,spouse` | sonInLaw / daughterInLaw |
| `spouse,parent` | fatherInLaw / motherInLaw |
| `spouse,child` | stepSon / stepDaughter |
| `parent,parent,parent` | greatGrandfather / greatGrandmother |
| **`parent,parent,spouse`** | **grandfather / grandmother** ← _Bug fix: grandparent's spouse is a grandparent_ |
| `parent,parent,child` | fathersOlderBrother / fathersYoungerBrother / fathersBrother / fathersSister / mothersBrother / mothersOlderSister / mothersYoungerSister / mothersSister |
| `parent,child,child` | nephew / niece |
| `parent,child,spouse` | sisterInLaw / brotherInLaw (sibling's spouse) |
| `spouse,parent,child` | brotherInLaw / sisterInLaw (spouse's sibling) |
| `parent,parent,child,child` | cousin |
| `parent,parent,child,spouse` | fathersBrotherWife / fathersSisterHusband / mothersBrotherWife / mothersSisterHusband |
| `parent,parent,parent,parent` | ancestor |
| unrecognised reachable | relative |
| unreachable | null |

---

## The Grandparent Spouse Bug Fix

Previously, the grandparent's spouse was incorrectly labelled as a **step-parent** or given no title. The fix: `parent,parent,spouse` is explicitly mapped to grandparent keys using the **intermediate parent's gender** to determine paternal vs maternal line.

```
Persp → father (MALE) → grandfather → grandmother
pathTypes: ['parent', 'parent', 'spouse']
intermediate parent gender: MALE → paternal line
target gender: FEMALE → paternalGrandmother ✓
```

---

## Older/Younger Sibling & Uncle/Aunt

Both rely on **DOB comparison**:

- **Sibling**: if target was born _before_ perspective → `older`, else `younger`. If either DOB is missing → plain `brother`/`sister`.
- **Father's brother**: if uncle's DOB < father's DOB → `fathersOlderBrother`, else `fathersYoungerBrother`.
- **Mother's sister**: if aunt's DOB < mother's DOB → `mothersOlderSister`, else `mothersYoungerSister`.

---

## Paternal vs Maternal Line

Determined by the gender of the **intermediate person** (path[1], the perspective's direct parent):

- Intermediate is MALE → paternal line → `paternalGrandfather/paternalGrandmother`
- Intermediate is FEMALE → maternal line → `maternalGrandfather/maternalGrandmother`

The same logic applies to `parent,parent,spouse` (grandparent's spouse): the intermediate parent's gender decides the line.

---

## Adding a New Culture

1. Add an entry to `CULTURE_TITLES` in `kinship.js` with the same keys as `TAMIL_TITLES`.
2. Add the new culture value to the `Culture` enum in `server/prisma/schema.prisma`.
3. Done — the kinship graph algorithm is culture-agnostic.

---

## Running the Tests

```bash
cd client
npm test
```

Tests live in `src/lib/kinship.test.js` and cover: direct family, grandparents (paternal/maternal), the GP-spouse bug fix, great-grandparents, older/younger siblings, uncles/aunts, in-laws, cousins, step-parents, nephews, unconnected people, Tamil script output, and edge cases.
