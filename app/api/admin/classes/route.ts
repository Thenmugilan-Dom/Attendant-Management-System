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

// GET - Fetch all classes for admin's department
export async function GET(request: NextRequest) {
  try {
    const adminId = request.nextUrl.searchParams.get('adminId')
    const department = request.nextUrl.searchParams.get('department')

    console.log('📚 Fetching classes for admin:', { adminId, department })

    // Fetch classes using service role (department filtering optional for now)
    let query = supabaseAdmin
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false })

    // Add department filter if provided and department column exists
    if (department) {
      query = query.eq('department', department)
    }

    const { data, error } = await query

    if (error) {
      console.error('⚠️ Error fetching classes:', error.message)
      // Return empty array for graceful degradation
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    console.log('✅ Classes fetched:', (data || []).length)
    return NextResponse.json(
      {
        success: true,
        data: data || [],
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
        }
      }
    )
  } catch (error) {
    console.error('❌ Classes GET API error:', error)
    // Return empty array on error instead of 500
    return NextResponse.json({
      success: true,
      data: [],
    })
  }
}

// POST - Create new class
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId, department, class_name, section, year, class_email } = body

    console.log('📝 Creating class:', { adminId, department, class_name, section, year, class_email })

    if (!adminId) {
      return NextResponse.json(
        { error: 'adminId is required' },
        { status: 400 }
      )
    }

    if (!class_name) {
      return NextResponse.json(
        { error: 'class_name is required' },
        { status: 400 }
      )
    }

    // Create class using service role (bypasses RLS)
    const insertData: any = {
      class_name: class_name.trim(),
      section: section?.trim() || null,
      year: year ? parseInt(year) : null,
      total_students: 0,
      class_email: class_email?.trim() || null,
    }

    // Try to add department if provided
    // If the column doesn't exist, Supabase will error on insert
    // In that case, we'll retry without department
    if (department) {
      insertData.department = department
    }

    let result = await supabaseAdmin
      .from('classes')
      .insert([insertData])
      .select()

    // If we get a schema error about department column, retry without it
    if (result.error && result.error.message.includes('department')) {
      console.log('⚠️ Department column not found, retrying without it')
      delete insertData.department
      result = await supabaseAdmin
        .from('classes')
        .insert([insertData])
        .select()
    }

    const { data, error } = result

    if (error) {
      console.error('❌ Error creating class:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.log('✅ Class created:', data)

    return NextResponse.json({
      success: true,
      message: 'Class created successfully',
      data: data?.[0],
    })
  } catch (error) {
    console.error('❌ Classes POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update class
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId, department, classId, class_name, section, year, class_email } = body

    console.log('✏️ Updating class:', { adminId, department, classId, class_name, section, year, class_email })

    if (!adminId || !classId) {
      return NextResponse.json(
        { error: 'adminId and classId are required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (class_name) updateData.class_name = class_name.trim()
    if (section !== undefined) updateData.section = section ? section.trim() : null
    if (year !== undefined) updateData.year = year ? parseInt(year) : null
    if (class_email !== undefined) updateData.class_email = class_email ? class_email.trim() : null

    // Update class using service role
    let query = supabaseAdmin
      .from('classes')
      .update(updateData)
      .eq('id', classId)

    // Add department filter if provided
    if (department) {
      query = query.eq('department', department)
    }

    const { data, error } = await query.select()

    if (error) {
      console.error('❌ Error updating class:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.log('✅ Class updated:', data)

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully',
      data: data?.[0],
    })
  } catch (error) {
    console.error('❌ Classes PUT API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete class
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId, department, classId } = body

    console.log('🗑️ Deleting class:', { adminId, department, classId })

    if (!adminId || !classId) {
      return NextResponse.json(
        { error: 'adminId and classId are required' },
        { status: 400 }
      )
    }

    // Delete class using service role
    let query = supabaseAdmin
      .from('classes')
      .delete()
      .eq('id', classId)

    // Add department filter if provided
    if (department) {
      query = query.eq('department', department)
    }

    const { error } = await query

    if (error) {
      console.error('❌ Error deleting class:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.log('✅ Class deleted:', classId)

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully',
    })
  } catch (error) {
    console.error('❌ Classes DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
