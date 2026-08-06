/**
 * HSK level helpers shared by browse/map/dashboard views.
 *
 * Levels 1–6 are the classic packs; 7 is the combined HSK 3.0 band 7–9
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
