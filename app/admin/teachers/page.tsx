"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Users, Mail, Building } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  role: string
  name?: string
}

interface Teacher {
  id: string
  email: string
  name: string
  department?: string
  created_at: string
}

export default function TeachersPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    // Check authentication
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.replace("/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== "admin") {
      router.replace("/login")
      return
    }

    setUser(parsedUser)
    fetchTeachers()
  }, [router])

  useEffect(() => {
    // Filter teachers based on search term
    if (searchTerm.trim() === "") {
      setFilteredTeachers(teachers)
    } else {
      const filtered = teachers.filter(teacher =>
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (teacher.department && teacher.department.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredTeachers(filtered)
    }
  }, [searchTerm, teachers])

  const fetchTeachers = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("role", "teacher")
        .order("name", { ascending: true })

      if (error) {
        console.error("Error fetching teachers:", error)
        return
      }

      console.log("📚 Fetched teachers:", data)
      setTeachers(data || [])
      setFilteredTeachers(data || [])
    } catch (error) {
      console.error("Error fetching teachers:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav userName={user.name} userEmail={user.email} userRole={user.role} />
      
      <main className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push("/admin")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">All Teachers</h2>
              <p className="text-muted-foreground">
                Manage and view all registered teachers
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Teachers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Teachers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teachers ({filteredTeachers.length})
            </CardTitle>
            <CardDescription>
              {searchTerm ? `Showing results for "${searchTerm}"` : "All registered teachers in the system"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading teachers...</div>
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No teachers found matching your search." : "No teachers found."}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTeachers.map((teacher) => (
                  <div key={teacher.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{teacher.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {teacher.email}
                          </div>
                          {teacher.department && (
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {teacher.department}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Joined: {new Date(teacher.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
