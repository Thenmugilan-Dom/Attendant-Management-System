'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface Student {
  id: string;
  name: string;
  email: string;
  class_id: string;
}

interface ODRequest {
  id: string;
  od_start_date: string;
  od_end_date: string;
  reason: string;
  status: string;
  teacher_approved: boolean;
  admin_approved: boolean;
  duration_days?: number;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'on_duty';
  created_at: string;
  attendance_sessions?: {
    session_date: string;
    classes?: {
      class_name: string;
    };
    subjects?: {
      subject_name: string;
    };
  };
}

export default function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [odRequests, setOdRequests] = useState<ODRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    const studentEmail = localStorage.getItem('studentEmail');
    if (!studentEmail) {
      router.push('/student/od-request');
      return;
    }

    fetchStudentData(studentEmail);
  }, []);

  const fetchStudentData = async (email: string) => {
    try {
      setLoading(true);

      // Fetch student info
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, email, class_id')
        .eq('email', email.toLowerCase())
        .limit(1);

      if (studentError || !studentData || studentData.length === 0) {
        router.push('/student/od-request');
        return;
      }

      const student = studentData[0];
      setStudent(student);

      // Fetch OD requests
      await fetchODRequests(student.id);

      // Fetch attendance records
      await fetchAttendanceRecords(student.id);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchODRequests = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('od_requests')
        .select(`
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const processedData = data.map((req: any) => ({
          ...req,
          duration_days:
            Math.ceil(
              (new Date(req.od_end_date).getTime() - new Date(req.od_start_date).getTime()) /
                (1000 * 60 * 60 * 24)
            ) + 1,
        }));
        setOdRequests(processedData);
      }
    } catch (error) {
      console.error('Error fetching OD requests:', error);
    }
  };

  const fetchAttendanceRecords = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          session_id,
          student_id,
          status,
          created_at,
          attendance_sessions:session_id (
            session_date,
            classes (class_name),
            subjects (subject_name)
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAttendanceRecords(data);
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  };

  const getStatusBadge = (request: ODRequest) => {
    if (request.status === 'approved') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          <CheckCircle className="h-4 w-4" />
          Approved
        </div>
      );
    } else if (request.status === 'rejected') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
          <XCircle className="h-4 w-4" />
          Rejected
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
          <Clock className="h-4 w-4" />
          Pending
        </div>
      );
    }
  };

  const getAttendanceStats = () => {
    const records = attendanceRecords.filter((r) => {
      const recordDate = new Date(r.created_at).toISOString().substring(0, 7);
      return recordDate === selectedMonth;
    });

    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const onDuty = records.filter((r) => r.status === 'on_duty').length;
    const total = records.length;

    return { present, absent, onDuty, total };
  };

  const attendanceStats = getAttendanceStats();
  const attendancePercentage =
    attendanceStats.total > 0
      ? Math.round(((attendanceStats.present + attendanceStats.onDuty) / attendanceStats.total) * 100)
      : 0;

  const filteredAttendance = attendanceRecords.filter((r) => {
    const recordDate = new Date(r.created_at).toISOString().substring(0, 7);
    return recordDate === selectedMonth;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
              Welcome, {student?.name}!
            </h1>
            <p className="text-gray-600 mt-1">Student Dashboard</p>
          </div>
          <Button
            onClick={() => router.push('/student/od-request')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            + New OD Request
          </Button>
        </div>

        {/* OD Requests Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">📋 Your On-Duty Requests</CardTitle>
            <CardDescription>Track your OD request approvals</CardDescription>
          </CardHeader>
          <CardContent>
            {odRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No OD requests yet.</p>
                <Button
                  onClick={() => router.push('/student/od-request')}
                  variant="outline"
                  className="mt-4"
                >
                  Submit Your First OD Request
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {odRequests.map((request) => (
                  <div
                    key={request.id}
                    className="border rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {new Date(request.od_start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {' to '}
                          {new Date(request.od_end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
                        <p className="text-xs text-blue-600 font-medium mt-2">
                          Duration: {request.duration_days} {request.duration_days === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                      <div className="text-right space-y-2">
                        {getStatusBadge(request)}
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>
                            Teacher:{' '}
                            <span
                              className={request.teacher_approved ? 'text-green-600 font-medium' : 'text-gray-600'}
                            >
                              {request.teacher_approved ? '✓ Approved' : '⏳ Pending'}
                            </span>
                          </p>
                          <p>
                            Admin:{' '}
                            <span
                              className={request.admin_approved ? 'text-green-600 font-medium' : 'text-gray-600'}
                            >
                              {request.admin_approved ? '✓ Approved' : '⏳ Pending'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Approval Status Details */}
                    {request.status === 'approved' && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">
                          ✓ Your OD request has been approved! Attendance will be marked as "On Duty" for the
                          selected dates.
                        </p>
                      </div>
                    )}
                    {request.status === 'rejected' && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 font-medium">
                          ✕ Your OD request was rejected. Please submit a new request if needed.
                        </p>
                      </div>
                    )}
                    {request.status === 'pending' && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 font-medium">
                          ⏳ Your request is pending approval from both teacher and admin.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">📊 Your Attendance</CardTitle>
            <CardDescription>Track your presence and absence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Month Selector */}
            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-700">Select Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Attendance Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-600">Total Sessions</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{attendanceStats.total}</p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-gray-600">Present</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{attendanceStats.present}</p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-gray-600">Absent</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{attendanceStats.absent}</p>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-gray-600">On Duty</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{attendanceStats.onDuty}</p>
              </div>
            </div>

            {/* Attendance Percentage */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-700 font-semibold">Overall Attendance</p>
                  <p className="text-sm text-gray-600 mt-1">Present + On Duty / Total Sessions</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-blue-600">{attendancePercentage}%</p>
                  <div className="w-48 h-2 bg-gray-300 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                      style={{ width: `${attendancePercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Attendance Table */}
            {filteredAttendance.length > 0 ? (
              <div>
                <h3 className="font-semibold text-lg mb-4">Attendance Details</h3>
                <div className="border rounded-lg overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Class</th>
                        <th className="p-3 text-left">Subject</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((record) => (
                        <tr key={record.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">
                            {new Date(record.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short',
                            })}
                          </td>
                          <td className="p-3">
                            {record.attendance_sessions?.classes?.class_name || 'N/A'}
                          </td>
                          <td className="p-3">
                            {record.attendance_sessions?.subjects?.subject_name || 'N/A'}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                record.status === 'present'
                                  ? 'bg-green-100 text-green-800'
                                  : record.status === 'absent'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {record.status === 'present'
                                ? '✓ Present'
                                : record.status === 'absent'
                                ? '✕ Absent'
                                : '🎖 On Duty'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No attendance records for the selected month.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
