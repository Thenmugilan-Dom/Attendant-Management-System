# 📚 Student Class Login - Quick Reference

## 🎯 What Is This?
**Students can mark attendance WITHOUT scanning QR codes!**

Instead of:
❌ Teacher displays QR → Student scans → Email + OTP

Now also:
✅ Student uses class credentials → Select session → Email + OTP

---

## 👨‍🎓 For Students: How to Mark Attendance

### Step 1: Get Class Credentials
Look at the classroom whiteboard or projector:
```
Class: CS-101-A
Password: cs2026
```

### Step 2: Visit Class Login Page
Go to: `your-website.com/class-login`

### Step 3: Login
- Username: `CS-101-A`
- Password: `cs2026`
- Click "Login"

### Step 4: Select Session
You'll see active sessions like:
```
✅ Java Programming
   Started: 9:00 AM
   Expires: 9:30 AM
```
Click on it!

### Step 5: Enter Your Email
- Type: `yourname@kprcas.ac.in`
- Click "Send OTP"

### Step 6: Check Email & Verify
- Open email
- Copy 6-digit code
- Paste and verify

### ✅ Done! Attendance Marked!

---

## 👨‍🏫 For Teachers: Nothing Changes!

Teachers continue as usual:
1. Login to teacher dashboard
2. Start attendance session
3. Students can now mark attendance TWO ways:
   - **Option A:** Scan QR code (if you display it)
   - **Option B:** Use class login (new feature)

---

## 👨‍💼 For Admin: Setup Once

### 1. Run SQL Migration
```sql
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS class_username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS class_password TEXT;
```

### 2. Set Credentials for Each Class
- Admin panel → Manage → Classes
- Edit class → Set "Class Username" and "Class Password"
- Example: Username: `CS-101-A`, Password: `cs2026`

### 3. Share with Students
- Write on classroom whiteboard
- Display on projector at start of semester
- Share in class WhatsApp group

---

## 🔥 Benefits

### For Students:
✅ No need for QR scanner app  
✅ Works on any device (laptop, tablet, phone)  
✅ No camera needed  
✅ Simple username + password  
✅ Can mark from home (if allowed)  

### For Teachers:
✅ Less crowded screen (students not clustering to scan)  
✅ Faster attendance process  
✅ No need to keep QR displayed  
✅ Students can mark even if projector fails  

### For Institution:
✅ More accessible (works for visually impaired)  
✅ Backup method if QR system fails  
✅ Flexibility for students  
✅ Reduced technical support needed  

---

## 📱 Both Methods Work!

### Method 1: QR Code (Original) 🤳
```
Teacher displays QR → Student scans → Done
```
**Best for:** Students with smartphones, quick access

### Method 2: Class Login (New) 💻
```
Student uses class credentials → Selects session → Done
```
**Best for:** Students with laptops, no camera, or prefer typing

**Students choose what works best for them!**

---

## ⚠️ Important Notes

1. **Security:** Class credentials are SHARED among all students in that class
2. **Session Required:** Teacher must start session first (students can't mark if no active session)
3. **OTP Still Required:** Each student verifies with their personal email + OTP
4. **Geofencing:** Location restrictions (if enabled) still apply
5. **One Method:** Students can use EITHER QR or class login (not both for same session)

---

## 🆘 Troubleshooting

### Problem: "Invalid class credentials"
**Solution:** Ask teacher for correct username/password

### Problem: "No active sessions"
**Solution:** Wait for teacher to start session, or ask teacher

### Problem: "OTP not received"
**Solution:** Check spam folder, verify email is correct

### Problem: Can't find class login page
**Solution:** Look for link on main login page: "📚 Student Class Login"

---

## 🔗 Quick Links

- **Student Class Login:** `/class-login`
- **Original Student Portal:** `/students` (QR code method)
- **Teacher Login:** `/login`
- **Admin Panel:** `/admin`

---

**Questions?** Ask your teacher or system administrator!

**Last Updated:** February 17, 2026
