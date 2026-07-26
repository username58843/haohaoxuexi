# Инструкция по деплою на Vercel

## Быстрый деплой

### Шаг 1: Подготовка репозитория

```bash
git add .
git commit -m "Update to Next.js 15"
git push origin main
```

### Шаг 2: Деплой на Vercel

1. Зайдите на [Vercel](https://vercel.com)
2. Нажмите "New Project"
3. Импортируйте ваш GitHub репозиторий
4. Vercel автоматически определит Next.js проект

### Шаг 3: Настройка переменных окружения

В настройках проекта добавьте следующие переменные:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hsk-app?retryWrites=true&w=majority
JWT_SECRET=ваш-случайный-секретный-ключ-минимум-32-символа
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=ваш-site-key
RECAPTCHA_SECRET_KEY=ваш-secret-key
OPENAI_API_KEY=sk-ваш-openai-key (опционально)
```

### Шаг 4: Настройка Build Settings

Vercel автоматически определит:
- **Framework Preset**: Next.js
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install` или `yarn install`

### Шаг 5: Настройка Node.js версии

В `package.json` уже указано:
```json
"engines": {
  "node": ">=18.0.0",
  "npm": ">=9.0.0"
}
```

Vercel автоматически использует правильную версию Node.js.

### Шаг 6: Деплой

Нажмите "Deploy" и дождитесь завершения сборки.

## Возможные проблемы и решения

### Проблема: Build fails с ошибкой MongoDB

**Решение**: 
1. Убедитесь что `MONGODB_URI` правильно установлен
2. Проверьте что MongoDB Atlas доступен из интернета
3. Убедитесь что IP адрес `0.0.0.0/0` добавлен в белый список MongoDB Atlas

### Проблема: Build fails с ошибкой модулей

**Решение**:
1. Убедитесь что все зависимости указаны в `package.json`
2. Проверьте что версии совместимы
3. Очистите кэш Vercel: Settings → General → Clear Build Cache

### Проблема: Runtime errors

**Решение**:
1. Проверьте логи в Vercel Dashboard → Deployments → [ваш деплой] → Runtime Logs
2. Убедитесь что все переменные окружения установлены
3. Проверьте что MongoDB доступен

### Проблема: API routes не работают

**Решение**:
1. Убедитесь что файлы находятся в `pages/api/`
2. Проверьте что экспортируется `default` функция
3. Проверьте логи в Vercel для деталей ошибок

## Проверка после деплоя

После успешного деплоя проверьте:

- [ ] Главная страница загружается
- [ ] Страница регистрации работает
- [ ] Страница входа работает
- [ ] Поиск работает
- [ ] Переводчик работает
- [ ] API routes отвечают правильно
- [ ] MongoDB подключение работает

## Обновление переменных окружения

Если нужно обновить переменные окружения:

1. Зайдите в Vercel Dashboard
2. Выберите ваш проект
3. Settings → Environment Variables
4. Добавьте или обновите переменные
5. Пересоберите проект (Redeploy)

## Мониторинг

Vercel предоставляет:
- **Analytics**: Статистика посещений
- **Logs**: Логи приложения и ошибки
- **Speed Insights**: Анализ производительности

## Дополнительные настройки

### Custom Domain

1. Settings → Domains
2. Добавьте ваш домен
3. Следуйте инструкциям по настройке DNS

### Environment Variables для разных окружений

Вы можете установить разные переменные для:
- Production
- Preview
- Development

## Поддержка

Если возникли проблемы:
1. Проверьте логи в Vercel Dashboard
2. Проверьте что все переменные окружения установлены
3. Убедитесь что MongoDB доступен
4. Проверьте что Node.js версия >= 18

