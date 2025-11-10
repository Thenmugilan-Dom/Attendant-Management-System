import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch all users to debug
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count by role
    const studentCount = users?.filter(u => u.role === 'student').length || 0
    const teacherCount = users?.filter(u => u.role === 'teacher').length || 0
    const adminCount = users?.filter(u => u.role === 'admin').length || 0

    return NextResponse.json({
      users: users || [],
      counts: {
        students: studentCount,
        teachers: teacherCount,
        admins: adminCount,
        total: users?.length || 0
      }
    })
  } catch (error) {
    console.error('Debug users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
