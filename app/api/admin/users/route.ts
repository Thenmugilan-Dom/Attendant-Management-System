import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Validate email domain
function isValidEmail(email: string): boolean {
  const emailLower = email.toLowerCase()
  return emailLower.endsWith('@kprcas.ac.in') || emailLower.endsWith('@gmail.com')
}

// Generate strong random password (letters, numbers, and @ symbol only)
function generatePassword(length: number = 10): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const special = '@'
  const allChars = uppercase + lowercase + numbers + special
  
  let password = ''
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += '@' // Always include @
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, username, password, department, phone, user_type } = body

    // Validate user type
    if (user_type !== 'teacher' && user_type !== 'admin') {
      return NextResponse.json(
        { error: 'Invalid user type. Only teacher or admin allowed.' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
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

    // Generate password if not provided
    const finalPassword = password || generatePassword(10)
    const finalUsername = username || email.split('@')[0]

    // Check for duplicates before inserting
    const { data: existingEmail } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      )
    }

    const { data: existingUsername } = await supabase
      .from('users')
      .select('username')
      .eq('username', finalUsername)
      .single()

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      )
    }

    if (phone) {
      const { data: existingPhone } = await supabase
        .from('users')
        .select('phone')
        .eq('phone', phone)
        .single()

      if (existingPhone) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 409 }
        )
      }
    }

    // Insert user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        username: finalUsername.trim(),
        plain_password: finalPassword.trim(),
        user_type,
        role: user_type, // Add role field (same as user_type)
        department: department?.trim(),
        phone: phone?.trim(),
        status: 'active',
      })
      .select()
      .single()
    
    console.log('✅ User created:', {
      email: email.toLowerCase().trim(),
      password: finalPassword.trim(),
      user_type,
      status: 'active'
    })

    if (insertError) {
      console.error('Error creating user:', insertError)
      
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Email, username, or phone already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create user: ' + insertError.message },
        { status: 500 }
      )
    }

    console.log('📤 Returning password to admin:', finalPassword.trim())

    return NextResponse.json({
      success: true,
      message: `${user_type === 'teacher' ? 'Teacher' : 'Admin'} created successfully`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        password: finalPassword.trim(), // Return password to show to admin
        user_type: newUser.user_type,
        department: newUser.department,
      },
    })
  } catch (error) {
    console.error('Error in create-user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get all users or single user by ID
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userType = url.searchParams.get('type') // admin, teacher, student
    const userId = url.searchParams.get('id') // Get single user by ID

    // If ID is provided, fetch single user with all details
    if (userId) {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, username, user_type, department, phone, status, plain_password, created_at')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user:', error)
        return NextResponse.json(
          { error: 'Failed to fetch user details' },
          { status: 500 }
        )
      }

      // Fetch assigned subjects for this teacher (OPTIMIZED)
      let assignments: any[] = []
      if (user.user_type === 'teacher') {
        const { data: assignmentsData } = await supabase
          .from('teacher_subjects')
          .select('*')
          .eq('teacher_id', userId)

        if (assignmentsData && assignmentsData.length > 0) {
          // Fetch all related data in parallel
          const subjectIds = [...new Set(assignmentsData.map(a => a.subject_id))]
          const classIds = [...new Set(assignmentsData.map(a => a.class_id))]

          const [subjectsResult, classesResult] = await Promise.all([
            supabase
              .from('subjects')
              .select('id, subject_code, subject_name, credits, semester')
              .in('id', subjectIds),
            supabase
              .from('classes')
              .select('id, class_name, section, year')
              .in('id', classIds)
          ])

          // Create lookup maps
          const subjectsMap = new Map(subjectsResult.data?.map(s => [s.id, s]) || [])
          const classesMap = new Map(classesResult.data?.map(c => [c.id, c]) || [])

          // Map assignments with related data
          assignments = assignmentsData.map(assignment => ({
            subject: subjectsMap.get(assignment.subject_id) || null,
            class: classesMap.get(assignment.class_id) || null,
          }))
        }
      }

      return NextResponse.json({
        success: true,
        user: {
          ...user,
          assignments,
        },
      })
    }

    // Fetch all users
    let query = supabase
      .from('users')
      .select('id, name, email, username, user_type, department, phone, status, created_at')
      .order('created_at', { ascending: false })

    if (userType) {
      query = query.eq('user_type', userType)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        users,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    )
  } catch (error) {
    console.error('Error in get users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete user (teacher)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Delete user (this will cascade delete teacher_subjects due to ON DELETE CASCADE)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting user:', error)
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Error in delete user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
