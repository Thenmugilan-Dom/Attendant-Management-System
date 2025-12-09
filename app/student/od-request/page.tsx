'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check } from 'lucide-react';

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
  department?: string;
}

interface StudentData {
  id: string;
  name: string;
  email: string;
  class_id: string;
  department?: string;
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
  // Step 1: Email entry
  const [step, setStep] = useState<'email' | 'form'>('email');
  const [emailInput, setEmailInput] = useState<string>('');
  const [studentData, setStudentData] = useState<StudentData | null>(null);

  // Step 2: OD form
  const [classId, setClassId] = useState<string>('');
  const [teachersInClass, setTeachersInClass] = useState<Teacher[]>([]);
  const [adminsForDepartment, setAdminsForDepartment] = useState<Admin[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [odDate, setOdDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [odRequests, setOdRequests] = useState<ODRequest[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Step 1: Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!emailInput.trim()) {
        setMessage({ type: 'error', text: 'Please enter your email' });
        setLoading(false);
        return;
      }

      const emailLower = emailInput.toLowerCase().trim();

      // Validate email domain
      if (!emailLower.endsWith('@kprcas.ac.in') && !emailLower.endsWith('@gmail.com')) {
        setMessage({ type: 'error', text: 'Only @kprcas.ac.in and @gmail.com emails are allowed' });
        setLoading(false);
        return;
      }

      // Find student by email
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select(`
          id, 
          name, 
          email, 
          class_id,
          classes:class_id (id, class_name, section)
        `)
        .eq('email', emailLower)
        .limit(1);

      if (studentError || !students || students.length === 0) {
        setMessage({ type: 'error', text: 'Student not found. Please check your email.' });
        setLoading(false);
        return;
      }

      const student = students[0] as any;
      const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
      const department = classData?.class_name || 'Unknown';

      setStudentData({
        id: student.id,
        name: student.name,
        email: student.email,
        class_id: student.class_id,
        department: department,
      });

      setClassId(student.class_id);
      setMessage({ type: 'success', text: `Welcome ${student.name}! Loading OD form...` });

      // Fetch teachers for this class
      const { data: teacherSubjectsData } = await supabase
        .from('teacher_subjects')
        .select(`
          teacher_id,
          users:teacher_id (id, name, email)
        `)
        .eq('class_id', student.class_id);

      const uniqueTeachers: { [key: string]: Teacher } = {};
      (teacherSubjectsData || []).forEach((ts: any) => {
        if (ts.users) {
          uniqueTeachers[ts.teacher_id] = ts.users;
        }
      });

      setTeachersInClass(Object.values(uniqueTeachers));

      // Fetch all admins (show all available admins for the student to choose from)
      const { data: adminsData } = await supabase
        .from('users')
        .select('id, name, email, department')
        .eq('user_type', 'admin')
        .limit(100);

      setAdminsForDepartment(adminsData || []);

      // Fetch existing OD requests
      const { data: odRequestsData } = await supabase
        .from('od_requests')
        .select(`
          id,
          od_date,
          reason,
          status,
          teacher_approved,
          admin_approved
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setOdRequests((odRequestsData || []).map((req: any) => ({
        ...req,
        subjects: []
      })));

      // Move to form step after 1 second
      setTimeout(() => {
        setStep('form');
        setMessage(null);
      }, 1500);
    } catch (error) {
      console.error('Error during email submission:', error);
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle OD form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!studentData) {
        setMessage({ type: 'error', text: 'Student data not found. Please re-enter your email.' });
        setLoading(false);
        return;
      }

      if (!selectedTeacherId || !selectedAdminId || !odDate || !reason.trim()) {
        setMessage({ type: 'error', text: 'Please fill all required fields' });
        setLoading(false);
        return;
      }

      // Submit OD request
      const response = await fetch('/api/student/submit-od-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentData.id,
          class_id: classId,
          teacher_id: selectedTeacherId,
          admin_id: selectedAdminId,
          od_date: odDate,
          reason: reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit OD request');
      }

      setMessage({ type: 'success', text: 'OD request submitted successfully!' });

      // Reset form
      setOdDate('');
      setReason('');
      setSelectedTeacherId('');
      setSelectedAdminId('');

      // Refresh OD requests list
      const { data: updatedRequests } = await supabase
        .from('od_requests')
        .select(`
          id,
          od_date,
          reason,
          status,
          teacher_approved,
          admin_approved
        `)
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setOdRequests((updatedRequests || []).map((req: any) => ({
        ...req,
        subjects: []
      })));
    } catch (error) {
      console.error('Error submitting OD request:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to submit OD request',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setEmailInput('');
    setStudentData(null);
    setSelectedTeacherId('');
    setSelectedAdminId('');
    setOdDate('');
    setReason('');
    setMessage(null);
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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">On Duty (OD) Request</h1>

        {/* STEP 1: EMAIL ENTRY */}
        {step === 'email' && (
          <Card className="p-8 shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Enter Your Email</h2>

            {message && (
              <div
                className={`p-4 rounded-lg mb-6 flex items-start gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}
              >
                {message.type === 'success' ? (
                  <Check className="w-5 h-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@kprcas.ac.in or your.email@gmail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  className="mt-2"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter your KPRCAS email or Gmail address
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
              >
                {loading ? 'Verifying...' : 'Continue'}
              </Button>
            </form>
          </Card>
        )}

        {/* STEP 2: OD FORM */}
        {step === 'form' && studentData && (
          <>
            {/* Welcome Card */}
            <Card className="p-4 mb-6 bg-blue-50 border border-blue-200">
              <h3 className="font-semibold text-blue-900">
                Welcome, {studentData.name}
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                Department: <span className="font-medium">{studentData.department}</span>
              </p>
              <button
                onClick={handleBackToEmail}
                className="text-sm text-blue-600 hover:text-blue-800 underline mt-2"
              >
                Use different email
              </button>
            </Card>

            {/* OD Form Card */}
            <Card className="p-8 mb-8 shadow-lg">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Submit New OD Request</h2>

              {message && (
                <div
                  className={`p-4 rounded-lg mb-6 flex items-start gap-3 ${
                    message.type === 'success'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {message.type === 'success' ? (
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* OD Date */}
                <div>
                  <Label htmlFor="od-date">OD Date *</Label>
                  <Input
                    id="od-date"
                    type="date"
                    value={odDate}
                    onChange={(e) => setOdDate(e.target.value)}
                    required
                    disabled={loading}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-2"
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
                      disabled={loading}
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a teacher from your class...</option>
                      {teachersInClass.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} ({teacher.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 mt-2 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>No teachers found for your class. Please contact admin.</span>
                    </div>
                  )}
                </div>

                {/* Admin Selection - Show only if teacher selected */}
                <div>
                  <Label htmlFor="admin">
                    Select Admin for Final Approval *
                  </Label>
                  {selectedTeacherId ? (
                    adminsForDepartment.length > 0 ? (
                      <select
                        id="admin"
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Choose an admin for approval...</option>
                        {adminsForDepartment.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.name} ({admin.email})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-4 mt-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>No admins available at the moment. Please contact admin.</span>
                      </div>
                    )
                  ) : (
                    <div className="p-4 mt-2 bg-blue-50 border border-blue-300 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Please select a teacher first to see available admins.</span>
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
                    disabled={loading}
                    placeholder="Explain the reason for your On Duty request..."
                    className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32 resize-none"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
                >
                  {loading ? 'Submitting...' : 'Submit OD Request'}
                </Button>
              </form>
            </Card>

            {/* OD Requests History */}
            {odRequests.length > 0 && (
              <Card className="p-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Your OD Requests</h2>

                <div className="space-y-4">
                  {odRequests.map((request) => (
                    <div
                      key={request.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
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
              <Card className="p-8 text-center">
                <p className="text-gray-600">No OD requests yet. Submit one above to get started!</p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
