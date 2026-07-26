import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  Container, Row, Col, Card, CardBody, Button, Modal, ModalHeader, ModalBody,
  Form, FormGroup, Label, Input, Alert, Badge, ListGroup, ListGroupItem,
  Dropdown, DropdownToggle, DropdownMenu, DropdownItem
} from 'reactstrap'
import axios from 'axios'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import SiteLayout from '~/components/SiteLayout'
import Link from '~/components/Link'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import LoadingSpinner from '~/components/LoadingSpinner'

export default function DictionariesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { t } = useSettings()
  const [dictionaries, setDictionaries] = useState([])
  const [selectedWords, setSelectedWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedDictionary, setSelectedDictionary] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    words: []
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importData, setImportData] = useState('')
  const [importFormat, setImportFormat] = useState('json')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    // Wait for auth bootstrap — never redirect while loading
    if (authLoading) return
    if (!user) {
      router.replace('/auth')
      return
    }
    loadData()
  }, [user, authLoading, router])

  const loadData = async () => {
    try {
      const [dictResponse, wordsResponse] = await Promise.all([
        axios.get('/api/dictionaries', { withCredentials: true }),
        axios.get('/api/dictionaries/selected-words', { withCredentials: true })
      ])

      // Сортируем словари: новые сверху (по дате создания, убывание)
      const sortedDictionaries = (dictResponse.data.dictionaries || []).sort((a, b) => {
        const dateA = new Date(a.createdAt || 0)
        const dateB = new Date(b.createdAt || 0)
        return dateB - dateA // Новые сверху
      })

      setDictionaries(sortedDictionaries)
      setSelectedWords(wordsResponse.data.selectedWords || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDictionary = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.name.trim()) {
      setError(t('dictionaryNameRequired'))
      return
    }

    try {
      await axios.post('/api/dictionaries', {
        name: formData.name.trim(),
        words: formData.words
      })

      setSuccess(t('dictionaryCreated'))
      setModalOpen(false)
      setFormData({ name: '', words: [] })
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || t('failedCreateDictionary'))
    }
  }

  const handleCreateFromSelected = async () => {
    if (selectedWords.length === 0) {
      setError(t('noWordsSelected'))
      return
    }

    const dictionaryName = prompt(t('enterDictionaryName'))
    if (!dictionaryName || !dictionaryName.trim()) return

    try {
      await axios.put('/api/dictionaries/selected-words', {
        dictionaryName: dictionaryName.trim()
      })

      setSuccess(t('dictionaryFromSelected'))
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || t('failedCreateDictionary'))
    }
  }

  const handleUpdateDictionary = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedDictionary) return

    try {
      await axios.put(`/api/dictionaries/${selectedDictionary.id}`, {
        name: formData.name.trim(),
        words: formData.words
      })

      setSuccess(t('dictionaryUpdated'))
      setEditModalOpen(false)
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update dictionary')
    }
  }

  const handleDeleteDictionary = async (dictionaryId) => {
    if (!confirm(t('confirmDeleteDictionary'))) return

    try {
      await axios.delete(`/api/dictionaries/${dictionaryId}`)
      setSuccess(t('dictionaryDeleted'))
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete dictionary')
    }
  }

  // ===== ЭКСПОРТ СЛОВАРЯ =====
  const exportDictionary = (dictionary, format) => {
    let content = ''
    let filename = `${dictionary.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}`
    let mimeType = ''

    if (format === 'json') {
      content = JSON.stringify({
        name: dictionary.name,
        words: dictionary.words,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }, null, 2)
      filename += '.json'
      mimeType = 'application/json'
    } else if (format === 'csv') {
      // CSV формат: simplified,pinyin,definitions
      const header = 'simplified,pinyin,definitions'
      const rows = dictionary.words.map(word => {
        const simplified = word.simplified || ''
        const pinyin = word.pinyin || ''
        const definitions = (word.definitions || []).join('; ').replace(/"/g, '""')
        return `"${simplified}","${pinyin}","${definitions}"`
      })
      content = [header, ...rows].join('\n')
      filename += '.csv'
      mimeType = 'text/csv'
    }

    // Создаём и скачиваем файл
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setSuccess(t('dictionaryExported').replace('{name}', dictionary.name).replace('{format}', format.toUpperCase()))
  }

  // ===== ИМПОРТ СЛОВАРЯ =====
  const handleImport = async () => {
    setImportError('')

    if (!importData.trim()) {
      setImportError(t('pleasePasteOrUpload'))
      return
    }

    try {
      let parsedWords = []
      let dictionaryName = ''

      if (importFormat === 'json') {
        const parsed = JSON.parse(importData)

        if (parsed.words && Array.isArray(parsed.words)) {
          parsedWords = parsed.words
          dictionaryName = parsed.name || 'Imported Dictionary'
        } else if (Array.isArray(parsed)) {
          parsedWords = parsed
          dictionaryName = 'Imported Dictionary'
        } else {
          throw new Error(t('invalidJsonFormat'))
        }
      } else if (importFormat === 'csv') {
        const lines = importData.trim().split('\n')

        // Пропускаем заголовок если есть
        const startIndex = lines[0].toLowerCase().includes('simplified') ? 1 : 0

        parsedWords = lines.slice(startIndex).map(line => {
          // Парсим CSV с учётом кавычек
          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
          if (!matches || matches.length < 1) return null

          const clean = (str) => str ? str.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : ''

          return {
            simplified: clean(matches[0]),
            pinyin: clean(matches[1] || ''),
            definitions: clean(matches[2] || '').split(';').map(d => d.trim()).filter(Boolean)
          }
        }).filter(w => w && w.simplified)

        dictionaryName = 'Imported from CSV'
      }

      // Валидация слов
      const validWords = parsedWords.filter(word =>
        word &&
        typeof word.simplified === 'string' &&
        word.simplified.trim().length > 0
      ).map(word => ({
        simplified: word.simplified.trim(),
        pinyin: (word.pinyin || '').trim(),
        definitions: Array.isArray(word.definitions) ? word.definitions : ['']
      }))

      if (validWords.length === 0) {
        throw new Error(t('noValidWordsFound'))
      }

      // Запрашиваем имя словаря
      const finalName = prompt(t('enterDictionaryName'), dictionaryName)
      if (!finalName || !finalName.trim()) {
        setImportError(t('dictionaryNameRequired'))
        return
      }

      // Создаём словарь через API
      await axios.post('/api/dictionaries', {
        name: finalName.trim(),
        words: validWords
      })

      setSuccess(t('importSuccess').replace('{count}', validWords.length))
      setImportModalOpen(false)
      setImportData('')
      loadData()
    } catch (err) {
      console.error('Import error:', err)
      setImportError(err.message || t('failedToParseFile'))
    }
  }

  // Обработчик загрузки файла
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setImportData(event.target.result)

      // Автоопределение формата
      if (file.name.endsWith('.json')) {
        setImportFormat('json')
      } else if (file.name.endsWith('.csv')) {
        setImportFormat('csv')
      }
    }
    reader.readAsText(file)
  }

  const openEditModal = (dictionary) => {
    setSelectedDictionary(dictionary)
    setFormData({
      name: dictionary.name,
      words: dictionary.words || []
    })
    setEditModalOpen(true)
  }

  const onDragEnd = async (result) => {
    if (!result.destination) return

    const items = Array.from(dictionaries)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setDictionaries(items)

    // Отправляем новый порядок на сервер
    try {
      await axios.put('/api/dictionaries/reorder', {
        dictionaryOrder: items.map(d => d.id)
      })
    } catch (error) {
      console.error('Failed to reorder dictionaries:', error)
      // Возвращаем исходный порядок в случае ошибки
      loadData()
    }
  }

  if (authLoading || !user) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loading')} />
      </SiteLayout>
    )
  }

  if (loading) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loadingDictionaries')} />
      </SiteLayout>
    )
  }

  return (
    <SiteLayout>
      <Container className="dictionaries-page px-0">
        <Row>
          <Col>
            <div className="page-heading">
              <h1 className="page-heading__title">{t('myDictionaries')}</h1>
              <p className="page-heading__sub">
                {dictionaries?.length || 0} · {selectedWords?.length || 0}{' '}
                {t('selectedWords') || 'selected'}
              </p>
            </div>

            {success && <Alert color="success">{success}</Alert>}
            {error && <Alert color="danger">{error}</Alert>}

            <div className="d-flex gap-2 mb-4 flex-wrap">
              <Button color="primary" onClick={() => setModalOpen(true)}>
                {t('createNewDictionary')}
              </Button>

              <Button color="secondary" onClick={() => setImportModalOpen(true)}>
                {t('importDictionary')}
              </Button>

              {selectedWords.length > 0 && (
                <Button color="info" onClick={handleCreateFromSelected}>
                  {t('createFromSelected')} ({selectedWords.length})
                </Button>
              )}

              <Link href="/dictionary" className="btn btn-secondary">
                {t('dictionary') || 'HSK'}
              </Link>
            </div>

            {/* Выбранные слова */}
            {selectedWords.length > 0 && (
              <Card className="mb-4 glass">
                <CardBody>
                  <h4>{t('selectedWords')} ({selectedWords.length})</h4>
                  <div className="d-flex flex-wrap gap-2">
                    {selectedWords.slice(0, 10).map((word, idx) => (
                      <Badge key={idx} color="secondary" className="p-2 hanzi selected-word-hanzi" lang="zh">
                        {word.simplified}
                      </Badge>
                    ))}
                    {selectedWords.length > 10 && (
                      <Badge color="secondary">{t('andMore').replace('{count}', selectedWords.length - 10)}</Badge>
                    )}
                  </div>
                  <Button
                    color="outline-danger"
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      try {
                        await axios.delete('/api/dictionaries/selected-words')
                        loadData()
                      } catch (err) {
                        console.error(t('failedToClearSelected'), err)
                      }
                    }}
                  >
                    {t('clearAll')}
                  </Button>
                </CardBody>
              </Card>
            )}

            {/* Список словарей с drag & drop */}
            {dictionaries.length > 0 ? (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="dictionaries">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {dictionaries.map((dict, index) => (
                        <Draggable key={dict.id} draggableId={String(dict.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`mb-3 dict-card-wrap${snapshot.isDragging ? ' is-dragging' : ''}`}
                              style={provided.draggableProps.style}
                            >
                              <Card className="dict-card glass mb-0">
                                <CardBody>
                                  <div className="d-flex justify-content-between align-items-center gap-2">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="dict-card__handle"
                                      style={{ cursor: 'grab', minWidth: 0, flex: 1 }}
                                    >
                                      <h5 className="mb-1" style={{ color: '#fff' }}>
                                        {dict.name}
                                      </h5>
                                      <small className="text-muted">
                                        {dict.words?.length || 0} {t('words')}
                                      </small>
                                    </div>

                                    <Dropdown
                                      isOpen={dropdownOpen === dict.id}
                                      toggle={() =>
                                        setDropdownOpen(dropdownOpen === dict.id ? null : dict.id)
                                      }
                                      direction="down"
                                      className="dict-actions-dropdown"
                                    >
                                      <DropdownToggle
                                        caret
                                        color="secondary"
                                        size="sm"
                                        className="dict-actions-toggle"
                                      >
                                        {t('actions')}
                                      </DropdownToggle>
                                      <DropdownMenu end flip className="dict-actions-menu">
                                        <DropdownItem onClick={() => openEditModal(dict)}>
                                          {t('editDictionary')}
                                        </DropdownItem>
                                        <DropdownItem
                                          onClick={() => {
                                            if (!dict?.id) return
                                            if (!dict.words?.length) {
                                              alert(t('dictionaryEmpty') || 'Dictionary has no words')
                                              return
                                            }
                                            router.push({
                                              pathname: '/learn',
                                              query: { dict: String(dict.id) },
                                            })
                                          }}
                                        >
                                          {t('startLearningDict')}
                                        </DropdownItem>
                                        <DropdownItem divider />
                                        <DropdownItem onClick={() => exportDictionary(dict, 'json')}>
                                          {t('exportAsJSON')}
                                        </DropdownItem>
                                        <DropdownItem onClick={() => exportDictionary(dict, 'csv')}>
                                          {t('exportAsCSV')}
                                        </DropdownItem>
                                        <DropdownItem divider />
                                        <DropdownItem
                                          onClick={() => handleDeleteDictionary(dict.id)}
                                          className="text-danger"
                                        >
                                          {t('deleteDictionary')}
                                        </DropdownItem>
                                      </DropdownMenu>
                                    </Dropdown>
                                  </div>
                                </CardBody>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <Card className="glass">
                <CardBody className="text-center">
                  <h4 style={{ color: '#fff' }}>{t('noDictionariesYet')}</h4>
                  <p style={{ color: '#aaa' }}>
                    {t('createYourFirst')}
                  </p>
                  <Button color="primary" onClick={() => setModalOpen(true)}>
                    {t('createNewDictionary')}
                  </Button>
                </CardBody>
              </Card>
            )}
          </Col>
        </Row>

        {/* Модальное окно создания словаря */}
        <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)}>
          <ModalHeader
            toggle={() => setModalOpen(false)}
            style={{ backgroundColor: '#1c1c1e', color: '#fff', borderColor: '#333' }}
            close={<button className="btn-close btn-close-white" onClick={() => setModalOpen(false)} />}
          >
            {t('createNewDictionary')}
          </ModalHeader>
          <ModalBody style={{ backgroundColor: '#1c1c1e', color: '#fff' }}>
            <Form onSubmit={handleCreateDictionary}>
              <FormGroup>
                <Label>{t('dictionaryName')}</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('dictionaryNamePlaceholder')}
                  required
                  style={{ backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
                />
              </FormGroup>
              <Button type="submit" color="primary">{t('createNewDictionary')}</Button>
            </Form>
          </ModalBody>
        </Modal>

        {/* Модальное окно редактирования словаря */}
        <Modal isOpen={editModalOpen} toggle={() => setEditModalOpen(false)} size="lg">
          <ModalHeader
            toggle={() => setEditModalOpen(false)}
            style={{ backgroundColor: '#1c1c1e', color: '#fff', borderColor: '#333' }}
            close={<button className="btn-close btn-close-white" onClick={() => setEditModalOpen(false)} />}
          >
            {t('editDictionaryTitle').replace('{name}', selectedDictionary?.name)}
          </ModalHeader>
          <ModalBody style={{ backgroundColor: '#1c1c1e', color: '#fff' }}>
            <Form onSubmit={handleUpdateDictionary}>
              <FormGroup>
                <Label>{t('dictionaryName')}</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
                />
              </FormGroup>

              <FormGroup>
                <Label>{t('wordsLabel')}</Label>
                {formData.words?.map((word, idx) => (
                  <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                    <Input
                      type="text"
                      className="hanzi"
                      lang="zh"
                      value={word.simplified || ''}
                      onChange={(e) => {
                        const newWords = [...formData.words]
                        newWords[idx].simplified = e.target.value
                        setFormData({ ...formData, words: newWords })
                      }}
                      placeholder={t('chineseCharacter')}
                      style={{ flex: 1, backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
                    />
                    <Input
                      type="text"
                      value={word.pinyin || ''}
                      onChange={(e) => {
                        const newWords = [...formData.words]
                        newWords[idx].pinyin = e.target.value
                        setFormData({ ...formData, words: newWords })
                      }}
                      placeholder={t('pinyinLabel')}
                      style={{ flex: 1, backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
                    />
                    <Input
                      type="text"
                      value={word.definitions?.join('; ') || ''}
                      onChange={(e) => {
                        const newWords = [...formData.words]
                        newWords[idx].definitions = e.target.value.split(';').map(d => d.trim())
                        setFormData({ ...formData, words: newWords })
                      }}
                      placeholder={t('translationLabel')}
                      style={{ flex: 2, backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
                    />
                    <Button
                      color="danger"
                      size="sm"
                      onClick={() => {
                        const newWords = formData.words.filter((_, i) => i !== idx)
                        setFormData({ ...formData, words: newWords })
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ))}

                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      words: [...(formData.words || []), {
                        simplified: '',
                        pinyin: '',
                        definitions: ['']
                      }]
                    })
                  }}
                >
                  {t('addWord')}
                </Button>
              </FormGroup>

              <Button type="submit" color="primary">{t('updateDictionary')}</Button>
            </Form>
          </ModalBody>
        </Modal>

        {/* Модальное окно импорта */}
        <Modal isOpen={importModalOpen} toggle={() => setImportModalOpen(false)} size="lg">
          <ModalHeader
            toggle={() => setImportModalOpen(false)}
            style={{ backgroundColor: '#1c1c1e', color: '#fff', borderColor: '#333' }}
            close={<button className="btn-close btn-close-white" onClick={() => setImportModalOpen(false)} />}
          >
            {t('importDictionaryTitle')}
          </ModalHeader>
          <ModalBody style={{ backgroundColor: '#1c1c1e', color: '#fff' }}>
            {importError && <Alert color="danger">{importError}</Alert>}

            <FormGroup>
              <Label>{t('formatLabel')}</Label>
              <Input
                type="select"
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value)}
                style={{ backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </Input>
            </FormGroup>

            <FormGroup>
              <Label>{t('uploadFile')}</Label>
              <Input
                type="file"
                accept=".json,.csv"
                onChange={handleFileUpload}
                style={{ backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
              />
            </FormGroup>

            <FormGroup>
              <Label>{t('orPasteContent')}</Label>
              <Input
                type="textarea"
                rows={10}
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={importFormat === 'json'
                  ? '{\n  "name": "My Dictionary",\n  "words": [\n    {"simplified": "你好", "pinyin": "nǐ hǎo", "definitions": ["hello"]}\n  ]\n}'
                  : 'simplified,pinyin,definitions\n"你好","nǐ hǎo","hello"\n"谢谢","xiè xie","thank you"'
                }
                style={{
                  backgroundColor: '#2c2c2e',
                  color: '#fff',
                  borderColor: '#444',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }}
              />
            </FormGroup>

            <div className="d-flex gap-2">
              <Button color="primary" onClick={handleImport}>
                {t('importDictionaryBtn')}
              </Button>
              <Button color="secondary" onClick={() => setImportModalOpen(false)}>
                {t('cancel')}
              </Button>
            </div>

            <hr style={{ borderColor: '#444', margin: '20px 0' }} />

            <div style={{ color: '#fff', fontSize: '0.9rem' }}>
              {/* JSON Format */}
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#fff' }}>JSON Format:</strong>
                  <Button
                    size="sm"
                    color="secondary"
                    onClick={() => {
                      const jsonExample = `{
  "name": "Dictionary Name",
  "words": [
    {
      "simplified": "汉字",
      "pinyin": "hàn zì",
      "definitions": ["Chinese character"]
    }
  ]
}`
                      navigator.clipboard.writeText(jsonExample)
                      setSuccess('JSON example copied!')
                      setTimeout(() => setSuccess(''), 2000)
                    }}
                    style={{ fontSize: '0.75rem' }}
                  >
                    📋 Copy
                  </Button>
                </div>
                <pre style={{
                  backgroundColor: '#2c2c2e',
                  padding: '15px',
                  borderRadius: '8px',
                  marginTop: '10px',
                  color: '#fff',
                  border: '1px solid #444',
                  overflow: 'auto'
                }}>
{`{
  "name": "Dictionary Name",
  "words": [
    {
      "simplified": "汉字",
      "pinyin": "hàn zì",
      "definitions": ["Chinese character"]
    }
  ]
}`}
                </pre>
              </div>

              {/* CSV Format */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#fff' }}>CSV Format:</strong>
                  <Button
                    size="sm"
                    color="secondary"
                    onClick={() => {
                      const csvExample = `simplified,pinyin,definitions
"你好","nǐ hǎo","hello"
"谢谢","xiè xie","thank you"`
                      navigator.clipboard.writeText(csvExample)
                      setSuccess('CSV example copied!')
                      setTimeout(() => setSuccess(''), 2000)
                    }}
                    style={{ fontSize: '0.75rem' }}
                  >
                    📋 Copy
                  </Button>
                </div>
                <pre style={{
                  backgroundColor: '#2c2c2e',
                  padding: '15px',
                  borderRadius: '8px',
                  marginTop: '10px',
                  color: '#fff',
                  border: '1px solid #444',
                  overflow: 'auto'
                }}>
{`simplified,pinyin,definitions
"你好","nǐ hǎo","hello"
"谢谢","xiè xie","thank you"`}
                </pre>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </Container>
    </SiteLayout>
  )
}
