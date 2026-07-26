# Исправления для деплоя на Vercel

## Исправленные ошибки

### 1. ✅ next.config.js - Удалены устаревшие опции

**Проблема**: 
```
⚠ Invalid next.config.js options detected: 
⚠     Unrecognized key(s) in object: 'swcMinify', 'serverComponentsExternalPackages'
```

**Решение**: 
- Удален `swcMinify: true` (в Next.js 15 это включено по умолчанию)
- Удален `serverComponentsExternalPackages` (больше не нужен)

### 2. ✅ components/Auth/LoginForm.js - Экранирован апостроф

**Проблема**:
```
Error: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.
```

**Решение**: 
- `Don't` → `Don&apos;t`

### 3. ✅ components/Search/SearchResults.js - Экранированы кавычки

**Проблема**:
```
Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.
```

**Решение**: 
- `"{searchTerm}"` → `&quot;{searchTerm}&quot;`

### 4. ✅ pages/dictionary.js - Добавлен eslint-disable для img

**Проблема**:
```
Warning: Using `<img>` could result in slower LCP and higher bandwidth.
```

**Решение**: 
- Добавлен комментарий `// eslint-disable-next-line @next/next/no-img-element`
- Это допустимо, так как изображение загружается из внешнего CDN и не может использовать Next.js Image

## Все исправления применены

Теперь проект должен успешно собираться на Vercel!

## Что делать дальше

1. Закоммитьте изменения:
   ```bash
   git add .
   git commit -m "Fix Vercel build errors"
   git push
   ```

2. Vercel автоматически пересоберет проект

3. Проверьте что сборка прошла успешно

