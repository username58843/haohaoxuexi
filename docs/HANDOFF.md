# HANDOFF — состояние проекта и как продолжить

> Этот файл — точка входа для продолжения работы (новая сессия / другой аккаунт).
> Дата: 2026-08-02. Всё описанное запушено в `main` этого репозитория.

## Что это за проект

好好学习 (HaoHao XueXi) — платформа изучения китайской лексики HSK 1–6:
- **Веб + REST API**: Next.js 16 (Pages Router, JS), MongoDB — корень репозитория.
  **Пуш в `main` автоматически деплоится на Vercel (haohaoxuexi.tech)** — main
  должен оставаться зелёным после каждого коммита.
- **Android**: Flutter-приложение в `mobile/` (Riverpod 3, dio, go_router 16,
  flutter_secure_storage) — общий бэкенд через `/api/v1`.
- Контракты и справка: `docs/ARCHITECTURE.md` (API, модель данных, SRS,
  безопасность — синхронизирован с кодом 2026-08-02), `docs/DESIGN.md`
  (дизайн-система), `docs/FIREBASE_SETUP.md` (опциональный Firebase),
  `docs/RELEASE_CHECKLIST.md` (выпуск в Play).

## Статус

Функционал закрыт на обеих платформах; код прошёл адверсариальное ревью
(34 агента, все подтверждённые находки исправлены) и полные UX-аудиты веба и
мобилки. Осталось только то, что требует ключей/устройства (см. «Осталось»).

### База (перестройка v2)

- Полный аудит старого кода: удалён бэкдор-админ, NoSQL-инъекции, токен из
  query, открытые прокси — всё исправлено архитектурно.
- Ядро `lib/server/*` (db с индексами, api-middleware с auth/rate-limit/
  валидацией, ленивая миграция legacy-юзеров, words со стабильными id
  `слово·пиньинь`, SRS SM-2), `lib/words-shared.js`, `lib/i18n` (en инлайн +
  ru/tk/zh), все страницы веба, все экраны Flutter, админка, store-документы.
- Тесты: jest-юниты + смоук-тест API (`node scripts/smoke.mjs`, in-memory
  MongoDB, реальный `next start`), eslint чистый.

### Дальнейшие сессии (детали в `git log --oneline -80`)

- **Auth и безопасность**: email-верификация 6-значным кодом (регистрация не
  выдаёт сессию до верификации; логин отдаёт 403 `email_not_verified`),
  forgot/reset-password, Turnstile-капча (регистрация/логин/forgot; выключена,
  если `TURNSTILE_SECRET` пуст), resend-код с кулдауном 60с, bcrypt cost 12,
  единые серверные валидаторы (`lib/server/validate.js`), маппинг ошибок auth
  на обеих платформах.
- **Веб**: страница `/stats` — heatmap активности за 6 месяцев (GitHub-стиль)
  + 4 StatCard + список сложных слов с бейджем ×lapses; карточка-ссылка на
  дашборде; Turnstile-виджет переписан (forwardRef, `reset()` после
  неудачного сабмита — siteverify-токены одноразовые).
- **API**: `GET /api/v1/srs/difficult` — leech-список из сохранённых lapses
  (`lib/server/srs.js#getDifficult`).
- **Mobile**: вкладка Learn (конструктор сессий + типы вопросов как на вебе);
  опциональный Firebase-бутстрап (без `google-services.json` всё no-op —
  `lib/core/firebase_bootstrap.dart`); analytics-события `session_complete`
  / `streak` / `deck_created` + `setUserId` во всех auth-переходах; экран
  «Сложные слова» (`/difficult`, вход с Home); ежедневные напоминания о ревью
  (`lib/core/reminders.dart`: flutter_local_notifications, inexact-алармы без
  exact-alarm пермишена, opt-in тумблер + время в настройках; настройки
  device-local — не зеркалятся на сервер).
- **Доки**: ARCHITECTURE.md синхронизирован с кодом (все роуты, включая
  auth-верификацию, `/srs/difficult`, `/content`, `/health`; экраны и
  пермишены мобилки).

## Осталось (релизные шаги — нужны ключи/устройство, не код)

1. `cd mobile && flutter pub get` — **pubspec.lock намеренно не обновлялся**
   при добавлении зависимостей (firebase_*, flutter_local_notifications,
   timezone, flutter_timezone); обновить lock, прогнать `flutter analyze`
   и сборку.
2. Прогон приложения на устройстве/эмуляторе: онбординг → регистрация →
   верификация → ревью → колоды → сложные слова → напоминание.
3. Ключи: `android/app/google-services.json` (опционально, Firebase) и
   keystore (`mobile/android/key.properties.example`).
4. Скриншоты и feature graphic для Play (`docs/store/PLAY_STORE_LISTING.md`).
5. AAB: `flutter build appbundle --release
   --dart-define=API_BASE_URL=https://haohaoxuexi.tech`
   (дефолт в `core/api.dart` уже указывает на прод).

## Как продолжить в новой сессии

> Прочитай docs/HANDOFF.md и docs/ARCHITECTURE.md, посмотри
> `git log --oneline -80`. Работай итеративно: один логический коммит — один
> пуш в main; веб и Android должны собираться после каждого коммита.

## Проверочные команды

```bash
npm run build            # прод-сборка (web)
npm test                 # юнит-тесты
npx eslint pages components lib
node scripts/smoke.mjs   # смоук API (нужен собранный build)
cd mobile && flutter pub get && flutter analyze && flutter build apk --release
```

## Env (веб)

`MONGODB_URI`, `JWT_SECRET`, `APP_URL`, `TURNSTILE_SECRET` (капча; пустой =
капча выключена), `RESEND_API_KEY` + `RESEND_FROM` (письма верификации и
сброса пароля) — см. `.env.example`.

## Грабли

- Riverpod 3: `valueOrNull` больше нет — используй `.value`. Flutter:
  `.withValues(alpha:)` вместо `withOpacity`.
- i18n веб: en — инлайн-дефолт `t('key', 'Default')`; ru/tk/zh — flat-ключи в
  `lib/i18n/locales/*` (внутри секции по алфавиту). Новые строки — во все три
  локали одним коммитом с использованием.
- i18n mobile: `mobile/lib/core/i18n.dart` — en инлайн в `tr(...)`, ru/tk/zh
  в `_overrides` (по блоку на язык, добавлять во все три).
- Дизайн-токены веба: сырые цвета только в `styles/_tokens.scss`; UI-kit —
  `components/ui/*`; глобальные `.word-row*` (класс определения —
  `word-row__def`).
- Turnstile siteverify-токены одноразовые: любая форма с капчей держит
  `captchaRef` и зовёт `reset()` после неудачного сабмита (образцы:
  `pages/auth.js`, `pages/auth/forgot-password.js`).
- Напоминания mobile: `reminderEnabled` / `reminderMinutes` в `AppSettings` —
  device-local, НЕ зеркалить в `PUT /user/settings` и не трогать в
  `applyServerSettings`.
- `next lint` в Next 16 удалён — линт через `npx eslint` (flat config
  `eslint.config.mjs`).
- Первая установка `mongodb-memory-server` качает бинарник mongod (~500MB).
- Осознанные решения, которые НЕ надо «чинить»: кнопка Review в `learn.js`
  показывает полный dueCount; `/stats` не подсвечивает таб в AppShell;
  третья dash-quick карточка одна во втором ряду; строки `deckFull` с «2000»
  = `DECK_WORD_CAP`.
