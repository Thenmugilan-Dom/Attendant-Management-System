"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  // Validate email domain
  const isValidEmail = (email: string): boolean => {
    const emailLower = email.toLowerCase()
    return emailLower.endsWith("@kprcas.ac.in") || emailLower.endsWith("@gmail.com")
  }

  // Handle Admin/Teacher login with email and password
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!email || !password) {
      setError("Please enter email and password")
      return
    }

    if (!isValidEmail(email)) {
      setError("Only @kprcas.ac.in and @gmail.com emails are allowed")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Invalid credentials")
      }

      // Store user data and token in sessionStorage (per-tab isolation)
      sessionStorage.setItem("user", JSON.stringify(data.user))
      sessionStorage.setItem("token", data.token)

      setMessage("Login successful! Redirecting...")

      // Redirect based on user role
      setTimeout(() => {
        if (data.user.role === "admin") {
          router.push("/admin")
        } else if (data.user.role === "teacher") {
          router.push("/teacher")
        } else {
          setError("Invalid user type")
        }
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Admin & Teacher Login
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Admin/Teacher Login Form */}
          <form onSubmit={handleStaffLogin}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@kprcas.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>

              {error && (
                <div className="text-sm text-red-500 text-center">{error}</div>
              )}
              {message && (
                <div className="text-sm text-green-500 text-center">{message}</div>
              )}

              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center text-xs text-muted-foreground">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  )
}
