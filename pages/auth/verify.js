import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import { Card, Button } from '~/components/ui'

export default function VerifyPage() {
  const router = useRouter()
  const { verified, error } = router.query

  let title, body

  if (verified === '1') {
    title = 'Email confirmed'
    body = (
      <>
        <p style={{ margin: '0 0 24px', color: '#444' }}>
          Your email has been confirmed. You can now use all features.
        </p>
        <Link href="/auth">
          <Button variant="primary" block>Sign in</Button>
        </Link>
      </>
    )
  } else if (error) {
    title = 'Verification failed'
    body = (
      <>
        <p style={{ margin: '0 0 24px', color: '#444' }}>
          This verification link is invalid or has expired.
        </p>
        <Link href="/auth">
          <Button variant="primary" block>Back to sign in</Button>
        </Link>
      </>
    )
  } else {
    title = 'Check your email'
    body = (
      <>
        <p style={{ margin: '0 0 24px', color: '#444' }}>
          We sent you a verification link. Please check your inbox and click the link to confirm your email.
        </p>
        <Link href="/auth">
          <Button variant="primary" block>Back to sign in</Button>
        </Link>
      </>
    )
  }

  return (
    <AppShell bare>
      <Head>
        <title>{`${title} · 好好学习汉语`}</title>
      </Head>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '32px 16px' }}>
        <Card as="section" style={{ maxWidth: 420, width: '100%', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <img src="/logo-180.png" alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          </div>
          <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>{title}</h2>
          {body}
        </Card>
      </div>
    </AppShell>
  )
}
