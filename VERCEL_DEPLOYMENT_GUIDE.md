# 🚀 Vercel Deployment Guide - Camera Access Fix

## ✅ Why Camera Doesn't Work Locally (HTTP)

Modern browsers require **HTTPS** for camera access due to security reasons:
- ❌ `http://192.168.1.100:3000` → Camera blocked
- ❌ `http://your-computer-ip:3000` → Camera blocked
- ✅ `http://localhost:3000` → Camera works (localhost exception)
- ✅ `https://your-app.vercel.app` → **Camera works!**

## 📱 Solution: Deploy to Vercel (Free HTTPS)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate with your email or GitHub.

### Step 3: Deploy Your App

```bash
# First deployment (will ask questions)
vercel

# Or deploy directly to production
vercel --prod
```

### Step 4: Add Environment Variables

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add these variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_app_password
```

### Step 5: Test Camera on Mobile

1. Open the Vercel URL on your phone: `https://your-app.vercel.app/students`
2. Click "Start Camera"
3. Allow camera permissions when prompted
4. Point camera at QR code
5. ✅ Should work perfectly!

## 🔧 Manual Entry Fallback

If camera still doesn't work:
1. Students can click "Enter Session Code Manually"
2. Type the 8-character code shown by teacher
3. Continue with OTP verification

## 📋 Quick Deploy Commands

```bash
# Deploy to preview (test deployment)
vercel

# Deploy to production
vercel --prod

# Check deployment logs
vercel logs

# List all deployments
vercel list

# Remove a deployment
vercel remove [deployment-url]
```

## 🌐 Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your domain: `attendance.kprcas.ac.in`
3. Update DNS records as instructed
4. HTTPS is automatically configured!

## ✅ Post-Deployment Checklist

- [ ] Visit deployment URL on desktop (check if site loads)
- [ ] Visit on mobile phone (check responsive design)
- [ ] Test camera access (should prompt for permission)
- [ ] Test QR code scanning with teacher QR
- [ ] Test manual entry fallback
- [ ] Test OTP email delivery
- [ ] Test attendance marking flow
- [ ] Check teacher dashboard
- [ ] Check admin dashboard

## 🐛 Troubleshooting

### Camera Permission Denied
- **Chrome Android**: Settings → Site Settings → Camera → Allow
- **Safari iOS**: Settings → Safari → Camera → Allow

### Camera Not Found
- Ensure device has a working camera
- Try restarting the browser
- Use manual entry as fallback

### HTTPS Certificate Errors
- Vercel handles SSL automatically
- If issues persist, contact Vercel support

## 📱 Mobile Browser Compatibility

| Browser | Android | iOS | Camera Support |
|---------|---------|-----|----------------|
| Chrome | ✅ | ✅ | Full |
| Safari | - | ✅ | Full |
| Firefox | ✅ | ✅ | Full |
| Edge | ✅ | ✅ | Full |

## 🔄 Update Deployment

Whenever you make changes:

```bash
# Push to GitHub (if connected)
git push origin main

# Or deploy manually
vercel --prod
```

Vercel will automatically redeploy if connected to GitHub!

## 💡 Pro Tips

1. **Connect to GitHub**: Auto-deploy on every push
2. **Use Preview URLs**: Test changes before production
3. **Check Vercel Logs**: Debug issues in real-time
4. **Enable Analytics**: Track usage (free tier available)
5. **Set up Monitoring**: Get alerts for downtime

## 🎉 Success!

Once deployed to Vercel:
- ✅ HTTPS enabled automatically
- ✅ Camera access works on all devices
- ✅ Free SSL certificates
- ✅ Global CDN for fast loading
- ✅ Automatic scaling

---

**Questions?** Check [Vercel Documentation](https://vercel.com/docs) or [Next.js Deployment](https://nextjs.org/docs/deployment)
