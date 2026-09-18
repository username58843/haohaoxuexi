/**
 * HSK level helpers shared by browse/map/dashboard views.
 *
 * All levels follow the syllabus effective July 2026; 7 is the combined band 7–9
 * (七–九级 is published as ONE official list, so it ships as one pack with
 * `hsk: 7` internally and a "7–9" label everywhere in the UI).
 */

export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7]

/** UI label for a level: 1..6 → "1".."6", 7 → "7–9". */
export function hskLevelLabel(level) {
  return level === 7 ? '7–9' : String(level)
}

/** Pack id serving a level: hsk1..hsk6, hsk7-9. */
export function hskPackId(level) {
  return level === 7 ? 'hsk7-9' : `hsk${level}`
}
