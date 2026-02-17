import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')

    if (!classId) {
      return NextResponse.json(
        { error: 'classId is required' },
        { status: 400 }
      )
    }

    console.log('📋 Fetching active sessions for class:', classId)

    // Fetch active sessions for this class
    const { data: sessions, error } = await supabase
      .from('attendance_sessions')
      .select(`
        id,
        session_code,
        session_date,
        session_time,
        expires_at,
        status,
        subjects (
          subject_code,
          subject_name
        )
      `)
      .eq('class_id', classId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching sessions:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${sessions?.length || 0} active sessions`)

    return NextResponse.json({
      success: true,
      sessions: sessions || []
    })
  } catch (error) {
    console.error('❌ Active sessions API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
