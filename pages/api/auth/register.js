import { User } from '~/lib/models/User'
import { generateToken, buildAuthCookie } from '~/lib/auth'
import clientPromise from '~/lib/db'
import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password, name } = req.body

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Check if email already exists
    const existingEmail = await User.findByEmail(email)
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // Check if name already exists
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')
    const existingName = await users.findOne({ name: name.trim() })
    if (existingName) {
      return res.status(400).json({ error: 'Name already taken' })
    }

    // Create user
    const user = await User.create({ email, password, name })

    const token = generateToken(user._id.toString())
    res.setHeader('Set-Cookie', buildAuthCookie(token))

    return res.status(201).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isPremium: user.isPremium,
        isAdmin: user.isAdmin
      },
      token
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(400).json({ error: error.message || 'Registration failed' })
  }
}

