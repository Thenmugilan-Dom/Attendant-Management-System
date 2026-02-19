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

// GET - Fetch all classes that the teacher is assigned to
export async function GET(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get('teacherId')

    if (!teacherId) {
      return NextResponse.json(
        { error: 'teacherId is required' },
        { status: 400 }
      )
    }

    console.log('📚 Fetching classes for teacher:', teacherId)

    // Fetch classes the teacher is assigned to via teacher_subjects
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('teacher_subjects')
      .select(`
        class_id,
        classes (
          id,
          class_name,
          section,
          year,
          department,
          total_students,
          class_email,
          latitude,
          longitude,
          location_radius
        )
      `)
      .eq('teacher_id', teacherId)

    if (assignmentsError) {
      console.error('⚠️ Error fetching teacher assignments:', assignmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch classes' },
        { status: 500 }
      )
    }

    // Extract unique classes (teacher may have multiple subjects for same class)
    const uniqueClasses = new Map()
    assignments?.forEach((assignment: any) => {
      if (assignment.classes && !uniqueClasses.has(assignment.classes.id)) {
        uniqueClasses.set(assignment.classes.id, assignment.classes)
      }
    })

    const classes = Array.from(uniqueClasses.values())
    console.log('✅ Classes fetched for teacher:', classes.length)

    return NextResponse.json({
      success: true,
      data: classes,
    })
  } catch (error) {
    console.error('❌ Teacher classes GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a class (for testing purposes)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacherId, classId } = body

    console.log('🗑️ Teacher deleting class:', { teacherId, classId })

    if (!teacherId || !classId) {
      return NextResponse.json(
        { error: 'teacherId and classId are required' },
        { status: 400 }
      )
    }

    // Verify teacher has access to this class (is assigned to it)
    const { data: assignment, error: verifyError } = await supabaseAdmin
      .from('teacher_subjects')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .limit(1)
      .single()

    if (verifyError || !assignment) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this class' },
        { status: 403 }
      )
    }

    // Delete the class (will cascade delete related records)
    const { error: deleteError } = await supabaseAdmin
      .from('classes')
      .delete()
      .eq('id', classId)

    if (deleteError) {
      console.error('⚠️ Error deleting class:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete class' },
        { status: 500 }
      )
    }

    console.log('✅ Class deleted successfully')
    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully',
    })
  } catch (error) {
    console.error('❌ Teacher classes DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
