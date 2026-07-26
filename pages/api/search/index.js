import { getUserIdFromRequest } from '~/lib/auth'
import { User } from '~/lib/models/User'
import allDictionaries from '~/words'
import { runCors } from '~/lib/cors'

// Функция для поиска через Youdao API (бесплатный)
async function searchYoudao(query) {
  try {
    const response = await fetch(`https://openapi.youdao.com/api?q=${encodeURIComponent(query)}&from=auto&to=zh-CHS&appKey=YOUR_APP_KEY&salt=1&sign=YOUR_SIGN`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('Youdao API error')

    const data = await response.json()

    if (data.translation && data.translation.length > 0) {
      return {
        simplified: data.translation[0],
        traditional: data.translation[0], // Youdao не всегда возвращает традиционные
        pinyin: data.basic?.phonetic || '',
        definitions: data.basic?.explains || [data.translation[0]],
        source: 'Youdao'
      }
    }
  } catch (error) {
    console.log('Youdao search failed:', error.message)
  }
  return null
}

// Функция для поиска через Google Translate API
async function searchGoogleTranslate(query) {
  try {
    // Определяем язык запроса
    const isChinese = /[\u4e00-\u9fff]/.test(query)

    if (isChinese) {
      // Если запрос на китайском, переводим на английский, русский и туркменский
      const translations = {}

      // Английский
      try {
        const enResponse = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(query)}`)
        const enData = await enResponse.json()
        if (enData && enData[0] && enData[0][0]) {
          translations.english = enData[0][0][0]
        }
      } catch (e) { console.log('English translation failed') }

      // Русский
      try {
        const ruResponse = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=ru&dt=t&q=${encodeURIComponent(query)}`)
        const ruData = await ruResponse.json()
        if (ruData && ruData[0] && ruData[0][0]) {
          translations.russian = ruData[0][0][0]
        }
      } catch (e) { console.log('Russian translation failed') }

      // Туркменский
      try {
        const tkResponse = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=tk&dt=t&q=${encodeURIComponent(query)}`)
        const tkData = await tkResponse.json()
        if (tkData && tkData[0] && tkData[0][0]) {
          translations.turkmen = tkData[0][0][0]
        }
      } catch (e) { console.log('Turkmen translation failed') }

      return {
        simplified: query,
        traditional: query,
        pinyin: '',
        definitions: [translations.english || query],
        translations: {
          english: translations.english,
          russian: translations.russian,
          turkmen: translations.turkmen
        },
        source: 'Google Translate'
      }
    } else {
      // Если запрос на английском, переводим на китайский
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (data && data[0] && data[0][0]) {
        return {
          simplified: data[0][0][0],
          traditional: data[0][0][0],
          pinyin: '',
          definitions: [query],
          translations: {
            english: query,
            russian: null,
            turkmen: null
          },
          source: 'Google Translate'
        }
      }
    }
  } catch (error) {
    console.log('Google Translate search failed:', error.message)
  }
  return null
}

// Функция для получения пиньиня через несколько API
async function getPinyin(text) {
  // Пробуем несколько API по очереди
  const apis = [
    `https://api.pinyin.pepe.is/convert?text=${encodeURIComponent(text)}&format=marks&tone=true`,
    `https://pinyin-rest.pepebigotes.me/convert?text=${encodeURIComponent(text)}&format=marks&tone=true`,
    `https://pinyin-api.vercel.app/api/pinyin?text=${encodeURIComponent(text)}`
  ]

  for (const apiUrl of apis) {
    try {
      const response = await fetch(apiUrl, { timeout: 3000 })
      if (response.ok) {
        const data = await response.json()
        const pinyin = data.result || data.pinyin || ''
        if (pinyin) return pinyin
      }
    } catch (error) {
      console.log(`Pinyin API ${apiUrl} failed:`, error.message)
    }
  }

  // Fallback: простая транслитерация (не идеально, но лучше чем ничего)
  try {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=rm&q=${encodeURIComponent(text)}`)
    const data = await response.json()
    if (data && data[0] && data[0][0] && data[0][0][3]) {
      return data[0][0][3] // Romanization from Google
    }
  } catch (error) {
    console.log('Google romanization fallback failed:', error.message)
  }

  return ''
}

// Функция поиска в локальных данных (fallback)
function searchLocalDictionaries(searchTerm) {
  const results = []

  Object.keys(allDictionaries).forEach((dictName) => {
    const words = allDictionaries[dictName]
    words.forEach((word, index) => {
      const simplified = word.simplified?.toLowerCase() || ''
      const pinyin = word.pinyin?.toLowerCase() || ''
      const definitions = word.definitions?.join(' ').toLowerCase() || ''

      if (
        simplified.includes(searchTerm) ||
        pinyin.includes(searchTerm) ||
        definitions.includes(searchTerm)
      ) {
        results.push({
          id: `${dictName}-${index}`,
          dictionary: dictName,
          simplified: word.simplified,
          traditional: word.traditional,
          pinyin: word.pinyin,
          definitions: word.definitions,
          source: dictName
        })
      }
    })
  })

  return results
}

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q } = req.query

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const searchTerm = q.trim().toLowerCase()
    let results = []

    const hskMatch = searchTerm.match(/^hsk([1-6])$/)
    if (hskMatch) {
      const levelKey = `hsk${hskMatch[1]}`
      const levelWords = allDictionaries[levelKey] || []

      const mapped = levelWords.map((word, index) => ({
        id: `${levelKey}-${index}`,
        dictionary: levelKey,
        simplified: word.simplified,
        traditional: word.traditional,
        pinyin: word.pinyin,
        definitions: word.definitions,
        source: levelKey
      }))

      return res.status(200).json({
        results: mapped,
        count: mapped.length,
        source: 'hsk-level'
      })
    }

    // 1. Сначала пробуем поиск через внешние API
    console.log('Searching for:', searchTerm)

    // Пробуем Youdao (если есть API ключ)
    const youdaoResult = await searchYoudao(searchTerm)
    if (youdaoResult) {
      results.push(youdaoResult)
    }

    // Пробуем Google Translate
    const googleResult = await searchGoogleTranslate(searchTerm)
    if (googleResult && !results.some(r => r.simplified === googleResult.simplified)) {
      results.push(googleResult)
    }

    // Если ничего не найдено, ищем в локальных данных
    if (results.length === 0) {
      const localResults = searchLocalDictionaries(searchTerm)
      results = localResults.slice(0, 10) // Ограничиваем до 10 результатов
    }

    // Для найденных результатов добавляем пиньин, если его нет
    for (const result of results) {
      if (!result.pinyin && result.simplified) {
        result.pinyin = await getPinyin(result.simplified)
      }
    }

    // Remove duplicates based on simplified + pinyin
    const uniqueResults = []
    const seen = new Set()
    results.forEach((item) => {
      const key = `${item.simplified}-${item.pinyin}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueResults.push({
          ...item,
          id: `search-${uniqueResults.length}`,
          dictionary: item.source || 'Online Dictionary'
        })
      }
    })

    // Save to search history if user is logged in
    const userId = getUserIdFromRequest(req)
    if (userId) {
      await User.addSearchHistory(userId, searchTerm)
    }

    return res.status(200).json({
      results: uniqueResults,
      count: uniqueResults.length
    })
  } catch (error) {
    console.error('Search error:', error)

    // Fallback to local search if all external APIs fail
    try {
      const fallbackQ = req.query?.q || ''
      const searchTerm = fallbackQ.trim().toLowerCase()
      const localResults = searchLocalDictionaries(searchTerm)
      const uniqueResults = []
      const seen = new Set()
      localResults.forEach((item) => {
        const key = `${item.simplified}-${item.pinyin}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueResults.push(item)
        }
      })

      return res.status(200).json({
        results: uniqueResults.slice(0, 10),
        count: uniqueResults.length,
        fallback: true
      })
    } catch (fallbackError) {
      console.error('Fallback search error:', fallbackError)
      return res.status(500).json({ error: 'Search failed' })
    }
  }
}

