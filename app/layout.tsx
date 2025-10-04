import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/hooks/use-auth"
import { Navigation } from "@/components/navigation"
import { NavigationLoading } from "@/components/navigation-loading"
import { LanguageProvider } from "@/contexts/language-context"
import { cookies } from "next/headers"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Audit Fix Management System",
  description: "Comprehensive audit management and tracking system",
    generator: 'v0.app'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get("locale")?.value as "en" | "ar") || "en"
  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <LanguageProvider>
          <AuthProvider>
            <NavigationLoading />
            <Navigation />
            <main>{children}</main>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
