import type { TranslationKeys } from "./translations"

export function translateStatus(status: string, t: (key: string) => string): string {
  const statusMap: Record<string, string> = {
    open: t("tickets.statusOpen"),
    in_progress: t("tickets.statusInProgress"),
    resolved: t("tickets.statusResolved"),
    closed: t("tickets.statusClosed"),
    active: t("tickets.statusActive"),
  }

  return statusMap[status.toLowerCase()] || status
}

export function translatePriority(priority: string, t: (key: string) => string): string {
  const priorityMap: Record<string, string> = {
    low: t("tickets.priorityLow"),
    medium: t("tickets.priorityMedium"),
    high: t("tickets.priorityHigh"),
    critical: t("tickets.priorityCritical"),
  }

  return priorityMap[priority.toLowerCase()] || priority
}

export function translateDepartment(department: string, t: (key: string) => string): string {
  const deptMap: Record<string, string> = {
    IT: t("tickets.deptIT"),
    Finance: t("tickets.deptFinance"),
    HR: t("tickets.deptHR"),
    Legal: t("tickets.deptLegal"),
    Operations: t("tickets.deptOperations"),
    Security: t("tickets.deptSecurity"),
    Administration: t("tickets.deptAdministration"),
    General: t("tickets.deptGeneral"),
  }

  return deptMap[department] || department
}
