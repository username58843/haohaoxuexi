import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM || 'haohaoxuexi <onboarding@resend.dev>'
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://haohaoxuexi.tech'

function buildVerifyUrl(token) {
  return `${APP_URL}/auth/verify?token=${encodeURIComponent(token)}`
}

function buildResetUrl(token) {
  return `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`
}

export async function sendVerifyEmail({ to, name, token }) {
  const url = buildVerifyUrl(token)
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Confirm your email — 好好学习汉语',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
        <h2 style="margin:0 0 16px">Welcome, ${name || ''}!</h2>
        <p style="margin:0 0 24px;color:#444">
          Thanks for signing up for <strong>haohaoxuexi.tech</strong>.
          Please confirm your email address to start learning.
        </p>
        <a href="${url}" style="display:inline-block;padding:12px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Confirm email
        </a>
        <p style="margin:24px 0 0;color:#999;font-size:13px">
          If you didn't create an account, you can ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendResetEmail({ to, name, token }) {
  const url = buildResetUrl(token)
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your password — 好好学习汉语',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
        <h2 style="margin:0 0 16px">Password reset</h2>
        <p style="margin:0 0 24px;color:#444">
          Hi ${name || ''}, we received a request to reset your password for <strong>haohaoxuexi.tech</strong>.
        </p>
        <a href="${url}" style="display:inline-block;padding:12px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Reset password
        </a>
        <p style="margin:24px 0 0;color:#999;font-size:13px">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

export function generateToken() {
  const bytes = new Uint8Array(32)
  globalThis.crypto?.getRandomValues?.(bytes) ||
    bytes.forEach((_, i, a) => { a[i] = Math.floor(Math.random() * 256) })
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
