import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const authorization = await requireUser(request, ['ADMIN'])
  if (authorization.error) return authorization.error
  return NextResponse.json({
    message: 'Mật khẩu được bảo vệ và không thể xem lại. Vui lòng dùng chức năng đổi mật khẩu.'
  }, { status: 410 })
}
