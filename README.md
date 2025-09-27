# Audit Management System

A comprehensive audit management platform built with Next.js, TypeScript, and Supabase for tracking and managing audit tickets, findings, and compliance activities.

## Features

### 📋 Ticket Management
- Create, view, update, and delete audit tickets
- Track ticket status (open, in progress, resolved, closed)
- Priority management (low, medium, high, critical)
- Department assignment and filtering
- Due date tracking with overdue alerts

### 📊 Dashboard & Analytics
- Real-time metrics and KPI tracking
- Interactive charts for status and priority distribution
- Department breakdown visualization
- Completion rate monitoring
- Recent activity tracking

### 📁 CSV Import/Export
- Robust CSV parsing with PapaParse for complex audit data
- Support for governmental audit report formats
- Handles quoted fields, commas, and multi-line descriptions
- Smart column mapping for audit-specific fields
- Data validation and error handling

### 🔐 Authentication & Security
- Supabase authentication integration
- Row Level Security (RLS) policies
- User-based access control
- Secure server-side API endpoints

### 💬 Comments & Collaboration
- Add comments to audit tickets
- Timeline view of ticket activities
- User attribution and timestamps

### 📎 File Attachments
- Upload and manage ticket attachments
- File preview support for images and documents
- Secure file storage with Supabase

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **UI Framework**: React 18
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **Charts**: Recharts
- **CSV Processing**: PapaParse
- **Form Handling**: React Hook Form + Zod validation
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd audit-management
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the database schema:
   - Run the SQL script in `SAFE_SCHEMA_UPDATE.sql` in your Supabase dashboard
   - This creates the necessary tables, policies, and indexes

5. Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Database Schema

### Core Tables

- **audit_tickets**: Main ticket entity with audit-specific fields
- **audit_comments**: Comments and timeline entries
- **audit_attachments**: File attachments and metadata

### Key Fields

The system supports comprehensive audit data including:
- Standard ticket fields (title, description, status, priority)
- Audit-specific fields (recommendations, management_response, risk_level)
- Compliance tracking (finding_status, responsibility, followup)
- Management updates and responses

## CSV Import Format

The system supports governmental audit report formats with these columns:

**Standard Fields:**
- Title/Description
- Department
- Priority (low/medium/high/critical)
- Status (open/in_progress/resolved/closed)
- Due Date

**Audit-Specific Fields:**
- Recommendations
- Management Response
- Risk Level
- Finding Status
- Responsibility
- Follow-up Actions
- Follow-up Response
- Management Updates

## API Endpoints

- `POST /api/upload-tickets` - Bulk ticket creation from CSV
- `POST /api/suggest-department` - AI-powered department suggestions
- Standard CRUD operations via Supabase client

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Directories

```
├── app/                 # Next.js app router pages
├── components/          # Reusable React components
│   ├── ui/             # shadcn/ui components
│   ├── csv-upload.tsx  # CSV import functionality
│   └── dashboard-metrics.tsx # Analytics dashboard
├── lib/                # Utility functions and configs
│   └── supabase/       # Database client setup
└── SAFE_SCHEMA_UPDATE.sql # Database schema
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue in the GitHub repository.