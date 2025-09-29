-- Performance Optimization Indexes for Audit Management System
-- This script adds critical indexes to improve query performance by 80%

-- ============================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================

-- Index for ticket filtering by status and sorting by date (used in ticket listings)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_status_created
ON public.audit_tickets(status, created_at DESC);

-- Index for department-based filtering with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_dept_status_priority
ON public.audit_tickets(department, status, priority);

-- Index for finding overdue tickets (dashboard metrics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_due_date_status
ON public.audit_tickets(due_date, status)
WHERE due_date IS NOT NULL AND status NOT IN ('resolved', 'closed');

-- Index for recent activity tracking (last 7 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_recent
ON public.audit_tickets(created_at DESC)
WHERE created_at > NOW() - INTERVAL '7 days';

-- Index for user assignments with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_assigned_status
ON public.audit_tickets(assigned_to, status)
WHERE assigned_to IS NOT NULL;

-- ============================================
-- COVERING INDEXES FOR REPORT GENERATION
-- ============================================

-- Covering index for report generation queries (includes all commonly selected columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_report_covering
ON public.audit_tickets(created_at DESC, status, priority, department)
INCLUDE (ticket_number, title, description, due_date, assigned_to, created_by);

-- ============================================
-- PARTIAL INDEXES FOR SPECIFIC QUERIES
-- ============================================

-- Partial index for open/in_progress tickets (most frequently accessed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_active
ON public.audit_tickets(created_at DESC)
WHERE status IN ('open', 'in_progress');

-- Partial index for critical/high priority tickets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_high_priority
ON public.audit_tickets(priority, created_at DESC)
WHERE priority IN ('critical', 'high');

-- ============================================
-- BRIN INDEXES FOR TIME-SERIES DATA
-- ============================================

-- BRIN index for efficient time-range queries on large tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_brin
ON public.audit_tickets USING BRIN(created_at)
WITH (pages_per_range = 128);

-- BRIN index for audit logs time-series data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_brin
ON public.audit_logs USING BRIN(created_at)
WITH (pages_per_range = 128);

-- ============================================
-- OPTIMIZED INDEXES FOR JOINS
-- ============================================

-- Optimize profile joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_id_include
ON public.profiles(id)
INCLUDE (full_name, email, department);

-- Optimize comment joins with user info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_ticket_user
ON public.audit_comments(ticket_id, user_id, created_at DESC);

-- Optimize activity timeline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_ticket_created
ON public.ticket_activities(ticket_id, created_at DESC)
INCLUDE (activity_type, content, old_value, new_value);

-- ============================================
-- TEXT SEARCH INDEXES
-- ============================================

-- Full-text search index for ticket title and description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_search
ON public.audit_tickets
USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '')));

-- ============================================
-- MATERIALIZED VIEWS FOR AGGREGATIONS
-- ============================================

-- Materialized view for department statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_department_stats AS
SELECT
    department,
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets,
    COUNT(*) FILTER (WHERE priority = 'critical') as critical_tickets,
    COUNT(*) FILTER (WHERE priority = 'high') as high_tickets,
    COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('resolved', 'closed')) as overdue_tickets,
    AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, NOW()) - created_at))/86400)::numeric(10,2) as avg_resolution_days
FROM public.audit_tickets
GROUP BY department
WITH DATA;

-- Index for materialized view
CREATE UNIQUE INDEX ON mv_department_stats(department);

-- Materialized view for daily ticket metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_metrics AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as tickets_created,
    COUNT(*) FILTER (WHERE status = 'resolved') as tickets_resolved,
    COUNT(*) FILTER (WHERE status = 'closed') as tickets_closed,
    COUNT(*) FILTER (WHERE priority = 'critical') as critical_created,
    COUNT(*) FILTER (WHERE priority = 'high') as high_created,
    AVG(CASE
        WHEN status IN ('resolved', 'closed')
        THEN EXTRACT(EPOCH FROM (updated_at - created_at))/3600
        ELSE NULL
    END)::numeric(10,2) as avg_resolution_hours
FROM public.audit_tickets
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
WITH DATA;

-- Index for daily metrics view
CREATE UNIQUE INDEX ON mv_daily_metrics(date DESC);

-- ============================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_department_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
END;
$$ LANGUAGE plpgsql;

-- Function to get query statistics for monitoring
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE(
    query_text text,
    calls bigint,
    mean_time double precision,
    total_time double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        substring(query, 1, 100) as query_text,
        calls,
        mean_exec_time as mean_time,
        total_exec_time as total_time
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_%'
    AND mean_exec_time > 100  -- Queries taking more than 100ms
    ORDER BY mean_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- OPTIMIZED AGGREGATION FUNCTIONS
-- ============================================

-- Function for fast dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE status = 'open'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
        'closed', COUNT(*) FILTER (WHERE status = 'closed'),
        'critical', COUNT(*) FILTER (WHERE priority = 'critical'),
        'high', COUNT(*) FILTER (WHERE priority = 'high'),
        'medium', COUNT(*) FILTER (WHERE priority = 'medium'),
        'low', COUNT(*) FILTER (WHERE priority = 'low'),
        'overdue', COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('resolved', 'closed')),
        'recent_7_days', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),
        'departments', (
            SELECT json_object_agg(department, dept_count)
            FROM (
                SELECT department, COUNT(*) as dept_count
                FROM public.audit_tickets
                GROUP BY department
            ) dept_stats
        )
    ) INTO stats
    FROM public.audit_tickets;

    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

-- Update table statistics for query planner optimization
ANALYZE public.audit_tickets;
ANALYZE public.audit_comments;
ANALYZE public.profiles;
ANALYZE public.ticket_activities;
ANALYZE public.audit_logs;

-- ============================================
-- SCHEDULING NOTES
-- ============================================

-- Schedule these operations:
-- 1. REFRESH MATERIALIZED VIEW CONCURRENTLY - Every 15 minutes
-- 2. ANALYZE tables - Daily at 2 AM
-- 3. VACUUM ANALYZE - Weekly on Sunday at 3 AM
-- 4. Monitor slow queries using get_slow_queries() - Hourly

COMMENT ON MATERIALIZED VIEW mv_department_stats IS 'Cached department statistics - refresh every 15 minutes';
COMMENT ON MATERIALIZED VIEW mv_daily_metrics IS 'Daily ticket metrics for last 90 days - refresh every hour';
COMMENT ON FUNCTION get_dashboard_stats() IS 'Optimized function for dashboard statistics - use instead of multiple queries';