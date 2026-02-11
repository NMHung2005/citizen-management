# Citizen & Cultural Center Management System

A modern system for managing demographic information and cultural center facilities, built with Next.js 14, TypeScript, Prisma, and Tailwind CSS.

## 🚀 Key Features

### 👨‍💼 Admin
- **Demographics:** Manage households, residents, and district classifications.
- **Facilities:** Manage 3 cultural center buildings including mapping.
- **Approvals:** Review and approve user requests and facility bookings.
- **Dashboard:** Comprehensive statistics and overview.

### 👤 User
- **Personal Info:** View own household details.
- **Requests:** Submit requests for information updates or resident changes.
- **Bookings:** Book cultural centers (public/private modes) and check availability.

## 🛠️ Tech Stack

- **Framework:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS, Headless UI
- **Database:** SQLite with Prisma ORM
- **Auth:** JWT
- **UI Components:** Lucide React, React Hot Toast

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/natsusuke0215/Citizen-Management.git
   cd Citizen-Management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup Database**
   ```bash
   npx prisma db push
   ```

4. **Environment Setup**
   Create a `.env` file:
   ```env
   JWT_SECRET=your-secret-key-here
   DATABASE_URL="file:./prisma/dev.db"
   ```

5. **Seed Data**
   ```bash
   npm run db:seed
   ```
   *Note: If updating from hashed passwords, run `npx tsx scripts/update-passwords-to-plaintext.ts`*

6. **Run Application**
   ```bash
   npm run dev
   ```
   Access at `http://localhost:3000`

## 🗄️ Core Database Entities
- **User:** System users (Admin/User)
- **District/Household/Person:** Demographic hierarchy
- **CulturalCenter/Booking:** Facility management
- **Request/Notification:** User interactions

## 📄 License
MIT License