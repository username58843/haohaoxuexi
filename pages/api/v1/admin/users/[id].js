import { createApiHandler, errors, parseObjectId } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { str, optStr, oneOf, bool, objectBody, ValidationError } from '~/lib/server/validate'
import { adminUserView, deleteUserCompletely, writeAuditLog } from '~/lib/server/users'

async function findTarget(req) {
  const targetId = parseObjectId(req.query.id)
  const users = await getCollection('users')
  const target = await users.findOne({ _id: targetId })
  if (!target) throw errors.notFound('User not found')
  return { users, targetId, target }
}

async function assertNotLastAdmin(users) {
  const adminCount = await users.countDocuments({ role: 'admin' })
  if (adminCount <= 1) throw errors.forbidden('Cannot remove the last admin')
}

export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      const { target } = await findTarget(req)
      res.status(200).json({ user: adminUserView(target) })
    },
  },

  PUT: {
    admin: true,
    handler: async (req, res) => {
      const body = objectBody(req.body)

      // Whitelist + validate every field before touching the DB.
      const role =
        body.role === undefined ? undefined : oneOf(body.role, ['user', 'admin'], { field: 'role' })
      const isPremium =
        body.isPremium === undefined ? undefined : bool(body.isPremium, { field: 'isPremium' })
      const isBanned =
        body.isBanned === undefined ? undefined : bool(body.isBanned, { field: 'isBanned' })
      const banReason = optStr(body.banReason, { field: 'banReason', max: 300 })
      let premiumExpiresAt
      const hasPremiumExpiresAt = body.premiumExpiresAt !== undefined
      if (hasPremiumExpiresAt) {
        if (body.premiumExpiresAt === null) {
          premiumExpiresAt = null
        } else {
          const raw = str(body.premiumExpiresAt, { field: 'premiumExpiresAt', min: 1, max: 40 })
          const date = new Date(raw)
          if (Number.isNaN(date.getTime())) {
            throw new ValidationError('premiumExpiresAt must be a valid date', 'premiumExpiresAt')
          }
          premiumExpiresAt = date
        }
      }

      const { users, targetId, target } = await findTarget(req)
      const isSelf = target._id.equals(req.userId)

      if (isSelf && role !== undefined && role !== target.role) {
        throw errors.forbidden('Cannot change your own role')
      }
      if (isSelf && isBanned === true) {
        throw errors.forbidden('Cannot ban yourself')
      }
      if (role === 'user' && target.role === 'admin') {
        await assertNotLastAdmin(users)
      }

      const now = new Date()
      const set = { updatedAt: now }
      const changes = {}
      let inc = null

      if (role !== undefined) {
        set.role = role
        changes.role = role
      }
      if (isPremium !== undefined) {
        set.isPremium = isPremium
        changes.isPremium = isPremium
      }
      if (hasPremiumExpiresAt) {
        set.premiumExpiresAt = premiumExpiresAt
        changes.premiumExpiresAt = premiumExpiresAt
      }
      if (banReason !== undefined) {
        set.banReason = banReason.length > 0 ? banReason : null
        changes.banReason = set.banReason
      }
      if (isBanned === true) {
        set.isBanned = true
        set.bannedAt = now
        inc = { tokenVersion: 1 } // instant revocation of every issued JWT
        changes.isBanned = true
      } else if (isBanned === false) {
        set.isBanned = false
        set.banReason = null
        set.bannedAt = null
        changes.isBanned = false
        changes.banReason = null
      }

      if (Object.keys(changes).length === 0) {
        throw errors.badRequest('No valid fields to update')
      }

      const update = { $set: set }
      if (inc) update.$inc = inc
      const updated = await users.findOneAndUpdate({ _id: targetId }, update, {
        returnDocument: 'after',
      })
      if (!updated) throw errors.notFound('User not found')

      await writeAuditLog(req.userId, 'user.update', {
        targetUserId: targetId,
        detail: changes,
      })

      res.status(200).json({ user: adminUserView(updated) })
    },
  },

  DELETE: {
    admin: true,
    handler: async (req, res) => {
      const { users, targetId, target } = await findTarget(req)
      if (target._id.equals(req.userId)) {
        throw errors.forbidden('Cannot delete yourself')
      }
      if (target.role === 'admin') {
        await assertNotLastAdmin(users)
      }

      await deleteUserCompletely(targetId)
      // Record the action but no PII — the account (and its data) is now erased.
      await writeAuditLog(req.userId, 'user.delete', {
        targetUserId: targetId,
        detail: { deletedRole: target.role },
      })

      res.status(200).json({ ok: true })
    },
  },
})
