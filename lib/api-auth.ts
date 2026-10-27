import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, type UserPayload } from './auth'
import { prisma } from './prisma'

export const RESIDENT_ROLES = ['ADMIN', 'TEAM_LEADER', 'LEADER', 'DEPUTY'] as const
export const FACILITY_ROLES = [...RESIDENT_ROLES, 'FACILITY_MANAGER', 'CALENDAR_MANAGER'] as const

type Authorization = { user: UserPayload; error: null } | { user: null; error: NextResponse }

export async function requireUser(request: NextRequest, roles?: readonly string[]): Promise<Authorization> {
  const token = request.cookies.get('auth-token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return { user: null, error: NextResponse.json({ message: 'Vui lòng đăng nhập' }, { status: 401 }) }
  // Use the current database role so deleted accounts and old role tokens do not grant access.
  const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, name: true, email: true, role: true } })
  if (!user) return { user: null, error: NextResponse.json({ message: 'Tài khoản không tồn tại' }, { status: 401 }) }
  if (roles && !roles.includes(user.role)) return { user: null, error: NextResponse.json({ message: 'Không có quyền thực hiện thao tác này' }, { status: 403 }) }
  return { user, error: null }
}
