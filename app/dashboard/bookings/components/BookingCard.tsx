'use client'

import { Calendar, Building, Clock, User, Edit, Trash2, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react'
import { Booking } from '../types'
import { formatDateTime } from '../utils/dateUtils'
import { useUser } from '../../components/useLayoutUser'
import toast from 'react-hot-toast'

interface BookingCardProps {
  booking: Booking
  onEdit: (booking: Booking) => void
  onDelete: (id: string) => void
  fetchBookings: () => void
}

export default function BookingCard({ booking, onEdit, onDelete, fetchBookings }: BookingCardProps) {
  const { user } = useUser()
  const startDateTime = formatDateTime(booking.startTime)
  const endDateTime = formatDateTime(booking.endTime)
  const createdDateTime = formatDateTime(booking.createdAt)

  const isLeader = user?.role === 'TEAM_LEADER' || user?.role === 'ADMIN' || user?.role === 'LEADER' || user?.role === 'DEPUTY'
  const isOwner = user?.id === booking.user.id

  const handleStatusUpdate = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      const response = await fetch(`/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        toast.success(status === 'APPROVED' ? 'Đã duyệt lịch đặt' : 'Đã từ chối lịch đặt')
        fetchBookings()
      } else {
        const data = await response.json()
        toast.error(data.message || 'Có lỗi xảy ra')
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5" />
            ĐANG CHỜ DUYỆT
          </span>
        )
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
            <CheckCircle className="h-3.5 w-3.5" />
            ĐÃ DUYỆT
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
            <XCircle className="h-3.5 w-3.5" />
            ĐÃ TỪ CHỐI
          </span>
        )
      case 'PENDING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <DollarSign className="h-3.5 w-3.5" />
            CHỜ THANH TOÁN
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="group relative bg-white rounded-[15px] shadow-drop hover:shadow-drop-lg transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border border-gray-100">

      {/* Decorative gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-1/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="p-4 rounded-[12px] bg-gradient-to-br from-navy-1 to-navy-2 shadow-drop group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-navy-1 transition-colors">
                  {booking.title}
                </h3>
                {getStatusBadge(booking.status)}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Building className="h-4 w-4 text-navy-1" />
                <span className="text-sm font-medium text-gray-700">
                  {booking.culturalCenter.name}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(isOwner || isLeader) && booking.status === 'PENDING' && (
              <button
                onClick={() => onEdit(booking)}
                className="p-2 text-gray-400 hover:text-navy-1 hover:bg-navy-1/5 rounded-full transition-colors"
                title="Chỉnh sửa"
              >
                <Edit className="h-5 w-5" />
              </button>
            )}
            {(isOwner || isLeader) && (
              <button
                onClick={() => onDelete(booking.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Xóa"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {booking.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-4 ml-[76px]">
            {booking.description}
          </p>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Event time (start / end) */}
          <div className="p-3 bg-yellow-2 rounded-[8px] border border-yellow-1">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-navy-1 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-gray-900 mb-1">
                  Bắt đầu: <span className="font-semibold">{startDateTime.date} {startDateTime.time}</span>
                </div>
                <div className="text-sm text-gray-900">
                  Kết thúc: <span className="font-semibold">{endDateTime.date} {endDateTime.time}</span>
                </div>
              </div>
            </div>
          </div>

          {/* User & Fee */}
          <div className="p-3 bg-gray-50 rounded-[8px] border border-gray-200">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-navy-1 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">
                    {booking.bookerName ? booking.bookerName : booking.user.name}
                  </div>
                  {booking.bookerPhone && (
                    <div className="text-xs text-gray-500">{booking.bookerPhone}</div>
                  )}
                </div>
              </div>
              {booking.fee != null && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-bold text-green-600">
                    Phí dự kiến: {booking.fee.toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons for Leaders */}
        {isLeader && booking.status === 'PENDING' && (
          <div className="flex gap-3 mt-4 mb-4">
            <button
              onClick={() => handleStatusUpdate('APPROVED')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-[8px] text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
            >
              <CheckCircle className="h-4 w-4" />
              DUYỆT LỊCH
            </button>
            <button
              onClick={() => handleStatusUpdate('REJECTED')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-[8px] text-sm font-bold hover:bg-red-50 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              TỪ CHỐI
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Thời điểm đặt: {createdDateTime.full}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

