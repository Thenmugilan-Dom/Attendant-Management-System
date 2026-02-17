"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { GraduationCap, Lock, AlertCircle } from "lucide-react"

export default function ClassLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch('/api/auth/class-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // Store class info in localStorage
      localStorage.setItem('classSession', JSON.stringify({
        classId: data.class.id,
        className: data.class.className,
        section: data.class.section,
        year: data.class.year,
        department: data.class.department,
        classEmail: data.class.classEmail,
        username: data.class.username,
        subjects: data.subjects,
        loginTime: new Date().toISOString()
      }))

      // Redirect to student attendance page
      router.push('/class/attendance')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">Student Class Login</CardTitle>
            <CardDescription className="mt-2">
              Login with your class credentials to mark attendance
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Class Username</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="e.g., CS101-A"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
                <FieldDescription>
                  Ask your teacher for class login credentials
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Class Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter class password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Lock className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Login to Class
                    </>
                  )}
                </Button>
              </Field>
            </FieldGroup>

            <div className="pt-4 border-t">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Quick access for managing class attendance sessions
                </p>
                <div className="flex gap-2 justify-center text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="underline hover:text-primary"
                  >
                    Teacher/Admin Login
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => router.push('/students')}
                    className="underline hover:text-primary"
                  >
                    Student Attendance
                  </button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
