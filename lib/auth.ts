import jwt from 'jsonwebtoken'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { getJwtSecret } from './jwt-secret'

export interface UserPayload {
  id: string
  email: string
  name: string
  role: string
}

export function isPasswordHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, storedPassword: string): Promise<boolean> {
  if (typeof password !== 'string' || typeof storedPassword !== 'string') return false
  // Legacy plaintext is accepted only to support migration on successful login.
  return isPasswordHash(storedPassword)
    ? bcrypt.compare(password, storedPassword)
    : password === storedPassword
}

export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d', algorithm: 'HS256' })
}

export function verifyToken(token: string): UserPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] })
    if (typeof payload === 'string' || typeof payload.id !== 'string' ||
        typeof payload.email !== 'string' || typeof payload.name !== 'string' ||
        typeof payload.role !== 'string') return null
    return payload as UserPayload
  } catch {
    return null
  }
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user || !await verifyPassword(password, user.password)) {
    return null
  }

  if (!isPasswordHash(user.password)) {
    const upgraded = await prisma.user.updateMany({
      where: { id: user.id, password: user.password },
      data: { password: await hashPassword(password) }
    })
    // A reset during hashing takes precedence over this older login attempt.
    if (upgraded.count === 0) return null
  }

  const { password: _, ...userWithoutPassword } = user
  return userWithoutPassword
}

export async function createUser(email: string, password: string, name: string, role: string = 'USER') {
  return prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      name,
      role
    }
  })
}
