import random from 'lodash/random'
import uniq from 'lodash/uniq'
import map from 'lodash/map'
import sample from 'lodash/sample'
import shuffle from 'lodash/shuffle'
import slice from 'lodash/slice'
import flatten from 'lodash/flatten'

// Импортируем все словари из индексного файла
import allDictionaries from '~/words'

// Получаем список всех доступных словарей
export function getAvailableDictionaries() {
  return Object.keys(allDictionaries).sort()
}

// Получаем слова для конкретного словаря
export function levelWords(dictionaryName) {
  // Проверяем, является ли это пользовательским словарем
  if (dictionaryName.startsWith('personal-')) {
    // Для пользовательских словарей возвращаем пустой массив
    // Реальная загрузка будет происходить в компоненте обучения
    return []
  }

  return allDictionaries[dictionaryName] || []
}

export function nRandomDigitsWithoutRepetitionExcluding(count, max, exclude) {
  // Защита от бесконечного цикла
  const availableCount = max // max уже = words.length - 1
  const actualCount = Math.min(count, availableCount)

  if (actualCount <= 0) return []

  const digits = []
  let attempts = 0
  const maxAttempts = 1000 // Защита от зацикливания

  while (uniq(digits).length < actualCount && attempts < maxAttempts) {
    const digit = random(0, max)
    if (digit !== exclude) digits.push(digit)
    attempts++
  }

  return uniq(digits).slice(0, actualCount)
}

export function selectNWords(words, count, exclude) {
  // Защита от пустого массива или малого количества слов
  if (!words || words.length === 0) return []
  if (words.length === 1) return []

  const maxCount = Math.min(count, words.length - 1)
  if (maxCount <= 0) return []

  return map(
    nRandomDigitsWithoutRepetitionExcluding(maxCount, words.length - 1, exclude),
    (d) => words[d]
  ).filter(Boolean) // Убираем undefined
}

/** Split "hsk1-12" or "dict_xxx-3" into { level, index } using last '-' */
export function parseForceId(id) {
  if (!id || typeof id !== 'string') return null
  const i = id.lastIndexOf('-')
  if (i <= 0) return null
  return {
    level: id.slice(0, i),
    index: id.slice(i + 1),
  }
}

export function buildFromConfig(config) {
  // Игнорируем другие настройки кроме режимов
  if (Array.isArray(config.forceIds) && config.forceIds.length > 0) {
    const levelsMap = config.forceIds.reduce((obj, item) => {
      const parsed = parseForceId(item)
      if (!parsed) return obj
      const { level, index } = parsed

      if (!Array.isArray(obj[level])) {
        // eslint-disable-next-line no-param-reassign
        obj[level] = []
      }

      // eslint-disable-next-line no-param-reassign
      obj[level] = [...obj[level], index]

      return obj
    }, {})

    const data = []

    Object.keys(levelsMap).forEach((level) => {
      const words = levelWords(level)
      if (!words?.length) return

      const selectedWords = levelsMap[level]
        .map((index) => {
          const word = words[+index]
          if (!word) return null
          const variants = [word, ...selectNWords(words, 3, +index)].filter(Boolean)

          return {
            id: `${level}-${index}`,
            type: sample(config.modes || ['characters-pinyin']),
            question: word,
            variants: shuffle(variants),
          }
        })
        .filter(Boolean)

      data.push(selectedWords)
    })

    return shuffle(flatten(data))
  }

  const data = shuffle(
    flatten(
      config.levels.map((level) => {
        const words = levelWords(level)

        return map(words, (word, index) => {
          const variants = [word, ...selectNWords(words, 3, index)]

          return {
            id: `${level}-${index}`,
            type: sample(config.modes || ['characters-pinyin']),
            question: word,
            variants: shuffle(variants)
          }
        })
      })
    )
  )

  if (+config.wordsLimit > 0) {
    return slice(data, 0, +config.wordsLimit)
  }

  return data
}
