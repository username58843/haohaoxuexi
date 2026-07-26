import React, { useState } from 'react'
import { Modal, Segmented, Field, Button, useToast } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { useSettings } from '~/lib/contexts/SettingsContext'

/**
 * "Send feedback" modal: topic segmented (bug/idea/content/other) + message.
 * POST /feedback → success toast. The message survives accidental closes.
 */
export default function FeedbackModal({ open, onClose }) {
  const { t } = useSettings()
  const toast = useToast()
  const [topic, setTopic] = useState('bug')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const topics = [
    { value: 'bug', label: t('acctTopicBug', 'Bug') },
    { value: 'idea', label: t('acctTopicIdea', 'Idea') },
    { value: 'content', label: t('acctTopicContent', 'Content') },
    { value: 'other', label: t('acctTopicOther', 'Other') },
  ]

  const close = () => {
    if (sending) return
    setError('')
    onClose()
  }

  const submit = async () => {
    const trimmed = message.trim()
    if (trimmed.length < 3) {
      setError(t('acctFeedbackTooShort', 'Please write at least a few words'))
      return
    }
    setSending(true)
    setError('')
    try {
      await api.post('/feedback', { topic, message: trimmed })
      toast.success(t('acctFeedbackSent', 'Thanks — feedback sent!'))
      setMessage('')
      setTopic('bug')
      onClose()
    } catch (err) {
      const e = apiError(err)
      if (e.code === 'rate_limited') {
        setError(t('acctFeedbackRateLimited', 'Too many messages — please try again later'))
      } else if (e.code === 'validation') {
        setError(t('acctFeedbackInvalid', 'Message must be 3–2000 characters'))
      } else {
        setError(e.message || t('acctFeedbackFailed', 'Could not send feedback'))
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('acctFeedbackTitle', 'Send feedback')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={sending}>
            {t('acctCancel', 'Cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={sending}>
            {t('acctFeedbackSend', 'Send')}
          </Button>
        </>
      }
    >
      <p className="acct-fb__intro">
        {t('acctFeedbackIntro', 'Found a bug, missing word, or have an idea? Tell us — we read everything.')}
      </p>
      <div className="acct-fb__topic">
        <Segmented
          block
          ariaLabel={t('acctFeedbackTopicLabel', 'Topic')}
          options={topics}
          value={topic}
          onChange={setTopic}
        />
      </div>
      <Field
        textarea
        rows={5}
        label={t('acctFeedbackMessageLabel', 'Message')}
        placeholder={t('acctFeedbackPlaceholder', 'What happened, or what would you like to see?')}
        value={message}
        maxLength={2000}
        onChange={(e) => setMessage(e.target.value)}
        error={error}
      />
    </Modal>
  )
}
