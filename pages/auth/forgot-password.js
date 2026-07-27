import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import { Card, Field, Button } from '~/components/ui'
import { api } from '~/lib/api-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell bare>
      <Head>
        <title>Forgot password · 好好学习汉语</title>
      </Head>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '32px 16px' }}>
        <Card as="section" style={{ maxWidth: 420, width: '100%', padding: '32px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src="/logo-180.png" alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, textAlign: 'center' }}>Forgot password?</h2>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#444', margin: '0 0 24px' }}>
                If an account exists with <strong>{email}</strong>, we sent a password reset link. Check your inbox.
              </p>
              <Link href="/auth">
                <Button variant="primary" block>Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <>
              <p style={{ color: '#666', margin: '0 0 24px', fontSize: 14, textAlign: 'center' }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              <form onSubmit={onSubmit}>
                <Field
                  label="Email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {error && (
                  <div style={{ color: '#ef4444', fontSize: 13, margin: '8px 0' }}>{error}</div>
                )}
                <Button type="submit" variant="primary" block loading={loading}>
                  Send reset link
                </Button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link href="/auth" style={{ fontSize: 14, color: '#10b981' }}>Back to sign in</Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
