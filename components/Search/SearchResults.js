import React, { useState, useEffect, useRef } from 'react'
import { Card, CardBody, Button, Modal, ModalHeader, ModalBody, Badge, Alert } from 'reactstrap'
import axios from 'axios'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

function StrokeOrderSVG({ character, t }) {
  const [svgContent, setSvgContent] = useState(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!character) return

    // Находим первый китайский иероглиф
    const chineseChars = [...character].filter((char) => {
      const code = char.codePointAt(0)
      return code >= 0x4E00 && code <= 0x9FFF
    })

    if (chineseChars.length === 0) {
      setError(true)
      return
    }

    setLoading(true)
    setError(false)

    const charCode = chineseChars[0].codePointAt(0)

    // Пробуем несколько источников для SVG
    const sources = [
      `https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/svgs/${charCode}.svg`,
      `https://raw.githubusercontent.com/skishore/makemeahanzi/master/svgs/${charCode}.svg`,
      `https://unpkg.com/makemeahanzi-data@latest/svgs/${charCode}.svg`
    ]

    const tryLoadSVG = async (sources) => {
      for (const url of sources) {
        try {
          const response = await fetch(url, {
            timeout: 5000,
            headers: {
              'Accept': 'image/svg+xml'
            }
          })

          if (response.ok) {
            const svg = await response.text()
            if (svg.includes('<svg')) {
              setSvgContent(svg)
              return
            }
          }
        } catch (error) {
          console.log(`Failed to load SVG from ${url}:`, error.message)
        }
      }

      // Если все источники не сработали
      setError(true)
    }

    tryLoadSVG(sources).finally(() => setLoading(false))
  }, [character])

  if (loading) return (
    <div style={{
      textAlign: 'center',
      padding: '20px',
      color: '#aaa'
    }}>
      {t('loadingStrokeOrder')}
    </div>
  )

  if (error || !svgContent) return (
    <div style={{
      textAlign: 'center',
      padding: '20px',
      color: '#666',
      fontSize: '0.9rem'
    }}>
      {t('strokeOrderNotAvailable')}
    </div>
  )

  return (
    <div style={{
      textAlign: 'center',
      margin: '10px 0'
    }}>
      <div
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{
          maxWidth: '250px',
          maxHeight: '250px',
          margin: '0 auto',
          filter: 'brightness(0) invert(1)', // Делаем SVG белым для темной темы
          opacity: 0.9
        }}
      />
    </div>
  )
}

function AudioButton({ text, lang = 'zh-CN', t }) {
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const audioRef = useRef(null)

  const playAudio = async () => {
    if (audioUrl) {
      // Если аудио уже загружено, просто проигрываем
      audioRef.current?.play()
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/search/audio?text=${encodeURIComponent(text)}&lang=${lang}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        // Автоматически проигрываем после загрузки
        setTimeout(() => {
          audioRef.current?.play()
        }, 100)
      } else {
        // Fallback to browser TTS if API fails
        console.log('API TTS failed, using browser TTS')
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang
        utterance.rate = 0.8
        utterance.pitch = 1
        window.speechSynthesis.speak(utterance)
      }
    } catch (error) {
      console.error('Audio loading error:', error)
      // Fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 0.8
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        color="link"
        onClick={(e) => {
          e.stopPropagation() // Предотвращаем открытие модалки
          playAudio()
        }}
        className="p-0 ms-2"
        title={t('playPronunciation')}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: loading ? '#333' : '#ff3b30',
          border: 'none',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.backgroundColor = '#ff5545'
        }}
        onMouseLeave={(e) => {
          if (!loading) e.currentTarget.style.backgroundColor = '#ff3b30'
        }}
      >
        {loading ? (
          <span style={{ color: '#fff', fontSize: '0.8rem' }}>⏳</span>
        ) : (
          <span style={{ color: '#fff', fontSize: '1rem' }}>▶</span>
        )}
      </Button>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          style={{ display: 'none' }}
          onEnded={() => {
            URL.revokeObjectURL(audioUrl)
            setAudioUrl(null)
          }}
        />
      )}
    </>
  )
}

function ExampleSentences({ word, isPremium, t }) {
  const [examples, setExamples] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const limit = isPremium ? 10 : 6

  useEffect(() => {
    if (!word) return
    setLoading(true)
    axios.get(`/api/search/examples?word=${encodeURIComponent(word)}`)
      .then(res => {
        setExamples(res.data.examples || [])
        console.log(`Loaded ${res.data.examples?.length || 0} examples for &quot;${word}&quot;`)
      })
      .catch(err => {
        console.error('Failed to load examples:', err)
        setExamples([])
      })
      .finally(() => setLoading(false))
  }, [word])

  if (loading) return (
    <div className="mt-3" style={{ color: '#fff', textAlign: 'center' }}>
      <span style={{ opacity: 0.7 }}>{t('loadingExamples')}</span>
    </div>
  )

  if (examples.length === 0) return (
    <div className="mt-3" style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center' }}>
      {t('noExamplesFound')}
    </div>
  )

  const displayedExamples = showAll ? examples : examples.slice(0, limit)

  return (
    <div className="mt-4">
      <h5 style={{
        color: '#fff',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        📚 {t('exampleSentencesTitle')}
        <Badge
          style={{
            backgroundColor: isPremium ? '#ff3b30' : '#666',
            color: '#fff',
            fontSize: '0.7rem'
          }}
        >
          {isPremium ? t('premium') : t('free')}
        </Badge>
      </h5>

      {displayedExamples.map((ex, idx) => (
        <Card
          key={idx}
          className="mb-2"
          style={{
            backgroundColor: '#2c2c2e',
            borderColor: '#444',
            transition: 'all 0.3s ease',
            animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`,
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#ff3b30'
            e.currentTarget.style.transform = 'translateX(5px)'
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(255, 59, 48, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#444'
            e.currentTarget.style.transform = 'translateX(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <CardBody style={{ padding: '15px' }}>
            <div className="mb-2" style={{ color: '#fff', lineHeight: '1.5' }}>
              <strong className="hanzi" lang="zh" style={{
                color: '#fff',
                fontSize: '1.1rem',
                marginRight: '10px'
              }}>
                {ex.chinese}
              </strong>
              <AudioButton text={ex.chinese} lang="zh-CN" t={t} />
            </div>
            <div style={{
              color: '#aaa',
              fontSize: '0.9rem',
              lineHeight: '1.4',
              paddingLeft: '5px',
              borderLeft: '2px solid #555'
            }}>
              {ex.english}
            </div>
          </CardBody>
        </Card>
      ))}

      {examples.length > limit && !showAll && (
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <Button
            color="outline-primary"
            size="sm"
            onClick={() => setShowAll(true)}
            style={{
              borderColor: '#ff3b30',
              color: '#ff3b30',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#ff3b30'
              e.target.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent'
              e.target.style.color = '#ff3b30'
            }}
          >
            {t('showAllExamples').replace('{count}', examples.length).replace('{more}', examples.length - limit)}
          </Button>
        </div>
      )}

      {showAll && examples.length > limit && (
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <Button
            color="outline-secondary"
            size="sm"
            onClick={() => setShowAll(false)}
            style={{
              borderColor: '#666',
              color: '#666',
              backgroundColor: 'transparent'
            }}
          >
            {t('showLess')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function SearchResults({ results, searchTerm }) {
  const { user } = useAuth()
  const { t } = useSettings()
  const [selectedWord, setSelectedWord] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedWordsCount, setSelectedWordsCount] = useState(0)
  const [addSuccess, setAddSuccess] = useState('')
  const isPremium = user?.isPremium || false

  useEffect(() => {
    // Загружаем количество выбранных слов при монтировании
    if (user) {
      loadSelectedWordsCount()
    }
  }, [user])

  const loadSelectedWordsCount = async () => {
    try {
      const response = await axios.get('/api/dictionaries/selected-words')
      setSelectedWordsCount(response.data.selectedWords?.length || 0)
    } catch (error) {
      console.error('Failed to load selected words count:', error)
    }
  }

  const openWordDetail = (word) => {
    setSelectedWord(word)
    setModalOpen(true)
    setAddSuccess('')
  }

  const addToSelectedWords = async (word) => {
    try {
      await axios.post('/api/dictionaries/selected-words', { word })
      setAddSuccess(t('wordAddedToSelected'))
      loadSelectedWordsCount()
      setTimeout(() => setAddSuccess(''), 3000)
    } catch (error) {
      console.error('Failed to add word:', error)
      setAddSuccess(t('failedToAddWord'))
      setTimeout(() => setAddSuccess(''), 3000)
    }
  }

  // Показываем "Searching..." пока идёт загрузка
  if (!results || results.length === 0) {
    return (
      <div className="text-center mt-4">
        <p style={{ color: '#fff', fontSize: '1.2rem' }}>
          {t('noResultsFound')} <span style={{ color: '#ff3b30', fontWeight: 'bold' }}>{searchTerm}</span>
        </p>
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
          {t('tryDifferentSearch')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mt-4">
        <h4 style={{ color: '#fff', marginBottom: '20px' }}>
          {t('foundResults')} <span style={{ color: '#ff3b30', fontWeight: 'bold' }}>{results.length}</span> {t('results')}
        </h4>
        {results.map((result, idx) => (
          <Card 
            key={idx} 
            className="mb-3 search-result-card glass" 
            style={{ 
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`
            }}
            onClick={() => openWordDetail(result)}
          >
            <CardBody>
              <div className="d-flex justify-content-between align-items-start">
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openWordDetail(result)}>
                  <h3 className="mb-1 hanzi" lang="zh" style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 600 }}>
                    {result.simplified}
                  </h3>
                  <div className="mb-2">
                    <span style={{ color: '#ffc107', fontSize: '1.1rem', fontWeight: 'bold' }}>
                      {result.pinyin}
                    </span>
                    <AudioButton text={result.simplified} lang="zh" t={t} />
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.95rem' }}>
                    {result.definitions.slice(0, 3).join('; ')}
                    {result.definitions.length > 3 && '...'}
                  </div>
                </div>

                {/* Кнопки справа */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '15px' }}>
                  <Button
                    size="sm"
                    color="success"
                    onClick={(e) => {
                      e.stopPropagation()
                      addToSelectedWords(result)
                    }}
                    title={t('addToSelected')}
                  >
                    ➕
                  </Button>
                  <Button
                    size="sm"
                    color="secondary"
                    onClick={() => openWordDetail(result)}
                    title={t('viewDetails')}
                  >
                    👁️
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={modalOpen}
        toggle={() => setModalOpen(false)}
        size="lg"
        centered
        style={{
          maxWidth: '700px'
        }}
      >
        <ModalHeader
          toggle={() => setModalOpen(false)}
          style={{
            backgroundColor: '#1c1c1e',
            color: '#fff',
            borderBottom: '1px solid #444',
            padding: '15px 20px'
          }}
          close={<button className="btn-close btn-close-white" onClick={() => setModalOpen(false)} />}
        >
          <span className="hanzi" lang="zh" style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff' }}>
            {selectedWord?.simplified}
          </span>
        </ModalHeader>

        <ModalBody style={{
          backgroundColor: '#1c1c1e',
          color: '#fff',
          padding: '20px',
          maxHeight: '70vh',
          overflowY: 'auto'
        }}>
          {addSuccess && (
            <Alert color={addSuccess.includes('Failed') ? 'danger' : 'success'} className="mb-3">
              {addSuccess}
            </Alert>
          )}

          {selectedWord && (
            <div className="word-detail-content">
              {/* Кнопка добавления в выбранные */}
              <div className="mb-3 text-end">
                <Button
                  color="success"
                  size="sm"
                  onClick={() => addToSelectedWords(selectedWord)}
                  disabled={addSuccess === t('wordAddedToSelected')}
                >
                  ➕ {t('addToSelectedWords')} ({selectedWordsCount})
                </Button>
              </div>

              {/* Основная информация о слове */}
              <div className="row mb-4">
                <div className="col-lg-6">
                  <div className="text-center mb-4">
                    <div
                      className="hanzi word-detail-hanzi"
                      lang="zh"
                      style={{
                      fontSize: '4rem',
                      fontWeight: 600,
                      color: '#fff',
                      textShadow: '0 0 30px rgba(255, 59, 48, 0.5)',
                      marginBottom: '20px',
                      lineHeight: '1'
                    }}>
                      {selectedWord.simplified}
                    </div>

                    {selectedWord.traditional && selectedWord.traditional !== selectedWord.simplified && (
                      <div style={{
                        color: '#aaa',
                        marginBottom: '15px',
                        fontSize: '1. 2rem'
                      }}>
                        {t('traditional')} <strong className="hanzi" lang="zh" style={{ color: '#fff' }}>{selectedWord.traditional}</strong>
                      </div>
                    )}

                    <div style={{
                      marginBottom: '20px',
                      padding: '15px',
                      backgroundColor: '#2c2c2e',
                      borderRadius: '10px',
                      border: '1px solid #444'
                    }}>
                      <div style={{
                        fontSize: '1.5rem',
                        color: '#ffc107',
                        fontWeight: 'bold',
                        marginBottom: '10px'
                      }}>
                        {selectedWord.pinyin || 'Loading...'}
                      </div>
                      <AudioButton text={selectedWord.simplified} lang="zh-CN" t={t} />
                    </div>

                    <div style={{
                      padding: '15px',
                      backgroundColor: '#2c2c2e',
                      borderRadius: '10px',
                      border: '1px solid #444'
                    }}>
                      <div style={{
                        fontSize: '1rem',
                        color: '#fff',
                        lineHeight: '1. 6'
                      }}>
                        <strong style={{ color: '#ff3b30' }}>{t('definition')}:</strong><br />
                        {selectedWord.definitions.join('; ')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#2c2c2e',
                    borderRadius: '10px',
                    border: '1px solid #444',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <h4 style={{
                      color: '#fff',
                      marginBottom: '20px',
                      textAlign: 'center'
                    }}>
                      ✍️ {t('strokeOrder')}
                    </h4>
                    <StrokeOrderSVG character={selectedWord.simplified} t={t} />
                  </div>
                </div>
              </div>

              {/* Примеры предложений */}
              <ExampleSentences word={selectedWord.simplified} isPremium={isPremium} t={t} />
            </div>
          )}
        </ModalBody>
      </Modal>
    </>
  )
}

