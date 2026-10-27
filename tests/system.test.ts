import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'test-only-secret-at-least-thirty-two-characters'
const testRoot = path.resolve('.cache/tests')
mkdirSync(testRoot, { recursive: true })
const fixture = mkdtempSync(path.join(testRoot, 'system-'))
const db = new PrismaClient({ datasources: { db: { url: `file:${path.join(fixture, 'test.db').replace(/\\/g, '/')}` } } })
let auth: typeof import('../lib/auth')
let admin: { id: string; email: string; name: string; role: string }
let staff: typeof admin
let centerId: string
const uploadedFiles: string[] = []

function request(url: string, method = 'GET', body?: unknown, user: typeof admin | null = admin) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { ...(user ? { cookie: `auth-token=${auth.generateToken(user)}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
}

before(async () => {
  const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
  for (const statement of sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement)
  ;(globalThis as typeof globalThis & { prisma: PrismaClient }).prisma = db
  auth = require('../lib/auth')
  admin = await db.user.create({ data: { name: 'Test Admin', email: 'admin@example.test', role: 'ADMIN', password: await bcrypt.hash('admin-password', 4) } })
  staff = await db.user.create({ data: { name: 'Test Staff', email: 'staff@example.test', role: 'FACILITY_MANAGER', password: await bcrypt.hash('staff-password', 4) } })
  centerId = (await db.culturalCenter.create({ data: { name: 'Test Hall', building: 'A', capacity: 50, location: 'Test' } })).id
})

after(async () => {
  await db.$disconnect()
  const uploadRoot = path.resolve('public/uploads/avatars') + path.sep
  for (const file of uploadedFiles) {
    assert.ok(file.startsWith(uploadRoot))
    if (existsSync(file)) unlinkSync(file)
  }
  assert.ok(fixture.startsWith(testRoot + path.sep))
  rmSync(fixture, { recursive: true, force: true })
})

test('new account passwords are hashed and support correct/incorrect verification', async () => {
  const user = await auth.createUser('created@example.test', 'created-password', 'Created', 'DEPUTY')
  assert.notEqual(user.password, 'created-password')
  assert.ok(await bcrypt.compare('created-password', user.password))
  assert.equal(await auth.verifyPassword('wrong', user.password), false)
  assert.equal(await auth.verifyPassword('created-password', user.password), true)
})

test('legacy plaintext login upgrades the stored password without changing it', async () => {
  const user = await db.user.create({ data: { email: 'legacy@example.test', name: 'Legacy', password: 'legacy-password' } })
  assert.equal(await auth.authenticateUser(user.email, 'wrong'), null)
  assert.equal((await auth.authenticateUser(user.email, 'legacy-password'))?.id, user.id)
  const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } })
  assert.notEqual(stored.password, 'legacy-password')
  assert.ok(await bcrypt.compare('legacy-password', stored.password))
})

test('legacy login migration cannot overwrite a concurrent password reset', async () => {
  const user = await db.user.create({ data: { email: 'race@example.test', name: 'Race', password: 'old-password' } })
  const login = auth.authenticateUser(user.email, 'old-password')
  await new Promise(resolve => setTimeout(resolve, 50))
  const replacement = await bcrypt.hash('reset-password', 4)
  await db.user.update({ where: { id: user.id }, data: { password: replacement } })
  await login
  const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } })
  assert.ok(await bcrypt.compare('reset-password', stored.password))
  assert.equal(await auth.verifyPassword('old-password', stored.password), false)
})

test('JWT generation rejects an absent/default secret', () => {
  const secret = process.env.JWT_SECRET
  try {
    delete process.env.JWT_SECRET
    assert.throws(() => auth.generateToken(admin))
    process.env.JWT_SECRET = 'your-secret-key'
    assert.throws(() => auth.generateToken(admin))
  } finally { process.env.JWT_SECRET = secret }
})

test('middleware rejects a forged token rather than just decoding its role', async () => {
  const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken')
  const { middleware } = require('../middleware') as typeof import('../middleware')
  const token = jwt.sign(admin, 'attacker-secret')
  const response = await middleware(new NextRequest('http://localhost/dashboard/accounts', { headers: { cookie: `auth-token=${token}` } }))
  assert.equal(response.status, 307)
  assert.equal(new URL(response.headers.get('location')!).pathname, '/login')
})

test('district duplicate checks handle Vietnamese case and update exclusions', async () => {
  const routes = require('../app/api/districts/route') as typeof import('../app/api/districts/route')
  const item = require('../app/api/districts/[id]/route') as typeof import('../app/api/districts/[id]/route')
  const district = await db.district.create({ data: { name: 'Khu PHỐ Á' } })
  assert.equal((await routes.POST(request('/api/districts', 'POST', { name: 'khu phố á' }))).status, 400)
  assert.equal((await item.PUT(request('/api/districts/id', 'PUT', { name: 'khu phố á' }), { params: { id: district.id } })).status, 200)
})

test('personal export works with the current account schema and excludes secrets', async () => {
  const route = require('../app/api/users/me/export/route') as typeof import('../app/api/users/me/export/route')
  const response = await route.GET(request('/api/users/me/export'))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal('password' in data, false)
  assert.equal('household' in data, false)
})

test('self-service password change verifies bcrypt and stores another hash', async () => {
  const route = require('../app/api/users/me/password/route') as typeof import('../app/api/users/me/password/route')
  const response = await route.PATCH(request('/api/users/me/password', 'PATCH', { currentPassword: 'staff-password', newPassword: 'new-staff-password' }, staff))
  assert.equal(response.status, 200)
  const stored = await db.user.findUniqueOrThrow({ where: { id: staff.id } })
  assert.ok(await bcrypt.compare('new-staff-password', stored.password))
})

test('password reveal never returns the stored secret', async () => {
  const route = require('../app/api/admin/verify-and-reveal/route') as typeof import('../app/api/admin/verify-and-reveal/route')
  const response = await route.POST(request('/api/admin/verify-and-reveal', 'POST', { adminId: admin.id, adminPassword: 'admin-password', targetUserId: staff.id }))
  assert.equal(response.status, 410)
  assert.equal('password' in await response.json(), false)
})

const previouslyUnguarded = [
  'districts', 'districts/[id]', 'temporary-residences', 'temporary-absences',
  'temporary-residences/[id]/pdf', 'temporary-absences/[id]/pdf',
  'pdf/generate', 'persons/[id]/changes', 'households/history',
  'households/[id]/history', 'households/[id]/split', 'households/[id]/transfer',
  'dashboard/detailed-stats', 'cultural-centers', 'cultural-centers/[id]',
  'cultural-centers/[id]/activities', 'cultural-centers/[id]/assets',
  'cultural-centers/[id]/assets/[assetId]', 'events'
]

for (const endpoint of previouslyUnguarded) {
  test(`${endpoint} rejects unauthenticated API access before reading or writing data`, async () => {
    const routes = require(`../app/api/${endpoint}/route`) as Record<string, (req: NextRequest, context: { params: { id: string; assetId: string } }) => Promise<Response>>
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      if (!routes[method]) continue
      const response = await routes[method](request(`/api/${endpoint}`, method, method === 'GET' ? undefined : {}, null), { params: { id: 'missing', assetId: 'missing' } })
      assert.equal(response.status, 401, `${method} ${endpoint}`)
    }
  })
}

test('facility staff cannot modify district administration', async () => {
  const route = require('../app/api/districts/route') as typeof import('../app/api/districts/route')
  const response = await route.POST(request('/api/districts', 'POST', { name: 'Forbidden' }, staff))
  assert.equal(response.status, 403)
  assert.equal(await db.district.count({ where: { name: 'Forbidden' } }), 0)
})

async function booking(start: string, end: string, status = 'PENDING') {
  return db.culturalCenterBooking.create({ data: { title: 'Test Booking', culturalCenterId: centerId, userId: staff.id, startTime: new Date(start), endTime: new Date(end), status } })
}

test('approval rejects an overlapping pending booking without changing its status', async () => {
  const route = require('../app/api/bookings/[id]/status/route') as typeof import('../app/api/bookings/[id]/status/route')
  await booking('2099-01-01T08:00:00Z', '2099-01-01T10:00:00Z', 'APPROVED')
  const pending = await booking('2099-01-01T09:00:00Z', '2099-01-01T11:00:00Z')
  const response = await route.PATCH(request('/api/bookings/id/status', 'PATCH', { status: 'APPROVED' }), { params: { id: pending.id } })
  assert.equal(response.status, 409)
  assert.equal((await db.culturalCenterBooking.findUniqueOrThrow({ where: { id: pending.id } })).status, 'PENDING')
})

test('an adjacent time slot can be approved', async () => {
  const route = require('../app/api/bookings/[id]/status/route') as typeof import('../app/api/bookings/[id]/status/route')
  const pending = await booking('2099-01-01T10:00:00Z', '2099-01-01T12:00:00Z')
  const response = await route.PATCH(request('/api/bookings/id/status', 'PATCH', { status: 'APPROVED' }), { params: { id: pending.id } })
  assert.equal(response.status, 200)
})

test('payment confirmation cannot approve an overlapping booking or create a fee', async () => {
  const route = require('../app/api/bookings/[id]/confirm-payment/route') as typeof import('../app/api/bookings/[id]/confirm-payment/route')
  const pending = await booking('2099-01-01T08:30:00Z', '2099-01-01T09:30:00Z', 'PENDING_PAYMENT')
  const response = await route.POST(request('/api/bookings/id/confirm-payment', 'POST', {}, staff), { params: { id: pending.id } })
  assert.equal(response.status, 409)
  assert.equal((await db.culturalCenterBooking.findUniqueOrThrow({ where: { id: pending.id } })).feePaid, false)
  assert.equal(await db.culturalCenterUsageFee.count({ where: { bookingId: pending.id } }), 0)
})

test('avatar upload rejects SVG content rather than publishing an active document', async () => {
  const route = require('../app/api/users/me/avatar/route') as typeof import('../app/api/users/me/avatar/route')
  const form = new FormData()
  form.set('avatar', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' }), 'avatar.svg')
  const response = await route.POST(new NextRequest('http://localhost/api/users/me/avatar', {
    method: 'POST', headers: { cookie: `auth-token=${auth.generateToken(admin)}` }, body: form
  }))
  const body = await response.json()
  if (body.avatarUrl) uploadedFiles.push(path.resolve('public', body.avatarUrl.slice(1)))
  assert.equal(response.status, 400)
})

test('a raster avatar is saved in the profile and survives another profile read', async () => {
  const route = require('../app/api/users/me/avatar/route') as typeof import('../app/api/users/me/avatar/route')
  const profile = require('../app/api/users/me/route') as typeof import('../app/api/users/me/route')
  const form = new FormData()
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDAAAAAAASUVORK5CYII=', 'base64')
  form.set('avatar', new Blob([png], { type: 'image/png' }), 'avatar.png')
  const response = await route.POST(new NextRequest('http://localhost/api/users/me/avatar', {
    method: 'POST', headers: { cookie: `auth-token=${auth.generateToken(admin)}` }, body: form
  }))
  assert.equal(response.status, 200)
  const body = await response.json()
  uploadedFiles.push(path.resolve('public', body.avatarUrl.slice(1)))
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).avatarUrl, body.avatarUrl)
  const fresh = await profile.GET(request('/api/users/me'))
  assert.equal(fresh.status, 200)
  assert.equal((await fresh.json()).avatarUrl, body.avatarUrl)
  const updated = await profile.PUT(request('/api/users/me', 'PUT', { name: admin.name, email: admin.email }))
  assert.equal(updated.status, 200)
  assert.equal((await updated.json()).user.avatarUrl, body.avatarUrl)
})

test('simultaneous approvals cannot both reserve the same time slot', async () => {
  const route = require('../app/api/bookings/[id]/status/route') as typeof import('../app/api/bookings/[id]/status/route')
  const first = await booking('2099-02-01T08:00:00Z', '2099-02-01T10:00:00Z')
  const second = await booking('2099-02-01T09:00:00Z', '2099-02-01T11:00:00Z')
  const results = await Promise.all([first, second].map(b => route.PATCH(request('/api/bookings/id/status', 'PATCH', { status: 'APPROVED' }), { params: { id: b.id } })))
  assert.equal(results.filter(r => r.status === 200).length, 1)
  assert.equal(results.filter(r => r.status === 409).length, 1)
  assert.equal(await db.culturalCenterBooking.count({ where: { id: { in: [first.id, second.id] }, status: 'APPROVED' } }), 1)
})
