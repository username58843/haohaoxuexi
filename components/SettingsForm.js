import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import axios from 'axios'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { useForm, Controller } from 'react-hook-form'
import {
  Form, FormGroup, Label, Input, Button, Alert, ListGroup, ListGroupItem
} from 'reactstrap'

import ButtonCheckboxGroup from './ButtonCheckboxGroup'
import { getAvailableDictionaries } from '~/lib/learn'

const SettingsForm = (props) => {
  const { onSubmit } = props
  const { user } = useAuth()
  const {
    t,
    alwaysShowPinyin,
    setAlwaysShowPinyin,
    alwaysShowTranslation,
    setAlwaysShowTranslation,
  } = useSettings()
  const [dictionaries, setDictionaries] = useState([])
  const [personalDictionaries, setPersonalDictionaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadDictionaries = async () => {
      setLoading(true)
      try {
        const availableDicts = getAvailableDictionaries()
        const hskDictionaries = availableDicts.filter(
          (dict) =>
            dict.toLowerCase().startsWith('hsk') &&
            /^\d+$/.test(dict.toLowerCase().replace('hsk', ''))
        )
        const extraPacks = availableDicts.filter(
          (dict) =>
            !dict.toLowerCase().startsWith('hsk') &&
            !String(dict).startsWith('personal-')
        )
        if (!cancelled) {
          setDictionaries([...hskDictionaries, ...extraPacks])
        }

        if (user) {
          const response = await axios.get('/api/dictionaries', {
            withCredentials: true,
          })
          if (!cancelled) {
            const sorted = (response.data.dictionaries || []).sort(
              (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            )
            setPersonalDictionaries(sorted)
          }
        } else if (!cancelled) {
          setPersonalDictionaries([])
        }
      } catch (error) {
        console.error('Failed to load dictionaries:', error)
        if (!cancelled) setPersonalDictionaries([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDictionaries()
    return () => {
      cancelled = true
    }
  }, [user])

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      levels: [],
      wordsLimit: 0,
      modes: ['characters-pinyin'],
      alwaysShowPinyin: alwaysShowPinyin || false,
      alwaysShowTranslation: alwaysShowTranslation || false,
    },
  })

  const submitSafe = (data) => {
    if (!data?.levels?.length) return
    onSubmit({
      ...data,
      levels: data.levels,
      modes: data.modes?.length ? data.modes : ['characters-pinyin'],
      wordsLimit: Number(data.wordsLimit) || 0,
    })
  }

  const personalOptions = personalDictionaries.map((dict) => ({
    value: `personal-${dict.id}`,
    label: `${dict.name} (${dict.words?.length || 0})`,
    isPersonal: true,
    dictionary: dict,
  }))

  const packOptions = dictionaries.map((dict) => {
    const isHsk = /^hsk\d+$/i.test(dict)
    return {
      value: dict,
      label: isHsk ? dict.toUpperCase() : dict,
      isPersonal: false,
    }
  })

  const allDictionaryOptions = [...personalOptions, ...packOptions]

  return (
    <Form onSubmit={handleSubmit(submitSafe)} className="stitch-panel settings-form">
      <Alert color="info" className="mb-3 stitch-hint">
        <Link href="/dictionaries" className="stitch-hint__link">
          {t('goToMyDictionaries') || t('myDictionaries') || 'My dictionaries'} →
        </Link>
        <div className="small mt-1 text-muted">
          {t('myDictionaries')} · HSK 1–6 · {t('textbookPacks') || 'packs'}
        </div>
      </Alert>

      {errors.levels && (
        <Alert color="danger" className="mb-3">
          {t('selectVocabulary') || 'Select at least one deck'}
        </Alert>
      )}

      <FormGroup>
        <Label for="levels">{t('selectVocabulary')}</Label>
        {loading ? (
          <div className="text-center py-3">
            <span style={{ color: '#aaa' }}>{t('loadingDictionaries')}</span>
          </div>
        ) : (
          <Controller
            control={control}
            rules={{ required: true }}
            name="levels"
            render={({ field }) => (
              <div className="settings-form__decks">
                <div className="settings-form__block">
                  <div className="settings-form__block-title">
                    {t('myDictionaries') || 'My dictionaries'}
                    {personalOptions.length > 0 && (
                      <span className="settings-form__count">{personalOptions.length}</span>
                    )}
                  </div>
                  {personalOptions.length === 0 ? (
                    <div className="settings-form__empty">
                      <span>{t('noPersonalDicts') || 'No personal lists yet'}</span>
                      <Link href="/dictionaries" className="settings-form__empty-link">
                        {t('goToMyDictionaries') || 'Create'} →
                      </Link>
                    </div>
                  ) : (
                    <ButtonCheckboxGroup
                      options={personalOptions}
                      selected={field.value || []}
                      onChange={field.onChange}
                      color="primary"
                    />
                  )}
                </div>

                <div className="settings-form__block">
                  <div className="settings-form__block-title">HSK · packs</div>
                  <ButtonCheckboxGroup
                    options={packOptions}
                    selected={field.value || []}
                    onChange={field.onChange}
                    color="secondary"
                  />
                </div>

                {field.value && field.value.length > 1 && (
                  <div className="mt-3">
                    <Label className="mb-2" style={{ color: '#fff' }}>
                      📋 {t('dictionaryOrder')}
                    </Label>
                    <ListGroup>
                      {field.value.map((levelId, index) => {
                        const option = allDictionaryOptions.find(
                          (opt) => opt.value === levelId
                        )
                        return (
                          <ListGroupItem
                            key={levelId}
                            className="d-flex justify-content-between align-items-center"
                            style={{
                              backgroundColor: '#2c2c2e',
                              borderColor: '#444',
                              color: '#fff',
                            }}
                          >
                            <div className="d-flex align-items-center">
                              <span className="me-2">⋮⋮</span>
                              <span>{option?.label || levelId}</span>
                            </div>
                            <div>
                              <Button
                                size="sm"
                                color="outline-light"
                                className="me-1"
                                disabled={index === 0}
                                onClick={() => {
                                  const newOrder = [...field.value]
                                  ;[newOrder[index - 1], newOrder[index]] = [
                                    newOrder[index],
                                    newOrder[index - 1],
                                  ]
                                  field.onChange(newOrder)
                                }}
                              >
                                ↑
                              </Button>
                              <Button
                                size="sm"
                                color="outline-light"
                                disabled={index === field.value.length - 1}
                                onClick={() => {
                                  const newOrder = [...field.value]
                                  ;[newOrder[index], newOrder[index + 1]] = [
                                    newOrder[index + 1],
                                    newOrder[index],
                                  ]
                                  field.onChange(newOrder)
                                }}
                              >
                                ↓
                              </Button>
                            </div>
                          </ListGroupItem>
                        )
                      })}
                    </ListGroup>
                  </div>
                )}
              </div>
            )}
          />
        )}
      </FormGroup>

      <FormGroup>
        <Label for="words-limit">{t('wordsLimit')}</Label>
        <Input
          type="number"
          {...register('wordsLimit')}
          placeholder="0"
          id="words-limit"
          min={0}
        />
      </FormGroup>

      <FormGroup className="mb-2">
        <Label className="mb-1">{t('learningMode')}</Label>
        <div className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
          {t('modesDescription')}
        </div>
        <Controller
          control={control}
          name="modes"
          render={({ field: { onChange, value } }) => {
            const modeOptions = [
              { value: 'characters-pinyin', label: t('charactersToPinyin') },
              { value: 'pinyin-characters', label: t('pinyinToCharacters') },
              {
                value: 'characters-translation',
                label: t('charactersToTranslation'),
              },
              {
                value: 'translation-characters',
                label: t('translationToCharacters'),
              },
            ]
            const selected = value || []
            const toggleMode = (mode) => {
              if (selected.includes(mode)) {
                if (selected.length <= 1) return
                onChange(selected.filter((v) => v !== mode))
              } else {
                onChange([...selected, mode])
              }
            }
            return (
              <div className="compact-chip-row">
                {modeOptions.map((opt) => {
                  const active = selected.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`compact-chip ${active ? 'is-active' : ''}`}
                      onClick={() => toggleMode(opt.value)}
                      aria-pressed={active}
                    >
                      {active ? '✓ ' : ''}
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )
          }}
        />
      </FormGroup>

      <FormGroup className="mb-2">
        <Label className="mb-1">{t('otherSettings')}</Label>
        <div className="compact-chip-row">
          <Controller
            control={control}
            name="alwaysShowPinyin"
            render={({ field: { onChange, value } }) => (
              <button
                type="button"
                className={`compact-chip ${value ? 'is-active' : ''}`}
                onClick={() => {
                  const next = !value
                  onChange(next)
                  setAlwaysShowPinyin(next)
                }}
                aria-pressed={!!value}
              >
                {value ? '✓ ' : ''}
                {t('alwaysShowPinyin')}
              </button>
            )}
          />
          <Controller
            control={control}
            name="alwaysShowTranslation"
            render={({ field: { onChange, value } }) => (
              <button
                type="button"
                className={`compact-chip ${value ? 'is-active' : ''}`}
                onClick={() => {
                  const next = !value
                  onChange(next)
                  setAlwaysShowTranslation(next)
                }}
                aria-pressed={!!value}
              >
                {value ? '✓ ' : ''}
                {t('alwaysShowDefinition')}
              </button>
            )}
          />
        </div>
      </FormGroup>

      <FormGroup className="mt-4 mb-0">
        <Button type="submit" color="primary" size="lg" className="w-100 stitch-cta">
          {t('startLearning')}
        </Button>
      </FormGroup>
    </Form>
  )
}

SettingsForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
}

export default SettingsForm
