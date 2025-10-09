export const getDepartmentLabel = (value: string, locale: string) => {
  const departments: Record<string, { en: string; ar: string }> = {
    IT: { en: "IT", ar: "تقنية المعلومات" },
    Finance: { en: "Finance", ar: "المالية" },
    HR: { en: "HR", ar: "الموارد البشرية" },
    Operations: { en: "Operations", ar: "العمليات" },
    Legal: { en: "Legal", ar: "القانونية" },
    Compliance: { en: "Compliance", ar: "الامتثال" },
    Marketing: { en: "Marketing", ar: "التسويق" },
    Sales: { en: "Sales", ar: "المبيعات" },
    General: { en: "General", ar: "عام" }
  }

  return departments[value]?.[locale as 'en' | 'ar'] || value
}

export const getDepartmentOptions = (locale: string) => {
  return [
    { value: "IT", label: getDepartmentLabel("IT", locale) },
    { value: "Finance", label: getDepartmentLabel("Finance", locale) },
    { value: "HR", label: getDepartmentLabel("HR", locale) },
    { value: "Operations", label: getDepartmentLabel("Operations", locale) },
    { value: "Legal", label: getDepartmentLabel("Legal", locale) },
    { value: "Compliance", label: getDepartmentLabel("Compliance", locale) },
    { value: "Marketing", label: getDepartmentLabel("Marketing", locale) },
    { value: "Sales", label: getDepartmentLabel("Sales", locale) },
    { value: "General", label: getDepartmentLabel("General", locale) }
  ]
}