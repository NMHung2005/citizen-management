import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { changeBookingStatus, bookingErrorStatus } from '@/lib/booking-status'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorization = await requireUser(request)
    if (authorization.error) return authorization.error
    return NextResponse.json(await changeBookingStatus(params.id, 'APPROVED', authorization.user))
  } catch (error) {
    const status = bookingErrorStatus(error)
    return NextResponse.json({ message: status === 500 ? 'Có lỗi xảy ra khi xác nhận thanh toán' : error instanceof Error ? error.message : 'Vui lòng thử lại' }, { status })
  }
}
