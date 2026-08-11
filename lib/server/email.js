import { Resend } from 'resend'

// Lazy client: constructing Resend without a key THROWS in current SDKs,
// which used to crash every route that merely imports this module (register,
// forgot-password) on servers without RESEND_API_KEY. Instantiate on first
// actual send instead.
let resendClient = null
function resend() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

const FROM = process.env.RESEND_FROM || 'haohaoxuexi <noreply@haohaoxuexi.tech>'
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://haohaoxuexi.tech'

// ─── Email templates (i18n) ────────────────────────────────────────────────────

const T = {
  en: {
    verifySubject: 'Confirm your email — 好好学习汉语',
    verifyTitle: 'Welcome, {name}!',
    verifyBody: 'Thanks for signing up for <strong>haohaoxuexi.tech</strong>. Please confirm your email address to start learning.',
    verifyCta: 'Confirm email',
    verifyFooter: "If you didn't create an account, you can ignore this email.",
    verifyCopyHint: 'Click the code above to copy it',
    resetSubject: 'Reset your password — 好好学习汉语',
    resetTitle: 'Password reset',
    resetBody: 'Hi {name}, we received a request to reset your password for <strong>haohaoxuexi.tech</strong>.',
    resetCta: 'Reset password',
    resetFooter: 'This link expires in 1 hour. If you didn\'t request this, you can safely ignore this email.',
  },
  ru: {
    verifySubject: 'Подтвердите email — 好好学习汉语',
    verifyTitle: 'Добро пожаловать, {name}!',
    verifyBody: 'Спасибо за регистрацию на <strong>haohaoxuexi.tech</strong>. Пожалуйста, подтвердите ваш email, чтобы начать обучение.',
    verifyCta: 'Подтвердить email',
    verifyFooter: 'Если вы не создавали аккаунт, просто проигнорируйте это письмо.',
    verifyCopyHint: 'Нажмите на код выше, чтобы скопировать его',
    resetSubject: 'Сброс пароля — 好好学习汉语',
    resetTitle: 'Сброс пароля',
    resetBody: 'Привет, {name}! Мы получили запрос на сброс пароля для аккаунта на <strong>haohaoxuexi.tech</strong>.',
    resetCta: 'Сбросить пароль',
    resetFooter: 'Эта ссылка действует 1 час. Если вы не запрашивали сброс, просто проигнорируйте это письмо.',
  },
  tk: {
    verifySubject: 'Email-i tassyklaň — 好好学习汉语',
    verifyTitle: 'Hoş geldiňiz, {name}!',
    verifyBody: '<strong>haohaoxuexi.tech</strong> saýtyna gyzyklanmaňyz üçin sag boluň. Ögrenmegi başlamak üçin email salgyňyzy tassyklaň.',
    verifyCta: 'Email-i tassyklaň',
    verifyFooter: 'Eger hasap açmadyňyzsa, bu haty ýene gormeýärsiňiz.',
    verifyCopyHint: 'Göçürmek üçin ýokardaky koda basyň',
    resetSubject: 'Açar sözü täzelenmek — 好好学习汉语',
    resetTitle: 'Açar sözü täzelenmek',
    resetBody: 'Salam, {name}! <strong>haohaoxuexi.tech</strong> saýtynyň açar sözüni täzelenmek soragyny aldyk.',
    resetCta: 'Açar sözü täzelenmek',
    resetFooter: 'Bu baglanyşyk 1 sagat amalda. Eger siz soramadyňyzsa, bu haty ýene gormeýärsiňiz.',
  },
  zh: {
    verifySubject: '请确认您的邮箱 — 好好学习汉语',
    verifyTitle: '欢迎，{name}！',
    verifyBody: '感谢您注册 <strong>haohaoxuexi.tech</strong>。请确认您的邮箱地址以开始学习。',
    verifyCta: '确认邮箱',
    verifyFooter: '如果您没有注册账户，请忽略此邮件。',
    verifyCopyHint: '点击上方验证码即可复制',
    resetSubject: '重置密码 — 好好学习汉语',
    resetTitle: '密码重置',
    resetBody: '您好，{name}！我们收到了重置 <strong>haohaoxuexi.tech</strong> 账户密码的请求。',
    resetCta: '重置密码',
    resetFooter: '此链接在1小时内有效。如果您没有请求重置密码，请忽略此邮件。',
  },
}

function t(lang, key, name) {
  const tpl = (T[lang] && T[lang][key]) || T.en[key]
  return tpl.replace('{name}', name || '')
}

// ─── Shared HTML wrapper ───────────────────────────────────────────────────────

function wrap({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 32px 24px;text-align:center">
          <img src="${APP_URL}/logo-180.png" alt="" width="56" height="56" style="border-radius:14px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.15)">
          <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:.5px">好好学习汉语</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 32px 24px">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;text-align:center">
          <a href="${APP_URL}" style="display:inline-block;text-decoration:none;font-size:12px;color:#9ca3af">${APP_URL}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f5f7">${preheader}</div>
</body>
</html>`
}

// ─── URL builders ──────────────────────────────────────────────────────────────

function buildResetUrl(token) {
  return `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function sendVerifyEmail({ to, name, code, lang = 'en' }) {
  const html = wrap({
    title: t(lang, 'verifySubject', name),
    preheader: t(lang, 'verifyBody', name),
    body: `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center">
        ${t(lang, 'verifyTitle', name)}
      </h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b5563;text-align:center">
        ${t(lang, 'verifyBody', name)}
      </p>
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:18px 36px;font-family:monospace;font-size:42px;font-weight:800;color:#059669;letter-spacing:8px;cursor:pointer;user-select:all;-webkit-user-select:all;-moz-user-select:all;-ms-user-select:all" onclick="navigator.clipboard.writeText('${code}').catch(()=>{})">
          ${code}
        </div>
        <p style="margin:12px 0 0;font-size:12px;color:#9ca3af">
          ${t(lang, 'verifyCopyHint', 'Click the code above to copy it')}
        </p>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center">
        ${t(lang, 'verifyFooter', name)}
      </p>
    `,
  })

  await resend().emails.send({ from: FROM, to, subject: t(lang, 'verifySubject', name), html })
}

export async function sendResetEmail({ to, name, token, lang = 'en' }) {
  const url = buildResetUrl(token)
  const html = wrap({
    title: t(lang, 'resetSubject', name),
    preheader: t(lang, 'resetBody', name),
    body: `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center">
        ${t(lang, 'resetTitle', name)}
      </h1>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b5563;text-align:center">
        ${t(lang, 'resetBody', name)}
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${url}" style="display:inline-block;padding:14px 36px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:.3px">
          ${t(lang, 'resetCta', name)}
        </a>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center">
        ${t(lang, 'resetFooter', name)}
      </p>
    `,
  })

  await resend().emails.send({ from: FROM, to, subject: t(lang, 'resetSubject', name), html })
}

export function generateToken() {
  const bytes = new Uint8Array(32)
  globalThis.crypto?.getRandomValues?.(bytes) ||
    bytes.forEach((_, i, a) => { a[i] = Math.floor(Math.random() * 256) })
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
