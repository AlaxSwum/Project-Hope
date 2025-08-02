# Hope Pharmacy Internal Management System (IMS)

A modern, secure pharmacy management system built with **Next.js + Supabase** for complete full-stack functionality.

## 🏗️ Modern Architecture

- **Frontend & Backend**: Next.js with TypeScript (full-stack)
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **Authentication**: Supabase Auth with role-based access control
- **Security**: Row Level Security (RLS), audit logging, HIPAA-compliant
- **Deployment**: Vercel (frontend) + Supabase (backend)

## ⚡ Why Next.js + Supabase?

- **🚀 Rapid Development**: Full-stack in one framework
- **🔐 Built-in Security**: RLS policies, authentication, authorization
- **📊 Real-time**: Live updates across all connected clients
- **💰 Cost-effective**: Scales from $0 to enterprise
- **🛠️ Developer Experience**: TypeScript, hot reload, modern tooling

## 🔐 Security Features

- **HIPAA Compliance**: Encrypted data, comprehensive audit logging
- **Authentication**: Email/password with social login options
- **Authorization**: Role-based permissions (staff, pharmacist, c-level, administrator)
- **Audit Trails**: Complete tracking of all user actions
- **Row Level Security**: Database-level access control

## 👥 User Roles

- **🏥 Administrator**: Full system access, user management
- **💊 Pharmacist**: Patient records, prescriptions, inventory
- **📈 C-Level**: Analytics, reports, system overview
- **👨‍💼 Staff**: Basic patient lookup, prescription processing

## 📋 Prerequisites

- Node.js 18+
- Git
- Supabase account (free tier available)

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone <repository-url>
cd "Hope IMS/frontend"
npm install
```

### 2. Supabase Setup

1. **Create Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Copy your project URL and anon key

2. **Environment Configuration**:
```bash
# Create .env.local file
cp env.example .env.local

# Add your Supabase credentials:
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. **Database Setup**:
```bash
# In Supabase Dashboard → SQL Editor
# Copy and run: frontend/database-setup.sql
```

4. **Create Admin User**:
```bash
node scripts/fix-admin.js
```

### 3. Start Development

```bash
npm run dev
```

🌐 Open [http://localhost:3000](http://localhost:3000)

## 🔑 Default Admin Credentials

```
Email: soneswumpyae@gmail.com
Password: 1231312
```

## 🗂️ Project Structure

```
Hope IMS/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── pages/           # Next.js pages
│   │   ├── lib/             # Supabase client & utilities
│   │   └── styles/          # Tailwind CSS
│   ├── scripts/             # Database setup scripts
│   ├── database-setup.sql   # Complete database schema
│   └── package.json
└── README.md
```

## 🎯 Core Features

### ✅ Currently Implemented
- **User Management**: Admin dashboard for creating/managing users
- **Authentication**: Secure login with role-based access
- **Dashboard**: Role-specific dashboards and navigation
- **Database**: Complete pharmaceutical management schema

### 🚧 Coming Soon
- **Patient Management**: Complete patient records and profiles
- **Prescription Processing**: Prescription workflow and management
- **Inventory Management**: Real-time stock tracking and alerts
- **Reporting**: Analytics and compliance reports

## 🛠️ Development

### Key Technologies
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Supabase**: Backend-as-a-Service
- **PostgreSQL**: Relational database with RLS

### Database Schema
```sql
-- Core tables
├── users          # Staff and user management
├── patients       # Patient records and profiles
├── medications    # Drug catalog and information
├── inventory      # Stock levels and tracking
├── prescriptions  # Prescription management
├── audit_logs     # Activity tracking
└── system_settings # Configuration
```

### Adding New Features

1. **Database Changes**:
```sql
-- Add to database-setup.sql
-- Run in Supabase SQL Editor
```

2. **Frontend Components**:
```typescript
// Add to src/pages/ or src/components/
import { supabase } from '../lib/supabase'
```

3. **API Integration**:
```typescript
// Use Supabase client for all data operations
const { data, error } = await supabase
  .from('table_name')
  .select('*')
```

## 📊 Database Schema

The system includes comprehensive tables for pharmaceutical management:

- **Users**: Staff authentication and role management
- **Patients**: Complete patient profiles with medical history
- **Medications**: Drug catalog with NDC numbers and classifications
- **Inventory**: Real-time stock tracking with expiration dates
- **Prescriptions**: Full prescription lifecycle management
- **Audit Logs**: HIPAA-compliant activity tracking

## 🔒 Security Implementation

### Row Level Security (RLS)
```sql
-- Example policy
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'administrator'
    )
  );
```

### Authentication Flow
1. User login through Supabase Auth
2. User profile synced with database
3. Role-based dashboard redirect
4. RLS policies enforce data access

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📈 Scaling Considerations

- **Supabase**: Scales automatically with usage
- **Vercel**: Edge deployment for global performance
- **Database**: PostgreSQL with built-in optimization
- **Real-time**: Websocket connections for live updates

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the code comments and this README
- **Issues**: Create GitHub issues for bugs or feature requests
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

---

**🎯 Built with Next.js + Supabase for modern, scalable pharmacy management** 