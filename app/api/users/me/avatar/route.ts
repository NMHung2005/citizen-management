import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireUser(request)
    if (authorization.error) return authorization.error
    const form = await request.formData()
    const file = form.get('avatar')
    if (!file || typeof file === 'string') return NextResponse.json({ message: 'Vui lòng chọn ảnh' }, { status: 400 })
    if (file.size === 0 || file.size > 5 * 1024 * 1024) return NextResponse.json({ message: 'Ảnh phải có kích thước từ 1 byte đến 5 MB' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const signatures: Record<string, { extension: string; valid: boolean }> = {
      'image/png': { extension: 'png', valid: bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
      'image/jpeg': { extension: 'jpg', valid: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
      'image/gif': { extension: 'gif', valid: /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii')) },
      'image/webp': { extension: 'webp', valid: bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' }
    }
    const image = signatures[file.type]
    if (!image?.valid) return NextResponse.json({ message: 'Chỉ hỗ trợ ảnh PNG, JPEG, GIF hoặc WebP hợp lệ' }, { status: 400 })
    const directory = join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(directory, { recursive: true })
    const filename = `${authorization.user.id}-${randomUUID()}.${image.extension}`
    const target = join(directory, filename)
    await writeFile(target, bytes)
    const avatarUrl = `/uploads/avatars/${filename}`
    try {
      await prisma.user.update({ where: { id: authorization.user.id }, data: { avatarUrl } })
    } catch (error) {
      await unlink(target).catch(() => {})
      throw error
    }
    return NextResponse.json({ message: 'Đã cập nhật ảnh đại diện', avatarUrl })
  } catch (error) {
    console.error('Upload avatar error:', error)
    return NextResponse.json({ message: 'Không thể lưu ảnh đại diện' }, { status: 500 })
  }
}
