import React from 'react'

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 12.5l5 5L19.5 6.8" />
    </svg>
  )
}

/**
 * One lexicon row: hanzi · pinyin · first definition · HSK badge.
 * Memoized — thousands of these can be on screen while scrolling.
 */
function WordRow({ word, known = false, onSelect, knownLabel = 'Known' }) {
  const firstDef =
    (word.definitions && word.definitions[0]) ||
    (word.translations && word.translations.en && word.translations.en[0]) ||
    ''

  return (
    <button
      type="button"
      className={`word-row hsk-row${known ? ' hsk-row--known' : ''}`}
      onClick={() => onSelect(word)}
    >
      <span className="word-row__hanzi hanzi" lang="zh">
        {word.simplified}
      </span>
      <span className="word-row__body">
        <span className="word-row__pinyin">{word.pinyin}</span>
        <span className="word-row__def">{firstDef}</span>
      </span>
      {known && (
        <span className="hsk-row__check" title={knownLabel}>
          <CheckIcon />
        </span>
      )}
      {word.hsk ? (
        <span className={`word-row__tag word-row__tag--hsk${word.hsk}`}>HSK {word.hsk}</span>
      ) : null}
    </button>
  )
}

export default React.memo(WordRow)
