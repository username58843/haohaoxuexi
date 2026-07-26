import React, { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useRouter } from 'next/router'
import axios from 'axios'
import { Modal, ModalHeader, ModalBody, Input } from 'reactstrap'

import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import SiteLayout from '~/components/SiteLayout'
import LoadingSpinner from '~/components/LoadingSpinner'
import Link from '~/components/Link'

import { levelWords } from '~/lib/learn'

const openGoogleImages = (word) => {
  const query = encodeURIComponent(word)
  window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank')
}

const HSK_LEVELS = ['hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6']

const StrokeOrderModal = ({ isOpen, toggle, character }) => {
  const [imageError, setImageError] = useState(false)
  const [animationKey, setAnimationKey] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const { t } = useSettings()

  const characters = character
    ? [...character].filter((char) => {
        const code = char.codePointAt(0)
        return code >= 0x4e00 && code <= 0x9fff
      })
    : []
  const hasMultipleChars = characters.length > 1

  React.useEffect(() => {
    setImageError(false)
    setAnimationKey((prev) => prev + 1)
    setCurrentCharIndex(0)
  }, [character, isOpen])

  React.useEffect(() => {
    if (!isOpen || imageError) return undefined
    const interval = setInterval(() => {
      setAnimationKey((prev) => prev + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [isOpen, imageError, currentCharIndex])

  if (!character || characters.length === 0) return null

  const currentChar = characters[currentCharIndex] || characters[0]
  const charCode = currentChar.codePointAt(0)
  const strokeOrderUrl = `https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/svgs/${charCode}.svg`

  const switchToChar = (index) => {
    setCurrentCharIndex(index)
    setImageError(false)
    setAnimationKey((prev) => prev + 1)
  }

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered className="dict-stroke-modal">
      <ModalHeader toggle={toggle}>
        <span>
          {t('strokeOrder') || '笔画顺序'}:{' '}
          <span className="hanzi" lang="zh">
            {currentChar}
          </span>
          {hasMultipleChars && ` (${currentCharIndex + 1}/${characters.length})`}
        </span>
      </ModalHeader>
      <ModalBody className="text-center">
        {!imageError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={animationKey}
            src={strokeOrderUrl}
            alt={`Stroke order for ${currentChar}`}
            className="dict-stroke-modal__img"
            onError={() => setImageError(true)}
          />
        )}
        {imageError && (
          <p className="text-muted mb-0">
            {t('strokeOrderNotAvailable') || '无法加载笔画动画'}
          </p>
        )}
        {hasMultipleChars && (
          <div className="dict-stroke-modal__chars">
            {characters.map((char, index) => (
              <button
                key={`${char}-${index}`}
                type="button"
                className={`dict-stroke-modal__char hanzi${
                  index === currentCharIndex ? ' is-active' : ''
                }`}
                lang="zh"
                onClick={() => switchToChar(index)}
                aria-label={`显示 ${char} 的笔画顺序`}
              >
                {char}
              </button>
            ))}
          </div>
        )}
      </ModalBody>
    </Modal>
  )
}

StrokeOrderModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  character: PropTypes.string,
}

StrokeOrderModal.defaultProps = {
  character: '',
}

function WordCard({ word, index, onShowStroke }) {
  const def = Array.isArray(word.definitions)
    ? word.definitions.join('; ')
    : word.definitions || word.translation || word.meaning || ''

  return (
    <article className="dict-word">
      <div className="dict-word__index" aria-hidden>
        {index + 1}
      </div>
      <div className="dict-word__main">
        <div className="dict-word__top">
          <span className="dict-word__hanzi hanzi" lang="zh">
            {word.simplified}
          </span>
          {word.pinyin ? <span className="dict-word__pinyin">{word.pinyin}</span> : null}
        </div>
        {def ? <p className="dict-word__def">{def}</p> : null}
      </div>
      <div className="dict-word__actions">
        <button
          type="button"
          className="dict-word__btn"
          title="笔画顺序"
          onClick={() => onShowStroke(word.simplified)}
          aria-label={`笔画 ${word.simplified}`}
        >
          ✍️
        </button>
        <button
          type="button"
          className="dict-word__btn"
          title="Google Images"
          onClick={() => openGoogleImages(word.simplified)}
          aria-label={`图片 ${word.simplified}`}
        >
          🖼
        </button>
      </div>
    </article>
  )
}

WordCard.propTypes = {
  word: PropTypes.shape({
    simplified: PropTypes.string.isRequired,
    pinyin: PropTypes.string,
    definitions: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.string),
      PropTypes.string,
    ]),
    translation: PropTypes.string,
    meaning: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  onShowStroke: PropTypes.func.isRequired,
}

export default function Dictionary() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useSettings()
  const router = useRouter()
  const [words, setWords] = useState([])
  const [level, setLevel] = useState('')
  const [personalDictionaries, setPersonalDictionaries] = useState([])
  const [strokeModalOpen, setStrokeModalOpen] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const loadPersonalDictionaries = async () => {
      if (!user) return
      try {
        const response = await axios.get('/api/dictionaries')
        const sorted = (response.data.dictionaries || []).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
        setPersonalDictionaries(sorted)
      } catch (error) {
        console.error('Failed to load personal dictionaries:', error)
      }
    }
    loadPersonalDictionaries()
  }, [user])

  useEffect(() => {
    if (!level) {
      setWords([])
      return
    }
    if (level.startsWith('personal-')) return
    setWords(levelWords(level))
  }, [level])

  const selectHsk = (id) => {
    setLevel(id)
    setQuery('')
  }

  const selectPersonal = (dict) => {
    const value = `personal-${dict.id}`
    setLevel(value)
    setQuery('')
    setWords(Array.isArray(dict.words) ? dict.words : [])
  }

  const clearSelection = () => {
    setLevel('')
    setWords([])
    setQuery('')
  }

  const activeLabel = useMemo(() => {
    if (!level) return ''
    if (level.startsWith('personal-')) {
      const id = level.replace('personal-', '')
      const dict = personalDictionaries.find((d) => d.id === id)
      return dict?.name || t('myDictionaries')
    }
    return level.toUpperCase()
  }, [level, personalDictionaries, t])

  const filteredWords = useMemo(() => {
    if (!query.trim()) return words
    const q = query.trim().toLowerCase()
    return words.filter((w) => {
      const hanzi = (w.simplified || '').toLowerCase()
      const pinyin = (w.pinyin || '').toLowerCase()
      const defs = Array.isArray(w.definitions)
        ? w.definitions.join(' ').toLowerCase()
        : String(w.definitions || w.translation || w.meaning || '').toLowerCase()
      return hanzi.includes(q) || pinyin.includes(q) || defs.includes(q)
    })
  }, [words, query])

  const hskCounts = useMemo(() => {
    const map = {}
    HSK_LEVELS.forEach((id) => {
      map[id] = levelWords(id)?.length || 0
    })
    return map
  }, [])

  const handleShowStroke = (character) => {
    setSelectedCharacter(character)
    setStrokeModalOpen(true)
  }

  if (authLoading) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loading')} />
      </SiteLayout>
    )
  }

  if (!user) return null

  return (
    <SiteLayout>
      <div className="dict-browser">
        <header className="dict-browser__header">
          <div>
            <Link href="/dictionaries" className="dict-browser__link">
              ← {t('myDictionaries') || 'My dictionaries'}
            </Link>
            <h1 className="dict-browser__title">{t('dictionary')}</h1>
            <p className="dict-browser__sub">
              {level
                ? `${activeLabel} · ${filteredWords.length}${
                    query.trim() && filteredWords.length !== words.length
                      ? ` / ${words.length}`
                      : ''
                  } ${t('lexiconWords') || 'words'}`
                : t('selectVocabularyList') || 'Select a list'}
            </p>
          </div>
          {level ? (
            <button type="button" className="dict-browser__clear" onClick={clearSelection}>
              ← {t('dictAllLists') || 'Lists'}
            </button>
          ) : null}
        </header>

        {!level && (
          <>
            <section className="dict-browser__section">
              <h2 className="dict-browser__section-title">HSK</h2>
              <div className="dict-browser__chips">
                {HSK_LEVELS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="dict-browser__chip"
                    onClick={() => selectHsk(id)}
                  >
                    <span className="dict-browser__chip-title">{id.toUpperCase()}</span>
                    <span className="dict-browser__chip-meta">
                      {hskCounts[id]} {t('lexiconWords') || 'words'}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="dict-browser__section">
              <div className="dict-browser__section-row">
                <h2 className="dict-browser__section-title">
                  {t('myDictionaries') || 'My dictionaries'}
                </h2>
                <Link href="/dictionaries" className="dict-browser__link">
                  {t('myDictionaries') || 'Manage'} →
                </Link>
              </div>
              {personalDictionaries.length === 0 ? (
                <div className="dict-browser__empty">
                  <p>{t('noPersonalDicts') || t('dictionaryEmpty') || 'No personal lists yet'}</p>
                  <Link href="/dictionaries" className="btn btn-primary btn-sm">
                    {t('myDictionaries') || 'Create list'}
                  </Link>
                </div>
              ) : (
                <div className="dict-browser__chips dict-browser__chips--personal">
                  {personalDictionaries.map((dict) => (
                    <button
                      key={dict.id}
                      type="button"
                      className="dict-browser__chip dict-browser__chip--wide"
                      onClick={() => selectPersonal(dict)}
                    >
                      <span className="dict-browser__chip-title">{dict.name}</span>
                      <span className="dict-browser__chip-meta">
                        {dict.words?.length || 0} {t('lexiconWords') || 'words'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {level && (
          <>
            <div className="dict-browser__toolbar">
              <Input
                type="search"
                className="dict-browser__search"
                placeholder={t('lexiconPlaceholder') || '汉字 / pinyin / meaning…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {words.length === 0 ? (
              <div className="dict-browser__empty">
                {t('dictionaryEmpty') || 'No words in this list'}
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="dict-browser__empty">
                {t('noResults') || 'Nothing found'}
              </div>
            ) : (
              <div className="dict-browser__list">
                {filteredWords.map((word, index) => (
                  <WordCard
                    key={`${word.simplified}-${word.pinyin || ''}-${index}`}
                    word={word}
                    index={index}
                    onShowStroke={handleShowStroke}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <StrokeOrderModal
        isOpen={strokeModalOpen}
        toggle={() => setStrokeModalOpen((v) => !v)}
        character={selectedCharacter}
      />
    </SiteLayout>
  )
}
