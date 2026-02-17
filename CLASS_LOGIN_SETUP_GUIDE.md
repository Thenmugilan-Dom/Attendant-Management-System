# 🔐 Class Login System - Quick Staff Access

## Overview
The **Class Login System** (`/class-login`) is a **STAFF/TEACHER ONLY** page for quick access without individual teacher login. Staff logs in with shared class credentials, displays the QR code on projector/screen, and students scan it to mark attendance.

⚠️ **IMPORTANT**: This page is NOT for students - it's for staff to quickly access and display QR codes.

---

## ✅ Benefits
- ✅ **Staff Quick Access**: No need for individual teacher login
- ✅ **Shared Credentials**: One username/password per class
- ✅ **QR Display on Projector**: Show QR codes to entire class
- ✅ **Large Scannable QR**: 300x300px QR code for easy scanning
- ✅ **Fast Setup**: Staff can start displaying QR in seconds

---

## 🗄️ Database Setup

### Step 1: Run Migration
Copy and execute this in **Supabase SQL Editor**:

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS class_username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS class_password TEXT;

CREATE INDEX IF NOT EXISTS idx_classes_username ON classes(class_username);

COMMENT ON COLUMN classes.class_username IS 'Shared class login username (e.g., CS101-A)';
COMMENT ON COLUMN classes.class_password IS 'Shared class login password';
```

✅ **Result**: Classes table now has `class_username` and `class_password` columns

---

## 👨‍💼 Admin Setup

### Step 2: Set Class Credentials

1. **Login as Admin** → Go to `/admin/manage`
2. **Select Classes Tab**
3. **Add New Class** or **Edit Existing Class**
4. **Fill in Class Login Section**:
   - **Class Username**: e.g., `CS101-A`, `IT-2024-B`, `MATH-SEC-A`
   - **Class Password**: e.g., `class123`, `attendance2026`
5. **Click Save**

**Example:**
```
Class Name: CS-101
Section: A
Year: 1
Class Username: CS101-A
Class Password: attendance123
```

### Step 3: Share Credentials with Staff/Teachers
- ⚠️ **Keep credentials secure** - for staff use only
- Share with teachers via staff WhatsApp/email
- Store in staff room or teacher's desk
- Do NOT share with students

---

## 👨‍� Staff Usage

### Step 4: Staff Quick Login

**URL**: `https://your-domain.com/class-login`

**Login Steps (Staff Only):**
1. Staff/Teacher goes to `/class-login` page
2. Enter **Class Username** (e.g., `CS101-A`)
3. Enter **Class Password** (e.g., `attendance123`)
4. Click **"Login"**

✅ **Redirects to QR Code Display Page** (`/class/attendance`)
⚠️ **Students should NOT access this page**

### Step 5: Display QR Code on Projector

**Staff displays page, students scan QR codes:**

1. **Staff selects active session** from list (shows subject and time)
2. **Large QR code is displayed** (300x300px, scannable)
3. **Staff displays this on projector/screen**
4. **Students scan QR code:**

   **How Students Mark Attendance:** 📱
   - Student opens phone camera or QR scanner app
   - Scans the QR code from projector screen
   - Taps the link that appears
   - Enters their email for verification
   - Receives OTP via email
   - Verifies OTP
   - ✅ Attendance marked!

### Staff Controls:
- **Download QR Code**: Save as PNG image for sharing
- **Back to Sessions**: Switch to different active session
- **Logout**: Exit class login

---

## 🎯 Workflow Example

### Scenario: CS-101 Section A - Java Programming Class

**Admin Setup (One-time):**
```
Admin creates class:
- Class: CS-101
- Section: A
- Username: CS101-A
- Password: java2026
```

**Teacher Usage (Before Class):**
```
Teacher starts attendance session as usual:
1. Login as teacher (or use class login)
2. Select class and subject
3. Generate QR code
4. Session is now ACTIVE
```

**Staff Usage (During Class - Quick Access):**
```
1. Staff goes to /class-login on classroom computer
2. Enters: CS101-A / java2026
3. Sees active Java Programming session
4. Clicks on session
5. 🎯 DISPLAYS QR CODE ON PROJECTOR
6. Students scan QR from projector screen
```

**Student Actions (During Class):**
```
1. Student looks at projector screen
2. Opens phone camera
3. Scans QR code from projector
4. Taps the link on phone
5. Enters email address
6. Receives OTP via email
7. Enters OTP code
8. Attendance marked → Done! ✅
```

**⚠️ Students do NOT access /class-login - only staff does!**

---

## 📱 How Students Mark Attendance

### QR Code Scanning Process: 📱
1. **Staff** displays QR code on projector (via `/class-login` access)
2. **Student** scans QR with phone camera from projector screen
3. **Student** taps the link that appears on their phone
4. **Student** enters their email address
5. **Student** receives 6-digit OTP via email
6. **Student** enters OTP code
7. ✅ Attendance marked!

### Purpose of Class Login Page:
🎯 **Access:** STAFF/TEACHER ONLY (not for students)  
🎯 **Purpose:** Quick login without individual teacher accounts  
🎯 **Benefit:** Display QR codes on projector for students to scan  
⚠️ **Security:** Keep credentials away from students

---

## 📱 Integration with Email System

### Email Notifications
When a session starts via class login:
- Email is sent to **class email** (if configured)
- QR code is attached
- Students can also receive QR via email if needed

**Configure Class Email:**
- Admin panel → Classes → Edit class
- Set "Class Email" field (e.g., `cs101a@kprcas.ac.in`)
- All session notifications go to this email

---

## 🔒 Security Considerations

### Password Management
- ✅ **Simple passwords** are fine (institutional setting)
- ✅ **Visible to teachers** (shared credentials model)
- ✅ **Change passwords** if compromised
- ⚠️ **Not for admin access** (admin login remains individual)

### Access Control
- Class login **cannot access admin functions**
- Can only **view/display sessions** for that specific class
- Cannot view other classes' data
- Cannot modify class settings
- **STAFF USE ONLY** - not for students

---

## 📊 Comparison: Class Login vs Individual Teacher Login

| Feature | Class Login (Staff Quick Access) | Individual Teacher Login |
|---------|----------------------------------|-------------------------|
| **Who Uses** | Any staff member for that class | Specific teacher only |
| **Credentials** | Shared class username/password | Individual teacher account |
| **Setup Time** | ⚡ Fast (no login hassle) | Slower (personal credentials) |
| **Purpose** | Quick QR display | Full teacher dashboard |
| **Best For** | Lab assistants, substitute teachers | Regular class teachers |
| **Access Level** | View/display QR only | Full teacher features |
| **Security** | Shared among staff | Personal account |

---

## 🛠️ Troubleshooting

### Problem: "Invalid class credentials"
**Solution:**
- Check username and password (case-sensitive)
- Verify admin set credentials in manage page
- Check database: `SELECT class_username, class_password FROM classes WHERE class_name = 'CS-101'`

### Problem: No subjects showing in dashboard
**Solution:**
- No active sessions currently
- Wait for teacher to start attendance session
- Refresh page to see new sessions
- Check: Teacher must generate QR or start session first

### Problem: "Invalid class credentials"
**Solution:**
- Check username and password (case-sensitive)
- Ask teacher for correct credentials
- Credentials may be written on classroom board

### Problem: No active sessions showing
**Solution:**
- Teacher hasn't started session yet
- Session may have expired (check expiry time)
- Ask teacher to start new session
- Click "Refresh" button to check again

### Problem: QR code not generating
**Solution:**
- Check attendance session API is working
- Verify class has subjects assigned
- Check browser console for errors

### Problem: Email not received
**Solution:**
- Verify class email is set in admin panel
- Check Gmail SMTP settings in `.env.local`
- Check spam folder
- Refer to `GMAIL_SMTP_INFO.md` for email delivery timings

---

## 🚀 Quick Start Checklist

### For Admin:
- [ ] Run database migration (add class_username, class_password columns)
- [ ] Set username/password for each class in admin panel
- [ ] Share credentials with STAFF ONLY (not students)
- [ ] Inform teachers/staff about class login system

### For Teachers/Staff:
- [ ] Start attendance sessions as usual (teacher login)
- [ ] Use `/class-login` for quick access (optional)
- [ ] Display QR code on projector using class login
- [ ] Monitor attendance from teacher dashboard
- [ ] End sessions when class finishes

### For Students:
- [ ] Look at projector screen when staff displays QR
- [ ] Open phone camera
- [ ] Scan QR code from projector
- [ ] Tap the link on your phone
- [ ] Enter your email address
- [ ] Check email for OTP code
- [ ] Enter OTP to verify
- [ ] Attendance marked! ✅

---

## 📝 API Endpoints

### Class Login Authentication (Students)
```typescript
POST /api/auth/class-login
Body: { username: string, password: string }
Response: { success: true, class: {...}, subjects: [...] }
```

### Get Active Sessions for Class
```typescript
GET /api/attendance/active-sessions?classId=xxx
Response: { success: true, sessions: [...] }
```

### Send OTP (Student Email Verification)
```typescript
POST /api/attendance/send-otp
Body: { email: string, sessionCode: string }
Response: { success: true, message: "OTP sent" }
```

### Mark Attendance
```typescript
POST /api/attendance/mark
Body: { sessionCode: string, email: string, otp: string }
Response: { success: true, message: "Attendance marked" }
```

---

## 🎓 Best Practices

1. **Keep Credentials Secure:**
   - ⚠️ **DO NOT share with students**
   - Share only with authorized staff/teachers
   - Store in staff room or secure location
   - Change immediately if students gain access

2. **Password Management:**
   - Use simple passwords for staff convenience
   - Change passwords if compromised
   - Passwords are for staff quick-access only

3. **Session Timing:**
   - Teachers start sessions at beginning of class
   - Give students 5-10 minutes to mark attendance
   - Announce session end time clearly

4. **Student Support:**
   - Ensure students know how to scan QR codes
   - Help students who don't have working cameras
   - Keep QR visible on projector throughout session duration
   - Download QR and share if needed

---

## 🔗 Related Documentation

- **[GMAIL_SMTP_INFO.md](GMAIL_SMTP_INFO.md)** - Email delivery information
- **[MASTER_DATABASE_SETUP.sql](MASTER_DATABASE_SETUP.sql)** - Database schema
- **[ADMIN_DEPARTMENT_STRUCTURE.md](ADMIN_DEPARTMENT_STRUCTURE.md)** - Department isolation
- **[QUICK_START_TESTING.md](QUICK_START_TESTING.md)** - Testing guide

---

## 📞 Support

**Issues?** Contact system administrator:
- Check browser console for errors
- Verify database migration ran successfully
- Test with different browsers
- Review server logs for API errors

---

**Implementation Date:** February 17, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready
