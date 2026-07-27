import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import { Card, Field, Button } from '~/components/ui'
import { api } from '~/lib/api-client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = router.query
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function validate() {
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (loading || !token) return
    const v = validate()
    if (v) { setError(v); return }
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Invalid or expired link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell bare>
      <Head>
        <title>Reset password · 好好学习汉语</title>
      </Head>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '32px 16px' }}>
        <Card as="section" style={{ maxWidth: 420, width: '100%', padding: '32px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src="/logo-180.png" alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, textAlign: 'center' }}>Reset password</h2>

          {done ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#444', margin: '0 0 24px' }}>
                Your password has been reset. You can now sign in with your new password.
              </p>
              <Link href="/auth">
                <Button variant="primary" block>Sign in</Button>
              </Link>
            </div>
          ) : !token ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#ef4444', margin: '0 0 24px' }}>
                Invalid reset link. Please request a new one.
              </p>
              <Link href="/auth/forgot-password">
                <Button variant="primary" block>Request new link</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <Field
                label="New password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="At least 8 characters"
                required
              />
              <Field
                label="Confirm password"
                type="password"
                name="confirm"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && (
                <div style={{ color: '#ef4444', fontSize: 13, margin: '8px 0' }}>{error}</div>
              )}
              <Button type="submit" variant="primary" block loading={loading}>
                Reset password
              </Button>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
