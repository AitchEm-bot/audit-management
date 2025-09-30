import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/hooks/use-auth"
import { Navigation } from "@/components/navigation"
import { NavigationLoading } from "@/components/navigation-loading"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Audit Fix Management System",
  description: "Comprehensive audit management and tracking system",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <NavigationLoading />
          <Navigation />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}
