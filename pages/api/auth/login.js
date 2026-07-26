import { User } from '~/lib/models/User'
import { generateToken, buildAuthCookie } from '~/lib/auth'
import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user
    const user = await User.findByEmail(email)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Verify password
    const isValid = await User.verifyPassword(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check if user is banned
    if (user.isBanned) {
      const reason = user.banReason || 'No reason provided'
      return res.status(403).json({
        error: `Your account has been banned. Reason: ${reason}`,
        banned: true,
        banReason: reason
      })
    }

    // Update last seen and IP address
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'
    await User.update(user._id, {
      lastSeen: new Date(),
      ipAddress: ipAddress.split(',')[0].trim() // Берем первый IP из списка
    })

    // Generate token (always string userId)
    const token = generateToken(user._id.toString())
    res.setHeader('Set-Cookie', buildAuthCookie(token))

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Login failed' })
  }
}

