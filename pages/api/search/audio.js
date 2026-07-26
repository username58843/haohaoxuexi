import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { text, lang = 'zh-CN' } = req.query

    if (!text) {
      return res.status(400).json({ error: 'Text is required' })
    }

    console.log('Generating audio for:', text, 'lang:', lang)

    // Используем Google Translate TTS (бесплатный и качественный)
    try {
      const response = await fetch(
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Google TTS failed')
      }

      const audioBuffer = await response.arrayBuffer()

      // Возвращаем аудио данные
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Cache-Control', 'public, max-age=86400') // Кэшируем на 24 часа
      res.status(200).send(Buffer.from(audioBuffer))

    } catch (googleError) {
      console.log('Google TTS failed, trying alternative...')

      // Альтернатива: Baidu TTS (если Google не работает)
      try {
        const baiduResponse = await fetch(
          `https://tts.baidu.com/text2audio?lan=${lang}&ie=UTF-8&spd=5&text=${encodeURIComponent(text)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        )

        if (baiduResponse.ok) {
          const audioBuffer = await baiduResponse.arrayBuffer()
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Cache-Control', 'public, max-age=86400')
          res.status(200).send(Buffer.from(audioBuffer))
        } else {
          throw new Error('Baidu TTS also failed')
        }

      } catch (baiduError) {
        console.log('All TTS services failed')

        // Если все TTS сервисы недоступны, возвращаем ошибку
        return res.status(503).json({
          error: 'Audio generation temporarily unavailable',
          fallback: true
        })
      }
    }

  } catch (error) {
    console.error('Audio generation error:', error)
    return res.status(500).json({ error: 'Failed to generate audio' })
  }
}
