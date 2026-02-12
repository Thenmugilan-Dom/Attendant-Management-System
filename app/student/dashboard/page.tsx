'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, XCircle, Clock, Calendar, X, Download, 
  Bell, BellRing, Filter, TrendingUp, BookOpen, 
  BarChart3, PieChart, FileText, RefreshCw, ChevronDown,
  AlertTriangle, Info, Award, Search
} from 'lucide-react';

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
      subject_code?: string;
    };
  };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  created_at: string;
  expires_at?: string;
}

interface SubjectBreakdown {
  subject_name: string;
  subject_code?: string;
  total: number;
  present: number;
  absent: number;
  onDuty: number;
  percentage: number;
}

interface MonthlyBreakdown {
  month: string;
  monthName: string;
  total: number;
  present: number;
  absent: number;
  onDuty: number;
  percentage: number;
}

type TabType = 'overview' | 'history' | 'subjects' | 'reports' | 'notifications';

export default function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [odRequests, setOdRequests] = useState<ODRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDaySessions, setSelectedDaySessions] = useState<AttendanceRecord[]>([]);
  
  // New enhanced states
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  
  // Filter states
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  
  // Report states
  const [subjectBreakdown, setSubjectBreakdown] = useState<SubjectBreakdown[]>([]);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthlyBreakdown[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Check if student email is in localStorage
    const studentEmail = localStorage.getItem('studentEmail');
    
    // If no email and it's the first load, try to restore from session
    if (!studentEmail) {
      const sessionStudent = sessionStorage.getItem('studentData');
      if (sessionStudent) {
        try {
          const parsedStudent = JSON.parse(sessionStudent);
          setStudent(parsedStudent);
          localStorage.setItem('studentEmail', parsedStudent.email);
          fetchStudentData(parsedStudent.email);
          return;
        } catch (err) {
          console.error('Error parsing session student:', err);
        }
      }
      
      // No student data found, redirect to login
      router.push('/student/od-request');
      return;
    }

    fetchStudentData(studentEmail);
  }, [router]);

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
        // Clear stored data if student not found
        localStorage.removeItem('studentEmail');
        sessionStorage.removeItem('studentData');
        router.push('/student/od-request');
        return;
      }

      const student = studentData[0];
      setStudent(student);
      
      // Store student data in session for persistence across page refreshes
      sessionStorage.setItem('studentData', JSON.stringify(student));

      // Fetch OD requests
      await fetchODRequests(student.id);

      // Fetch attendance records
      await fetchAttendanceRecords(student.id);
      
      // Fetch notifications
      await fetchNotifications(student.id, student.class_id);
      
      // Fetch report data
      await fetchReportData(student.id);
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
          created_at
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Fetch session details separately for each record
        const recordsWithSessions = await Promise.all(
          data.map(async (record: any) => {
            const { data: sessionData } = await supabase
              .from('attendance_sessions')
              .select(`
                session_date,
                classes (class_name),
                subjects (subject_name)
              `)
              .eq('id', record.session_id)
              .limit(1);

            return {
              ...record,
              attendance_sessions: sessionData?.[0] || null,
            };
          })
        );

        setAttendanceRecords(recordsWithSessions);
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  };

  // Fetch notifications for the student
  const fetchNotifications = useCallback(async (studentId: string, classId: string) => {
    try {
      const response = await fetch(`/api/student/notifications?studentId=${studentId}&classId=${classId}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  // Fetch report data with subject and monthly breakdowns
  const fetchReportData = useCallback(async (studentId: string) => {
    try {
      setReportLoading(true);
      const response = await fetch(`/api/student/reports?studentId=${studentId}`);
      if (response.ok) {
        const data = await response.json();
        setSubjectBreakdown(data.subjectBreakdown || []);
        setMonthlyBreakdown(data.monthlyBreakdown || []);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setReportLoading(false);
    }
  }, []);

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/student/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!student) return;
    try {
      await fetch('/api/student/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, markAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    if (!student) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchODRequests(student.id),
        fetchAttendanceRecords(student.id),
        fetchNotifications(student.id, student.class_id),
        fetchReportData(student.id),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Download report as CSV
  const downloadReport = async (format: 'csv' | 'json' = 'csv') => {
    if (!student) return;
    try {
      const response = await fetch(`/api/student/reports?studentId=${student.id}&format=${format}`);
      const data = await response.json();
      
      if (format === 'csv' && data.csv) {
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${student.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${student.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    }
  };

  // Get unique subjects from attendance records
  const getUniqueSubjects = () => {
    const subjects = new Set<string>();
    attendanceRecords.forEach(r => {
      const subjectName = r.attendance_sessions?.subjects?.subject_name;
      if (subjectName) subjects.add(subjectName);
    });
    return Array.from(subjects);
  };

  // Filter attendance records based on current filters
  const getFilteredAttendance = () => {
    return attendanceRecords.filter((r) => {
      // Month filter
      const recordDate = new Date(r.created_at).toISOString().substring(0, 7);
      if (recordDate !== selectedMonth) return false;
      
      // Subject filter
      if (selectedSubject !== 'all') {
        const subjectName = r.attendance_sessions?.subjects?.subject_name;
        if (subjectName !== selectedSubject) return false;
      }
      
      // Status filter
      if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
      
      // Date range filter
      if (dateRangeStart) {
        const recordDateStr = r.created_at.split('T')[0];
        if (recordDateStr < dateRangeStart) return false;
      }
      if (dateRangeEnd) {
        const recordDateStr = r.created_at.split('T')[0];
        if (recordDateStr > dateRangeEnd) return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const subjectName = r.attendance_sessions?.subjects?.subject_name?.toLowerCase() || '';
        const className = r.attendance_sessions?.classes?.class_name?.toLowerCase() || '';
        if (!subjectName.includes(query) && !className.includes(query)) return false;
      }
      
      return true;
    });
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'urgent': return <BellRing className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadODCertificate = async (request: ODRequest) => {
    // Create QR code data containing certificate information
    const certificateData = JSON.stringify({
      studentName: student?.name,
      studentId: student?.id,
      email: student?.email,
      odStartDate: request.od_start_date,
      odEndDate: request.od_end_date,
      reason: request.reason,
      status: 'APPROVED',
      issueDate: new Date().toISOString(),
    });

    // Dynamically import QR code library
    const QRCode = require('qrcode');
    let qrCodeDataUrl = '';
    
    try {
      qrCodeDataUrl = await QRCode.toDataURL(certificateData, { width: 200 });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }

    const startDate = new Date(request.od_start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const endDate = new Date(request.od_end_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const issueDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create enhanced HTML certificate
    const certificateHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OD Certificate</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .certificate {
            width: 900px;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            border: 3px solid #1e3a8a;
            border-radius: 10px;
            margin: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #1e3a8a;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            color: #1e3a8a;
            font-size: 32px;
            letter-spacing: 2px;
        }
        .header p {
            margin: 5px 0;
            color: #666;
            font-size: 14px;
        }
        .content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .details {
            gap: 20px;
        }
        .detail-row {
            margin-bottom: 15px;
        }
        .detail-label {
            font-weight: bold;
            color: #1e3a8a;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .detail-value {
            color: #333;
            font-size: 16px;
            margin-top: 5px;
            padding: 8px;
            background: #f9f9f9;
            border-left: 3px solid #1e3a8a;
            padding-left: 12px;
        }
        .qr-section {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 2px dashed #ddd;
            padding: 20px;
            border-radius: 8px;
        }
        .qr-section img {
            width: 200px;
            height: 200px;
            margin-bottom: 10px;
        }
        .qr-label {
            font-size: 12px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .footer {
            text-align: center;
            border-top: 3px solid #1e3a8a;
            padding-top: 20px;
            color: #666;
            font-size: 12px;
        }
        .approval-status {
            background: #d1fae5;
            border: 2px solid #10b981;
            color: #065f46;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 20px;
            font-weight: bold;
        }
        .reason-box {
            background: #f3f4f6;
            padding: 12px;
            border-radius: 6px;
            margin-top: 10px;
            border-left: 4px solid #1e3a8a;
        }
        @media print {
            body {
                background: white;
            }
            .certificate {
                box-shadow: none;
                margin: 0;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            <h1>ON DUTY (OD) CERTIFICATE</h1>
            <p>Official Certificate of Leave</p>
        </div>

        <div class="approval-status">
            ✓ APPROVED - Valid Certificate
        </div>

        <div class="content">
            <div class="details">
                <div class="detail-row">
                    <div class="detail-label">Student Name</div>
                    <div class="detail-value">${student?.name || 'N/A'}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Email Address</div>
                    <div class="detail-value">${student?.email || 'N/A'}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">OD Start Date</div>
                    <div class="detail-value">${startDate}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">OD End Date</div>
                    <div class="detail-value">${endDate}</div>
                </div>
                
                <div class="detail-row">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${request.duration_days} day${request.duration_days !== 1 ? 's' : ''}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Reason for OD</div>
                    <div class="reason-box">${request.reason || 'N/A'}</div>
                </div>
            </div>

            <div class="qr-section">
                ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="Certificate QR Code">` : '<p style="color: #ccc; margin: 0;">QR Code</p>'}
                <div class="qr-label">Scan for Verification</div>
            </div>
        </div>

        <div class="footer">
            <p style="margin: 5px 0;">Certificate Issue Date: <strong>${issueDate}</strong></p>
            <p style="margin: 5px 0;">This is an electronically generated certificate and is valid for all official purposes.</p>
            <p style="margin: 10px 0; font-style: italic; color: #999;">Document ID: OD-${request.id.substring(0, 8).toUpperCase()}</p>
        </div>
    </div>
</body>
</html>
    `;

    // Create blob and download HTML file
    const element = document.createElement('a');
    const file = new Blob([certificateHTML], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `OD_Certificate_${student?.name?.replace(/\s+/g, '_')}_${startDate.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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

  // Use the enhanced filter function
  const filteredAttendance = getFilteredAttendance();
  
  // Get unique subjects for filter dropdown
  const uniqueSubjects = getUniqueSubjects();

  // Calendar helper functions
  const getCalendarDays = () => {
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]) - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getAttendanceStatusForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const records = filteredAttendance.filter((r) => {
      const recordDate = r.created_at.split('T')[0];
      return recordDate === dateStr;
    });

    if (records.length === 0) return null;
    
    // Determine the status: if any on_duty, show on_duty; if any present, show present; otherwise absent
    if (records.some((r) => r.status === 'on_duty')) return 'on_duty';
    if (records.some((r) => r.status === 'present')) return 'present';
    return 'absent';
  };

  const getDayColor = (status: string | null) => {
    if (!status) return 'bg-gray-50';
    if (status === 'present') return 'bg-green-100 border-green-300';
    if (status === 'absent') return 'bg-red-100 border-red-300';
    if (status === 'on_duty') return 'bg-purple-100 border-purple-300';
    return 'bg-gray-50';
  };

  const handleDateClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const sessions = filteredAttendance.filter((r) => r.created_at.split('T')[0] === dateStr);
    setSelectedDate(date);
    setSelectedDaySessions(sessions);
  };

  const { daysInMonth, startingDayOfWeek } = getCalendarDays();

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
                      <div className="mt-4 space-y-3">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800 font-medium">
                            ✓ Your OD request has been approved! Attendance will be marked as "On Duty" for the
                            selected dates.
                          </p>
                        </div>
                        <Button
                          onClick={() => downloadODCertificate(request)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download OD Certificate
                        </Button>
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

            {/* Calendar View */}
            <div className="border rounded-lg p-6 bg-white">
              <h3 className="font-semibold text-lg mb-4">📅 Attendance Calendar</h3>
              <div className="grid grid-cols-7 gap-2">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center font-bold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
                {/* Empty cells for days before month starts */}
                {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square"></div>
                ))}
                {/* Calendar days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(selectedMonth + `-${day.toString().padStart(2, '0')}`);
                  const status = getAttendanceStatusForDate(date);
                  const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();

                  return (
                    <button
                      key={day}
                      onClick={() => handleDateClick(date)}
                      className={`aspect-square flex items-center justify-center rounded-lg border-2 font-semibold text-sm transition-all cursor-pointer ${
                        getDayColor(status)
                      } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''} hover:shadow-md`}
                    >
                      <span className="text-gray-700">{day}</span>
                    </button>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-100 border-2 border-green-300 rounded"></div>
                  <span className="text-sm text-gray-700">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-100 border-2 border-red-300 rounded"></div>
                  <span className="text-sm text-gray-700">Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-100 border-2 border-purple-300 rounded"></div>
                  <span className="text-sm text-gray-700">On Duty</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-50 border-2 border-gray-300 rounded"></div>
                  <span className="text-sm text-gray-700">No Session</span>
                </div>
              </div>
            </div>

            {/* Day Details Modal */}
            {selectedDate && selectedDaySessions.length > 0 && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>
                        {selectedDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </CardTitle>
                      <CardDescription>Period-wise Attendance</CardDescription>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDate(null);
                        setSelectedDaySessions([]);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedDaySessions.map((session, idx) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg border-l-4 ${
                          session.status === 'present'
                            ? 'bg-green-50 border-l-green-500'
                            : session.status === 'absent'
                            ? 'bg-red-50 border-l-red-500'
                            : 'bg-purple-50 border-l-purple-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">
                              Period {idx + 1}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {session.attendance_sessions?.classes?.class_name || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {session.attendance_sessions?.subjects?.subject_name || 'N/A'}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ml-2 ${
                              session.status === 'present'
                                ? 'bg-green-200 text-green-800'
                                : session.status === 'absent'
                                ? 'bg-red-200 text-red-800'
                                : 'bg-purple-200 text-purple-800'
                            }`}
                          >
                            {session.status === 'present'
                              ? '✓ Present'
                              : session.status === 'absent'
                              ? '✕ Absent'
                              : '🎖 On Duty'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Day Details when selected (no sessions) */}
            {selectedDate && selectedDaySessions.length === 0 && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>
                        {selectedDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </CardTitle>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDate(null);
                        setSelectedDaySessions([]);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-center">No sessions scheduled for this day.</p>
                  </CardContent>
                </Card>
              </div>
            )}

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
