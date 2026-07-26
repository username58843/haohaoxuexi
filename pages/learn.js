import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

import { buildFromConfig, levelWords, selectNWords } from '~/lib/learn'
import sample from 'lodash/sample'
import shuffle from 'lodash/shuffle'

import Learn from '~/components/Learn'
import SiteLayout from '~/components/SiteLayout'
import LoadingSpinner from '~/components/LoadingSpinner'
import EmptyState from '~/components/EmptyState'
import Link from '~/components/Link'
import {
  pushRecentDeck,
  saveLastConfig,
  loadLastConfig,
  loadRecentDecks,
} from '~/lib/stats'

const HSK_LEVELS = [1, 2, 3, 4, 5, 6]
const LIMIT_OPTIONS = [10, 20, 40, 0] // 0 = all

const DEFAULT_MODES = ['characters-pinyin', 'characters-translation']

function parseConfig(raw) {
  if (!raw) return null
  const str = Array.isArray(raw) ? raw[0] : raw
  if (typeof str !== 'string' || !str.trim()) return null
  try {
    const parsed = JSON.parse(str)
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.levels)) parsed.levels = []
    if (!Array.isArray(parsed.modes) || parsed.modes.length === 0) {
      parsed.modes = ['characters-pinyin']
    }
    parsed.wordsLimit = Number(parsed.wordsLimit) || 0
    return parsed
  } catch {
    return null
  }
}

function buildDeckFromWords(words, modes, wordsLimit, idPrefix) {
  if (!Array.isArray(words) || words.length === 0) return []

  const limited = wordsLimit > 0 ? words.slice(0, wordsLimit) : words

  return limited.map((word, index) => {
    const otherWords = selectNWords(words, 3, index)
    const variants =
      otherWords.length > 0
        ? [word, ...otherWords]
        : [word, word, word, word].slice(0, Math.min(4, Math.max(1, words.length)))

    return {
      id: `${idPrefix}-${index}`,
      type: sample(modes || ['characters-pinyin']),
      question: word,
      variants,
    }
  })
}

function loadReviewWords() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('xue_review_words')
    if (!raw) return null
    const words = JSON.parse(raw)
    if (!Array.isArray(words) || words.length === 0) return null
    return words
  } catch {
    return null
  }
}

function modeLabels(t) {
  return [
    { value: 'characters-pinyin', label: t('charactersToPinyin') || '字 → pinyin' },
    { value: 'pinyin-characters', label: t('pinyinToCharacters') || 'pinyin → 字' },
    { value: 'characters-translation', label: t('charactersToTranslation') || '字 → meaning' },
    { value: 'translation-characters', label: t('translationToCharacters') || 'meaning → 字' },
  ]
}

const LearnPage = () => {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { t, alwaysShowPinyin, alwaysShowTranslation } = useSettings()

  const dict = router.isReady
    ? Array.isArray(router.query.dict)
      ? router.query.dict[0]
      : router.query.dict
    : null

  const reviewFlag = router.isReady
    ? Array.isArray(router.query.review)
      ? router.query.review[0]
      : router.query.review
    : null

  const configQuery = router.isReady
    ? Array.isArray(router.query.config)
      ? router.query.config[0]
      : router.query.config
    : null

  const configObject = useMemo(
    () => (router.isReady ? parseConfig(configQuery) : null),
    [router.isReady, configQuery]
  )

  const [personalDictionary, setPersonalDictionary] = useState(null)
  const [userDictionaries, setUserDictionaries] = useState({})
  const [homePersonalDicts, setHomePersonalDicts] = useState([])
  const [dictsLoading, setDictsLoading] = useState(false)
  const [dictError, setDictError] = useState(null)
  const [shuffledData, setShuffledData] = useState(null)
  const [reviewWords, setReviewWords] = useState(null)
  const lastDeckKeyRef = useRef('')

  // Hub UI state
  const [tab, setTab] = useState('mine') // mine | hsk
  const [selected, setSelected] = useState([]) // level ids: hsk1, personal-xxx
  const [limit, setLimit] = useState(20)
  const [modes, setModes] = useState(DEFAULT_MODES)
  const [lastConfig, setLastConfig] = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    if (authLoading) return
    if (!user) router.replace('/auth')
  }, [user, authLoading, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setLastConfig(loadLastConfig())
    setRecent(loadRecentDecks().slice(0, 4))
  }, [])

  useEffect(() => {
    if (authLoading || !user) {
      setHomePersonalDicts([])
      return
    }
    let cancelled = false
    axios
      .get('/api/dictionaries', { withCredentials: true })
      .then((response) => {
        if (cancelled) return
        const sorted = (response.data.dictionaries || []).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
        setHomePersonalDicts(sorted)
        // Prefer "mine" tab if user has decks
        if (sorted.length > 0) setTab('mine')
        else setTab('hsk')
      })
      .catch(() => {
        if (!cancelled) {
          setHomePersonalDicts([])
          setTab('hsk')
        }
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  useEffect(() => {
    if (!router.isReady) return
    if (reviewFlag) setReviewWords(loadReviewWords())
    else setReviewWords(null)
  }, [router.isReady, reviewFlag])

  const hskCounts = useMemo(() => {
    const map = {}
    HSK_LEVELS.forEach((n) => {
      map[n] = levelWords(`hsk${n}`)?.length || 0
    })
    return map
  }, [])

  const startSession = useCallback(
    (payload) => {
      if (!payload?.levels?.length) return
      const full = {
        levels: payload.levels,
        modes:
          Array.isArray(payload.modes) && payload.modes.length > 0
            ? payload.modes
            : DEFAULT_MODES,
        wordsLimit: Number(payload.wordsLimit) || 0,
        alwaysShowPinyin: !!payload.alwaysShowPinyin,
        alwaysShowTranslation: !!payload.alwaysShowTranslation,
      }

      const name = full.levels
        .map((l) => {
          if (String(l).startsWith('personal-')) {
            const id = String(l).replace('personal-', '')
            const d = homePersonalDicts.find((x) => String(x.id) === id)
            return d?.name || l
          }
          return String(l).toUpperCase()
        })
        .join(', ')

      pushRecentDeck({
        id: full.levels.join('+'),
        name,
        meta: `${full.wordsLimit || '∞'} · ${full.modes.length} modes`,
        levels: full.levels,
        modes: full.modes,
        wordsLimit: full.wordsLimit,
        config: JSON.stringify(full),
      })
      saveLastConfig(full)

      // Single personal dict → use ?dict= for full deck fidelity
      if (
        full.levels.length === 1 &&
        String(full.levels[0]).startsWith('personal-') &&
        !full.wordsLimit
      ) {
        const id = String(full.levels[0]).replace('personal-', '')
        router.push({ pathname: '/learn', query: { dict: id } })
        return
      }

      router.push({
        pathname: '/learn',
        query: { config: JSON.stringify(full) },
      })
    },
    [router, homePersonalDicts]
  )

  const toggleLevel = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleMode = (mode) => {
    setModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length <= 1) return prev
        return prev.filter((m) => m !== mode)
      }
      return [...prev, mode]
    })
  }

  const handleStart = () => {
    if (!selected.length) return
    startSession({
      levels: selected,
      modes,
      wordsLimit: limit,
      alwaysShowPinyin: false,
      alwaysShowTranslation: false,
    })
  }

  const handleContinue = () => {
    if (!lastConfig?.levels?.length) return
    startSession(lastConfig)
  }

  const quickStartPersonal = useCallback(
    (d) => {
      if (!d?.id || !(d.words?.length > 0)) return
      pushRecentDeck({
        id: d.id,
        type: 'dict',
        name: d.name,
        meta: `${d.words.length} words`,
      })
      router.push({ pathname: '/learn', query: { dict: String(d.id) } })
    },
    [router]
  )

  // Load personal dictionary by ?dict=
  useEffect(() => {
    if (!router.isReady || !dict) {
      setPersonalDictionary(null)
      setDictError(null)
      return
    }
    if (authLoading) return
    if (!user) {
      setDictError('auth')
      return
    }

    let cancelled = false
    setDictsLoading(true)
    setDictError(null)

    axios
      .get('/api/dictionaries', { withCredentials: true })
      .then((response) => {
        if (cancelled) return
        const dictionary = (response.data.dictionaries || []).find(
          (d) => String(d.id) === String(dict)
        )
        if (dictionary && Array.isArray(dictionary.words) && dictionary.words.length > 0) {
          setPersonalDictionary(dictionary)
          pushRecentDeck({
            id: dictionary.id,
            type: 'dict',
            name: dictionary.name,
            meta: `${dictionary.words.length} words`,
          })
        } else if (dictionary && (!dictionary.words || dictionary.words.length === 0)) {
          setPersonalDictionary(null)
          setDictError('empty')
        } else {
          setPersonalDictionary(null)
          setDictError('notfound')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonalDictionary(null)
          setDictError('failed')
        }
      })
      .finally(() => {
        if (!cancelled) setDictsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [router.isReady, dict, user, authLoading])

  // Load user dicts needed by config personal-* levels
  useEffect(() => {
    if (!router.isReady || !configObject || dict || reviewFlag) return
    if (authLoading) return

    const personalLevels = (configObject.levels || []).filter((l) =>
      String(l).startsWith('personal-')
    )
    if (personalLevels.length === 0) {
      setUserDictionaries({})
      return
    }
    if (!user) return

    let cancelled = false
    setDictsLoading(true)

    axios
      .get('/api/dictionaries', { withCredentials: true })
      .then((response) => {
        if (cancelled) return
        const map = {}
        ;(response.data.dictionaries || []).forEach((d) => {
          map[`personal-${d.id}`] = d
        })
        setUserDictionaries(map)
      })
      .catch(() => {
        if (!cancelled) setUserDictionaries({})
      })
      .finally(() => {
        if (!cancelled) setDictsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [router.isReady, configObject, user, authLoading, dict, reviewFlag])

  const rawData = useMemo(() => {
    if (!router.isReady) return null

    if (reviewFlag) {
      if (!reviewWords) return []
      const pool = [...reviewWords]
      if (pool.length < 4) {
        const pad = levelWords('hsk1') || []
        for (const w of pad) {
          if (pool.length >= 8) break
          if (!pool.some((p) => p.simplified === w.simplified)) pool.push(w)
        }
      }
      return buildDeckFromWords(
        reviewWords,
        ['characters-pinyin', 'characters-translation'],
        0,
        'review'
      ).map((item) => {
        const idx = reviewWords.findIndex(
          (w) => w.simplified === item.question.simplified
        )
        const others = selectNWords(pool, 3, Math.max(0, idx))
        return {
          ...item,
          variants: others.length > 0 ? [item.question, ...others] : item.variants,
        }
      })
    }

    if (dict) {
      if (!personalDictionary) return null
      const modesCfg = configObject?.modes || DEFAULT_MODES
      const limitCfg = configObject?.wordsLimit || 0
      return buildDeckFromWords(
        personalDictionary.words,
        modesCfg,
        limitCfg,
        `dict-${personalDictionary.id}`
      )
    }

    if (!configObject) return null

    if (Array.isArray(configObject.forceIds) && configObject.forceIds.length > 0) {
      return buildFromConfig(configObject)
    }

    const levels = configObject.levels || []
    if (levels.length === 0) return []

    const personalLevels = levels.filter((l) => String(l).startsWith('personal-'))
    const regularLevels = levels.filter((l) => !String(l).startsWith('personal-'))

    if (personalLevels.length > 0 && Object.keys(userDictionaries).length === 0) {
      if (user) return null
    }

    const chunks = []

    regularLevels.forEach((level) => {
      const words = levelWords(level)
      if (words?.length) {
        chunks.push(buildDeckFromWords(words, configObject.modes, 0, level))
      }
    })

    personalLevels.forEach((level) => {
      const d = userDictionaries[level]
      if (d?.words?.length) {
        chunks.push(buildDeckFromWords(d.words, configObject.modes, 0, level))
      }
    })

    let result = chunks.flat()
    if (configObject.wordsLimit > 0) {
      result = result.slice(0, configObject.wordsLimit)
    }
    return result
  }, [
    router.isReady,
    dict,
    personalDictionary,
    configObject,
    userDictionaries,
    user,
    reviewFlag,
    reviewWords,
  ])

  useEffect(() => {
    if (!Array.isArray(rawData)) return

    if (rawData.length === 0) {
      lastDeckKeyRef.current = 'empty'
      setShuffledData([])
      return
    }

    const key = reviewFlag
      ? `review:${rawData.length}:${rawData[0]?.id || ''}`
      : dict
        ? `dict:${dict}:${rawData.length}:${rawData[0]?.id || ''}`
        : `cfg:${JSON.stringify(configObject?.levels || [])}:${configObject?.wordsLimit || 0}:${rawData.length}:${rawData[0]?.id || ''}`

    if (lastDeckKeyRef.current === key) return
    lastDeckKeyRef.current = key

    const shuffled = rawData.map((item) => ({
      ...item,
      variants: shuffle([...(item.variants || [])]),
    }))
    setShuffledData(shuffle(shuffled))
  }, [rawData, dict, configObject, reviewFlag])

  const data = shuffledData
  const isSession = !!(dict || configObject || reviewFlag)
  const waiting =
    !router.isReady ||
    authLoading ||
    dictsLoading ||
    (isSession && data === null && !dictError && !(reviewFlag && reviewWords === null))

  if (authLoading || !user) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loading') || 'Loading…'} />
      </SiteLayout>
    )
  }

  if (waiting) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loadingDictionaries') || 'Loading…'} />
      </SiteLayout>
    )
  }

  if (dict && dictError) {
    const msg =
      dictError === 'empty'
        ? t('dictionaryEmpty') || 'Dictionary has no words'
        : dictError === 'auth'
          ? t('pleaseLogin') || 'Please log in'
          : t('dictionaryNotFound') || 'Dictionary not found'

    return (
      <SiteLayout>
        <EmptyState
          icon="空"
          title={msg}
          actionLabel={
            dictError === 'auth' ? t('login') || 'Login' : t('backToDictionaries') || 'Back'
          }
          onAction={() => router.push(dictError === 'auth' ? '/auth' : '/dictionaries')}
        />
      </SiteLayout>
    )
  }

  if (reviewFlag && (!reviewWords || !data || data.length === 0)) {
    return (
      <SiteLayout>
        <EmptyState
          icon="复"
          title={t('dashNoMistakes') || 'No mistakes to review'}
          actionLabel={t('startLearning') || 'Start learning'}
          onAction={() => router.push('/learn')}
        />
      </SiteLayout>
    )
  }

  // Empty config → back to hub
  if (isSession && Array.isArray(data) && data.length === 0 && !reviewFlag && !dict) {
    // fall through to hub below by not treating as session UI
  } else if (isSession && data && data.length > 0) {
    const sessionConfig = configObject || {
      modes: DEFAULT_MODES,
      alwaysShowPinyin,
      alwaysShowTranslation,
      wordsLimit: 0,
      levels: [],
    }

    return (
      <SiteLayout>
        <div className="learn-session-bar">
          <button
            type="button"
            className="learn-session-bar__back"
            onClick={() => router.push('/learn')}
          >
            ← {t('learn') || 'Learn'}
          </button>
          <div className="learn-session-bar__meta">
            {personalDictionary
              ? personalDictionary.name
              : reviewFlag
                ? t('dashReviewMistakes') || 'Review'
                : (configObject?.levels || [])
                    .map((l) => String(l).toUpperCase())
                    .join(' · ') || t('learn')}
          </div>
          <div className="learn-session-bar__count">
            {data.length} {t('wordsCount') || t('lexiconWords') || 'cards'}
          </div>
        </div>
        <Learn data={data} config={sessionConfig} />
      </SiteLayout>
    )
  }

  const selectedCount = selected.length
  const startLabel =
    selectedCount === 0
      ? t('selectVocabulary') || 'Pick a deck'
      : `${t('startLearning') || 'Start'}${
          limit > 0 ? ` · ${limit}` : ''
        }`

  return (
    <SiteLayout>
      <div className="learn-hub">
        <header className="learn-hub__header">
          <h1 className="learn-hub__title">{t('learn') || 'Learn'}</h1>
          <p className="learn-hub__sub">
            {t('learnHubSub') || 'Pick decks, set size, start'}
          </p>
        </header>

        {lastConfig?.levels?.length > 0 && (
          <button type="button" className="learn-hub__continue" onClick={handleContinue}>
            <span className="learn-hub__continue-label">
              {t('dashContinue') || 'Continue last'}
            </span>
            <span className="learn-hub__continue-meta">
              {lastConfig.levels
                .map((l) => {
                  if (String(l).startsWith('personal-')) {
                    const id = String(l).replace('personal-', '')
                    const d = homePersonalDicts.find((x) => String(x.id) === id)
                    return d?.name || 'Deck'
                  }
                  return String(l).toUpperCase()
                })
                .join(', ')}
              {lastConfig.wordsLimit > 0 ? ` · ${lastConfig.wordsLimit}` : ''}
            </span>
          </button>
        )}

        {recent.length > 0 && !lastConfig && (
          <div className="learn-hub__recent">
            {recent.map((r) => (
              <button
                key={r.id}
                type="button"
                className="learn-hub__recent-chip"
                onClick={() => {
                  if (r.type === 'dict' || (r.id && !String(r.id).includes('hsk') && !r.config)) {
                    router.push({ pathname: '/learn', query: { dict: String(r.id) } })
                    return
                  }
                  if (r.config) {
                    try {
                      startSession(JSON.parse(r.config))
                    } catch {
                      /* ignore */
                    }
                  } else if (r.levels) {
                    startSession({
                      levels: r.levels,
                      modes: r.modes || DEFAULT_MODES,
                      wordsLimit: r.wordsLimit || 20,
                    })
                  }
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        <div className="learn-hub__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={`learn-hub__tab${tab === 'mine' ? ' is-active' : ''}`}
            onClick={() => setTab('mine')}
          >
            {t('myDictionaries') || 'My decks'}
            {homePersonalDicts.length > 0 && (
              <span className="learn-hub__tab-count">{homePersonalDicts.length}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'hsk'}
            className={`learn-hub__tab${tab === 'hsk' ? ' is-active' : ''}`}
            onClick={() => setTab('hsk')}
          >
            HSK
          </button>
        </div>

        {tab === 'mine' && (
          <section className="learn-hub__section">
            {homePersonalDicts.length === 0 ? (
              <div className="learn-hub__empty">
                <p>{t('noPersonalDicts') || 'No personal lists yet'}</p>
                <Link href="/dictionaries" className="btn btn-primary btn-sm">
                  {t('myDictionaries') || 'Create deck'}
                </Link>
              </div>
            ) : (
              <div className="learn-hub__list">
                {homePersonalDicts.map((d) => {
                  const id = `personal-${d.id}`
                  const count = d.words?.length || 0
                  const active = selected.includes(id)
                  return (
                    <div key={d.id} className={`learn-hub__deck${active ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        className="learn-hub__deck-main"
                        onClick={() => count > 0 && toggleLevel(id)}
                        disabled={count === 0}
                      >
                        <span className={`learn-hub__check${active ? ' is-on' : ''}`}>
                          {active ? '✓' : ''}
                        </span>
                        <span className="learn-hub__deck-text">
                          <span className="learn-hub__deck-name">{d.name}</span>
                          <span className="learn-hub__deck-meta">
                            {count} {t('lexiconWords') || 'words'}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="learn-hub__deck-go"
                        disabled={count === 0}
                        title={t('startLearning') || 'Start'}
                        onClick={() => quickStartPersonal(d)}
                      >
                        ▶
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <Link href="/dictionaries" className="learn-hub__manage">
              {t('goToMyDictionaries') || t('myDictionaries') || 'Manage'} →
            </Link>
          </section>
        )}

        {tab === 'hsk' && (
          <section className="learn-hub__section">
            <div className="learn-hub__hsk">
              {HSK_LEVELS.map((n) => {
                const id = `hsk${n}`
                const active = selected.includes(id)
                return (
                  <button
                    key={n}
                    type="button"
                    className={`learn-hub__hsk-card${active ? ' is-active' : ''}`}
                    onClick={() => toggleLevel(id)}
                  >
                    <span className="learn-hub__hsk-level">HSK {n}</span>
                    <span className="learn-hub__hsk-count">
                      {hskCounts[n]} {t('lexiconWords') || 'words'}
                    </span>
                    {active && <span className="learn-hub__hsk-mark">✓</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="learn-hub__options">
          <div className="learn-hub__opt">
            <div className="learn-hub__opt-label">{t('wordsLimit') || 'Cards'}</div>
            <div className="learn-hub__chips">
              {LIMIT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`learn-hub__chip${limit === n ? ' is-active' : ''}`}
                  onClick={() => setLimit(n)}
                >
                  {n === 0 ? t('all') || 'All' : n}
                </button>
              ))}
            </div>
          </div>

          <div className="learn-hub__opt">
            <div className="learn-hub__opt-label">{t('learningMode') || 'Modes'}</div>
            <div className="learn-hub__chips learn-hub__chips--wrap">
              {modeLabels(t).map((opt) => {
                const active = modes.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`learn-hub__chip${active ? ' is-active' : ''}`}
                    onClick={() => toggleMode(opt.value)}
                  >
                    {active ? '✓ ' : ''}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {selectedCount > 0 && (
          <p className="learn-hub__picked">
            {selectedCount} {t('selectedWords') || 'selected'}
            {selectedCount > 1 ? ` · ${selected.map((s) => s.toUpperCase()).join(', ')}` : ''}
          </p>
        )}

        <button
          type="button"
          className="learn-hub__start"
          disabled={selectedCount === 0}
          onClick={handleStart}
        >
          {startLabel}
        </button>
      </div>
    </SiteLayout>
  )
}

export default LearnPage
