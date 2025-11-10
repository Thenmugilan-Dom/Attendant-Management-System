"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) return router.replace("/login")
    const parsed = JSON.parse(userData)
    if (parsed.role !== "admin") return router.replace("/login")
    setUser(parsed)
  }, [router])

  if (!user) return null

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav userName={user.name} userEmail={user.email} userRole={user.role} />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Attendance Reports</h2>
            <p className="text-muted-foreground">Generate and download attendance reports</p>
          </div>
          <div>
            <Button onClick={() => router.push('/admin')}>Back to Dashboard</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Reports</CardTitle>
            <CardDescription>Select the report type and date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={() => alert('Daily reports will be added soon')} className="w-full">Daily Report</Button>
              <Button onClick={() => alert('Monthly reports will be added soon')} className="w-full">Monthly Report</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
