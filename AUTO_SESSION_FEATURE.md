# Auto-Session Scheduling Feature

## Overview
This feature allows admins to schedule automatic attendance sessions that will be created and emailed to teachers at specific times without manual intervention.

## How It Works

### 1. Admin Setup
When assigning a teacher to a class and subject, admins can now:
- Enable automatic session creation
- Set the day of week (Monday-Sunday)
- Set start time and end time
- The system will automatically create sessions 5 minutes before class time

### 2. Automatic Session Creation
- A cron job runs every 15 minutes (Vercel Cron)
- It checks for scheduled assignments where `auto_session_enabled=true`
- If a class is about to start (within 0-7 minutes), it:
  1. Creates an attendance session
  2. Generates a unique session code (6 characters: e.g., "ABC123")
  3. Generates a QR code with session URL
  4. **Sends email to teacher** with QR code image and session code
  5. Session is active for 5 minutes total
- No second alert needed: Sessions show on teacher dashboard with "Starts automatically" label

### 3. Teacher Experience
Teachers automatically see **scheduled sessions** on their dashboard:

**Dashboard Display:**
- A blue card titled "📅 Scheduled Sessions Today"
- Lists all classes scheduled to auto-start today
- Shows class name, section, subject code, and subject name
- Shows scheduled start time in 12-hour AM/PM format (e.g., "9:30 AM")
- Displays status: "Starts automatically"
- No manual action needed—sessions start automatically at scheduled time

**Email Notification:**
- Received 5 minutes before class start (auto-generated)
- Contains QR code image that students scan
- Shows session code for manual entry if needed
- Lists class, subject, and expiration time
- Students can scan QR or enter code to mark attendance

## Database Changes

### New Fields in `teacher_subjects` Table
```sql
day_of_week TEXT              -- Monday, Tuesday, Wednesday, etc.
start_time TIME               -- Class start time (e.g., 09:00)
end_time TIME                 -- Class end time (e.g., 10:00)
auto_session_enabled BOOLEAN  -- Enable/disable auto-sessions
```

## Migration for Existing Databases

If you have an existing database, run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS day_of_week TEXT 
  CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'));

ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS auto_session_enabled BOOLEAN DEFAULT false;
```

## Environment Variables Required

Add these to your `.env.local` file:

```env
# Email Configuration (Required for sending QR codes)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-digit-app-password

# Cron Job Security (Optional but recommended)
CRON_SECRET=your-secret-key-here

# App URL (Required for email links and cron)
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

## Cron Job Setup

### Option 1: Vercel (Automatic - Recommended)
The `vercel.json` file is already configured. Once deployed to Vercel:
- Cron runs automatically every 15 minutes (`*/15 * * * *`)
- No additional configuration needed
- Free tier includes cron jobs

### Option 2: External Cron Service
If not using Vercel, set up a cron job to call:
```
GET https://your-domain.com/api/cron/create-scheduled-sessions
Authorization: Bearer YOUR_CRON_SECRET
```

Schedule: `*/15 * * * *` (every 15 minutes)

### Option 3: Manual Testing
Visit the endpoint in your browser:
```
https://your-domain.com/api/cron/create-scheduled-sessions
```

## API Endpoints

### 1. Create Scheduled Sessions (Cron)
**Endpoint:** `GET /api/cron/create-scheduled-sessions`

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "checked_at": "2025-12-06T10:00:00Z",
  "current_day": "Friday",
  "current_time": "10:00",
  "total_scheduled": 5,
  "triggered": 2,
  "created": 2,
  "sessions": [
    {
      "teacher": "John Doe",
      "email": "john@kprcas.ac.in",
      "class": "MSC A",
      "subject": "CS101 - Data Structures",
      "session_code": "ABC123",
      "expires_at": "2025-12-06T10:10:00Z"
    }
  ]
}
```

### 2. Send Session Email
**Endpoint:** `POST /api/teacher/send-session-email`

**Request:**
```json
{
  "sessionId": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session email sent successfully",
  "teacher_email": "teacher@kprcas.ac.in",
  "session_code": "ABC123"
}
```

## Admin UI Changes

### Assignment Form
When creating/editing teacher assignments, the form now includes:

1. **Auto-Session Toggle**
   - Checkbox to enable automatic sessions

2. **Schedule Fields** (shown when enabled)
   - Day of Week dropdown
   - Start Time input
   - End Time input

3. **Info Message**
   - Explains that sessions will be created 5 minutes before class time
   - Notes that QR code and session code will be emailed

## Email Template

Teachers receive a professional HTML email with:
- Session code (large, bold, easy to read)
- QR code image (300x300px)
- Class and subject details
- Expiration time
- Instructions for students
- KPRCAS branding

## How Students Mark Attendance

Students can mark attendance by:
1. Scanning the QR code from the teacher's email, OR
2. Entering the session code manually
3. Verifying their identity with OTP

## Timing Details

- **Cron check interval:** Every 3 minutes
- **Session creation trigger:** 0-7 minutes before class start
- **Session validity:** 5 minutes after start time
- **Duplicate prevention:** No duplicate sessions within 10 minutes

## Example Workflow

1. **Monday, 9:00 AM** - Admin assigns teacher to CS101 class
   - Day: Monday
   - Start Time: 10:00
   - End Time: 11:00
   - Auto-session: Enabled

2. **Monday, 9:57 AM** - Cron job runs
   - Checks scheduled assignments
   - Finds CS101 class starting at 10:00
   - Creates session (expires at 10:05)
   - Sends email to teacher

3. **Monday, 10:00 AM** - Class starts
   - Teacher receives email with QR code
   - Students scan QR code
   - Students verify with OTP
   - Attendance marked

4. **Monday, 10:05 AM** - Session expires
   - No more attendance can be marked
   - Records are saved

## Troubleshooting

### Sessions not being created
1. Check if cron job is running
2. Verify `auto_session_enabled` is true in database
3. Check day_of_week matches current day
4. Ensure start_time is set correctly
5. Check logs at `/api/cron/create-scheduled-sessions`

### Emails not being sent
1. Verify GMAIL_USER and GMAIL_APP_PASSWORD in .env.local
2. Check Gmail App Password is correct
3. Check teacher email is valid
4. Review server logs for email errors

### Duplicate sessions
- System prevents duplicates within 10 minutes
- If you see duplicates, check cron frequency

## Security Considerations

1. **Cron Secret:** Set a strong CRON_SECRET to prevent unauthorized access
2. **Email Validation:** Only @kprcas.ac.in emails are allowed by default
3. **Session Expiry:** Sessions auto-expire after 5 minutes
4. **Authorization:** Cron endpoint requires Bearer token in production

## Testing

### Test Auto-Session Creation
1. Create a teacher assignment with auto-session enabled
2. Set day_of_week to current day
3. Set start_time to 5 minutes from now
4. Wait for cron job to run (or trigger manually)
5. Check teacher's email
6. Verify session was created in database

### Manual Trigger (Development)
```bash
curl http://localhost:3000/api/cron/create-scheduled-sessions
```

### Test Email Sending
```bash
curl -X POST http://localhost:3000/api/teacher/send-session-email \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"your-session-uuid"}'
```

## Future Enhancements

Potential improvements:
- Support for recurring weekly schedules
- Email reminders before class
- SMS notifications
- Custom session duration
- Holiday calendar integration
- Multiple sessions per day
- Teacher dashboard for viewing scheduled sessions

## Support

For issues or questions:
1. Check server logs
2. Verify environment variables
3. Test cron endpoint manually
4. Check email delivery
5. Review database for scheduled assignments
