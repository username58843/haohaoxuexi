import clientPromise from '../db'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'

export class User {
  static async create({ email, password, name }) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    // Check if user exists
    const existingUser = await users.findOne({ email })
    if (existingUser) {
      throw new Error('User already exists')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = {
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      avatar: null,
      isPremium: false,
      premiumExpiresAt: null,
      isAdmin: email === 'payeer.tm@gmail.com', // Автоматически админ для этого email
      isBanned: false,
      banReason: null,
      lastSeen: new Date(),
      ipAddress: null, // Будет установлен при первом логине
      personalDictionaries: [], // Пользовательские словари
      selectedWords: [], // Выбранные слова для создания словаря
      searchHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await users.insertOne(user)
    return { ...user, _id: result.insertedId, password: undefined }
  }

  static async findByEmail(email) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')
    return users.findOne({ email })
  }

  static async findById(id) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    if (!id) return null

    try {
      const objectId =
        typeof id === 'string'
          ? new ObjectId(id)
          : id instanceof ObjectId
            ? id
            : new ObjectId(String(id))
      return users.findOne({ _id: objectId })
    } catch {
      // Invalid id format
      return null
    }
  }

  static async update(id, updates) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')
    updates.updatedAt = new Date()
    
    const objectId = typeof id === 'string' ? new ObjectId(id) : id
    return users.updateOne({ _id: objectId }, { $set: updates })
  }

  static async addSearchHistory(userId, searchTerm) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')
    
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId
    const user = await users.findOne({ _id: objectId })
    if (!user) return null

    const history = user.searchHistory || []
    const newEntry = {
      term: searchTerm,
      timestamp: new Date()
    }

    // Remove duplicates and keep last 100
    const filtered = history.filter(h => h.term !== searchTerm)
    filtered.unshift(newEntry)
    const limited = filtered.slice(0, 100)

    await users.updateOne(
      { _id: objectId },
      { $set: { searchHistory: limited, updatedAt: new Date() } }
    )

    return limited
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword)
  }

  static async getAllUsers() {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')
    const allUsers = await users.find({}).toArray()

    // Определяем онлайн пользователей (активных в последние 5 минут)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const onlineUsers = allUsers.filter(u => u.lastSeen && new Date(u.lastSeen) > fiveMinutesAgo)

    return allUsers.map(user => ({
      ...user,
      isOnline: onlineUsers.some(ou => ou._id.toString() === user._id.toString())
    }))
  }

  // Методы для управления пользовательскими словарями
  static async createPersonalDictionary(userId, name, words = []) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const dictionary = {
      id: `dict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      words: words,
      createdAt: new Date(),
      updatedAt: new Date(),
      order: 0
    }

    await users.updateOne(
      { _id: typeof userId === 'string' ? new ObjectId(userId) : userId },
      {
        $push: { personalDictionaries: dictionary },
        $set: { updatedAt: new Date() }
      }
    )

    return dictionary
  }

  static async updatePersonalDictionary(userId, dictionaryId, updates) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId

    // Находим пользователя и обновляем конкретный словарь
    const user = await users.findOne({ _id: objectId })
    if (!user) return null

    const dictionaries = user.personalDictionaries || []
    const dictIndex = dictionaries.findIndex(d => d.id === dictionaryId)
    if (dictIndex === -1) return null

    dictionaries[dictIndex] = {
      ...dictionaries[dictIndex],
      ...updates,
      updatedAt: new Date()
    }

    await users.updateOne(
      { _id: objectId },
      {
        $set: {
          personalDictionaries: dictionaries,
          updatedAt: new Date()
        }
      }
    )

    return dictionaries[dictIndex]
  }

  static async deletePersonalDictionary(userId, dictionaryId) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId

    await users.updateOne(
      { _id: objectId },
      {
        $pull: { personalDictionaries: { id: dictionaryId } },
        $set: { updatedAt: new Date() }
      }
    )

    return true
  }

  static async reorderPersonalDictionaries(userId, dictionaryOrder) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId

    // Обновляем порядок словарей
    const user = await users.findOne({ _id: objectId })
    if (!user) return null

    const dictionaries = user.personalDictionaries || []
    const reordered = dictionaryOrder.map((id, index) => {
      const dict = dictionaries.find(d => d.id === id)
      return dict ? { ...dict, order: index } : null
    }).filter(Boolean)

    await users.updateOne(
      { _id: objectId },
      {
        $set: {
          personalDictionaries: reordered,
          updatedAt: new Date()
        }
      }
    )

    return reordered
  }

  // Методы для управления выбранными словами
  static async addSelectedWord(userId, word) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId

    const user = await users.findOne({ _id: objectId })
    if (!user) {
      throw new Error('User not found')
    }

    const payload = {
      simplified: word.simplified,
      traditional: word.traditional || word.simplified,
      pinyin: word.pinyin || '',
      definitions: Array.isArray(word.definitions) ? word.definitions : [],
      selectedAt: new Date()
    }

    const existingWord = user.selectedWords?.find(w => w.simplified === payload.simplified)

    if (!existingWord) {
      await users.updateOne(
        { _id: objectId },
        {
          $push: { selectedWords: payload },
          $set: { updatedAt: new Date() }
        }
      )
      return { added: true }
    }

    return { added: false, alreadyExists: true }
  }

  static async removeSelectedWord(userId, wordSimplified) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId

    await users.updateOne(
      { _id: objectId },
      {
        $pull: { selectedWords: { simplified: wordSimplified } },
        $set: { updatedAt: new Date() }
      }
    )

    return true
  }

  static async clearSelectedWords(userId) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId

    await users.updateOne(
      { _id: objectId },
      {
        $set: { selectedWords: [], updatedAt: new Date() }
      }
    )

    return true
  }

  // Очистить все выбранные слова пользователя
  static async clearAllSelectedWords(userId) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId

    await users.updateOne(
      { _id: objectId },
      { $set: { selectedWords: [] } }
    )

    return true
  }

  static async createDictionaryFromSelectedWords(userId, dictionaryName) {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId
    const user = await users.findOne({ _id: objectId })

    if (!user || !user.selectedWords || user.selectedWords.length === 0) {
      return null
    }

    // Создаем новый словарь из выбранных слов
    const dictionary = await this.createPersonalDictionary(userId, dictionaryName, user.selectedWords)

    // Очищаем выбранные слова
    await this.clearSelectedWords(userId)

    return dictionary
  }
}

