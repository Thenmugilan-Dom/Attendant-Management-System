import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a service role client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function GET(request: NextRequest) {
  try {
    const adminId = request.nextUrl.searchParams.get('adminId')

    if (!adminId) {
      return NextResponse.json(
        { error: 'adminId is required' },
        { status: 400 }
      )
    }

    console.log('📊 Fetching dashboard data for admin:', adminId)

    // First, get admin's department
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('department')
      .eq('id', adminId)
      .single()

    if (adminError || !adminData) {
      console.error('❌ Error fetching admin department:', adminError)
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    const department = adminData.department || 'General'
    console.log('📍 Admin department:', department)

    // Fetch students for this department
    const { data: studentsData, count: studentCount, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact' })
      .eq('department', department)

    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError)
    }

    // Fetch teachers (showing all, but can be filtered if needed)
    const { data: teachersData, count: teacherCount, error: teachersError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .eq('user_type', 'teacher')
      .eq('department', department)

    if (teachersError) {
      console.error('❌ Error fetching teachers:', teachersError)
    }

    // Fetch classes for this department
    const { data: classesData, count: classCount, error: classesError } = await supabaseAdmin
      .from('classes')
      .select('*', { count: 'exact' })
      .eq('department', department)

    if (classesError) {
      console.error('❌ Error fetching classes:', classesError)
    }

    // Fetch pending OD requests for this department
    const { data: odRequests, error: odError } = await supabaseAdmin
      .from('od_requests')
      .select(`
        id,
        od_start_date,
        od_end_date,
        reason,
        status,
        teacher_approved,
        admin_approved,
        students (name, email),
        classes (class_name)
      `)
      .eq('admin_id', adminId)
      .eq('status', 'pending')
      .limit(10)

    if (odError) {
      console.error('❌ Error fetching OD requests:', odError)
    }

    console.log('✅ Dashboard data fetched:', {
      students: studentCount || 0,
      teachers: teacherCount || 0,
      classes: classCount || 0,
      odRequests: (odRequests || []).length,
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        totalClasses: classCount || 0,
      },
      odRequests: odRequests || [],
    })
  } catch (error) {
    console.error('❌ Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
