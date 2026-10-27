import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import type { UserPayload } from './auth'

export class BookingError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function lockCenter(tx: Prisma.TransactionClient, centerId: string) {
  // Acquire SQLite's write lock before reading the availability snapshot.
  await tx.$executeRaw`UPDATE cultural_centers SET updatedAt = updatedAt WHERE id = ${centerId}`
}

export async function assertAvailable(tx: Prisma.TransactionClient, centerId: string, start: Date, end: Date, excludeId?: string) {
  const conflict = await tx.culturalCenterBooking.findFirst({ where: {
    culturalCenterId: centerId, status: 'APPROVED',
    ...(excludeId ? { id: { not: excludeId } } : {}),
    startTime: { lt: end }, endTime: { gt: start }
  } })
  if (conflict) throw new BookingError('Thời gian này đã có lịch được duyệt. Vui lòng chọn thời gian khác.', 409)
}

export const bookingInclude = {
  culturalCenter: { select: { id: true, name: true, building: true, floor: true, room: true, capacity: true } },
  user: { select: { id: true, name: true } }
} as const

export async function changeBookingStatus(id: string, status: 'APPROVED' | 'REJECTED', paymentUser?: UserPayload) {
  return prisma.$transaction(async tx => {
    // A write statement serializes approvals against other booking writes.
    await tx.$executeRaw`UPDATE cultural_centers SET updatedAt = updatedAt WHERE id = (SELECT culturalCenterId FROM cultural_center_bookings WHERE id = ${id})`
    const booking = await tx.culturalCenterBooking.findUnique({ where: { id } })
    if (!booking) throw new BookingError('Không tìm thấy lịch đặt', 404)
    if (paymentUser) {
      if (booking.userId !== paymentUser.id && paymentUser.role !== 'ADMIN') throw new BookingError('Không có quyền truy cập', 403)
      if (booking.status !== 'PENDING_PAYMENT') throw new BookingError('Lịch đặt không ở trạng thái chờ thanh toán', 400)
    }
    if (status === 'APPROVED') await assertAvailable(tx, booking.culturalCenterId, booking.startTime, booking.endTime, id)
    const updated = await tx.culturalCenterBooking.update({
      where: { id }, data: { status, ...(paymentUser ? { feePaid: true } : {}) }, include: bookingInclude
    })
    if (paymentUser && booking.fee && booking.fee > 0) {
      await tx.culturalCenterUsageFee.upsert({
        where: { bookingId: id },
        create: { bookingId: id, amount: booking.fee, paymentDate: new Date(), paymentMethod: 'BANK_TRANSFER', notes: 'Xác nhận thanh toán' },
        update: { amount: booking.fee, paymentDate: new Date(), paymentMethod: 'BANK_TRANSFER' }
      })
    }
    if (!paymentUser) await tx.notification.create({ data: {
      title: status === 'APPROVED' ? 'Lịch đặt đã được duyệt' : 'Lịch đặt bị từ chối',
      message: `Lịch đặt "${booking.title}" ${status === 'APPROVED' ? 'đã được duyệt.' : 'đã bị từ chối.'}`,
      userId: booking.userId
    } })
    return updated
  }, { maxWait: 10000, timeout: 15000 })
}

export function bookingErrorStatus(error: unknown): number {
  if (error instanceof BookingError) return error.status
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P1008', 'P2028'].includes(error.code)) return 409
  return 500
}
