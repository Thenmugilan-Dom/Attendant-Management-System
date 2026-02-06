import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch all teacher-subject assignments (OPTIMIZED)
export async function GET(request: NextRequest) {
  try {
    console.log('Fetching assignments from database...')
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacher_id')
    const subjectId = searchParams.get('subject_id')
    const classId = searchParams.get('class_id')

    // Fetch assignments
    const { data: assignmentsRaw, error: assignError } = await supabase
      .from('teacher_subjects')
      .select('*')
      .order('created_at', { ascending: false })

    if (assignError) {
      console.error('Error fetching assignments:', assignError)
      return NextResponse.json(
        { error: assignError.message || 'Failed to fetch assignments' },
        { status: 500 }
      )
    }

    if (!assignmentsRaw || assignmentsRaw.length === 0) {
      return NextResponse.json({ success: true, assignments: [] })
    }

    // OPTIMIZATION: Fetch all related data in parallel with single queries
    const teacherIds = [...new Set(assignmentsRaw.map(a => a.teacher_id))]
    const subjectIds = [...new Set(assignmentsRaw.map(a => a.subject_id))]
    const classIds = [...new Set(assignmentsRaw.map(a => a.class_id))]

    const [teachersResult, subjectsResult, classesResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, department')
        .in('id', teacherIds),
      supabase
        .from('subjects')
        .select('id, subject_code, subject_name, credits, semester')
        .in('id', subjectIds),
      supabase
        .from('classes')
        .select('id, class_name, section, year')
        .in('id', classIds)
    ])

    // Create lookup maps for O(1) access
    const teachersMap = new Map(teachersResult.data?.map(t => [t.id, t]) || [])
    const subjectsMap = new Map(subjectsResult.data?.map(s => [s.id, s]) || [])
    const classesMap = new Map(classesResult.data?.map(c => [c.id, c]) || [])

    // Map assignments with related data
    const assignmentsWithDetails = assignmentsRaw.map(assignment => ({
      ...assignment,
      teacher: teachersMap.get(assignment.teacher_id) || null,
      subject: subjectsMap.get(assignment.subject_id) || null,
      class: classesMap.get(assignment.class_id) || null,
    }))

    // Apply filters if provided
    let filteredAssignments = assignmentsWithDetails
    if (teacherId) filteredAssignments = filteredAssignments.filter(a => a.teacher_id === teacherId)
    if (subjectId) filteredAssignments = filteredAssignments.filter(a => a.subject_id === subjectId)
    if (classId) filteredAssignments = filteredAssignments.filter(a => a.class_id === classId)

    console.log('Assignments fetched successfully:', filteredAssignments?.length || 0)
    return NextResponse.json(
      { success: true, assignments: filteredAssignments },
      { 
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
        }
      }
    )
  } catch (error: any) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}

// POST - Create new teacher-subject assignment
export async function POST(request: NextRequest) {
  try {
    const { teacher_id, subject_id, class_id, day_order, start_time, end_time, auto_session_enabled } = await request.json()

    if (!teacher_id || !subject_id || !class_id) {
      return NextResponse.json(
        { error: 'Teacher, Subject, and Class are required' },
        { status: 400 }
      )
    }

    // Verify all foreign keys exist
    const { data: teacherCheck } = await supabase
      .from('users')
      .select('id')
      .eq('id', teacher_id)
      .single()

    if (!teacherCheck) {
      return NextResponse.json(
        { error: `Teacher with ID ${teacher_id} not found` },
        { status: 404 }
      )
    }

    const { data: subjectCheck } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', subject_id)
      .single()

    if (!subjectCheck) {
      return NextResponse.json(
        { error: `Subject with ID ${subject_id} not found. Please refresh the page and try again.` },
        { status: 404 }
      )
    }

    const { data: classCheck } = await supabase
      .from('classes')
      .select('id')
      .eq('id', class_id)
      .single()

    if (!classCheck) {
      return NextResponse.json(
        { error: `Class with ID ${class_id} not found` },
        { status: 404 }
      )
    }

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('teacher_subjects')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('subject_id', subject_id)
      .eq('class_id', class_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This assignment already exists' },
        { status: 409 }
      )
    }

    const { data: newAssignment, error } = await supabase
      .from('teacher_subjects')
      .insert({
        teacher_id,
        subject_id,
        class_id,
        day_order: day_order || null,
        start_time: start_time || null,
        end_time: end_time || null,
        auto_session_enabled: auto_session_enabled || false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating assignment:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create assignment' },
        { status: 500 }
      )
    }

    // Fetch related data
    const { data: teacher } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', teacher_id)
      .single()

    const { data: subject } = await supabase
      .from('subjects')
      .select('id, subject_code, subject_name, credits, semester')
      .eq('id', subject_id)
      .single()

    const { data: classData } = await supabase
      .from('classes')
      .select('id, class_name, section')
      .eq('id', class_id)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Assignment created successfully',
      assignment: {
        ...newAssignment,
        teacher,
        subject,
        class: classData,
      },
    })
  } catch (error) {
    console.error('Error creating assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    )
  }
}

// DELETE - Delete teacher-subject assignment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('teacher_subjects')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting assignment:', error)
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    )
  }
}
