# Инструкция по установке и развертыванию

## Локальная установка

### 1. Установка зависимостей

```bash
npm install
# или
yarn install
```

### 2. Настройка переменных окружения

Создайте файл `.env.local` в корне проекта:

```env
MONGODB_URI=mongodb://localhost:27017/hsk-app
JWT_SECRET=ваш-секретный-ключ-измените-в-продакшене
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=ваш-recaptcha-site-key
RECAPTCHA_SECRET_KEY=ваш-recaptcha-secret-key
OPENAI_API_KEY=ваш-openai-api-key (опционально)
```

### 3. Запуск MongoDB

#### Вариант A: Локальный MongoDB

```bash
# Установите MongoDB локально и запустите
mongod
```

#### Вариант B: MongoDB Atlas (рекомендуется)

1. Зарегистрируйтесь на [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Создайте бесплатный кластер
3. Создайте пользователя базы данных
4. Добавьте IP адрес в белый список (0.0.0.0/0 для разработки)
5. Скопируйте connection string и добавьте в `.env.local`

### 4. Настройка Google reCAPTCHA

1. Перейдите на [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Зарегистрируйте новый сайт
3. Выберите reCAPTCHA v2
4. Добавьте домен (localhost для разработки)
5. Скопируйте Site Key и Secret Key в `.env.local`

### 5. Запуск приложения

```bash
npm run dev
# или
yarn dev
```

Откройте [http://localhost:3000](http://localhost:3000)

## Развертывание на Vercel

### 1. Подготовка репозитория

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Развертывание на Vercel

1. Перейдите на [Vercel](https://vercel.com)
2. Импортируйте ваш GitHub репозиторий
3. Добавьте переменные окружения в настройках проекта:
   - `MONGODB_URI` - строка подключения к MongoDB Atlas
   - `JWT_SECRET` - случайный секретный ключ
   - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - публичный ключ reCAPTCHA
   - `RECAPTCHA_SECRET_KEY` - секретный ключ reCAPTCHA
   - `OPENAI_API_KEY` - ключ OpenAI (опционально)

### 3. Настройка MongoDB Atlas для Vercel

1. В MongoDB Atlas перейдите в Network Access
2. Добавьте IP адрес: `0.0.0.0/0` (разрешает все IP)
3. Или добавьте IP диапазоны Vercel

### 4. Обновление домена reCAPTCHA

1. В Google reCAPTCHA Admin добавьте ваш домен Vercel
2. Обновите `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` если нужно

### 5. Создание первого администратора

После развертывания создайте администратора:

1. Зарегистрируйтесь через сайт
2. Подключитесь к MongoDB Atlas
3. Обновите документ пользователя:

```javascript
// В MongoDB Compass или через MongoDB shell
db.users.updateOne(
  { email: "ваш-email@example.com" },
  { $set: { isAdmin: true } }
)
```

## Структура проекта

- `components/` - React компоненты
- `lib/` - Утилиты и модели
- `pages/` - Страницы Next.js и API routes
- `words/` - Файлы словарей
- `styles/` - SCSS стили

## Основные функции

### Для всех пользователей:
- Поиск по словарю
- Переводчик текстов
- Режим обучения
- 6 примеров предложений на слово

### Для премиум пользователей:
- 10 примеров предложений на слово
- Личные словари
- История поиска
- Приоритетная поддержка

### Для администраторов:
- Управление пользователями
- Управление премиум подписками
- Полный административный доступ

## Устранение неполадок

### Ошибка подключения к MongoDB
- Проверьте `MONGODB_URI` в `.env.local`
- Убедитесь что MongoDB запущен (для локальной установки)
- Проверьте белый список IP в MongoDB Atlas

### Ошибка reCAPTCHA
- Проверьте ключи в `.env.local`
- Убедитесь что домен добавлен в настройках reCAPTCHA

### Ошибки сборки
- Убедитесь что все зависимости установлены: `npm install`
- Проверьте версию Node.js (требуется 14+)

## Поддержка

При возникновении проблем создайте issue в репозитории.

