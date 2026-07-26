# ТЕХНИЧЕСКИЙ АУДИТ ПРОЕКТА HSK CHINESE LEARNING PLATFORM

**Дата аудита:** 2025  
**Версия проекта:** 0.1.0  
**Платформа:** Next.js 15.0.3

---

# ЧАСТЬ 1 — ДЛЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ

## 📋 ОБЗОР ВСЕХ ДОСТУПНЫХ ФУНКЦИЙ

### 🌐 БЕЗ АВТОРИЗАЦИИ (Гостевой доступ)

#### 1. **Главная страница (Landing Page)**
- **URL:** `/` или `/index`
- **Что можно делать:**
  - Просматривать информацию о платформе
  - Видеть статистику (5000+ слов, 6 уровней HSK, 4 режима обучения)
  - Просматривать список функций
  - Переходить на страницу регистрации/входа
- **Визуально:** Темная тема с градиентами, анимированный флаг Китая, карточки с функциями, статистика
- **Ограничения:** Нет доступа к функционалу обучения, поиска, словарей

#### 2. **Страница регистрации/входа**
- **URL:** `/auth`
- **Что можно делать:**
  - Регистрироваться (email, пароль, имя)
  - Входить в аккаунт
  - Переключаться между формами входа и регистрации
- **Визуально:** Модальное окно с табами, темная тема
- **Ограничения:** Требуется регистрация для доступа к основному функционалу

---

### 🔐 С АВТОРИЗАЦИЕЙ (Зарегистрированные пользователи)

#### 3. **Страница обучения (Learn)**
- **URL:** `/learn`
- **Что можно делать:**
  - Настраивать режим обучения (выбор словарей, режимов, лимитов)
  - Учиться по карточкам (flashcards)
  - Выбирать режимы:
    - Иероглифы → Пиньинь
    - Пиньинь → Иероглифы
    - Иероглифы → Перевод
    - Перевод → Иероглифы
  - Видеть прогресс (правильные/неправильные ответы)
  - Повторять ошибки
  - Использовать клавиатурные сокращения
- **Визуально:** Карточки с вопросами, варианты ответов, прогресс-бар, финальный экран с результатами
- **Ограничения:** Нет ограничений для авторизованных пользователей

#### 4. **Поиск по словарю (Dictionary Search)**
- **URL:** `/search`
- **Что можно делать:**
  - Искать слова по иероглифам, пиньинь или английскому переводу
  - Просматривать детальную информацию о слове:
    - Упрощенные и традиционные иероглифы
    - Пиньинь с тонами
    - Переводы на несколько языков
    - Анимация порядка штрихов (stroke order)
    - Примеры предложений (6 для бесплатных, 10 для премиум)
    - Аудио произношение
  - Добавлять слова в "Выбранные слова" для создания словаря
  - Просматривать историю поиска (последние 20 запросов)
- **Визуально:** Карточки результатов, модальное окно с деталями слова, кнопки добавления, анимация штрихов
- **Ограничения:** 
  - Требуется авторизация
  - Бесплатные пользователи: 6 примеров предложений
  - Премиум пользователи: 10 примеров предложений

#### 5. **Переводчик текста (Text Translator)**
- **URL:** `/translate`
- **Что можно делать:**
  - Переводить тексты между языками:
    - Китайский (zh)
    - Русский (ru)
    - Английский (en)
    - Туркменский (tk)
  - Выбирать направление перевода
  - Менять языки местами (кнопка ⇄)
  - Выбирать метод перевода (AI или машинный)
  - Видеть какой метод использован
- **Визуально:** Две колонки (исходный текст и перевод), селекторы языков, чекбокс AI/машинный перевод
- **Ограничения:** Требуется авторизация

#### 6. **Просмотр словарей (Dictionary Viewer)**
- **URL:** `/dictionary`
- **Что можно делать:**
  - Просматривать словари HSK (hsk1-hsk6)
  - Просматривать свои персональные словари
  - Видеть таблицу слов с:
    - Номером
    - Иероглифами
    - Пиньинь
    - Переводами
  - Открывать анимацию порядка штрихов для каждого иероглифа
  - Открывать Google Images для поиска картинок слова
- **Визуально:** Таблица с данными, модальное окно с анимацией штрихов, кнопки для дополнительных действий
- **Ограничения:** Требуется авторизация

#### 7. **Мои словари (Personal Dictionaries)**
- **URL:** `/dictionaries`
- **Что можно делать:**
  - Создавать новые персональные словари
  - Редактировать существующие словари (название, слова)
  - Удалять словари
  - Импортировать словари из JSON/CSV файлов
  - Экспортировать словари в JSON/CSV
  - Переупорядочивать словари (drag & drop)
  - Создавать словарь из выбранных слов
  - Просматривать выбранные слова
  - Очищать список выбранных слов
  - Начинать обучение по конкретному словарю
- **Визуально:** Список карточек словарей, модальные окна для создания/редактирования, drag & drop интерфейс
- **Ограничения:** Требуется авторизация

#### 8. **Профиль пользователя (Profile)**
- **URL:** `/profile`
- **Что можно делать:**
  - Изменять имя
  - Изменять пароль
  - Просматривать email (нельзя изменить)
  - Просматривать статус (Premium/Admin)
  - Просматривать историю поиска (последние 20 запросов)
  - Видеть дату истечения премиум подписки (если есть)
- **Визуально:** Карточки с формами, бейджи статусов, список истории
- **Ограничения:** Требуется авторизация

#### 9. **Настройки (Settings)**
- **URL:** `/settings`
- **Что можно делать:**
  - Выбирать цвет темы (8 цветов: красный, оранжевый, желтый, зеленый, синий, фиолетовый, розовый, голубой)
  - Выбирать язык интерфейса (4 языка: English, Русский, Türkmençe, 中文)
  - Выбирать языки для отображения переводов (множественный выбор)
  - Сохранять настройки (синхронизируются с сервером)
- **Визуально:** Карточки с настройками, цветные кнопки для выбора темы, селекторы и чекбоксы
- **Ограничения:** Требуется авторизация

---

### ⭐ ПРЕМИУМ ФУНКЦИИ

#### Премиум пользователи получают:
- **10 примеров предложений** вместо 6 (на странице поиска)
- **Приоритетная поддержка** (указано в README, но не реализовано в UI)
- **Бейдж "PREMIUM"** в профиле и навигации

---

### 👨‍💼 АДМИНИСТРАТОРСКИЕ ФУНКЦИИ

#### 10. **Админ панель (Admin Panel)**
- **URL:** `/admin`
- **Что можно делать:**
  - Просматривать всех пользователей
  - Фильтровать онлайн пользователей
  - Редактировать пользователей:
    - Выдавать/отзывать премиум статус
    - Устанавливать дату истечения премиум
    - Назначать/снимать админ права
    - Банить/разбанивать пользователей
    - Указывать причину бана
  - Удалять пользователей
  - Видеть IP адреса пользователей
  - Видеть время последней активности
  - Видеть статус онлайн/оффлайн
- **Визуально:** Таблица пользователей, модальное окно редактирования, бейджи статусов
- **Ограничения:** Только для пользователей с `isAdmin: true`

---

# ЧАСТЬ 2 — ДЛЯ РАЗРАБОТЧИКА И АДМИНИСТРАТОРА

## 1. СТЕК ТЕХНОЛОГИЙ

### Frontend
- **Framework:** Next.js 15.0.3 (React 18.3.1)
- **UI Library:** React 18.3.1
- **UI Components:** Reactstrap 9.2.2 (Bootstrap 5.3.3)
- **Styling:**
  - Tailwind CSS (настроен, но используется минимально)
  - SCSS (основной стиль)
  - CSS модули (не используются)
  - Inline styles (активно используются)
- **State Management:** React Context API (AuthContext, SettingsContext)
- **HTTP Client:** Axios 1.7.7
- **Form Handling:** React Hook Form 7.53.0
- **Animations:** 
  - react-beautiful-dnd 13.1.1 (drag & drop)
  - CSS animations (custom)
- **Utilities:** Lodash 4.17.21

### Backend
- **Runtime:** Node.js (>=18.0.0)
- **Framework:** Next.js API Routes
- **Database:** MongoDB 6.10.0
- **Authentication:** 
  - JWT (jsonwebtoken 9.0.2)
  - bcryptjs 2.4.3 (хеширование паролей)
- **Session:** HTTP-only cookies

### Deployment
- **Platform:** Vercel (настроен через vercel.json)
- **Database:** MongoDB Atlas (рекомендуется) или локальный MongoDB

### Внешние сервисы и API
- **Translation:**
  - OpenAI API (GPT-3.5-turbo) - для AI перевода
  - MyMemory Translation API - fallback для перевода
  - Google Translate API (неофициальный) - для поиска и перевода
- **Text-to-Speech:**
  - Google TTS (неофициальный)
  - Baidu TTS (fallback)
  - Browser SpeechSynthesis API (fallback)
- **Example Sentences:**
  - Tatoeba API
  - Reverso Context
  - MDBG API
  - Jukuu API
- **Stroke Order:**
  - MakeMeAHanzi (jsdelivr CDN)
- **Pinyin:**
  - api.pinyin.pepe.is
  - pinyin-rest.pepebigotes.me
  - pinyin-api.vercel.app

---

## 2. СТРУКТУРА ПРОЕКТА

```
hsk-original/
├── components/              # React компоненты
│   ├── Auth/               # Компоненты аутентификации
│   │   ├── LoginForm.js    # Форма входа
│   │   └── RegisterForm.js # Форма регистрации
│   ├── Landing/            # Компоненты лендинга
│   │   └── HeroAnimation.js # Анимация героя
│   ├── Search/             # Компоненты поиска
│   │   └── SearchResults.js # Результаты поиска с модалками
│   ├── ButtonCheckboxGroup.js # Группа чекбоксов
│   ├── Hider.js            # Компонент скрытия
│   ├── Learn.js            # Основной компонент обучения
│   ├── LearnCard.js        # Карточка слова для обучения
│   ├── Link.js             # Кастомная ссылка Next.js
│   ├── LoadingSpinner.js   # Спиннер загрузки
│   ├── MainNav.js          # Главная навигация
│   ├── SettingsForm.js     # Форма настроек обучения
│   └── SiteLayout.js       # Общий layout сайта
│
├── lib/                    # Утилиты и библиотеки
│   ├── contexts/           # React Contexts
│   │   ├── AuthContext.js  # Контекст аутентификации
│   │   └── SettingsContext.js # Контекст настроек (тема, язык)
│   ├── models/             # Модели БД
│   │   └── User.js         # Модель пользователя (MongoDB)
│   ├── auth.js             # Функции аутентификации (JWT)
│   ├── cookies.js          # Работа с cookies
│   ├── db.js               # Подключение к MongoDB
│   └── learn.js            # Логика обучения (словари, режимы)
│
├── pages/                  # Next.js страницы и API
│   ├── _app.js            # Главный компонент приложения
│   ├── _document.js       # Кастомный document
│   ├── api/               # API endpoints
│   │   ├── admin/        # Админ API
│   │   │   └── users/    # Управление пользователями
│   │   ├── auth/         # Аутентификация
│   │   │   ├── login.js  # POST - вход
│   │   │   ├── register.js # POST - регистрация
│   │   │   ├── logout.js # POST - выход
│   │   │   └── me.js     # GET - текущий пользователь
│   │   ├── dictionaries/ # Управление словарями
│   │   │   ├── index.js  # GET/POST - список/создание
│   │   │   ├── [id].js   # PUT/DELETE - обновление/удаление
│   │   │   ├── reorder.js # PUT - изменение порядка
│   │   │   └── selected-words.js # GET/POST/PUT/DELETE - выбранные слова
│   │   ├── search/        # Поиск
│   │   │   ├── index.js  # GET - поиск слов
│   │   │   ├── examples.js # GET - примеры предложений
│   │   │   └── audio.js  # GET - генерация аудио
│   │   ├── translate/     # Перевод
│   │   │   └── index.js  # POST - перевод текста
│   │   └── user/         # Пользовательские данные
│   │       ├── profile.js # PUT - обновление профиля
│   │       ├── password.js # PUT - смена пароля
│   │       └── settings.js # GET/PUT - настройки
│   ├── admin/            # Админ страница
│   │   └── index.js      # Панель управления пользователями
│   ├── auth.js           # Страница входа/регистрации
│   ├── dictionary.js     # Просмотр словарей
│   ├── dictionaries.js   # Управление персональными словарями
│   ├── index.js          # Главная страница (лендинг)
│   ├── landing.js        # Альтернативный лендинг
│   ├── learn.js          # Страница обучения
│   ├── profile.js        # Профиль пользователя
│   ├── search.js         # Поиск по словарю
│   ├── settings.js       # Настройки приложения
│   └── translate.js      # Переводчик текста
│
├── words/                # Словари (JSON файлы)
│   ├── index.js         # Экспорт всех словарей
│   ├── hsk1.json        # HSK уровень 1
│   ├── hsk2.json        # HSK уровень 2
│   ├── hsk3.json        # HSK уровень 3
│   ├── hsk4.json        # HSK уровень 4
│   ├── hsk5.json        # HSK уровень 5
│   ├── hsk6.json        # HSK уровень 6
│   └── [множество других словарей].json
│
├── styles/              # Стили
│   ├── main.scss        # Основные стили
│   ├── animations.scss  # Анимации
│   └── bs.scss          # Bootstrap кастомизация
│
├── public/              # Статические файлы
│   ├── favicon.ico
│   └── zeit.svg
│
├── next.config.js       # Конфигурация Next.js
├── tailwind.config.js   # Конфигурация Tailwind
├── vercel.json          # Конфигурация Vercel
├── package.json         # Зависимости
└── README.md            # Документация
```

---

## 3. ВСЕ РОУТЫ И МАРШРУТЫ

### Frontend Routes (Pages)

| URL | Файл | Описание | Требует авторизации |
|-----|------|----------|---------------------|
| `/` | `pages/index.js` | Главная страница (лендинг) | ❌ |
| `/landing` | `pages/landing.js` | Альтернативный лендинг | ❌ |
| `/auth` | `pages/auth.js` | Вход/Регистрация | ❌ |
| `/learn` | `pages/learn.js` | Обучение по карточкам | ✅ |
| `/search` | `pages/search.js` | Поиск по словарю | ✅ |
| `/translate` | `pages/translate.js` | Переводчик текста | ✅ |
| `/dictionary` | `pages/dictionary.js` | Просмотр словарей | ✅ |
| `/dictionaries` | `pages/dictionaries.js` | Управление персональными словарями | ✅ |
| `/profile` | `pages/profile.js` | Профиль пользователя | ✅ |
| `/settings` | `pages/settings.js` | Настройки приложения | ✅ |
| `/admin` | `pages/admin/index.js` | Админ панель | ✅ (только админы) |

### Backend API Routes

#### Аутентификация (`/api/auth/`)

| Метод | URL | Описание | Параметры | Ответ |
|-------|-----|----------|-----------|-------|
| POST | `/api/auth/register` | Регистрация | `{email, password, name}` | `{success, user, token}` |
| POST | `/api/auth/login` | Вход | `{email, password}` | `{success, user, token}` |
| POST | `/api/auth/logout` | Выход | - | `{success}` |
| GET | `/api/auth/me` | Текущий пользователь | - | `{user}` |

#### Поиск (`/api/search/`)

| Метод | URL | Описание | Параметры | Ответ |
|-------|-----|----------|-----------|-------|
| GET | `/api/search` | Поиск слов | `?q=query` | `{results, count}` |
| GET | `/api/search/examples` | Примеры предложений | `?word=汉字` | `{examples, count, sources}` |
| GET | `/api/search/audio` | Генерация аудио | `?text=汉字&lang=zh-CN` | Audio file (MP3) |

#### Перевод (`/api/translate/`)

| Метод | URL | Описание | Параметры | Ответ |
|-------|-----|----------|-----------|-------|
| POST | `/api/translate` | Перевод текста | `{text, from, to, useAI}` | `{translation, method, from, to}` |

#### Словари (`/api/dictionaries/`)

| Метод | URL | Описание | Параметры | Ответ |
|-------|-----|----------|-----------|-------|
| GET | `/api/dictionaries` | Список словарей | - | `{dictionaries, selectedWordsCount}` |
| POST | `/api/dictionaries` | Создать словарь | `{name, words}` | `{dictionary}` |
| PUT | `/api/dictionaries/[id]` | Обновить словарь | `{name, words}` | `{dictionary}` |
| DELETE | `/api/dictionaries/[id]` | Удалить словарь | - | `{success}` |
| PUT | `/api/dictionaries/reorder` | Изменить порядок | `{dictionaryOrder}` | `{dictionaries}` |
| GET | `/api/dictionaries/selected-words` | Выбранные слова | - | `{selectedWords}` |
| POST | `/api/dictionaries/selected-words` | Добавить слово | `{word}` | `{selectedWords}` |
| PUT | `/api/dictionaries/selected-words` | Создать словарь из выбранных | `{dictionaryName}` | `{dictionary}` |
| DELETE | `/api/dictionaries/selected-words` | Очистить выбранные | `?wordSimplified=汉字` | `{selectedWords}` |

#### Пользователь (`/api/user/`)

| Метод | URL | Описание | Параметры | Ответ |
|-------|-----|----------|-----------|-------|
| PUT | `/api/user/profile` | Обновить профиль | `{name, avatar}` | `{user}` |
| PUT | `/api/user/password` | Сменить пароль | `{currentPassword, newPassword}` | `{success}` |
| GET | `/api/user/settings` | Получить настройки | - | `{settings}` |
| PUT | `/api/user/settings` | Сохранить настройки | `{themeColor, language, translationLanguages}` | `{success}` |

#### Админ (`/api/admin/`)

| Метод | URL | Описание | Параметры | Ответ |
|-------|-----|----------|-----------|-------|
| GET | `/api/admin/users` | Список всех пользователей | - | `{users}` |
| PUT | `/api/admin/users/[id]` | Обновить пользователя | `{isPremium, premiumExpiresAt, isAdmin, isBanned, banReason}` | `{success}` |
| DELETE | `/api/admin/users/[id]` | Удалить пользователя | - | `{success}` |

---

## 4. МОДЕЛИ БАЗЫ ДАННЫХ

### Коллекция: `users`

#### Схема документа пользователя:

```javascript
{
  _id: ObjectId,                    // ID пользователя
  email: String,                    // Email (уникальный)
  password: String,                 // Хеш пароля (bcrypt)
  name: String,                     // Имя пользователя (уникальное)
  avatar: String | null,            // URL аватара (не используется)
  
  // Статусы
  isPremium: Boolean,                // Премиум статус
  premiumExpiresAt: Date | null,     // Дата истечения премиум
  isAdmin: Boolean,                 // Админ права
  isBanned: Boolean,                 // Забанен ли
  banReason: String | null,          // Причина бана
  
  // Активность
  lastSeen: Date,                    // Последняя активность
  ipAddress: String | null,          // IP адрес
  
  // Пользовательские данные
  personalDictionaries: [             // Персональные словари
    {
      id: String,                    // ID словаря
      name: String,                  // Название
      words: [                        // Массив слов
        {
          simplified: String,        // Упрощенные иероглифы
          pinyin: String,            // Пиньинь
          definitions: [String]       // Переводы
        }
      ],
      createdAt: Date,
      updatedAt: Date,
      order: Number                   // Порядок сортировки
    }
  ],
  selectedWords: [                   // Выбранные слова для создания словаря
    {
      simplified: String,
      pinyin: String,
      definitions: [String],
      selectedAt: Date
    }
  ],
  searchHistory: [                   // История поиска (макс 100)
    {
      term: String,                   // Поисковый запрос
      timestamp: Date
    }
  ],
  settings: {                         // Настройки пользователя
    themeColor: String,               // Цвет темы
    language: String,                 // Язык интерфейса
    translationLanguages: [String]    // Языки для переводов
  },
  
  // Метаданные
  createdAt: Date,
  updatedAt: Date
}
```

#### Индексы (рекомендуется создать):
- `email` - уникальный индекс
- `name` - уникальный индекс
- `isAdmin` - индекс для быстрого поиска админов
- `isPremium` - индекс для статистики
- `lastSeen` - индекс для определения онлайн пользователей

---

## 5. СИСТЕМА АУТЕНТИФИКАЦИИ И АВТОРИЗАЦИИ

### Аутентификация

**Метод:** JWT (JSON Web Tokens) + HTTP-only Cookies

**Процесс:**
1. Пользователь регистрируется/входит через `/api/auth/register` или `/api/auth/login`
2. Сервер генерирует JWT токен с `userId` и сроком действия 30 дней
3. Токен сохраняется в HTTP-only cookie с именем `token`
4. При каждом запросе токен извлекается из cookie и проверяется
5. `userId` используется для получения данных пользователя из БД

**Функции (lib/auth.js):**
- `generateToken(userId)` - создание JWT токена
- `verifyToken(token)` - проверка токена
- `getUserIdFromRequest(req)` - извлечение userId из запроса

**Безопасность:**
- Пароли хешируются с помощью bcrypt (10 раундов)
- HTTP-only cookies предотвращают XSS атаки
- SameSite=Lax защищает от CSRF
- Secure флаг в production

### Авторизация (Роли)

**Роли:**
1. **Гость** - неавторизованный пользователь
2. **Пользователь** - авторизованный пользователь
3. **Премиум** - пользователь с `isPremium: true`
4. **Админ** - пользователь с `isAdmin: true`

**Проверка прав:**
- В API роутах используется `getUserIdFromRequest(req)`
- Для админ функций дополнительно проверяется `user.isAdmin`
- Забаненные пользователи не могут войти (проверка в `/api/auth/login`)

**Автоматическое назначение админа:**
- Email `payeer.tm@gmail.com` автоматически получает админ права при регистрации

---

## 6. ВСЕ API ЭНДПОИНТЫ (ДЕТАЛЬНО)

### Аутентификация

#### `POST /api/auth/register`
**Описание:** Регистрация нового пользователя

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

**Валидация:**
- Email обязателен, должен быть уникальным
- Пароль минимум 6 символов
- Имя обязательно, должно быть уникальным

**Ответ (201):**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": null,
    "isPremium": false,
    "isAdmin": false
  },
  "token": "jwt_token"
}
```

**Ошибки:**
- 400: Email уже зарегистрирован / Имя занято / Недостаточно данных
- 500: Ошибка сервера

---

#### `POST /api/auth/login`
**Описание:** Вход в систему

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": null,
    "isPremium": false,
    "premiumExpiresAt": null,
    "isAdmin": false,
    "isBanned": false
  },
  "token": "jwt_token"
}
```

**Ошибки:**
- 400: Недостаточно данных
- 401: Неверные учетные данные
- 403: Аккаунт забанен (с `banReason`)

**Дополнительно:**
- Обновляет `lastSeen` и `ipAddress`

---

#### `POST /api/auth/logout`
**Описание:** Выход из системы

**Ответ (200):**
```json
{
  "success": true
}
```

**Действие:** Удаляет cookie с токеном

---

#### `GET /api/auth/me`
**Описание:** Получить данные текущего пользователя

**Ответ (200):**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": null,
    "isPremium": true,
    "premiumExpiresAt": "2025-12-31T00:00:00.000Z",
    "isAdmin": false,
    "personalDictionaries": [...],
    "searchHistory": [...]
  }
}
```

**Ошибки:**
- 401: Не авторизован
- 404: Пользователь не найден

**Дополнительно:**
- Обновляет `lastSeen`
- Проверяет валидность премиум подписки

---

### Поиск

#### `GET /api/search`
**Описание:** Поиск слов в словарях

**Query параметры:**
- `q` (обязательный) - поисковый запрос

**Пример:** `/api/search?q=你好`

**Процесс поиска:**
1. Пробует Youdao API (если настроен)
2. Пробует Google Translate API
3. Fallback на локальные словари

**Ответ (200):**
```json
{
  "results": [
    {
      "id": "search-0",
      "simplified": "你好",
      "traditional": "你好",
      "pinyin": "nǐ hǎo",
      "definitions": ["hello", "hi"],
      "translations": {
        "english": "hello",
        "russian": "привет",
        "turkmen": "salam"
      },
      "dictionary": "Online Dictionary",
      "source": "Google Translate"
    }
  ],
  "count": 1
}
```

**Дополнительно:**
- Сохраняет запрос в историю поиска (если пользователь авторизован)
- Добавляет пиньинь если его нет

---

#### `GET /api/search/examples`
**Описание:** Получить примеры предложений для слова

**Query параметры:**
- `word` (обязательный) - китайское слово

**Пример:** `/api/search/examples?word=你好`

**Источники:**
- Tatoeba API
- Reverso Context
- MDBG API

**Ответ (200):**
```json
{
  "examples": [
    {
      "chinese": "你好，我是小明。",
      "english": "Hello, I am Xiaoming."
    }
  ],
  "count": 15,
  "sources": {
    "tatoeba": 5,
    "reverso": 7,
    "mdbg": 3
  }
}
```

**Ограничения:**
- Максимум 20 примеров
- Убираются дубликаты

---

#### `GET /api/search/audio`
**Описание:** Генерация аудио произношения

**Query параметры:**
- `text` (обязательный) - текст для озвучки
- `lang` (опциональный) - язык (по умолчанию `zh-CN`)

**Пример:** `/api/search/audio?text=你好&lang=zh-CN`

**Ответ (200):**
- Content-Type: `audio/mpeg`
- Тело: MP3 файл

**Источники:**
1. Google TTS (основной)
2. Baidu TTS (fallback)

**Кэширование:** 24 часа

---

### Перевод

#### `POST /api/translate`
**Описание:** Перевод текста

**Тело запроса:**
```json
{
  "text": "你好世界",
  "from": "zh",
  "to": "en",
  "useAI": true
}
```

**Поддерживаемые языки:**
- `zh` - Китайский
- `ru` - Русский
- `en` - Английский
- `tk` - Туркменский

**Методы перевода:**
1. OpenAI GPT-3.5-turbo (если `useAI: true` и есть `OPENAI_API_KEY`)
2. MyMemory Translation API (fallback)

**Ответ (200):**
```json
{
  "translation": "Hello world",
  "method": "AI",
  "from": "zh",
  "to": "en"
}
```

**Ошибки:**
- 400: Недостаточно данных
- 500: Ошибка перевода

---

### Словари

#### `GET /api/dictionaries`
**Описание:** Получить список персональных словарей

**Ответ (200):**
```json
{
  "dictionaries": [
    {
      "id": "dict_1234567890_abc",
      "name": "My Dictionary",
      "words": [...],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "order": 0
    }
  ],
  "selectedWordsCount": 5
}
```

---

#### `POST /api/dictionaries`
**Описание:** Создать новый словарь

**Тело запроса:**
```json
{
  "name": "My Dictionary",
  "words": [
    {
      "simplified": "你好",
      "pinyin": "nǐ hǎo",
      "definitions": ["hello"]
    }
  ]
}
```

**Ответ (201):**
```json
{
  "dictionary": {
    "id": "dict_1234567890_abc",
    "name": "My Dictionary",
    "words": [...],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "order": 0
  }
}
```

---

#### `PUT /api/dictionaries/[id]`
**Описание:** Обновить словарь

**Тело запроса:**
```json
{
  "name": "Updated Name",
  "words": [...]
}
```

**Валидация:**
- ID словаря должен быть строкой до 100 символов
- Название до 200 символов
- Массив слов до 10000 элементов

**Ответ (200):**
```json
{
  "dictionary": {...}
}
```

**Ошибки:**
- 400: Неверные данные
- 404: Словарь не найден

---

#### `DELETE /api/dictionaries/[id]`
**Описание:** Удалить словарь

**Ответ (200):**
```json
{
  "success": true
}
```

---

#### `PUT /api/dictionaries/reorder`
**Описание:** Изменить порядок словарей

**Тело запроса:**
```json
{
  "dictionaryOrder": ["dict_id_1", "dict_id_2", "dict_id_3"]
}
```

**Ответ (200):**
```json
{
  "dictionaries": [...]
}
```

---

#### `GET /api/dictionaries/selected-words`
**Описание:** Получить выбранные слова

**Ответ (200):**
```json
{
  "selectedWords": [
    {
      "simplified": "你好",
      "pinyin": "nǐ hǎo",
      "definitions": ["hello"],
      "selectedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/dictionaries/selected-words`
**Описание:** Добавить слово в выбранные

**Тело запроса:**
```json
{
  "word": {
    "simplified": "你好",
    "pinyin": "nǐ hǎo",
    "definitions": ["hello"]
  }
}
```

**Ответ (200):**
```json
{
  "selectedWords": [...]
}
```

**Примечание:** Дубликаты не добавляются

---

#### `PUT /api/dictionaries/selected-words`
**Описание:** Создать словарь из выбранных слов

**Тело запроса:**
```json
{
  "dictionaryName": "New Dictionary"
}
```

**Ответ (201):**
```json
{
  "dictionary": {...}
}
```

**Дополнительно:** Очищает список выбранных слов после создания

---

#### `DELETE /api/dictionaries/selected-words`
**Описание:** Удалить слово или очистить все выбранные

**Query параметры:**
- `wordSimplified` (опциональный) - если указан, удаляет конкретное слово, иначе очищает все

**Ответ (200):**
```json
{
  "selectedWords": [],
  "message": "All selected words cleared"
}
```

---

### Пользователь

#### `PUT /api/user/profile`
**Описание:** Обновить профиль

**Тело запроса:**
```json
{
  "name": "New Name",
  "avatar": "url_to_avatar"
}
```

**Ответ (200):**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "New Name",
    "avatar": "url_to_avatar",
    "isAdmin": false,
    "isPremium": false
  }
}
```

---

#### `PUT /api/user/password`
**Описание:** Сменить пароль

**Тело запроса:**
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

**Ответ (200):**
```json
{
  "success": true
}
```

**Ошибки:**
- 400: Недостаточно данных
- 401: Неверный текущий пароль
- 404: Пользователь не найден

---

#### `GET /api/user/settings`
**Описание:** Получить настройки пользователя

**Ответ (200):**
```json
{
  "settings": {
    "themeColor": "red",
    "language": "en",
    "translationLanguages": ["en", "ru"]
  }
}
```

---

#### `PUT /api/user/settings`
**Описание:** Сохранить настройки

**Тело запроса:**
```json
{
  "themeColor": "blue",
  "language": "ru",
  "translationLanguages": ["en", "ru", "zh"]
}
```

**Ответ (200):**
```json
{
  "success": true
}
```

---

### Админ

#### `GET /api/admin/users`
**Описание:** Получить список всех пользователей (только для админов)

**Ответ (200):**
```json
{
  "users": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "name": "User Name",
      "avatar": null,
      "isPremium": true,
      "premiumExpiresAt": "2025-12-31T00:00:00.000Z",
      "isAdmin": false,
      "isBanned": false,
      "banReason": null,
      "ipAddress": "192.168.1.1",
      "lastSeen": "2025-01-01T12:00:00.000Z",
      "isOnline": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Ошибки:**
- 401: Не авторизован
- 403: Не админ

**Дополнительно:**
- Определяет онлайн пользователей (активны в последние 5 минут)

---

#### `PUT /api/admin/users/[id]`
**Описание:** Обновить пользователя (только для админов)

**Тело запроса:**
```json
{
  "isPremium": true,
  "premiumExpiresAt": "2025-12-31T00:00:00.000Z",
  "isAdmin": false,
  "isBanned": false,
  "banReason": "Spam"
}
```

**Ответ (200):**
```json
{
  "success": true
}
```

**Ошибки:**
- 401: Не авторизован
- 403: Не админ

---

#### `DELETE /api/admin/users/[id]`
**Описание:** Удалить пользователя (только для админов)

**Ответ (200):**
```json
{
  "success": true
}
```

**Ошибки:**
- 401: Не авторизован
- 403: Не админ

---

## 7. СТОРОННИЕ СЕРВИСЫ

### Используемые API

1. **OpenAI API**
   - Использование: AI перевод текста
   - Требуется: `OPENAI_API_KEY` в env
   - Модель: `gpt-3.5-turbo`
   - Endpoint: `https://api.openai.com/v1/chat/completions`

2. **Google Translate (неофициальный)**
   - Использование: Перевод, поиск, TTS, пиньинь
   - Endpoints:
     - `https://translate.googleapis.com/translate_a/single` - перевод
     - `https://translate.google.com/translate_tts` - TTS
   - Без API ключа (неофициальное использование)

3. **MyMemory Translation API**
   - Использование: Fallback для перевода
   - Endpoint: `https://api.mymemory.translated.net/get`
   - Бесплатный, лимиты не указаны

4. **Tatoeba API**
   - Использование: Примеры предложений
   - Endpoint: `https://tatoeba.org/api/v0/search`
   - Бесплатный

5. **Reverso Context**
   - Использование: Примеры предложений
   - Endpoint: `https://context.reverso.net/translation/chinese-english/`
   - Бесплатный (скрапинг HTML)

6. **MDBG API**
   - Использование: Примеры предложений
   - Endpoint: `https://www.mdbg.net/chinese/api/example_sentences.php`
   - Бесплатный

7. **MakeMeAHanzi (CDN)**
   - Использование: Анимация порядка штрихов
   - Endpoint: `https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/svgs/`
   - Бесплатный, открытый проект

8. **Pinyin APIs**
   - Использование: Получение пиньиня для текста
   - Endpoints:
     - `https://api.pinyin.pepe.is/convert`
     - `https://pinyin-rest.pepebigotes.me/convert`
     - `https://pinyin-api.vercel.app/api/pinyin`
   - Бесплатные

9. **Baidu TTS**
   - Использование: Fallback для TTS
   - Endpoint: `https://tts.baidu.com/text2audio`
   - Бесплатный

10. **Google Images**
    - Использование: Поиск картинок для слова (открывается в новой вкладке)
    - URL: `https://www.google.com/search?tbm=isch&q=`

### Не используются (но упомянуты в коде)

- **Youdao API** - код есть, но не настроен (требуется API ключ)
- **Jukuu API** - код есть, но не используется в основном потоке

---

## 8. РЕДАКТИРОВАНИЕ КОНТЕНТА

### Как редактировать контент

#### Словари (words/)
- **Формат:** JSON файлы в папке `words/`
- **Структура слова:**
```json
{
  "simplified": "你好",
  "pinyin": "nǐ hǎo",
  "definitions": ["hello", "hi"]
}
```
- **Редактирование:** Прямое редактирование JSON файлов
- **Добавление нового словаря:**
  1. Создать файл `words/new-dict.json`
  2. Добавить импорт в `words/index.js`
  3. Перезапустить приложение

#### Тексты интерфейса
- **Локализация:** `lib/contexts/SettingsContext.js`
- **Файл:** Массив `TRANSLATIONS` с переводами на 4 языка
- **Редактирование:** Прямое редактирование объекта `TRANSLATIONS`
- **Языки:** `en`, `ru`, `tk`, `zh`

#### Лендинг
- **Главная страница:** `pages/index.js`
- **Альтернативный лендинг:** `pages/landing.js`
- **Тексты:** Захардкожены в компонентах, используют переводы из `SettingsContext`

#### Стили
- **Основные стили:** `styles/main.scss`
- **Анимации:** `styles/animations.scss`
- **Bootstrap кастомизация:** `styles/bs.scss`
- **Tailwind:** `tailwind.config.js` (настроен, но используется минимально)

---

## 9. ЗАХАРДКОЖЕННЫЙ КОНТЕНТ ЛЕНДИНГА

### Файл: `pages/index.js`

**Захардкоженные элементы:**

1. **Статистика:**
```javascript
const stats = [
  { number: '5000+', label: t('vocabulary') },
  { number: '6', label: t('hskLevels') },
  { number: '4', label: t('learningModes') },
  { number: '∞', label: t('unlimitedDictionaries') }
]
```

2. **Функции (features):**
```javascript
const features = [
  {
    icon: '📚',
    title: t('hskVocabulary'),
    description: t('hskVocabularyDesc')
  },
  // ... еще 5 функций
]
```

3. **SVG флаг Китая:**
```javascript
<svg width="80" height="53" viewBox="0 0 900 600">
  <rect fill="#EE1C25" width="900" height="600"/>
  <g fill="#FFFF00">
    // ... звезды
  </g>
</svg>
```

4. **Градиенты и цвета:**
```javascript
background: 'linear-gradient(180deg, #1c1c1e 0%, #000 100%)'
background: 'linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00)'
```

5. **Тексты кнопок:**
```javascript
{t('startLearning')}
{t('freeRegister')}
{t('login')}
```

### Файл: `pages/landing.js`

**Захардкоженные элементы:**

1. **Заголовок:**
```javascript
<h1>汉语学习</h1>
<p>Welcome back, {user.name}!</p>
```

2. **Описания функций:**
```javascript
<h3>📚 Dictionary Search</h3>
<p>Search through comprehensive Chinese dictionaries...</p>
```

3. **Цены:**
```javascript
<span>$0</span>/month  // Free
<span>$9.99</span>/month  // Premium
```

4. **Список функций Free/Premium:**
```javascript
<li>✓ Dictionary search</li>
<li>✓ Text translation</li>
// ... и т.д.
```

### Файл: `components/SiteLayout.js`

**Захардкоженные элементы:**

1. **Логотип:**
```javascript
<Link href="/" className="logo">汉语学习</Link>
```

2. **Футер:**
```javascript
<footer>汉语学习工具，2025年。</footer>
```

### Файл: `pages/_app.js`

**Захардкоженные элементы:**

1. **Title страницы:**
```javascript
<title>汉语学习</title>
```

---

## 10. ТЕХНОЛОГИИ ДЛЯ СТИЛЕЙ

### Используемые технологии

1. **SCSS (Sass)**
   - **Файлы:**
     - `styles/main.scss` - основные стили
     - `styles/animations.scss` - анимации
     - `styles/bs.scss` - кастомизация Bootstrap
   - **Импорт:** В `pages/_app.js` через `import '~/styles/main.scss'`
   - **Использование:** Основной способ стилизации

2. **Bootstrap 5.3.3**
   - **Импорт:** `import 'bootstrap/dist/css/bootstrap.min.css'` в `_app.js`
   - **Компоненты:** Reactstrap 9.2.2 (React обертка для Bootstrap)
   - **Использование:** Активно используется для компонентов (кнопки, формы, модалки, таблицы)

3. **Tailwind CSS**
   - **Конфигурация:** `tailwind.config.js`
   - **Настройки:**
     - Кастомные цвета (apple-dark, apple-gray, apple-text, apple-accent)
     - Кастомные шрифты
   - **Использование:** Минимальное, в основном для утилитарных классов

4. **Inline Styles**
   - **Использование:** Очень активно используется в компонентах
   - **Примеры:**
     - `style={{ backgroundColor: '#1c1c1e', color: '#fff' }}`
     - Динамические стили на основе темы
   - **Причина:** Легче управлять темой и динамическими значениями

5. **CSS Variables (CSS Custom Properties)**
   - **Использование:** Для темы
   - **Установка:** В `SettingsContext.js`
   ```javascript
   document.documentElement.style.setProperty('--theme-color', color)
   document.documentElement.style.setProperty('--theme-color-rgb', hexToRgb(color))
   ```

6. **CSS Animations**
   - **Файл:** `styles/animations.scss`
   - **Использование:** Для анимаций появления, hover эффектов
   - **Примеры:**
     - `fadeIn`
     - `fadeInUp`
     - `bounce`

### Цветовая схема

**Основные цвета:**
- Фон: `#000` (черный), `#1c1c1e` (темно-серый)
- Текст: `#fff` (белый), `#aaa` (светло-серый)
- Акцент: `#ff3b30` (красный) - основной цвет темы
- Вторичный: `#2c2c2e` (серый для карточек)
- Границы: `#333`, `#444`

**Цвета темы (8 вариантов):**
- `red`: `#ff3b30`
- `orange`: `#ff9500`
- `yellow`: `#ffcc00`
- `green`: `#34c759`
- `blue`: `#007AFF`
- `purple`: `#af52de`
- `pink`: `#ff2d55`
- `cyan`: `#5ac8fa`

### Шрифты

**Основной шрифт (sans):**
```
-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 
'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif
```

**Моноширинный:**
```
'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace
```

---

## ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### Переменные окружения

**Требуемые:**
- `MONGODB_URI` - строка подключения к MongoDB
- `JWT_SECRET` - секретный ключ для JWT

**Опциональные:**
- `OPENAI_API_KEY` - для AI перевода
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - для reCAPTCHA (не используется в коде)
- `RECAPTCHA_SECRET_KEY` - для reCAPTCHA (не используется в коде)
- `BASE_URL` - базовый URL для деплоя (используется в next.config.js)

### Скрипты (package.json)

- `npm run dev` - запуск dev сервера
- `npm run build` - сборка production
- `npm run start` - запуск production сервера
- `npm run analyze` - анализ bundle (требует ANALYZE=true)
- `npm run lint` - линтинг

### Версии Node.js

- **Требуется:** Node.js >= 18.0.0
- **Рекомендуется:** Node.js 18.x или 20.x LTS

### Особенности реализации

1. **Персональные словари хранятся в документе пользователя** (не отдельная коллекция)
2. **История поиска ограничена 100 записями** (удаляются старые)
3. **Онлайн пользователи определяются по активности за последние 5 минут**
4. **Премиум проверяется по дате истечения** при каждом запросе `/api/auth/me`
5. **Drag & Drop для словарей** реализован через react-beautiful-dnd
6. **Импорт/экспорт словарей** поддерживает JSON и CSV форматы
7. **Множественные источники для примеров предложений** - объединяются и дедуплицируются
8. **Fallback цепочки** для всех внешних API (если один не работает, пробуется следующий)

---

**Конец технического аудита**

