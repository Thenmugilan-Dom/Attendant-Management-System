import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    console.log('🔐 Class login attempt:', username)

    // Find class by username
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section, year, department, class_username, class_password, class_email')
      .eq('class_username', username)
      .single()

    if (classError || !classData) {
      console.error('❌ Class not found:', username)
      return NextResponse.json(
        { error: 'Invalid class credentials' },
        { status: 401 }
      )
    }

    // Verify password
    if (classData.class_password !== password) {
      console.error('❌ Invalid password for class:', username)
      return NextResponse.json(
        { error: 'Invalid class credentials' },
        { status: 401 }
      )
    }

    console.log('✅ Class login successful:', classData.class_name)

    // Fetch all subjects assigned to this class (from teacher_subjects)
    const { data: assignments, error: assignmentsError } = await supabase
      .from('teacher_subjects')
      .select(`
        id,
        subject_id,
        subjects (
          id,
          subject_code,
          subject_name,
          credits,
          semester
        )
      `)
      .eq('class_id', classData.id)

    if (assignmentsError) {
      console.error('Error fetching class subjects:', assignmentsError)
    }

    // Get unique subjects for this class
    const subjects = assignments?.map(a => a.subjects).filter(Boolean) || []

    return NextResponse.json({
      success: true,
      message: 'Class login successful',
      class: {
        id: classData.id,
        className: classData.class_name,
        section: classData.section,
        year: classData.year,
        department: classData.department,
        classEmail: classData.class_email,
        username: classData.class_username
      },
      subjects: subjects
    })
  } catch (error) {
    console.error('Error in class login:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
