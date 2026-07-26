# Исправление ошибки на странице /learn

## Проблема

```
[TypeError: props.render is not a function]
Error occurred prerendering page "/learn"
```

## Причина

Проблема была в использовании устаревшего синтаксиса `react-hook-form` версии 5 в компоненте `SettingsForm.js`. В версии 7 (которая установлена) синтаксис изменился:

1. **Controller**: Вместо `as={Component}` теперь используется `render={({ field }) => <Component />}`
2. **register**: Вместо `innerRef={register()}` теперь используется `{...register('fieldName')}`

## Исправления

### ✅ components/SettingsForm.js

1. Обновлен `Controller`:
   - Старый: `as={ButtonCheckboxGroup}`
   - Новый: `render={({ field }) => <ButtonCheckboxGroup ... />}`

2. Обновлены все `Input` поля:
   - Старый: `innerRef={register()}`
   - Новый: `{...register('fieldName')}`

3. Обновлена передача значений в `ButtonCheckboxGroup`:
   - Используется `field.value` и `field.onChange` из render prop

### ✅ pages/learn.js

- Добавлена проверка типа для `config` query параметра
- Улучшена обработка отсутствующих query параметров

## Результат

Теперь страница `/learn` должна успешно собираться на Vercel!

