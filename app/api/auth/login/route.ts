import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Validate email domain
function isValidEmail(email: string): boolean {
  const emailLower = email.toLowerCase()
  return emailLower.endsWith('@kprcas.ac.in') || emailLower.endsWith('@gmail.com')
}

export async function POST(request: NextRequest) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing environment variables:', {
        SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      })
      return NextResponse.json(
        { error: 'Server configuration error. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Create a service role client to bypass RLS (for login only)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const body = await request.json()
    const email = body.email?.trim()
    const password = body.password?.trim()

    console.log('🔐 Login attempt:', { email, passwordLength: password?.length })

    // Validate inputs
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Check if email domain is allowed
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Only @kprcas.ac.in and @gmail.com emails are allowed' },
        { status: 400 }
      )
    }

    // Find user by email using service role (bypasses RLS)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'active')
      .single()

    if (userError || !user) {
      console.error('User not found:', { 
        email: email.toLowerCase(), 
        error: userError?.message,
        code: userError?.code 
      })
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if user is admin or teacher
    if (user.user_type !== 'admin' && user.user_type !== 'teacher') {
      return NextResponse.json(
        { error: 'Access denied. Admin and Teacher only.' },
        { status: 403 }
      )
    }

    // Verify password (using plain_password for now)
    // In production, you should use hashed passwords
    const storedPassword = user.plain_password?.trim()
    const providedPassword = password.trim()
    
    console.log('🔑 Password comparison:', { 
      email: user.email,
      providedPassword,
      providedLength: providedPassword.length,
      storedPassword,
      storedLength: storedPassword?.length,
      match: storedPassword === providedPassword
    })
    
    if (!storedPassword || storedPassword !== providedPassword) {
      console.error('❌ Password mismatch!')
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }
    
    console.log('✅ Password match! Login successful')

    // Generate a simple token (in production, use JWT)
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64')

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.user_type,
        department: user.department,
        phone: user.phone,
      },
      token,
    })
  } catch (error) {
    console.error('Error in login:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
