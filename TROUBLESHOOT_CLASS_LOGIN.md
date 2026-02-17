# 🔧 TROUBLESHOOTING: Class Login Not Saving

## Problem
When adding Class Username and Class Password in the admin panel, clicking "Save" doesn't save the data to the database.

## Root Cause
The database columns `class_username` and `class_password` don't exist yet. You need to run the migration.

---

## ✅ SOLUTION (5 Minutes)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**

### Step 2: Run the Migration
Copy the entire contents of `FIX_CLASS_LOGIN_COLUMNS.sql` and paste into the SQL Editor, then click **"Run"**.

**OR** copy this quick fix:

```sql
-- Add columns
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS class_username TEXT,
ADD COLUMN IF NOT EXISTS class_password TEXT;

-- Make username unique
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_class_username_key;
ALTER TABLE classes ADD CONSTRAINT classes_class_username_key UNIQUE (class_username);

-- Create index
CREATE INDEX IF NOT EXISTS idx_classes_username ON classes(class_username);

-- Verify
SELECT 'SUCCESS!' as result 
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='classes' AND column_name='class_username'
);
```

### Step 3: Verify Success
You should see output like:
```
✅ SUCCESS: Both columns added!
```

### Step 4: Refresh Browser
1. Go back to your admin panel (localhost:3000/admin/manage)
2. Press `Ctrl+Shift+R` (hard refresh)
3. Try editing a class again

### Step 5: Test Saving
1. Edit a class
2. Fill in:
   - **Class Username:** `TEST-CLASS`
   - **Class Password:** `test123`
3. Click **Save**
4. Should show success message! ✅

---

## 🔍 Verification Steps

### Check if columns exist:
Run this in Supabase SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'classes' 
AND column_name IN ('class_username', 'class_password');
```

**Expected Output:**
```
class_username | text
class_password | text
```

### Check existing data:
```sql
SELECT class_name, section, class_username, class_password 
FROM classes 
LIMIT 5;
```

---

## 🐛 Still Not Working?

### 1. Check Browser Console
- Open browser DevTools (F12)
- Go to **Console** tab
- Look for error messages when clicking Save
- Should see: `📤 Sending class data: {...}`

### 2. Check Network Tab
- Open DevTools → **Network** tab
- Click Save
- Find the request to `/api/admin/classes`
- Check **Response** tab for error details

### 3. Check Server Logs
If running locally:
- Check terminal where `npm run dev` is running
- Look for error messages after clicking Save

### 4. Common Errors

**Error: "column class_username does not exist"**
- ✅ Solution: Run the migration SQL above

**Error: "duplicate key value violates unique constraint"**
- ✅ Solution: Username already exists, choose a different one
- Or check: `SELECT class_username FROM classes WHERE class_username = 'YOUR-USERNAME'`

**Error: "(no error shown, silently fails)"**
- ✅ Solution: Check browser console and network tab
- May be JavaScript error - refresh page with Ctrl+Shift+R

---

## 📊 Debug SQL Queries

### See all classes with current status:
```sql
SELECT 
    class_name,
    section,
    year,
    class_username,
    class_password,
    CASE 
        WHEN class_username IS NOT NULL THEN '✅ Has credentials'
        ELSE '⚠️ Missing credentials'
    END as status
FROM classes
ORDER BY class_name;
```

### Manually set credentials (if needed):
```sql
UPDATE classes 
SET 
    class_username = 'CS101-A',
    class_password = 'class123'
WHERE class_name = 'CS-101' AND section = 'A';
```

### Test class login:
```sql
SELECT * FROM classes 
WHERE class_username = 'CS101-A' 
AND class_password = 'class123';
```

---

## ✅ Success Checklist

After fixing, you should be able to:
- [ ] Open admin panel → Manage → Classes
- [ ] Click Edit on any class
- [ ] See "🔐 Shared Class Login" section
- [ ] Enter class username and password
- [ ] Click Save → Success message
- [ ] Go to `/class-login` page
- [ ] Login with the credentials
- [ ] See class dashboard with subjects

---

## 📞 Still Need Help?

If none of the above works:

1. **Share error messages:**
   - Browser console errors
   - Network tab response
   - Server logs (terminal output)

2. **Share SQL query result:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'classes';
   ```

3. **Check Supabase connection:**
   - Verify `.env.local` has correct Supabase URL and keys
   - Test connection with: `npm run dev` and check for errors

---

**Last Updated:** February 17, 2026  
**Migration File:** `FIX_CLASS_LOGIN_COLUMNS.sql`  
**API File:** `app/api/admin/classes/route.ts`
