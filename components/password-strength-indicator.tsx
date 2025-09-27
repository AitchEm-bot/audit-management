import { validatePassword } from "@/lib/password-validation"

interface PasswordStrengthIndicatorProps {
  password: string
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null

  const validation = validatePassword(password)

  const getStrengthColor = () => {
    switch (validation.strength) {
      case "weak":
        return "bg-red-500"
      case "medium":
        return "bg-yellow-500"
      case "strong":
        return "bg-green-500"
      default:
        return "bg-gray-300"
    }
  }

  const getStrengthWidth = () => {
    switch (validation.strength) {
      case "weak":
        return "w-1/3"
      case "medium":
        return "w-2/3"
      case "strong":
        return "w-full"
      default:
        return "w-0"
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Password strength:</span>
        <span
          className={`text-sm font-medium ${
            validation.strength === "weak"
              ? "text-red-500"
              : validation.strength === "medium"
                ? "text-yellow-500"
                : "text-green-500"
          }`}
        >
          {validation.strength.charAt(0).toUpperCase() + validation.strength.slice(1)}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`} />
      </div>

      {validation.errors.length > 0 && (
        <ul className="text-xs text-red-500 space-y-1">
          {validation.errors.map((error, index) => (
            <li key={index}>• {error}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
