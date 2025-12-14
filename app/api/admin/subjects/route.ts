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

    if (!adminId || !department) {
      return NextResponse.json(
        { error: 'adminId and department are required' },
        { status: 400 }
      );
    }

    console.log('📚 GET /api/admin/subjects', { adminId, department });

    // Fetch subjects for admin's department
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .select('*')
      .eq('department', department)
      .order('subject_name', { ascending: true });

    if (error) {
      console.error('❌ Error fetching subjects:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Fetched subjects:', data?.length);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new subject
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject_code, subject_name, department, adminId, credits, semester } = body;

    if (!subject_code || !subject_name || !department || !adminId) {
      return NextResponse.json(
        { error: 'subject_code, subject_name, department, and adminId are required' },
        { status: 400 }
      );
    }

    console.log('📝 POST /api/admin/subjects', { subject_code, subject_name, department });

    // Insert subject with department
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .insert({
        subject_code: subject_code.trim(),
        subject_name: subject_name.trim(),
        department: department,
        credits: credits || null,
        semester: semester || null,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating subject:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    if (!id || !subject_code || !subject_name || !department || !adminId) {
      return NextResponse.json(
        { error: 'id, subject_code, subject_name, department, and adminId are required' },
        { status: 400 }
      );
    }

    console.log('✏️ PUT /api/admin/subjects', { id, subject_code, subject_name, department });

    // Update only if subject belongs to admin's department
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .update({
        subject_code: subject_code.trim(),
        subject_name: subject_name.trim(),
        credits: credits || null,
        semester: semester || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('department', department)
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

    if (!id || !department || !adminId) {
      return NextResponse.json(
        { error: 'id, department, and adminId are required' },
        { status: 400 }
      );
    }

    console.log('🗑️ DELETE /api/admin/subjects', { id, department });

    // Delete only if subject belongs to admin's department
    const { error } = await supabaseAdmin
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('department', department);

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
