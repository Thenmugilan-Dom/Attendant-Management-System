import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // Generate a unique test student email
    const timestamp = Date.now()
    const testEmail = `teststudent${timestamp}@kprcas.ac.in`
    
    // Create a test student with both role and user_type
    const { data: student, error } = await supabase
      .from('users')
      .insert({
        email: testEmail,
        name: `Test Student ${timestamp}`,
        role: 'student',
        user_type: 'student'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating test student:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also create a few more test students for testing
    const moreStudents = []
    for (let i = 1; i <= 3; i++) {
      const { data: extraStudent } = await supabase
        .from('users')
        .insert({
          email: `student${timestamp}_${i}@kprcas.ac.in`,
          name: `Student ${i}`,
          role: 'student',
          user_type: 'student'
        })
        .select()
        .single()
      
      if (extraStudent) moreStudents.push(extraStudent)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Created ${1 + moreStudents.length} test students`,
      students: [student, ...moreStudents]
    })
  } catch (error) {
    console.error('Create test student error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
