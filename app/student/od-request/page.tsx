'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface Admin {
  id: string;
  name: string;
  email: string;
}

interface ODRequest {
  id: string;
  od_date: string;
  reason: string;
  status: string;
  teacher_approved: boolean;
  admin_approved: boolean;
  subjects?: { subject_name: string }[];
}

export default function ODRequestPage() {
  const [studentId, setStudentId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [teachersInClass, setTeachersInClass] = useState<Teacher[]>([]);
  const [adminsForTeacher, setAdminsForTeacher] = useState<Admin[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [odDate, setOdDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [odRequests, setOdRequests] = useState<ODRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  // Initialize student data and fetch teachers from their class
  useEffect(() => {
    const initializeData = async () => {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/login');
        return;
      }

      try {
        const user = JSON.parse(userStr);
        const studentId = user.id;
        setStudentId(studentId);

        // Fetch student class
        const { data: studentData } = await supabase
          .from('students')
          .select('id, class_id')
          .eq('id', studentId)
          .limit(1);

        if (studentData && studentData.length > 0) {
          const classId = studentData[0].class_id;
          setClassId(classId);

          // Fetch teachers who teach this class
          const { data: teacherSubjectsData } = await supabase
            .from('teacher_subjects')
            .select(`
              teacher_id,
              users:teacher_id (id, name, email)
            `)
            .eq('class_id', classId);

          // Extract unique teachers
          const uniqueTeachers: { [key: string]: Teacher } = {};
          (teacherSubjectsData || []).forEach((ts: any) => {
            if (ts.users) {
              uniqueTeachers[ts.teacher_id] = ts.users;
            }
          });

          setTeachersInClass(Object.values(uniqueTeachers));
        }

        // Fetch existing OD requests for this student
        const { data: odRequestsData } = await supabase
          .from('od_requests')
          .select(
            `
            id,
            od_date,
            reason,
            status,
            teacher_approved,
            admin_approved,
            subjects (subject_name)
          `
          )
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(50);

        setOdRequests((odRequestsData || []).map(req => ({
          ...req,
          subjects: Array.isArray(req.subjects) ? req.subjects : [req.subjects].filter(Boolean)
        })));
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();
  }, [router]);

  // Fetch admins when teacher is selected
  useEffect(() => {
    const fetchAdminsForTeacher = async () => {
      if (!selectedTeacherId) {
        setAdminsForTeacher([]);
        return;
      }

      try {
        // Get all admins (since we don't have explicit admin-teacher mapping,
        // we'll show all admins and the system will link based on class)
        const { data: adminsData } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('user_type', 'admin')
          .limit(100);

        setAdminsForTeacher(adminsData || []);
      } catch (error) {
        console.error('Error fetching admins:', error);
      }
    };

    fetchAdminsForTeacher();
  }, [selectedTeacherId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!studentId || !classId || !odDate || !reason || !selectedTeacherId || !selectedAdminId) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        setLoading(false);
        return;
      }

      // If no subject selected, use first available subject for the class
      let subjectToUse = subjectId;
      if (!subjectToUse) {
        const { data: subjects } = await supabase
          .from('teacher_subjects')
          .select('subject_id')
          .eq('class_id', classId)
          .limit(1);

        if (subjects && subjects.length > 0) {
          subjectToUse = subjects[0].subject_id;
        } else {
          setMessage({ type: 'error', text: 'No subjects found for your class' });
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/student/submit-od-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          classId,
          subjectId: subjectToUse,
          teacherId: selectedTeacherId,
          adminId: selectedAdminId,
          odDate,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to submit request' });
        setLoading(false);
        return;
      }

      setMessage({ type: 'success', text: 'OD request submitted successfully! ✓' });

      // Reset form
      setOdDate('');
      setReason('');
      setSelectedTeacherId('');
      setSelectedAdminId('');

      // Refresh OD requests
      const { data: odRequestsData } = await supabase
        .from('od_requests')
        .select(
          `
          id,
          od_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          subjects (subject_name)
        `
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50);

      setOdRequests((odRequestsData || []).map(req => ({
        ...req,
        subjects: Array.isArray(req.subjects) ? req.subjects : [req.subjects].filter(Boolean)
      })));
    } catch (error) {
      console.error('Error submitting OD request:', error);
      setMessage({ type: 'error', text: 'An error occurred while submitting the request' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (request: ODRequest) => {
    if (request.status === 'approved') {
      return (
        <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
          ✓ Approved
        </span>
      );
    } else if (request.status === 'rejected') {
      return (
        <span className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
          ✕ Rejected
        </span>
      );
    } else {
      return (
        <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          ⏳ Pending
        </span>
      );
    }
  };

  const getApprovalStatus = (request: ODRequest) => {
    return (
      <div className="text-sm text-gray-600 mt-2">
        <div>Teacher: {request.teacher_approved ? '✓ Approved' : '⏳ Pending'}</div>
        <div>Admin: {request.admin_approved ? '✓ Approved' : '⏳ Pending'}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">On Duty (OD) Request</h1>

        {/* Form Card */}
        <Card className="mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Submit New OD Request</h2>

          {message && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OD Date */}
            <div>
              <Label htmlFor="od-date">OD Date *</Label>
              <Input
                id="od-date"
                type="date"
                value={odDate}
                onChange={(e) => setOdDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Teacher Selection */}
            <div>
              <Label htmlFor="teacher">Select Teacher for Approval *</Label>
              {teachersInClass.length > 0 ? (
                <select
                  id="teacher"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a teacher...</option>
                  {teachersInClass.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} ({teacher.email})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                  No teachers found for your class. Please contact admin.
                </div>
              )}
            </div>

            {/* Admin Selection */}
            <div>
              <Label htmlFor="admin">Select Admin for Approval *</Label>
              {selectedTeacherId ? (
                adminsForTeacher.length > 0 ? (
                  <select
                    id="admin"
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose an administrator...</option>
                    {adminsForTeacher.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name} ({admin.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                    No admins available for the selected teacher.
                  </div>
                )
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-sm text-blue-800">
                  Please select a teacher first to see available admins.
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="reason">Reason for OD *</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="Explain the reason for your On Duty request..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
            >
              {loading ? 'Submitting...' : 'Submit OD Request'}
            </Button>
          </form>
        </Card>

        {/* OD Requests History */}
        {odRequests.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Your OD Requests</h2>

            <div className="space-y-4">
              {odRequests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {new Date(request.od_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
                    </div>
                    {getStatusBadge(request)}
                  </div>
                  {getApprovalStatus(request)}
                </div>
              ))}
            </div>
          </Card>
        )}

        {odRequests.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-gray-600">No OD requests yet. Submit one above to get started!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
