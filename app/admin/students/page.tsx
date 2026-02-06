"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, GraduationCap, Mail, Book } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  role: string
  name?: string
}

interface Student {
  id: string
  email: string
  name: string
  class_name?: string
  section?: string
  created_at: string
}

export default function StudentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    // Check authentication
    const userData = sessionStorage.getItem("user")
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
    fetchStudents()
  }, [router])

  useEffect(() => {
    // Filter students based on search term
    if (searchTerm.trim() === "") {
      setFilteredStudents(students)
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.class_name && student.class_name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredStudents(filtered)
    }
  }, [searchTerm, students])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      
      // Fetch students from the students table (same as admin manage panel)
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          *,
          classes (
            class_name
          )
        `)
        .order("name", { ascending: true })

      if (studentsError) {
        console.error("Error fetching students:", studentsError)
      } else {
        console.log("👥 Fetched students from students table:", studentsData?.length || 0, "students")
        console.log("📋 Sample students:", studentsData?.slice(0, 3))
        
        // Transform the data to match expected format
        const formattedStudents = (studentsData || []).map(student => ({
          id: student.student_id,
          email: student.email,
          name: student.name,
          class_name: student.classes?.class_name,
          section: student.section,
          created_at: student.created_at
        }))

        setStudents(formattedStudents)
        setFilteredStudents(formattedStudents)
      }
    } catch (error) {
      console.error("Error fetching students:", error)
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
              <h2 className="text-3xl font-bold tracking-tight">All Students</h2>
              <p className="text-muted-foreground">
                Manage and view all registered students
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Students ({filteredStudents.length})
            </CardTitle>
            <CardDescription>
              {searchTerm ? `Showing results for "${searchTerm}"` : "All registered students in the system"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading students...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No students found matching your search." : "No students found."}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{student.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {student.email}
                          </div>
                          {student.class_name && (
                            <div className="flex items-center gap-1">
                              <Book className="h-3 w-3" />
                              {student.class_name} {student.section}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Joined: {new Date(student.created_at).toLocaleDateString()}
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
