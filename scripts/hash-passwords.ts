import { PrismaClient } from '@prisma/client'
import { hashPassword, isPasswordHash } from '../lib/auth'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, password: true } })
  let updated = 0
  for (const user of users) {
    if (isPasswordHash(user.password)) continue
    const result = await prisma.user.updateMany({ where: { id: user.id, password: user.password }, data: { password: await hashPassword(user.password) } })
    updated += result.count
  }
  console.log(`Đã bảo vệ mật khẩu cho ${updated} tài khoản. Mật khẩu đăng nhập không thay đổi.`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
