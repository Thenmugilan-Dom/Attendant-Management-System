import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// GET - Fetch subjects for admin's department
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('adminId');
    const department = searchParams.get('department');

    console.log('📚 GET /api/admin/subjects', { adminId, department });

    // Fetch subjects - skip department filter if it doesn't exist yet
    let query = supabaseAdmin
      .from('subjects')
      .select('*')
      .order('subject_name', { ascending: true });

    // Only filter by department if provided
    // Try filtering, but fall back to no filter if it fails
    if (department) {
      try {
        query = query.eq('department', department);
      } catch (e) {
        console.log('⚠️ Department filter failed, returning all subjects');
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('⚠️ Error fetching subjects:', error.message);
      // Return empty array instead of error for graceful degradation
      return NextResponse.json([], { status: 200 });
    }

    console.log('✅ Fetched subjects:', data?.length);
    return NextResponse.json(data || [], { 
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    // Return empty array on error to prevent frontend crashes
    return NextResponse.json([], { status: 200 });
  }
}

// POST - Create new subject
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject_code, subject_name, department, adminId, credits, semester } = body;

    if (!subject_code || !subject_name || !adminId) {
      return NextResponse.json(
        { error: 'subject_code, subject_name, and adminId are required' },
        { status: 400 }
      );
    }

    console.log('📝 POST /api/admin/subjects', { subject_code, subject_name, department });

    // Insert subject (department is optional for now)
    const insertData: any = {
      subject_code: subject_code.trim(),
      subject_name: subject_name.trim(),
      credits: credits || null,
      semester: semester || null,
    };

    // Add department if provided
    if (department) {
      insertData.department = department;
    }

    let result = await supabaseAdmin
      .from('subjects')
      .insert(insertData)
      .select()
      .single();

    // If department column error, retry without it
    if (result.error && result.error.message.includes('department')) {
      console.log('⚠️ Department column not found, retrying without it');
      delete insertData.department;
      result = await supabaseAdmin
        .from('subjects')
        .insert(insertData)
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) {
      console.error('❌ Error creating subject:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('✅ Created subject:', data?.id);
    return NextResponse.json({
      success: true,
      message: 'Subject created successfully',
      subject: data,
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update subject
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, subject_code, subject_name, department, adminId, credits, semester } = body;

    if (!id || !subject_code || !subject_name || !adminId) {
      return NextResponse.json(
        { error: 'id, subject_code, subject_name, and adminId are required' },
        { status: 400 }
      );
    }

    console.log('✏️ PUT /api/admin/subjects', { id, subject_code, subject_name, department });

    // Update subject
    let query = supabaseAdmin
      .from('subjects')
      .update({
        subject_code: subject_code.trim(),
        subject_name: subject_name.trim(),
        credits: credits || null,
        semester: semester || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Add department filter if provided
    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating subject:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Updated subject:', id);
    return NextResponse.json({
      success: true,
      message: 'Subject updated successfully',
      subject: data,
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete subject
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, department, adminId } = body;

    if (!id || !adminId) {
      return NextResponse.json(
        { error: 'id and adminId are required' },
        { status: 400 }
      );
    }

    console.log('🗑️ DELETE /api/admin/subjects', { id, department });

    // Delete subject
    let query = supabaseAdmin
      .from('subjects')
      .delete()
      .eq('id', id);

    // Add department filter if provided
    if (department) {
      query = query.eq('department', department);
    }

    const { error } = await query;

    if (error) {
      console.error('❌ Error deleting subject:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Deleted subject:', id);
    return NextResponse.json({
      success: true,
      message: 'Subject deleted successfully',
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
