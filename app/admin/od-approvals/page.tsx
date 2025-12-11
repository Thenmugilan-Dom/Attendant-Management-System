'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';
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
  students?: { name: string; email: string }[];
  classes?: { class_name: string }[];
  duration_days?: number;
}

export default function AdminODApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pendingODRequests, setPendingODRequests] = useState<ODRequest[]>([]);
  const [approvedODRequests, setApprovedODRequests] = useState<ODRequest[]>([]);
  const [rejectedODRequests, setRejectedODRequests] = useState<ODRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    const userData = localStorage.getItem('user');
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

      // Fetch pending OD requests
      const { data: pendingData } = await supabase
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
          students (name, email),
          classes (class_name)
        `
        )
        .eq('admin_id', adminId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      // Calculate duration for pending requests
      const pendingWithDuration = (pendingData || []).map((req: any) => ({
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
          students (name, email),
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
          students (name, email),
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

  const ODRequestCard = ({ request }: { request: ODRequest }) => {
    const student = request.students?.[0];

    return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm sm:text-base">{student?.name}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">{student?.email}</p>
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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">OD Approval Requests</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Review and approve On Duty requests from students
          </p>
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
                <CardContent>
                  <div className="space-y-4">
                    {pendingODRequests.map((request) => (
                      <ODRequestCard key={request.id} request={request} />
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

            {pendingODRequests.length === 0 && approvedODRequests.length === 0 && rejectedODRequests.length === 0 && (
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
