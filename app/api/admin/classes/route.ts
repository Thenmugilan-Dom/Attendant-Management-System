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
    const { adminId, department, class_name, section, year, class_email, class_username, class_password, latitude, longitude, location_radius } = body

    console.log('📝 Creating class:', { adminId, department, class_name, section, year, class_email, class_username, latitude, longitude, location_radius })

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
      class_username: class_username?.trim() || null,
      class_password: class_password?.trim() || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      location_radius: location_radius ? parseInt(location_radius) : 100,
    }

    // Try to add department if provided
    // If the column doesn't exist, Supabase will error on insert
    // In that case, we'll retry without department
    if (department) {
      insertData.department = department
    }

    console.log('📝 Attempting to insert class with data:', insertData)
    
    let result = await supabaseAdmin
      .from('classes')
      .insert([insertData])
      .select()

    // If we get a schema error about missing columns, retry without them
    if (result.error) {
      const errorMsg = result.error.message.toLowerCase()
      
      if (errorMsg.includes('department')) {
        console.log('⚠️ Department column not found, retrying without it')
        delete insertData.department
        result = await supabaseAdmin
          .from('classes')
          .insert([insertData])
          .select()
      } else if (errorMsg.includes('class_username') || errorMsg.includes('class_password')) {
        console.log('⚠️ Class login columns not found. Run migration: migrations/008_class_login_credentials.sql')
        // Remove class login fields and retry
        delete insertData.class_username
        delete insertData.class_password
        result = await supabaseAdmin
          .from('classes')
          .insert([insertData])
          .select()
      }
    }

    const { data, error } = result

    if (error) {
      console.error('❌ Error creating class:', error.message)
      console.error('Full error details:', error)
      return NextResponse.json(
        { 
          error: error.message,
          hint: error.message.includes('class_username') || error.message.includes('class_password') 
            ? 'Database migration required. Run: migrations/008_class_login_credentials.sql' 
            : undefined
        },
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
    const { adminId, department, classId, class_name, section, year, class_email, class_username, class_password, latitude, longitude, location_radius } = body

    console.log('✏️ Updating class:', { adminId, department, classId, class_name, section, year, class_email, class_username, latitude, longitude, location_radius })

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
    if (class_username !== undefined) updateData.class_username = class_username ? class_username.trim() : null
    if (class_password !== undefined) updateData.class_password = class_password ? class_password.trim() : null
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null
    if (location_radius !== undefined) updateData.location_radius = location_radius ? parseInt(location_radius) : 100
    
    console.log('📝 Attempting to update class with data:', updateData)

    // Update class using service role
    let query = supabaseAdmin
      .from('classes')
      .update(updateData)
      .eq('id', classId)

    // Add department filter if provided
    if (department) {
      query = query.eq('department', department)
    }

    let result = await query.select()

    // If we get a schema error about missing columns, retry without them
    if (result.error) {
      const errorMsg = result.error.message.toLowerCase()
      
      if (errorMsg.includes('class_username') || errorMsg.includes('class_password')) {
        console.log('⚠️ Class login columns not found. Run migration: migrations/008_class_login_credentials.sql')
        console.log('⚠️ Retrying update without class login fields...')
        
        // Remove class login fields and retry
        delete updateData.class_username
        delete updateData.class_password
        
        query = supabaseAdmin
          .from('classes')
          .update(updateData)
          .eq('id', classId)
        
        if (department) {
          query = query.eq('department', department)
        }
        
        result = await query.select()
      }
    }

    const { data, error } = result

    if (error) {
      console.error('❌ Error updating class:', error)
      console.error('Full error details:', error)
      return NextResponse.json(
        { 
          error: error.message,
          hint: error.message.includes('class_username') || error.message.includes('class_password')
            ? 'Database migration required. Run: migrations/008_class_login_credentials.sql'
            : undefined
        },
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
