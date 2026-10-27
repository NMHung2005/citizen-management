import { hashPassword } from '../../lib/auth'
import { PrismaClient } from '@prisma/client'

export interface SeedUsersResult {
  admin: { id: string }
  user: { id: string }
}

export async function seedUsers(prisma: PrismaClient): Promise<SeedUsersResult> {
  console.log('👤 Đang tạo users...')

  // Tạo admin user (plain text password)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: await hashPassword('admin123'),
      name: 'Quản trị viên',
      role: 'ADMIN'
    }
  })

  // Tạo user thường -> Chuyển thành Cán bộ
  const user = await prisma.user.create({
    data: {
      email: 'user@example.com',
      password: await hashPassword('user123'),
      name: 'Cán bộ',
      role: 'DEPUTY'
    }
  })

  // Tạo Tổ trưởng
  await prisma.user.create({
    data: {
      email: 'totruong@gmail.com',
      password: await hashPassword('123456'),
      name: 'Nguyễn Văn Tổ Trưởng',
      role: 'TEAM_LEADER'
    }
  })

  // Tạo Tổ phó
  await prisma.user.create({
    data: {
      email: 'topho@gmail.com',
      password: await hashPassword('123456'),
      name: 'Trần Thị Tổ Phó',
      role: 'DEPUTY'
    }
  })

  // Cán bộ quản lý CSVC
  await prisma.user.create({
    data: {
      email: 'quanlycsvc@gmail.com',
      password: await hashPassword('123456'),
      name: 'Lê Văn Quản Lý',
      role: 'FACILITY_MANAGER'
    }
  })

  return { admin, user }
}

