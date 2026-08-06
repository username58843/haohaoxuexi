import React from 'react'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { canSpeak, speakChinese } from '~/lib/speech'

/**
 * One simple example sentence for a word: hanzi line with a speaker button
 * (browser TTS), pinyin underneath, then the translation matching the UI
 * language (tk → ru → en fallback chain, mirroring meaningLine).
 *
 * Renders nothing when the word has no example — packs are being enriched
 * progressively, and deck/SRS snapshots created before the rollout carry none.
 */
export default function ExampleSentence({ example, className = '' }) {
  const { t, language } = useSettings()
  if (!example || !example.zh) return null

  const translation =
    (language === 'tk' && example.tk) ||
    (language === 'ru' && example.ru) ||
    (language === 'zh' ? '' : example.en) ||
    ''

  return (
    <div className={`example-sentence ${className}`.trim()}>
      <div className="example-sentence__zh-row">
        <span className="example-sentence__zh hanzi" lang="zh">
          {example.zh}
        </span>
        {canSpeak() && (
          <button
            type="button"
            className="example-sentence__tts"
            onClick={() => speakChinese(example.zh)}
            aria-label={t('exampleListen', 'Listen to the example')}
            title={t('exampleListen', 'Listen to the example')}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M11 5 6 9H2v6h4l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
            </svg>
          </button>
        )}
      </div>
      {example.py && <div className="example-sentence__py">{example.py}</div>}
      {translation && <div className="example-sentence__tr">{translation}</div>}
    </div>
  )
}
