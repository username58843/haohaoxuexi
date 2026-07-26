# HANDOFF — состояние проекта и как продолжить

> Этот файл — точка входа для продолжения работы (новая сессия / другой аккаунт).
> Дата: 2026-07-27. Всё описанное закоммичено в git этого репозитория.

## Что это за проект

好好学习 (HaoHao XueXi) — платформа изучения китайской лексики HSK 1–6:
- **Веб + REST API**: Next.js 16 (Pages Router, JS), MongoDB — корень репозитория, деплой на Vercel
- **Android**: Flutter-приложение в `mobile/` (Riverpod 3, dio, go_router), готово к Play Store
- Контракты: `docs/ARCHITECTURE.md` (API, модель данных, SRS, безопасность), `docs/DESIGN.md` (дизайн-система)

## Статус: ~95% готово

### Сделано и проверено
- Полный аудит старого кода (безопасность: удалён бэкдор-админ, инъекции, токен из query, открытые прокси; всё исправлено архитектурно)
- Ядро: `lib/server/*` (db с индексами, api-middleware c auth/rate-limit/валидацией, users c ленивой миграцией legacy-документов, words со стабильными ID `слово·пиньинь`, SRS SM-2), `lib/words-shared.js`, `lib/i18n` (en инлайн + ru/tk/zh на 463 ключа)
- API `/api/v1/*` — все эндпоинты из ARCHITECTURE.md §4, включая decks (добавлены отдельно — при первом разбиении их пропустили)
- Веб полностью переделан: лендинг, дашборд (streak/цель/активность), learn (SRS-ревью + квизы), HSK-браузер (строковый порядок черт, TTS, «знаю»), колоды (импорт/экспорт JSON+CSV), профиль/настройки (тёмная/светлая темы, 8 акцентов, 4 языка), админка (метрики/юзеры/фидбек/аудит), /privacy /terms /about
- Flutter-приложение: все экраны, `flutter analyze` чистый, **release APK собирается (51.9MB)**
- Тесты: jest 32/32; **смоук-тест API 58/58** (`node scripts/smoke.mjs` — in-memory MongoDB, реальный next start); eslint 0 ошибок; `npm run build` зелёный
- Документы для Play: `docs/store/PLAY_STORE_LISTING.md` (описания en/ru), `docs/store/DATA_SAFETY.md` (точные ответы формы), `docs/RELEASE_CHECKLIST.md`

### НЕ доделано (следующие шаги, по приоритету)

1. ✅ СДЕЛАНО: адверсариальное ревью (34 агента) прошло, все 15 подтверждённых
   находок исправлены (SRS-дедупликация очереди и паков, mobile count=0 quiz,
   hsk в снапшотах, коллизии дистракторов-омографов, retry+предупреждение при
   несохранённых ответах, atomic-миграция legacy-юзеров, ensureIndexes без
   залипания + E11000→409, PII-очистка audit_logs при удалении аккаунта,
   rate-limit по userId + сброс протухших бакетов, hanzi-writer вендорен
   same-origin, CSV-алиасы заголовков, Dart trim-паритет wordId, CORS для
   APP_URL + OPTIONS). Смоук 58/58, jest 38/38, eslint 0, flutter analyze 0.
2. **Прогон Flutter-приложения на устройстве/эмуляторе** — компилируется
   (release APK), но ни разу не запускалось вживую; проверить онбординг →
   логин → ревью → колоды.
3. Скриншоты и feature graphic для Play (чек-лист в PLAY_STORE_LISTING.md).
4. Деплой: Vercel + MongoDB Atlas + env (`MONGODB_URI`, `JWT_SECRET`, `APP_URL`),
   затем пересобрать AAB с реальным URL:
   `flutter build appbundle --release --dart-define=API_BASE_URL=https://<домен>`
5. Keystore для подписи (одноразово, инструкция: `mobile/android/key.properties.example`).

## Как продолжить в новой сессии

Открыть Claude Code в папке `C:\Users\admin\Documents\GitHub\HaoHao XueXi\xuehanyuapp-main`
и дать промпт вида:

> Прочитай docs/HANDOFF.md и docs/ARCHITECTURE.md, посмотри git log.
> Продолжи с раздела «НЕ доделано»: пункт 1 — прогони адверсариальное ревью
> и исправь подтверждённые находки, затем пункт 2.

## Проверочные команды (всё должно быть зелёным)

```bash
npm run build        # прод-сборка
npm test             # 32 юнит-теста
npm run lint         # 0 ошибок
node scripts/smoke.mjs   # 58 проверок API (нужен собранный build)
cd mobile && flutter analyze && flutter build apk --release
```

## Важные грабли этого окружения

- **Gradle-прокси**: `~/.gradle/gradle.properties` содержит systemProp-прокси.
  Если Gradle падает по сети — обновить адрес на текущий из `$HTTP_PROXY`
  (сейчас 192.168.97.159:8080; старый мёртвый был 192.168.163.249).
- Смоук-тест на Windows: если падает с 500/timeout — на порту 3123 завис зомби
  `next start` от прошлого запуска: `netstat -ano | findstr :3123` → `taskkill /F /T /PID <pid>`.
- Первая установка `mongodb-memory-server` качает бинарник mongod (~500MB, долго).
- `next lint` в Next 16 удалён — линт через `npx eslint` (flat config `eslint.config.mjs`).
- Riverpod 3: `valueOrNull` больше нет — использовать `.value`.

## Git-история (важные точки)

- `9087210` — baseline (оригинальное приложение до перестройки; старые ru/tk/zh
  переводы можно смотреть через `git show 9087210:lib/contexts/SettingsContext.js`)
- `0c5e67e` — ядро v2 (server libs, дизайн-система, UI-kit)
- `16bcc06` — все API-роуты + все страницы
- `2de0e15` — i18n, линт, тесты, Flutter, документы
- `69bdad5` — decks-роуты + смоук 58/58
