"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { createSupabaseQueries } from "@/lib/supabase/queries"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Calendar, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { formatDateTime } from "@/lib/date-utils"
import { translateDepartment } from "@/lib/ticket-utils"

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
  recent_7_days?: number
}

interface ChartData {
  name: string
  value: number
  color?: string
  [key: string]: any
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
  userRole?: string
}

export function DashboardMetrics({ initialStats, userRole }: DashboardMetricsProps) {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const isRTL = locale === 'ar'
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
    { name: t("dashboard.openTickets"), value: stats.open, color: STATUS_COLORS.open },
    { name: t("dashboard.inProgress"), value: stats.in_progress, color: STATUS_COLORS.in_progress },
    { name: t("dashboard.resolved"), value: stats.resolved, color: STATUS_COLORS.resolved },
    { name: t("dashboard.closed"), value: stats.closed, color: STATUS_COLORS.closed },
  ]

  const priorityData: ChartData[] = [
    { name: t("dashboard.criticalPriority"), value: stats.critical, color: PRIORITY_COLORS.critical },
    { name: t("dashboard.highPriority"), value: stats.high, color: PRIORITY_COLORS.high },
    { name: t("dashboard.mediumPriority"), value: stats.medium, color: PRIORITY_COLORS.medium },
    { name: t("dashboard.lowPriority"), value: stats.low, color: PRIORITY_COLORS.low },
  ]

  const departmentData: ChartData[] = Object.entries(stats.departments).map(([name, value]) => ({
    name: translateDepartment(name, t),
    value,
  }))

  // Custom tick component for wrapping long department names
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const words = payload.value.split(' ')
    const maxCharsPerLine = isRTL ? 12 : 10

    // If text is short enough, render as single line
    if (payload.value.length <= maxCharsPerLine) {
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={16}
            textAnchor="end"
            fill="#666"
            fontSize={11}
            transform="rotate(-45)"
          >
            {payload.value}
          </text>
        </g>
      )
    }

    // Split into two lines
    let firstLine = ''
    let secondLine = ''
    let currentLength = 0

    for (let i = 0; i < words.length; i++) {
      if (currentLength + words[i].length <= maxCharsPerLine || firstLine === '') {
        firstLine += (firstLine ? ' ' : '') + words[i]
        currentLength += words[i].length + 1
      } else {
        secondLine = words.slice(i).join(' ')
        break
      }
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          textAnchor="end"
          fill="#666"
          fontSize={11}
          transform="rotate(-45)"
        >
          <tspan x={-20} dy={16}>{firstLine}</tspan>
          {secondLine && <tspan x={-30} dy="1.2em">{secondLine}</tspan>}
        </text>
      </g>
    )
  }

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
          {t("common.lastUpdated")}: {formatDateTime(lastRefresh, locale)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshStats}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("common.refreshStats")}
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalTickets")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{t("common.allAuditTickets")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("common.activeTickets")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open + stats.in_progress}</div>
            <p className="text-xs text-muted-foreground">{t("common.openPlusInProgress")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("common.criticalIssues")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">{t("common.requireImmediateAttention")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("common.completionRate")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{t("common.resolvedPlusClosed")}</p>
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
                  {t("common.overdueTickets")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 mb-2">{stats.overdue}</div>
                <p className="text-sm text-orange-700">{t("common.overdueTicketsDesc")}</p>
              </CardContent>
            </Card>
          )}

          {stats.critical > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t("common.criticalPriority")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 mb-2">{stats.critical}</div>
                <p className="text-sm text-red-700">{t("common.criticalPriorityDesc")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t("common.progressOverview")}</CardTitle>
          <CardDescription>{t("common.progressOverviewDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t("common.overallCompletion")}</span>
              <span>{completionRate.toFixed(1)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>{t("dashboard.openTickets")}: {stats.open}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>{t("dashboard.inProgress")}: {stats.in_progress}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>{t("dashboard.resolved")}: {stats.resolved}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span>{t("dashboard.closed")}: {stats.closed}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.statusDistribution")}</CardTitle>
            <CardDescription>{t("dashboard.viewTicketsDescription")}</CardDescription>
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
                <Tooltip formatter={(value, name) => [`${value} ${t("tickets.ticketPlural")}`, name]} />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  wrapperStyle={{ paddingLeft: '20px' }}
                  formatter={(value) => `  ${value}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.priorityDistribution")}</CardTitle>
            <CardDescription>{t("dashboard.viewTicketsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={priorityData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickMargin={isRTL ? 15 : 5} />
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

      {/* Department Breakdown - Hidden for managers (they only see their department) */}
      {departmentData.length > 0 && userRole !== 'manager' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("dashboard.departmentDistribution")}
            </CardTitle>
            <CardDescription>{t("dashboard.viewTicketsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={departmentData}
                margin={{ top: 20, right: 30, left: 40, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={<CustomXAxisTick />}
                  height={50}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value, name) => [`${value} ${t("common.allAuditTickets")}`, `${t("tickets.department")}: ${name}`]} />
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
            {t("common.recentActivity")}
          </CardTitle>
          <CardDescription>{t("common.recentActivityDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">{stats.recentActivity}</div>
          <p className="text-sm text-muted-foreground">
            {stats.recentActivity > 0
              ? t("common.newTicketsThisWeek", { count: stats.recentActivity.toString() })
              : t("common.noNewTicketsThisWeek")}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
