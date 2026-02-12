'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Download, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
}

interface ODRequest {
  id: string;
  od_start_date: string;
  od_end_date: string;
  reason: string;
  status: string;
  teacher_approved: boolean;
  admin_approved: boolean;
  student_id: string;
  students?: { name: string; email: string; student_id: string };
  classes?: { class_name: string };
  duration_days?: number;
}

export default function AdminODApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pendingODRequests, setPendingODRequests] = useState<ODRequest[]>([]);
  const [approvedODRequests, setApprovedODRequests] = useState<ODRequest[]>([]);
  const [rejectedODRequests, setRejectedODRequests] = useState<ODRequest[]>([]);
  const [oldODRequests, setOldODRequests] = useState<ODRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    // Check authentication
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      router.replace('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'admin') {
      router.replace('/login');
      return;
    }

    setUser(parsedUser);
    fetchODRequests(parsedUser.id);
  }, []);

  const fetchODRequests = async (adminId: string) => {
    try {
      setLoading(true);

      // Fetch all pending OD requests
      const { data: allPendingData } = await supabase
        .from('od_requests')
        .select(
          `
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          student_id,
          created_at,
          students:student_id (name, email, student_id),
          classes (class_name)
        `
        )
        .eq('admin_id', adminId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Separate old requests (>30 days) from current pending
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const currentPending: any[] = [];
      const oldRequests: any[] = [];
      
      (allPendingData || []).forEach(req => {
        const createdDate = new Date(req.created_at);
        if (createdDate < thirtyDaysAgo) {
          oldRequests.push(req);
        } else {
          currentPending.push(req);
        }
      });

      // Auto-reject old requests (>30 days)
      if (oldRequests.length > 0) {
        for (const oldReq of oldRequests) {
          await supabase
            .from('od_requests')
            .update({ status: 'rejected', admin_approved: false })
            .eq('id', oldReq.id);
        }
      }

      // Calculate duration for pending requests
      const pendingWithDuration = currentPending.map((req: any) => ({
        ...req,
        duration_days: req.od_start_date && req.od_end_date
          ? Math.ceil((new Date(req.od_end_date).getTime() - new Date(req.od_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 0,
      }));

      // Calculate duration for old requests
      const oldWithDuration = oldRequests.map((req: any) => ({
        ...req,
        duration_days: req.od_start_date && req.od_end_date
          ? Math.ceil((new Date(req.od_end_date).getTime() - new Date(req.od_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 0,
      }));

      // Fetch approved OD requests
      const { data: approvedData } = await supabase
        .from('od_requests')
        .select(
          `
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          student_id,
          students:student_id (name, email, student_id),
          classes (class_name)
        `
        )
        .eq('admin_id', adminId)
        .eq('status', 'approved')
        .order('admin_approved_at', { ascending: false })
        .limit(50);

      // Calculate duration for approved requests
      const approvedWithDuration = (approvedData || []).map((req: any) => ({
        ...req,
        duration_days: req.od_start_date && req.od_end_date
          ? Math.ceil((new Date(req.od_end_date).getTime() - new Date(req.od_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 0,
      }));

      // Fetch rejected OD requests
      const { data: rejectedData } = await supabase
        .from('od_requests')
        .select(
          `
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          student_id,
          students:student_id (name, email, student_id),
          classes (class_name)
        `
        )
        .eq('admin_id', adminId)
        .eq('status', 'rejected')
        .order('admin_approved_at', { ascending: false })
        .limit(50);

      // Calculate duration for rejected requests
      const rejectedWithDuration = (rejectedData || []).map((req: any) => ({
        ...req,
        duration_days: req.od_start_date && req.od_end_date
          ? Math.ceil((new Date(req.od_end_date).getTime() - new Date(req.od_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 0,
      }));

      setPendingODRequests(pendingWithDuration || []);
      setOldODRequests(oldWithDuration || []);
      setApprovedODRequests(approvedWithDuration || []);
      setRejectedODRequests(rejectedWithDuration || []);
    } catch (error) {
      console.error('Error fetching OD requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOD = async (requestId: string, approved: boolean) => {
    try {
      setActionLoading(requestId);
      const response = await fetch('/api/admin/approve-od', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odRequestId: requestId,
          adminId: user?.id,
          approved,
          approvalNotes: '',
        }),
      });

      if (response.ok) {
        // Refresh OD requests
        await fetchODRequests(user?.id!);
      } else {
        alert('Failed to process OD request');
      }
    } catch (error) {
      console.error('Error processing OD request:', error);
      alert('An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk approve selected requests
  const handleBulkApprove = async (approved: boolean) => {
    if (selectedRequests.size === 0) {
      alert('Please select at least one request');
      return;
    }

    if (!confirm(`Are you sure you want to ${approved ? 'approve' : 'reject'} ${selectedRequests.size} request(s)?`)) {
      return;
    }

    setBulkLoading(true);
    try {
      for (const requestId of selectedRequests) {
        await fetch('/api/admin/approve-od', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            odRequestId: requestId,
            adminId: user?.id,
            approved,
            approvalNotes: '',
          }),
        });
      }
      
      setSelectedRequests(new Set());
      await fetchODRequests(user?.id!);
    } catch (error) {
      console.error('Error in bulk operation:', error);
      alert('An error occurred during bulk operation');
    } finally {
      setBulkLoading(false);
    }
  };

  // Toggle request selection
  const toggleRequestSelection = (requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const allRequests = [
        ...pendingODRequests.map(r => ({ ...r, type: 'Pending' })),
        ...approvedODRequests.map(r => ({ ...r, type: 'Approved' })),
        ...rejectedODRequests.map(r => ({ ...r, type: 'Rejected' })),
      ];

      if (allRequests.length === 0) {
        alert('No OD requests to export');
        return;
      }

      // Create CSV content
      const headers = ['Type', 'Student Name', 'Email', 'Class', 'Start Date', 'End Date', 'Duration (Days)', 'Reason', 'Status'];
      const csvContent = [
        headers.join(','),
        ...allRequests.map(req =>
          [
            req.type,
            req.students?.name || 'N/A',
            req.students?.email || 'N/A',
            req.classes?.class_name || 'N/A',
            new Date(req.od_start_date).toLocaleDateString('en-US'),
            new Date(req.od_end_date).toLocaleDateString('en-US'),
            req.duration_days || 0,
            `"${(req.reason || '').replace(/"/g, '""')}"`, // Escape quotes in reason
            req.status,
          ].join(',')
        ),
      ].join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OD_Records_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export records');
    }
  };

  // Don't render anything until user is verified
  if (!user) {
    return null;
  }

  const ODRequestCard = ({ request, isPending = false }: { request: ODRequest, isPending?: boolean }) => {
    const student = request.students;
    const isSelected = selectedRequests.has(request.id);

    return (
    <div className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition ${isSelected ? 'bg-blue-50 border-blue-300' : ''}`}>
      <div className="flex justify-between items-start gap-4 mb-3">
        {isPending && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleRequestSelection(request.id)}
            className="w-4 h-4 mt-1 cursor-pointer"
          />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-sm sm:text-base">{student?.name || 'Student'}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">{student?.email || 'N/A'}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            📅 {new Date(request.od_start_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            {request.od_end_date !== request.od_start_date && (
              <> to {new Date(request.od_end_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}</>
            )}
          </p>
          {request.duration_days && (
            <p className="text-xs sm:text-sm text-blue-600 font-medium">
              Duration: {request.duration_days} day{request.duration_days > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs font-medium mb-2">
            Teacher: {request.teacher_approved ? '✓' : '⏳'}
          </div>
          <div className="text-xs font-medium">
            Admin: {request.admin_approved ? '✓' : '⏳'}
          </div>
        </div>
      </div>
      <p className="text-xs sm:text-sm text-gray-700 mb-3 bg-gray-50 p-2 rounded">
        <strong>Reason:</strong> {request.reason}
      </p>
      {request.status === 'pending' && (
        <div className="flex gap-2">
          <Button
            onClick={() => handleApproveOD(request.id, true)}
            disabled={actionLoading === request.id}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
          >
            {actionLoading === request.id ? 'Processing...' : '✓ Approve'}
          </Button>
          <Button
            onClick={() => handleApproveOD(request.id, false)}
            disabled={actionLoading === request.id}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm"
          >
            {actionLoading === request.id ? 'Processing...' : '✕ Reject'}
          </Button>
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav userName={user?.name} userEmail={user?.email} userRole={user?.role} />

      <main className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="px-2 sm:px-0">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">OD Approval Requests</h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Review and approve On Duty requests from students
              </p>
            </div>
            <Button onClick={exportToExcel} variant="outline" className="text-sm">
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Loading OD requests...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pending OD Requests */}
            {pendingODRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    ⏳ Pending Approvals
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      {pendingODRequests.length}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    OD requests waiting for your approval
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedRequests.size > 0 && (
                    <div className="flex gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-sm font-medium text-blue-900 flex-1">
                        {selectedRequests.size} request(s) selected
                      </span>
                      <Button
                        onClick={() => handleBulkApprove(true)}
                        disabled={bulkLoading}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                      >
                        {bulkLoading ? 'Processing...' : '✓ Approve All'}
                      </Button>
                      <Button
                        onClick={() => handleBulkApprove(false)}
                        disabled={bulkLoading}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs"
                      >
                        {bulkLoading ? 'Processing...' : '✕ Reject All'}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-4">
                    {pendingODRequests.map((request) => (
                      <ODRequestCard key={request.id} request={request} isPending={true} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approved OD Requests */}
            {approvedODRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Approved
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      {approvedODRequests.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {approvedODRequests.map((request) => (
                      <div key={request.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base">{request.students?.[0]?.name}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">{request.students?.[0]?.email}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                              📅 {new Date(request.od_start_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                              {request.od_end_date !== request.od_start_date && (
                                <> to {new Date(request.od_end_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}</>
                              )}
                            </p>
                            {request.duration_days && (
                              <p className="text-xs sm:text-sm text-blue-600 font-medium">
                                Duration: {request.duration_days} day{request.duration_days > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <span className="text-green-600 font-semibold">✓ Approved</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rejected OD Requests */}
            {rejectedODRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <XCircle className="h-5 w-5 text-red-600" />
                    Rejected
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                      {rejectedODRequests.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {rejectedODRequests.map((request) => (
                      <div key={request.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base">{request.students?.[0]?.name}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">{request.students?.[0]?.email}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                              📅 {new Date(request.od_start_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                              {request.od_end_date !== request.od_start_date && (
                                <> to {new Date(request.od_end_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}</>
                              )}
                            </p>
                            {request.duration_days && (
                              <p className="text-xs sm:text-sm text-blue-600 font-medium">
                                Duration: {request.duration_days} day{request.duration_days > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <span className="text-red-600 font-semibold">✕ Rejected</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Auto-Rejected Old OD Requests */}
            {oldODRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Clock className="h-5 w-5 text-orange-600" />
                    Auto-Rejected (Older than 30 days)
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                      {oldODRequests.length}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Requests that were automatically rejected due to exceeding the 30-day validity period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {oldODRequests.map((request) => (
                      <div key={request.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base">{request.students?.name || 'Student'}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">{request.students?.email || 'N/A'}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                              📅 {new Date(request.od_start_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                              {request.od_end_date !== request.od_start_date && (
                                <> to {new Date(request.od_end_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}</>
                              )}
                            </p>
                            {request.duration_days && (
                              <p className="text-xs sm:text-sm text-blue-600 font-medium">
                                Duration: {request.duration_days} day{request.duration_days > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <span className="text-orange-600 font-semibold">⏱ Auto-Rejected</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {pendingODRequests.length === 0 && approvedODRequests.length === 0 && rejectedODRequests.length === 0 && oldODRequests.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No OD requests found for you</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
