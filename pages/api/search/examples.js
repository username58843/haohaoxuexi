import axios from 'axios'

// Функция для поиска примеров через Tatoeba API
async function getTatoebaExamples(word) {
  try {
    const response = await axios.get(`https://tatoeba.org/api/v0/search?from=cmn&query=${encodeURIComponent(word)}&to=eng`, {
      timeout: 5000
    })

    const examples = []
    if (response.data && response.data.results) {
      response.data.results.slice(0, 15).forEach(result => {
        if (result.text && result.translations && result.translations.length > 0) {
          // Tatoeba returns translations as array of arrays [[{lang, text}, ...], ...]
          const allTranslations = result.translations.flat ? result.translations.flat() : [].concat(...result.translations)
          const englishTranslation = allTranslations.find(t => t && t.lang === 'eng')
          if (englishTranslation) {
            examples.push({
              chinese: result.text,
              english: englishTranslation.text
            })
          }
        }
      })
    }
    return examples
  } catch (error) {
    console.log('Tatoeba API failed:', error.message)
    return []
  }
}

// Функция для поиска через Jukuu
async function getJukuuExamples(word) {
  try {
    const response = await axios.get(`https://api.jukuu.com/sentences.php?q=${encodeURIComponent(word)}&lang=zh`, {
      timeout: 5000
    })

    const examples = []
    if (response.data) {
      const sentences = response.data.match(/<tr>[\s\S]*?<\/tr>/g) || []
      sentences.slice(0, 15).forEach((sentence) => {
        const chineseMatch = sentence.match(/<td class="c">([^<]+)<\/td>/)
        const englishMatch = sentence.match(/<td class="e">([^<]+)<\/td>/)
        if (chineseMatch && englishMatch) {
          examples.push({
            chinese: chineseMatch[1].trim(),
            english: englishMatch[1].trim()
          })
        }
      })
    }
    return examples
  } catch (error) {
    console.log('Jukuu API failed:', error.message)
    return []
  }
}

// Функция для поиска через Reverso Context (более надежный)
async function getReversoExamples(word) {
  try {
    const response = await axios.get(`https://context.reverso.net/translation/chinese-english/${encodeURIComponent(word)}`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    const examples = []
    // Парсим HTML Reverso Context
    const html = response.data
    const chineseRegex = /<span class="text" lang="zh">(.*?)<\/span>/g
    const englishRegex = /<span class="text" lang="en">(.*?)<\/span>/g

    const chineseMatches = [...html.matchAll(chineseRegex)]
    const englishMatches = [...html.matchAll(englishRegex)]

    const minLength = Math.min(chineseMatches.length, englishMatches.length)
    for (let i = 0; i < Math.min(minLength, 15); i++) {
      const chinese = chineseMatches[i][1].replace(/<[^>]*>/g, '').trim()
      const english = englishMatches[i][1].replace(/<[^>]*>/g, '').trim()

      if (chinese && english) {
        examples.push({
          chinese,
          english
        })
      }
    }

    return examples
  } catch (error) {
    console.log('Reverso Context failed:', error.message)
    return []
  }
}

// Функция для поиска через MDBG (альтернативный словарь)
async function getMDBGExamples(word) {
  try {
    const response = await axios.get(`https://www.mdbg.net/chinese/api/example_sentences.php?word=${encodeURIComponent(word)}`, {
      timeout: 5000
    })

    const examples = []
    if (response.data && Array.isArray(response.data)) {
      response.data.slice(0, 15).forEach(item => {
        if (item.chinese && item.english) {
          examples.push({
            chinese: item.chinese,
            english: item.english
          })
        }
      })
    }
    return examples
  } catch (error) {
    console.log('MDBG API failed:', error.message)
    return []
  }
}

import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { word } = req.query

    if (!word) {
      return res.status(400).json({ error: 'Word is required' })
    }

    console.log('Getting examples for:', word)

    // Параллельно запрашиваем примеры из нескольких источников
    const [tatoebaExamples, reversoExamples, mdbgExamples] = await Promise.allSettled([
      getTatoebaExamples(word),
      getReversoExamples(word),
      getMDBGExamples(word)
    ])

    // Объединяем результаты
    const allExamples = [
      ...(tatoebaExamples.status === 'fulfilled' ? tatoebaExamples.value : []),
      ...(reversoExamples.status === 'fulfilled' ? reversoExamples.value : []),
      ...(mdbgExamples.status === 'fulfilled' ? mdbgExamples.value : [])
    ]

    // Убираем дубликаты и ограничиваем количество
    const uniqueExamples = []
    const seen = new Set()

    allExamples.forEach(example => {
      const key = `${example.chinese}-${example.english}`
      if (!seen.has(key) && example.chinese && example.english) {
        seen.add(key)
        uniqueExamples.push(example)
      }
    })

    // Ограничиваем до 20 примеров максимум
    const limitedExamples = uniqueExamples.slice(0, 20)

    return res.status(200).json({
      examples: limitedExamples,
      count: limitedExamples.length,
      sources: {
        tatoeba: tatoebaExamples.status === 'fulfilled' ? tatoebaExamples.value.length : 0,
        reverso: reversoExamples.status === 'fulfilled' ? reversoExamples.value.length : 0,
        mdbg: mdbgExamples.status === 'fulfilled' ? mdbgExamples.value.length : 0
      }
    })

  } catch (error) {
    console.error('Examples error:', error)
    return res.status(500).json({ error: 'Failed to get examples' })
  }
}

