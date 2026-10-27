import { NextRequest, NextResponse } from 'next/server'
import { requireUser, RESIDENT_ROLES } from '@/lib/api-auth'
import { changeBookingStatus, bookingErrorStatus } from '@/lib/booking-status'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorization = await requireUser(request, RESIDENT_ROLES)
    if (authorization.error) return authorization.error
    const { status } = await request.json()
    if (status !== 'APPROVED' && status !== 'REJECTED') return NextResponse.json({ message: 'Trạng thái không hợp lệ' }, { status: 400 })
    return NextResponse.json(await changeBookingStatus(params.id, status))
  } catch (error) {
    const status = bookingErrorStatus(error)
    return NextResponse.json({ message: status === 500 ? 'Có lỗi xảy ra khi cập nhật lịch đặt' : error instanceof Error ? error.message : 'Vui lòng thử lại' }, { status })
  }
}
