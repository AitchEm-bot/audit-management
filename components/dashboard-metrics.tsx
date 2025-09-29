"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { createSupabaseQueries } from "@/lib/supabase/queries"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Calendar, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

interface TicketStats {
  total: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  critical: number
  high: number
  medium: number
  low: number
  overdue: number
  departments: { [key: string]: number }
  recentActivity: number
}

interface ChartData {
  name: string
  value: number
  color?: string
}

const PRIORITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
}

const STATUS_COLORS = {
  open: "#3b82f6",
  in_progress: "#8b5cf6",
  resolved: "#22c55e",
  closed: "#6b7280",
}

interface DashboardMetricsProps {
  initialStats?: TicketStats
}

export function DashboardMetrics({ initialStats }: DashboardMetricsProps) {
  const [stats, setStats] = useState<TicketStats>(
    initialStats || {
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      overdue: 0,
      departments: {},
      recentActivity: 0,
    }
  )
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Memoize queries instance with error handling
  const queries = useMemo(() => {
    try {
      const supabase = createClient()
      return createSupabaseQueries(supabase)
    } catch (error) {
      console.error("Failed to create Supabase client for dashboard:", error)
      return null
    }
  }, [])

  useEffect(() => {
    // Use server-side stats if they look complete, otherwise fetch client-side
    console.log("DashboardMetrics: Initial stats provided:", initialStats)

    if (initialStats && initialStats.total > 0 &&
        (initialStats.open + initialStats.in_progress + initialStats.resolved + initialStats.closed) > 0) {
      // Server-side stats look complete, use them
      console.log("Using complete server-side stats")
      setStats({
        ...initialStats,
        recentActivity: initialStats.recent_7_days || 0
      } as TicketStats)
      setLastRefresh(new Date())
    } else {
      // Server-side stats incomplete, try client-side fetch
      console.log("Server-side stats incomplete, fetching client-side")
      fetchStats()
    }
  }, [])

  const fetchStats = async (showLoading = true) => {
    if (showLoading) setLoading(true)

    try {
      // Check if queries is available (Supabase client creation succeeded)
      if (!queries) {
        console.warn("Supabase client not available, using initial stats")
        // Use initial stats or fallback to zeros, but don't stay in loading state
        setStats(initialStats || {
          total: 0,
          open: 0,
          in_progress: 0,
          resolved: 0,
          closed: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          overdue: 0,
          departments: {},
          recentActivity: 0,
        })
        return
      }

      // Use fallback-enabled dashboard stats
      console.log("fetchStats: About to call getDashboardStats")
      const { data, error } = await queries.getDashboardStats()
      console.log("fetchStats: getDashboardStats returned:", { data, error })

      if (error) {
        console.error("fetchStats: Error fetching stats:", error)
        // Use initial stats as fallback if available, otherwise use zeros
        console.warn("fetchStats: Using initial stats as fallback due to query error")
        setStats(initialStats || {
          total: 0,
          open: 0,
          in_progress: 0,
          resolved: 0,
          closed: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          overdue: 0,
          departments: {},
          recentActivity: 0,
        })
      } else if (data) {
        setStats({
          ...data,
          recentActivity: data.recent_7_days || 0 // Map recent_7_days to recentActivity
        } as TicketStats)
        setLastRefresh(new Date())
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
      // Ensure we don't stay in loading state
      setStats({
        total: 0,
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        overdue: 0,
        departments: {},
        recentActivity: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshStats = async () => {
    // For now, use page reload as a reliable refresh method
    // This ensures we get fresh server-side calculated stats
    setLoading(true)
    try {
      console.log("Refreshing dashboard stats...")

      // Instead of using the problematic client-side query,
      // we'll reload the page to get fresh server-side stats
      setTimeout(() => {
        window.location.reload()
      }, 500) // Small delay to show loading state

    } catch (error) {
      console.error("Error refreshing stats:", error)
      setLoading(false)
    }
  }

  const statusData: ChartData[] = [
    { name: "Open", value: stats.open, color: STATUS_COLORS.open },
    { name: "In Progress", value: stats.in_progress, color: STATUS_COLORS.in_progress },
    { name: "Resolved", value: stats.resolved, color: STATUS_COLORS.resolved },
    { name: "Closed", value: stats.closed, color: STATUS_COLORS.closed },
  ]

  const priorityData: ChartData[] = [
    { name: "Critical", value: stats.critical, color: PRIORITY_COLORS.critical },
    { name: "High", value: stats.high, color: PRIORITY_COLORS.high },
    { name: "Medium", value: stats.medium, color: PRIORITY_COLORS.medium },
    { name: "Low", value: stats.low, color: PRIORITY_COLORS.low },
  ]

  const departmentData: ChartData[] = Object.entries(stats.departments).map(([name, value]) => ({
    name,
    value,
  }))

  const completionRate = stats.total > 0 ? ((stats.resolved + stats.closed) / stats.total) * 100 : 0

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Refresh Button and Last Updated */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Last updated: {format(lastRefresh, "PPp")}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshStats}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Stats
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All audit tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tickets</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open + stats.in_progress}</div>
            <p className="text-xs text-muted-foreground">Open + In Progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Resolved + Closed</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      {(stats.overdue > 0 || stats.critical > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stats.overdue > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Overdue Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 mb-2">{stats.overdue}</div>
                <p className="text-sm text-orange-700">Tickets past their due date that need immediate attention</p>
              </CardContent>
            </Card>
          )}

          {stats.critical > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Critical Priority
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 mb-2">{stats.critical}</div>
                <p className="text-sm text-red-700">High-priority issues requiring urgent resolution</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Overview</CardTitle>
          <CardDescription>Visual breakdown of ticket completion status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Completion</span>
              <span>{completionRate.toFixed(1)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Open: {stats.open}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>In Progress: {stats.in_progress}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Resolved: {stats.resolved}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span>Closed: {stats.closed}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Breakdown of tickets by current status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="40%"
                  cy="50%"
                  outerRadius={85}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} tickets`, name]} />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  wrapperStyle={{ paddingLeft: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>Breakdown of tickets by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={priorityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown */}
      {departmentData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Department Breakdown
            </CardTitle>
            <CardDescription>Number of tickets assigned to each department</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={departmentData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, angle: -45, textAnchor: 'end' }}
                  height={80}
                  interval={0}
                  tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 9)}...` : value}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value, name) => [`${value} audit tickets`, `Department: ${name}`]} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Tickets created in the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">{stats.recentActivity}</div>
          <p className="text-sm text-muted-foreground">
            {stats.recentActivity > 0
              ? `${stats.recentActivity} new tickets created this week`
              : "No new tickets created this week"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
