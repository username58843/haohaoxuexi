/**
 * Shipped English defaults for the CMS document bodies (privacy / terms /
 * about), as Markdown. These are the fallback when no override exists for the
 * active language. Shared by the public doc pages and the /admin/content editor
 * so both start from the same baseline text.
 *
 * Admins override these per language via inline edit mode on each page or via
 * the admin content editor; an empty override restores the default below.
 */

import pkg from '~/package.json'

export const DOC_CONTACT_EMAIL = 'mail.tm.lb@gmail.com'
// Derived from package.json so the About page can never drift from the release.
export const DOC_APP_VERSION = pkg.version

/**
 * Shipped "Last updated" dates (ISO, UTC) for each doc — shown until an admin
 * saves an override, whose stored `updatedAt` then takes over (see the doc
 * pages + ContentContext.contentUpdatedAt). Bump when the default text changes.
 */
export const DOC_UPDATED = {
  privacy: '2026-07-27',
  terms: '2026-07-27',
  about: '2026-07-27',
}

/** Localized long-form date for the docs meta line (UTC-stable, so SSR and client agree). */
export function formatDocDate(value, locale = 'en') {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  try {
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return d.toLocaleDateString('en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
}

const PRIVACY_EN = `This policy explains what information 好好学习汉语 (HaoHao XueXi, "we", "us") collects when you use our website and our Android app, why we collect it, and how you can delete it. We have tried to keep it short and honest: the service is free, shows no ads, and collects only what it needs to work.

## 1. Information we collect

When you create an account and study, we store:

- **Account information** — your email address, your display name, and your password. The password is stored only as a bcrypt hash; we never store or have access to your plain-text password.
- **Study data** — the decks and words you save, your review history and spaced-repetition progress, streaks and daily goals, and your app settings (theme, accent color, interface language, display preferences).
- **Technical data** — transient server logs created when the app communicates with our servers. These may include an IP address and browser/device identifier (user agent) and are used only for security (such as rate limiting), abuse prevention, and debugging. They are rotated and discarded automatically after a short period and are not used to build profiles.

## 2. Information we do not collect

- We do not collect your location or your contacts.
- We do not use advertising identifiers, and the apps show no ads.
- We do not embed third-party analytics or tracking SDKs.
- We do not sell your data, and we do not share it with third parties for marketing or any purpose other than the infrastructure services listed below.

## 3. How we use your information

- To operate your account and sync your data between the web and Android apps.
- To run the learning features: scheduling reviews, computing streaks, daily goals, and progress statistics.
- To keep the service secure (rate limiting, abuse prevention).
- To respond when you contact us or send feedback.

## 4. Third-party services

We rely on a small set of infrastructure providers. Each processes only what is technically necessary to provide its function:

- **MongoDB Atlas** — database hosting. Stores the account and study data described above.
- **Vercel** — application hosting. Serves the website and the API that both apps use.
- **Google Fonts** — delivers the interface and serif fonts to your browser.
- **jsDelivr CDN** — delivers the stroke-order animation library and character data.

When your device requests files from Google Fonts or jsDelivr, those services receive standard connection data such as your IP address, as with any web request. We never send them your account or study data.

## 5. Data retention

Your account and study data are kept for as long as your account exists. Transient technical logs are kept only briefly. When you delete your account, all of your personal data is removed permanently.

## 6. Deleting your account and data

You can delete your account yourself at any time:

- **Web app:** Profile → Delete account.
- **Android app:** Settings → Delete account.

Deletion is immediate and permanent: it removes your email address, name, password hash, decks, review history, progress, and settings. If you cannot access your account, email us at [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}) from the address associated with the account and we will delete it for you.

## 7. Children

The service is not directed at children under 13, and we do not knowingly collect personal information from them. If you believe a child under 13 has created an account, please contact us and we will delete it.

## 8. Security

All traffic between the apps and our servers is encrypted with HTTPS. Passwords are stored only as bcrypt hashes, and access to production data is restricted by access controls. That said, no internet service can guarantee absolute security; please use a unique password for your account.

## 9. Changes to this policy

We may update this policy from time to time. When we do, we will change the "Last updated" date at the top of this page, and for material changes we will give notice in the app or on the website. Continuing to use the service after a change means you accept the updated policy.

## 10. Contact

Questions about privacy or your data? Email [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).`

const PRIVACY_RU = `Настоящая политика объясняет, какую информацию собирает 好好学习汉语 (HaoHao XueXi, «мы», «нас»), когда вы пользуетесь нашим сайтом и нашим Android-приложением, зачем мы её собираем и как вы можете её удалить. Мы постарались изложить её коротко и честно: сервис бесплатен, не показывает рекламу и собирает только то, что необходимо для его работы.

## 1. Информация, которую мы собираем

Когда вы создаёте аккаунт и занимаетесь, мы храним:

- **Данные аккаунта** — ваш адрес электронной почты, отображаемое имя и пароль. Пароль хранится только в виде bcrypt-хэша; мы никогда не храним ваш пароль в открытом виде и не имеем к нему доступа.
- **Учебные данные** — сохранённые вами колоды и слова, историю повторений и прогресс интервальных повторений, серии занятий (стрики) и ежедневные цели, а также настройки приложения (тема, акцентный цвет, язык интерфейса, параметры отображения).
- **Технические данные** — временные серверные логи, создаваемые при обмене данными между приложением и нашими серверами. Они могут содержать IP-адрес и идентификатор браузера или устройства (user agent) и используются исключительно для обеспечения безопасности (например, ограничения частоты запросов), предотвращения злоупотреблений и отладки. Такие логи автоматически ротируются и удаляются через короткое время и не используются для построения профилей.

## 2. Информация, которую мы не собираем

- Мы не собираем данные о вашем местоположении и ваших контактах.
- Мы не используем рекламные идентификаторы, а приложения не показывают рекламу.
- Мы не встраиваем сторонние SDK аналитики и трекинга.
- Мы не продаём ваши данные и не передаём их третьим лицам ни в маркетинговых, ни в каких-либо иных целях, за исключением перечисленных ниже инфраструктурных сервисов.

## 3. Как мы используем вашу информацию

- Для работы вашего аккаунта и синхронизации данных между веб-версией и Android-приложением.
- Для работы учебных функций: планирования повторений, подсчёта серий занятий, ежедневных целей и статистики прогресса.
- Для защиты сервиса (ограничение частоты запросов, предотвращение злоупотреблений).
- Для ответа на ваши обращения и отзывы.

## 4. Сторонние сервисы

Мы полагаемся на небольшой набор инфраструктурных провайдеров. Каждый из них обрабатывает только то, что технически необходимо для выполнения его функции:

- **MongoDB Atlas** — хостинг базы данных. Хранит описанные выше данные аккаунта и учебные данные.
- **Vercel** — хостинг приложения. Обслуживает сайт и API, которыми пользуются оба приложения.
- **Google Fonts** — доставляет в ваш браузер шрифты интерфейса и шрифты с засечками.
- **jsDelivr CDN** — доставляет библиотеку анимаций порядка черт и данные иероглифов.

Когда ваше устройство запрашивает файлы у Google Fonts или jsDelivr, эти сервисы получают стандартные данные соединения, например ваш IP-адрес, — как при любом веб-запросе. Мы никогда не передаём им данные вашего аккаунта или ваши учебные данные.

## 5. Сроки хранения данных

Данные аккаунта и учебные данные хранятся до тех пор, пока существует ваш аккаунт. Временные технические логи хранятся лишь непродолжительное время. При удалении аккаунта все ваши персональные данные удаляются безвозвратно.

## 6. Удаление аккаунта и данных

Вы можете самостоятельно удалить аккаунт в любой момент:

- **Веб-приложение:** Профиль → Удалить аккаунт.
- **Android-приложение:** Настройки → Удалить аккаунт.

Удаление происходит немедленно и безвозвратно: удаляются ваш адрес электронной почты, имя, хэш пароля, колоды, история повторений, прогресс и настройки. Если вы не можете войти в аккаунт, напишите нам на [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}) с адреса, привязанного к аккаунту, и мы удалим его за вас.

## 7. Дети

Сервис не предназначен для детей младше 13 лет, и мы сознательно не собираем их персональные данные. Если вы считаете, что аккаунт создал ребёнок младше 13 лет, свяжитесь с нами, и мы удалим такой аккаунт.

## 8. Безопасность

Весь трафик между приложениями и нашими серверами шифруется по HTTPS. Пароли хранятся только в виде bcrypt-хэшей, а доступ к рабочим данным ограничен средствами контроля доступа. Тем не менее ни один интернет-сервис не может гарантировать абсолютную безопасность; пожалуйста, используйте для аккаунта уникальный пароль.

## 9. Изменения настоящей политики

Время от времени мы можем обновлять настоящую политику. В этом случае мы изменим дату «Последнее обновление» вверху этой страницы, а о существенных изменениях сообщим в приложении или на сайте. Продолжая пользоваться сервисом после внесения изменений, вы принимаете обновлённую политику.

## 10. Контакты

Вопросы о конфиденциальности или ваших данных? Напишите на [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).`

const PRIVACY_TK = `Bu syýasat siz biziň web sahypamyzy we Android programmamyzy ulananyňyzda 好好学习汉语 (HaoHao XueXi, «biz») tarapyndan haýsy maglumatlaryň ýygnalýandygyny, olaryň näme üçin ýygnalýandygyny we olary nädip pozup biljekdigiňizi düşündirýär. Biz ony gysga we dogruçyl ýazmaga çalyşdyk: hyzmat mugt, mahabat görkezmeýär we diňe işlemegi üçin zerur maglumatlary ýygnaýar.

## 1. Ýygnaýan maglumatlarymyz

Hasap açanyňyzda we okanyňyzda biz şulary saklaýarys:

- **Hasap maglumatlary** — e-poçta salgyňyz, görkezilýän adyňyz we parolyňyz. Parol diňe bcrypt heşi görnüşinde saklanýar; biz siziň açyk görnüşdäki parolyňyzy hiç haçan saklamaýarys we oňa elýeterligimiz ýok.
- **Okuw maglumatlary** — ýatda saklan toplumlaryňyz we sözleriňiz, gaýtalama taryhyňyz we aralykly gaýtalama ösüşiňiz, yzygiderli günleriňiz (streak) we gündelik maksatlaryňyz, şeýle hem programma sazlamalaryňyz (tema, esasy reňk, interfeýs dili, görkeziş sazlamalary).
- **Tehniki maglumatlar** — programma serwerlerimiz bilen aragatnaşyk saklanda döreýän wagtlaýyn serwer ýazgylary (loglar). Olar IP salgyny we brauzeriň ýa-da enjamyň identifikatoryny (user agent) öz içine alyp biler we diňe howpsuzlyk (meselem, sorag sanyny çäklendirmek), hyýanatçylykly ulanyşyň öňüni almak we säwlikleri düzetmek üçin ulanylýar. Olar gysga wagtdan soň awtomatik täzelenýär we pozulýar hem-de profil düzmek üçin ulanylmaýar.

## 2. Ýygnamaýan maglumatlarymyz

- Biz siziň ýerleşýän ýeriňizi we kontaktlaryňyzy ýygnamaýarys.
- Biz mahabat identifikatorlaryny ulanmaýarys, programmalar bolsa mahabat görkezmeýär.
- Biz üçünji tarap analitika ýa-da yzarlaýyş SDK-laryny goşmaýarys.
- Biz maglumatlaryňyzy satmaýarys we olary marketing ýa-da aşakda sanalan infrastruktura hyzmatlaryndan başga hiç bir maksat bilen üçünji taraplara bermeýäris.

## 3. Maglumatlaryňyzy nähili ulanýarys

- Hasabyňyzy işletmek we maglumatlaryňyzy web bilen Android programmalarynyň arasynda sinhronlamak üçin.
- Okuw funksiýalaryny işletmek üçin: gaýtalamalary meýilleşdirmek, yzygiderli günleri, gündelik maksatlary we ösüş statistikasyny hasaplamak.
- Hyzmaty howpsuz saklamak üçin (sorag sanyny çäklendirmek, hyýanatçylykly ulanyşyň öňüni almak).
- Siz biz bilen habarlaşanyňyzda ýa-da seslenme iberende jogap bermek üçin.

## 4. Üçünji tarap hyzmatlary

Biz az sanly infrastruktura üpjünçisine daýanýarys. Olaryň her biri diňe öz wezipesini ýerine ýetirmek üçin tehniki taýdan zerur maglumatlary işleýär:

- **MongoDB Atlas** — maglumat bazasynyň hostingi. Ýokarda beýan edilen hasap we okuw maglumatlaryny saklaýar.
- **Vercel** — programmanyň hostingi. Web sahypasyna we iki programmanyň hem ulanýan API-sine hyzmat edýär.
- **Google Fonts** — interfeýs we serif şriftlerini brauzeriňize ýetirýär.
- **jsDelivr CDN** — çyzyk tertibiniň animasiýa kitaphanasyny we iýeroglif maglumatlaryny ýetirýär.

Enjamyňyz Google Fonts-dan ýa-da jsDelivr-den faýllary soranda, bu hyzmatlar islendik web soragynda bolşy ýaly, IP salgyňyz ýaly adaty birikme maglumatlaryny alýar. Biz olara hasap ýa-da okuw maglumatlaryňyzy hiç haçan ibermeýäris.

## 5. Maglumatlaryň saklanyş möhleti

Hasap we okuw maglumatlaryňyz hasabyňyz bar bolýança saklanýar. Wagtlaýyn tehniki ýazgylar diňe gysga wagtlyk saklanýar. Hasabyňyzy pozanyňyzda ähli şahsy maglumatlaryňyz hemişelik aýrylýar.

## 6. Hasabyňyzy we maglumatlaryňyzy pozmak

Hasabyňyzy islendik wagt özüňiz pozup bilersiňiz:

- **Web programmasy:** Profil → Hasaby pozmak.
- **Android programmasy:** Sazlamalar → Hasaby pozmak.

Pozmak dessine we hemişelik amala aşyrylýar: e-poçta salgyňyz, adyňyz, parol heşiňiz, toplumlaryňyz, gaýtalama taryhyňyz, ösüşiňiz we sazlamalaryňyz aýrylýar. Hasabyňyza girip bilmeýän bolsaňyz, hasaba baglanan salgydan [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}) salgysyna hat ýazyň, biz ony siziň üçin pozarys.

## 7. Çagalar

Hyzmat 13 ýaşdan kiçi çagalara niýetlenen däldir we biz olardan şahsy maglumatlary bilkastlaýyn ýygnamaýarys. 13 ýaşdan kiçi çaganyň hasap açandygyna ynanýan bolsaňyz, biz bilen habarlaşyň, biz ony pozarys.

## 8. Howpsuzlyk

Programmalar bilen serwerlerimiziň arasyndaky ähli trafik HTTPS bilen şifrlenýär. Parollar diňe bcrypt heşleri görnüşinde saklanýar, önümçilik maglumatlaryna elýeterlik bolsa giriş gözegçiligi bilen çäklendirilendir. Muňa garamazdan, hiç bir internet hyzmaty doly howpsuzlygy kepillendirip bilmez; hasabyňyz üçin gaýtalanmaýan parol ulanmagyňyzy haýyş edýäris.

## 9. Bu syýasata girizilýän üýtgetmeler

Biz bu syýasaty wagtal-wagtal täzeläp bileris. Şeýle bolanda bu sahypanyň ýokarsyndaky «Soňky täzelenme» senesini üýtgederis, düýpli üýtgetmeler barada bolsa programmada ýa-da web sahypada habar bereris. Üýtgetmeden soň hyzmaty ulanmagy dowam etdirmek täzelenen syýasaty kabul edýändigiňizi aňladýar.

## 10. Habarlaşmak

Gizlinlik ýa-da maglumatlaryňyz barada soragyňyz barmy? [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}) salgysyna hat ýazyň.`

const PRIVACY_ZH = `本政策说明您在使用我们的网站和 Android 应用时，好好学习汉语（HaoHao XueXi，“我们”）会收集哪些信息、为何收集，以及您如何删除这些信息。我们力求简明坦诚：本服务完全免费，不展示广告，只收集其正常运行所必需的信息。

## 1. 我们收集的信息

当您创建账户并学习时，我们会存储：

- **账户信息** — 您的电子邮箱地址、显示名称和密码。密码仅以 bcrypt 哈希形式存储；我们绝不会存储您的明文密码，也无法获取它。
- **学习数据** — 您保存的卡组和词语、复习历史与间隔重复进度、连续学习天数和每日目标，以及您的应用设置（主题、强调色、界面语言、显示偏好）。
- **技术数据** — 应用与我们的服务器通信时产生的临时服务器日志。其中可能包含 IP 地址和浏览器/设备标识（user agent），仅用于安全防护（如限流）、防止滥用和排查故障。这些日志会在短时间后自动轮换并删除，不会用于构建用户画像。

## 2. 我们不收集的信息

- 我们不收集您的位置信息或通讯录。
- 我们不使用广告标识符，应用也不展示广告。
- 我们不嵌入任何第三方分析或跟踪 SDK。
- 我们不出售您的数据，除下文所列基础设施服务外，也不会出于营销或任何其他目的与第三方共享您的数据。

## 3. 我们如何使用您的信息

- 运行您的账户，并在网页版与 Android 应用之间同步您的数据。
- 提供学习功能：安排复习、计算连续学习天数、每日目标和进度统计。
- 保障服务安全（限流、防止滥用）。
- 在您联系我们或发送反馈时予以回复。

## 4. 第三方服务

我们依赖少量基础设施提供商。每一家仅处理为实现其功能在技术上必需的信息：

- **MongoDB Atlas** — 数据库托管。存储上述账户和学习数据。
- **Vercel** — 应用托管。为网站以及两个应用共用的 API 提供服务。
- **Google Fonts** — 向您的浏览器提供界面字体和衬线字体。
- **jsDelivr CDN** — 提供笔顺动画库和汉字数据。

当您的设备向 Google Fonts 或 jsDelivr 请求文件时，这些服务会像处理任何网络请求一样收到标准连接数据（例如您的 IP 地址）。我们绝不会向它们发送您的账户或学习数据。

## 5. 数据保留

只要您的账户存在，您的账户和学习数据就会被保留。临时技术日志仅短暂保存。当您删除账户时，您的所有个人数据都会被永久移除。

## 6. 删除账户和数据

您可以随时自行删除账户：

- **网页版：** 个人资料 → 删除账户。
- **Android 应用：** 设置 → 删除账户。

删除即时生效且不可恢复：将移除您的邮箱地址、名称、密码哈希、卡组、复习历史、进度和设置。如果您无法登录账户，请使用与账户关联的邮箱地址发送邮件至 [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL})，我们将为您删除账户。

## 7. 儿童

本服务不面向 13 岁以下儿童，我们也不会有意收集他们的个人信息。如果您认为有 13 岁以下儿童创建了账户，请联系我们，我们会将其删除。

## 8. 安全

应用与我们的服务器之间的全部流量均通过 HTTPS 加密。密码仅以 bcrypt 哈希形式存储，对生产数据的访问受访问控制限制。尽管如此，没有任何互联网服务能够保证绝对安全；请为您的账户使用独一无二的密码。

## 9. 本政策的变更

我们可能不时更新本政策。届时我们会更改本页顶部的“最近更新”日期；对于重大变更，我们会在应用内或网站上另行通知。变更后继续使用本服务，即表示您接受更新后的政策。

## 10. 联系我们

对隐私或您的数据有疑问？请发送邮件至 [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL})。`

const TERMS_EN = `These Terms of Service ("Terms") govern your use of 好好学习汉语 (HaoHao XueXi, "the service", "we", "us"), available as a website and an Android app. By creating an account or using the service, you agree to these Terms. If you do not agree, please do not use the service.

## 1. The service

The service is a free tool for learning Chinese vocabulary. It offers spaced-repetition flashcards, quizzes, HSK 1–6 and textbook word lists, personal decks, and progress tracking, on the web and on Android. The service is provided free of charge and contains no purchases in this version.

## 2. Accounts

- You must be at least 13 years old to create an account.
- Provide accurate registration information and keep it up to date.
- One account per person; do not share accounts.
- Keep your password confidential. You are responsible for all activity under your account, and you should tell us promptly if you suspect unauthorized use.

## 3. Acceptable use

You agree not to:

- probe, breach, or attempt to bypass the service's security, or access data or accounts that are not yours;
- scrape, bulk-download, or systematically extract content from the service, or access it with automated clients beyond normal app use;
- circumvent rate limits or other technical protections;
- disrupt, overload, or interfere with the operation of the service;
- submit content that is unlawful, abusive, or infringes the rights of others — whether in decks, feedback, or anywhere else;
- impersonate another person, or resell access to the service.

## 4. Your content

The decks and other content you create remain yours. So that the service can work, you grant us a non-exclusive, worldwide, royalty-free license to store, process, back up, and display that content to you — solely for the purpose of operating and improving the service. This license ends when you delete the content or your account.

## 5. Premium

The "premium" badge is a courtesy supporter flag granted manually by administrators. There are no purchases or subscriptions in this version of the service, and the premium flag carries no entitlement: it may be changed or withdrawn at any time without notice.

## 6. Disclaimers

The service and all of its content are provided "as is" and "as available", without warranties of any kind, express or implied — including warranties of merchantability, fitness for a particular purpose, non-infringement, or that the service will be uninterrupted or error-free. Learning content may contain mistakes; it is provided for study purposes and is not professional advice.

## 7. Limitation of liability

To the maximum extent permitted by applicable law, we are not liable for any indirect, incidental, special, or consequential damages, or for loss of data, arising from your use of (or inability to use) the service. Because the service is free, our total aggregate liability for any claims relating to it is limited to the amount you have paid us for the service — which is zero. Nothing in these Terms limits liability that cannot be limited under applicable law.

## 8. Termination

You may stop using the service or delete your account at any time (see the Privacy Policy for how deletion works). We may suspend or ban accounts that violate these Terms, including permanently for serious or repeated violations. Sections that by their nature should survive termination — including sections 6, 7, and 9 — survive it.

## 9. Governing law

These Terms are governed by the laws that mandatorily apply in your country of habitual residence, and nothing in them deprives you of protections granted by those laws. Any dispute should first be raised with us informally at the contact address below; we will make a good-faith effort to resolve it.

## 10. Changes to these Terms

We may revise these Terms from time to time. When we do, we will update the "Last updated" date at the top of this page and, for material changes, give reasonable notice in the app or on the website. Continuing to use the service after a change means you accept the revised Terms.

## 11. Contact

Questions about these Terms? Email [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).`

const TERMS_RU = `Настоящие Условия использования («Условия») регулируют использование вами сервиса 好好学习汉语 (HaoHao XueXi, «сервис», «мы», «нас»), доступного в виде сайта и Android-приложения. Создавая аккаунт или пользуясь сервисом, вы соглашаетесь с настоящими Условиями. Если вы не согласны, пожалуйста, не пользуйтесь сервисом.

## 1. Сервис

Сервис — это бесплатный инструмент для изучения китайской лексики. Он предлагает карточки с интервальным повторением, тесты, списки слов HSK 1–6 и учебников, личные колоды и отслеживание прогресса — в вебе и на Android. Сервис предоставляется бесплатно и в этой версии не содержит покупок.

## 2. Аккаунты

- Для создания аккаунта вам должно быть не менее 13 лет.
- Указывайте достоверные регистрационные данные и поддерживайте их актуальность.
- Один аккаунт на человека; не передавайте аккаунт другим.
- Храните пароль в тайне. Вы несёте ответственность за все действия в вашем аккаунте и должны незамедлительно сообщить нам, если подозреваете несанкционированное использование.

## 3. Допустимое использование

Вы обязуетесь не:

- зондировать, взламывать или пытаться обойти защиту сервиса, а также получать доступ к данным или аккаунтам, которые вам не принадлежат;
- собирать (скрейпить), массово скачивать или систематически извлекать контент сервиса, а также обращаться к нему с помощью автоматизированных клиентов сверх обычного использования приложений;
- обходить ограничения частоты запросов и другие технические средства защиты;
- нарушать работу сервиса, перегружать его или вмешиваться в его функционирование;
- размещать контент, который является незаконным, оскорбительным или нарушает права других лиц, — будь то в колодах, отзывах или где-либо ещё;
- выдавать себя за другое лицо или перепродавать доступ к сервису.

## 4. Ваш контент

Создаваемые вами колоды и другой контент остаются вашими. Чтобы сервис мог работать, вы предоставляете нам неисключительную, действующую по всему миру, безвозмездную лицензию на хранение, обработку, резервное копирование и показ этого контента вам — исключительно в целях работы и улучшения сервиса. Действие этой лицензии прекращается, когда вы удаляете контент или свой аккаунт.

## 5. Premium

Значок «premium» — это знак признательности сторонникам проекта, присваиваемый администраторами вручную. В этой версии сервиса нет покупок и подписок, и значок premium не даёт никаких прав: он может быть изменён или отозван в любой момент без предупреждения.

## 6. Отказ от гарантий

Сервис и весь его контент предоставляются «как есть» и «по мере доступности», без каких-либо гарантий, явных или подразумеваемых, — включая гарантии товарной пригодности, соответствия определённой цели, ненарушения прав, а также того, что сервис будет работать бесперебойно и без ошибок. Учебный контент может содержать ошибки; он предназначен для учебных целей и не является профессиональной консультацией.

## 7. Ограничение ответственности

В максимальной степени, допустимой применимым правом, мы не несём ответственности за любые косвенные, случайные, специальные или последующие убытки, а также за потерю данных, возникшие в связи с использованием (или невозможностью использования) сервиса. Поскольку сервис бесплатен, наша совокупная ответственность по любым связанным с ним требованиям ограничена суммой, которую вы заплатили нам за сервис, — то есть нулём. Ничто в настоящих Условиях не ограничивает ответственность, которая не может быть ограничена применимым правом.

## 8. Прекращение использования

Вы можете в любой момент прекратить пользоваться сервисом или удалить аккаунт (порядок удаления описан в Политике конфиденциальности). Мы можем приостанавливать или блокировать аккаунты, нарушающие настоящие Условия, в том числе навсегда — за серьёзные или повторные нарушения. Разделы, которые по своей природе должны сохранять силу после прекращения, — включая разделы 6, 7 и 9 — сохраняют её.

## 9. Применимое право

Настоящие Условия регулируются нормами права, императивно применимыми в стране вашего обычного проживания, и ничто в них не лишает вас защиты, предоставляемой этими нормами. Любой спор следует сначала неформально направить нам по указанному ниже контактному адресу; мы приложим добросовестные усилия для его разрешения.

## 10. Изменения настоящих Условий

Время от времени мы можем пересматривать настоящие Условия. В этом случае мы обновим дату «Последнее обновление» вверху этой страницы, а о существенных изменениях заблаговременно сообщим в приложении или на сайте. Продолжая пользоваться сервисом после внесения изменений, вы принимаете обновлённые Условия.

## 11. Контакты

Вопросы о настоящих Условиях? Напишите на [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).`

const TERMS_TK = `Bu Hyzmat şertleri («Şertler») web sahypa we Android programmasy görnüşinde elýeterli bolan 好好学习汉语 (HaoHao XueXi, «hyzmat», «biz») hyzmatyny ulanyşyňyzy düzgünleşdirýär. Hasap açmak ýa-da hyzmaty ulanmak bilen siz bu Şertler bilen ylalaşýarsyňyz. Ylalaşmaýan bolsaňyz, hyzmaty ulanmaň.

## 1. Hyzmat

Hyzmat hytaý sözlerini öwrenmek üçin mugt guraldyr. Ol webde we Android-de aralykly gaýtalama kartoçkalaryny, testleri, HSK 1–6 we okuw kitaplarynyň söz sanawlaryny, şahsy toplumlary we ösüşi yzarlamagy hödürleýär. Hyzmat mugt berilýär we bu wersiýada hiç hili satyn alma ýok.

## 2. Hasaplar

- Hasap açmak üçin azyndan 13 ýaşyňyz bolmaly.
- Hasaba alnyş maglumatlaryny dogry görkeziň we olary täzeläp duruň.
- Her adama bir hasap; hasaby başgalar bilen paýlaşmaň.
- Parolyňyzy gizlin saklaň. Hasabyňyzdaky ähli hereketler üçin siz jogapkärsiňiz we rugsatsyz ulanyşdan şübhelenseňiz, bize derrew habar bermelisiňiz.

## 3. Ýol berilýän ulanyş

Siz şulary etmezligi kabul edýärsiňiz:

- hyzmatyň howpsuzlygyny barlamak, bozmak ýa-da ondan sowlup geçmäge synanyşmak, şeýle hem size degişli bolmadyk maglumatlara ýa-da hasaplara girmek;
- hyzmatyň mazmunyny awtomatik ýygnamak (skreýping), köpçülikleýin göçürip almak ýa-da yzygiderli çykaryp almak, şeýle hem oňa adaty programma ulanyşyndan daşary awtomatlaşdyrylan müşderiler bilen ýüzlenmek;
- sorag çäklendirmelerinden ýa-da beýleki tehniki gorag serişdelerinden sowlup geçmek;
- hyzmatyň işini bozmak, ony aşa ýüklemek ýa-da oňa päsgel bermek;
- toplumlarda, seslenmelerde ýa-da başga islendik ýerde bikanun, kemsidiji ýa-da başgalaryň hukuklaryny bozýan mazmun ýerleşdirmek;
- başga biriniň adyndan çykyş etmek ýa-da hyzmata elýeterligi gaýtadan satmak.

## 4. Siziň mazmunyňyz

Döreden toplumlaryňyz we beýleki mazmunyňyz siziňki bolup galýar. Hyzmatyň işläp bilmegi üçin siz bize şol mazmuny saklamak, işlemek, ätiýaçlyk nusgasyny almak we size görkezmek üçin aýratyn däl, bütindünýä we tölegsiz ygtyýarnama berýärsiňiz — diňe hyzmaty işletmek we kämilleşdirmek maksady bilen. Bu ygtyýarnama mazmuny ýa-da hasabyňyzy pozanyňyzda tamamlanýar.

## 5. Premium

«Premium» nyşany administratorlar tarapyndan el bilen berilýän hoşniýetli goldawçy belligidir. Hyzmatyň bu wersiýasynda satyn almalar we abunalar ýok, premium belligi bolsa hiç hili hukuk bermeýär: ol islendik wagt duýduryşsyz üýtgedilip ýa-da yzyna alnyp bilner.

## 6. Kepilliklerden ýüz döndermek

Hyzmat we onuň ähli mazmuny «bolşy ýaly» we «elýeterli bolşy ýaly» berilýär — hiç hili aç-açan ýa-da göz öňünde tutulýan kepilliksiz, şol sanda satuwa ýaramlylyk, belli bir maksada laýyklyk, hukuklary bozmazlyk ýa-da hyzmatyň üznüksiz we ýalňyşsyz işlejekdigi baradaky kepilliksiz. Okuw mazmunynda ýalňyşlyklar bolup biler; ol okuw maksatlary üçin berilýär we hünär maslahaty däldir.

## 7. Jogapkärçiligiň çäklendirilmegi

Ulanylýan kanunçylygyň rugsat berýän iň ýokary derejesinde biz hyzmaty ulanmagyňyzdan (ýa-da ulanyp bilmezligiňizden) gelip çykýan hiç hili gytaklaýyn, tötänleýin, ýörite ýa-da netijeleýin zyýan, şeýle hem maglumat ýitgisi üçin jogapkärçilik çekmeýäris. Hyzmat mugt bolany üçin, oňa degişli islendik talaplar boýunça umumy jogapkärçiligimiz hyzmat üçin bize tölän puluňyz bilen çäklenýär — ýagny nol bilen. Bu Şertlerdäki hiç zat ulanylýan kanunçylyk boýunça çäklendirilip bilinmeýän jogapkärçiligi çäklendirmeýär.

## 8. Bes etmek

Siz islendik wagt hyzmaty ulanmagy bes edip ýa-da hasabyňyzy pozup bilersiňiz (pozmagyň tertibi Gizlinlik syýasatynda beýan edilen). Biz bu Şertleri bozýan hasaplary togtadyp ýa-da petikläp bileris, agyr ýa-da gaýtalanýan bozulmalar üçin bolsa hemişelik petikläp bileris. Öz häsiýeti boýunça bes edilenden soň hem güýjüni saklamaly bölümler — şol sanda 6, 7 we 9-njy bölümler — güýjüni saklaýar.

## 9. Ulanylýan hukuk

Bu Şertler siziň hemişelik ýaşaýan ýurduňyzda hökmany suratda ulanylýan kanunlar bilen düzgünleşdirilýär we olardaky hiç zat şol kanunlaryň berýän goragyndan sizi mahrum etmeýär. Islendik jedeli ilki aşakdaky habarlaşma salgysy arkaly resmi däl görnüşde bize ýetiriň; biz ony çözmek üçin ak ýürekli tagalla ederis.

## 10. Bu Şertlere girizilýän üýtgetmeler

Biz bu Şertleri wagtal-wagtal täzeden seredip bileris. Şeýle bolanda bu sahypanyň ýokarsyndaky «Soňky täzelenme» senesini täzeläris, düýpli üýtgetmeler barada bolsa programmada ýa-da web sahypada öňünden habar bereris. Üýtgetmeden soň hyzmaty ulanmagy dowam etdirmek täzelenen Şertleri kabul edýändigiňizi aňladýar.

## 11. Habarlaşmak

Bu Şertler barada soragyňyz barmy? [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}) salgysyna hat ýazyň.`

const TERMS_ZH = `本服务条款（“条款”）适用于您对 好好学习汉语（HaoHao XueXi，“本服务”“我们”）的使用，本服务以网站和 Android 应用的形式提供。创建账户或使用本服务，即表示您同意本条款。如果您不同意，请勿使用本服务。

## 1. 服务内容

本服务是一款免费的汉语词汇学习工具，在网页端和 Android 上提供间隔重复抽认卡、测验、HSK 1–6 及教材词表、个人卡组和进度跟踪。本服务免费提供，当前版本不包含任何购买项目。

## 2. 账户

- 您必须年满 13 周岁方可创建账户。
- 请提供准确的注册信息并保持其为最新。
- 每人一个账户；请勿共享账户。
- 请妥善保管您的密码。您须对账户下的一切活动负责；如怀疑账户被未经授权使用，应及时告知我们。

## 3. 可接受的使用

您同意不从事以下行为：

- 探测、攻破或试图绕过本服务的安全机制，或访问不属于您的数据或账户；
- 抓取、批量下载或系统性提取本服务的内容，或在正常应用使用之外以自动化客户端访问本服务；
- 规避限流或其他技术保护措施；
- 破坏、过载或干扰本服务的运行；
- 提交违法、辱骂性或侵犯他人权利的内容——无论是在卡组、反馈还是其他任何地方；
- 冒充他人，或转售本服务的访问权限。

## 4. 您的内容

您创建的卡组及其他内容仍归您所有。为使本服务能够运行，您授予我们一项非独占、全球范围、免版税的许可，允许我们存储、处理、备份该内容并向您展示——仅用于运营和改进本服务。当您删除相关内容或您的账户时，该许可即告终止。

## 5. Premium

“premium”徽章是由管理员手动授予的答谢性支持者标识。当前版本的服务不包含任何购买或订阅，premium 标识也不附带任何权益：它可随时更改或撤销，恕不另行通知。

## 6. 免责声明

本服务及其全部内容按“现状”和“可用状态”提供，不附带任何明示或默示的保证——包括对适销性、特定用途适用性、不侵权的保证，以及对服务不中断、无错误的保证。学习内容可能存在错误；其仅供学习之用，不构成专业建议。

## 7. 责任限制

在适用法律允许的最大范围内，我们不对因您使用（或无法使用）本服务而产生的任何间接、附带、特殊或后果性损害或数据丢失承担责任。由于本服务免费，我们就与之相关的任何索赔所承担的责任总额，以您为本服务向我们支付的金额为限——即零。本条款中的任何内容均不限制依据适用法律不得限制的责任。

## 8. 终止

您可以随时停止使用本服务或删除账户（删除方式见隐私政策）。对于违反本条款的账户，我们可予以暂停或封禁；对于严重或屡次违规的账户，可永久封禁。依其性质应在终止后继续有效的条款——包括第 6、7、9 条——在终止后继续有效。

## 9. 适用法律

本条款受您惯常居住国强制适用的法律管辖，其中任何内容均不剥夺您依据该等法律享有的保护。任何争议请先通过下方联系地址以非正式方式向我们提出；我们将本着诚信原则努力解决。

## 10. 本条款的变更

我们可能不时修订本条款。届时我们会更新本页顶部的“最近更新”日期；对于重大变更，我们会在应用内或网站上提前合理通知。变更后继续使用本服务，即表示您接受修订后的条款。

## 11. 联系我们

对本条款有疑问？请发送邮件至 [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL})。`

const ABOUT_EN = `好好学习汉语 (HaoHao XueXi) is a free tool for learning Chinese vocabulary. It runs in the browser and as an Android app, with one account and your progress synced between the two. No ads, no tracking — just words, cards, and steady progress.

## The name

好好学习汉语 (*hǎohǎo xuéxí*) means "study well". It comes from the classic encouragement 好好学习，天天向上 (*hǎohǎo xuéxí, tiāntiān xiàngshàng*) — "study well and make progress every day". That is exactly what the app is built around: small daily sessions that add up.

## What you get

- **Spaced repetition (SRS)** — flashcards scheduled with an SM-2-style algorithm, graded Again / Hard / Good / Easy, so you review each word right before you would forget it.
- **HSK 1–6** — the complete standard vocabulary for all six levels, plus textbook word packs, with pinyin, definitions, stroke-order animations, and audio.
- **Personal decks** — collect words into your own decks, edit them freely, and import or export them.
- **Quizzes** — multiple-choice practice modes for quick self-testing.
- **Progress** — streaks, a daily goal, activity charts, and per-level mastery so you always know where you stand.

## Feedback

The app improves through the people who use it. Found a bug, missing word, or have an idea? Send feedback right from the app (More → Send feedback) or email [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).

## The fine print

How your data is handled is described in the Privacy Policy, and the rules of the road in the Terms of Service.

Version ${DOC_APP_VERSION}`

const ABOUT_RU = `好好学习汉语 (HaoHao XueXi) — бесплатный инструмент для изучения китайской лексики. Он работает в браузере и как Android-приложение: один аккаунт, а прогресс синхронизируется между ними. Без рекламы и трекинга — только слова, карточки и стабильный прогресс.

## Название

好好学习汉语 (*hǎohǎo xuéxí*) означает «учись хорошо». Оно происходит от классического напутствия 好好学习，天天向上 (*hǎohǎo xuéxí, tiāntiān xiàngshàng*) — «учись хорошо и каждый день двигайся вперёд». Именно вокруг этого и построено приложение: короткие ежедневные занятия, которые складываются в результат.

## Что вы получаете

- **Интервальное повторение (SRS)** — карточки, расписание которых строит алгоритм в духе SM-2, с оценками «Снова / Трудно / Хорошо / Легко», так что вы повторяете каждое слово прямо перед тем, как забыли бы его.
- **HSK 1–6** — полный стандартный словарь всех шести уровней плюс наборы слов из учебников — с пиньинем, определениями, анимацией порядка черт и озвучкой.
- **Личные колоды** — собирайте слова в собственные колоды, свободно редактируйте их, импортируйте и экспортируйте.
- **Тесты** — режимы практики с выбором ответа для быстрой самопроверки.
- **Прогресс** — серии занятий, ежедневная цель, графики активности и степень освоения каждого уровня, чтобы вы всегда знали, где находитесь.

## Обратная связь

Приложение становится лучше благодаря тем, кто им пользуется. Нашли ошибку, пропущенное слово или у вас есть идея? Отправьте отзыв прямо из приложения (Ещё → Отправить отзыв) или напишите на [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).

## Мелким шрифтом

Как обрабатываются ваши данные, описано в Политике конфиденциальности, а правила пользования сервисом — в Условиях использования.

Версия ${DOC_APP_VERSION}`

const ABOUT_TK = `好好学习汉语 (HaoHao XueXi) — hytaý sözlerini öwrenmek üçin mugt gural. Ol brauzerde we Android programmasy hökmünde işleýär: bir hasap, ösüşiňiz bolsa ikisiniň arasynda sinhronlanýar. Mahabat ýok, yzarlaýyş ýok — diňe sözler, kartoçkalar we durnukly ösüş.

## Ady

好好学习汉语 (*hǎohǎo xuéxí*) «gowy oka» diýmegi aňladýar. Ol 好好学习，天天向上 (*hǎohǎo xuéxí, tiāntiān xiàngshàng*) — «gowy oka we her gün öňe git» diýen nusgawy ündewden gelip çykýar. Programma hut şonuň daşynda gurlandyr: her günki gysga sapaklar uly netijä eltýär.

## Näme alarsyňyz

- **Aralykly gaýtalama (SRS)** — SM-2 görnüşli algoritm bilen meýilleşdirilýän we «Ýene / Kyn / Gowy / Aňsat» diýip bahalandyrylýan kartoçkalar; şeýlelikde her sözi ýatdan çykarmazyňyzyň öň ýanynda gaýtalaýarsyňyz.
- **HSK 1–6** — alty derejäniň hemmesiniň doly standart söz baýlygy hem-de okuw kitaplarynyň söz toplumlary — pinýin, düşündirişler, çyzyk tertibiniň animasiýalary we ses bilen.
- **Şahsy toplumlar** — sözleri öz toplumlaryňyza ýygnaň, olary erkin üýtgediň, import we eksport ediň.
- **Testler** — çalt öz-özüňi barlamak üçin köp jogaply türgenleşik tertipleri.
- **Ösüş** — yzygiderli günler, gündelik maksat, işjeňlik diagrammalary we her dereje boýunça özleşdiriş derejesi — nirededigiňizi hemişe bilersiňiz.

## Seslenme

Programma ony ulanýan adamlaryň kömegi bilen kämilleşýär. Säwlik ýa-da ýetmeýän söz tapdyňyzmy, ýa-da pikiriňiz barmy? Seslenmäni gönüden-göni programmadan iberiň (Başga → Seslenme ibermek) ýa-da [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}) salgysyna hat ýazyň.

## Resmi bellikler

Maglumatlaryňyzyň nähili işlenýändigi Gizlinlik syýasatynda, ulanyş düzgünleri bolsa Hyzmat şertlerinde beýan edilýär.

Wersiýa ${DOC_APP_VERSION}`

const ABOUT_ZH = `好好学习汉语（HaoHao XueXi）是一款免费的汉语词汇学习工具。它既能在浏览器中运行，也提供 Android 应用，一个账户即可在两端同步学习进度。没有广告，没有跟踪——只有词语、卡片和日积月累的进步。

## 名字的由来

好好学习汉语（*hǎohǎo xuéxí*）意为“好好地学习”。它出自经典的劝学名句 好好学习，天天向上（*hǎohǎo xuéxí, tiāntiān xiàngshàng*）——意思是“认真学习，每天进步”。这正是本应用的核心理念：每天一小段学习，积少成多。

## 您将获得

- **间隔重复（SRS）** — 抽认卡由 SM-2 风格的算法排期，按“重来 / 困难 / 良好 / 简单”评分，让您在即将遗忘之前复习每个词。
- **HSK 1–6** — 全部六个等级的完整标准词汇，外加教材词包，配有拼音、释义、笔顺动画和读音。
- **个人卡组** — 将词语收集到自己的卡组中，自由编辑，并可导入或导出。
- **测验** — 多项选择练习模式，方便快速自测。
- **进度** — 连续学习天数、每日目标、活动图表以及各等级的掌握程度，让您随时了解自己的水平。

## 反馈

这款应用因使用者而不断进步。发现了错误、缺失的词语，或者有好点子？可直接在应用内发送反馈（更多 → 发送反馈），或发送邮件至 [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL})。

## 附则

您的数据如何处理，详见隐私政策；使用规则详见服务条款。

版本 ${DOC_APP_VERSION}`

/** Ordered doc scopes for the admin editor. */
// Per-language shipped defaults. ru/tk/zh are full translations of the English
// canonical text; a missing language falls back to en at the call sites.
export const PRIVACY_MD = { en: PRIVACY_EN, ru: PRIVACY_RU, tk: PRIVACY_TK, zh: PRIVACY_ZH }
export const TERMS_MD = { en: TERMS_EN, ru: TERMS_RU, tk: TERMS_TK, zh: TERMS_ZH }
export const ABOUT_MD = { en: ABOUT_EN, ru: ABOUT_RU, tk: ABOUT_TK, zh: ABOUT_ZH }

export const DOC_DEFAULTS = [
  { scope: 'privacy', md: PRIVACY_MD },
  { scope: 'terms', md: TERMS_MD },
  { scope: 'about', md: ABOUT_MD },
]
