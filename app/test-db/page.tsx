"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export default function TestDBPage() {
  const [testResults, setTestResults] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const runTests = async () => {
    setLoading(true)
    const results: any = {}

    // Test 1: Check if we can connect to Supabase
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      results.authConnection = {
        success: !error,
        user: user?.email || 'Not authenticated',
        error: error?.message
      }
    } catch (e: any) {
      results.authConnection = { success: false, error: e.message }
    }

    // Test 2: Check if we can query profiles table
    try {
      const { data, error, count } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: false })
        .limit(1)

      results.profileQuery = {
        success: !error,
        count,
        error: error?.message,
        hasData: !!data && data.length > 0
      }
    } catch (e: any) {
      results.profileQuery = { success: false, error: e.message }
    }

    // Test 3: Check if we can query a specific profile (if authenticated)
    if (results.authConnection.success && results.authConnection.user !== 'Not authenticated') {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user!.id)
          .single()

        results.ownProfile = {
          success: !error,
          profile: data,
          error: error?.message
        }
      } catch (e: any) {
        results.ownProfile = { success: false, error: e.message }
      }
    }

    // Test 4: Check Realtime connection
    try {
      const channel = supabase
        .channel('test-channel')
        .on('system', { event: '*' }, (payload) => {
          console.log('System event:', payload)
        })
        .subscribe((status) => {
          results.realtime = {
            success: status === 'SUBSCRIBED',
            status
          }
        })

      // Wait a bit for subscription to complete
      await new Promise(resolve => setTimeout(resolve, 2000))
      channel.unsubscribe()
    } catch (e: any) {
      results.realtime = { success: false, error: e.message }
    }

    setTestResults(results)
    setLoading(false)
  }

  useEffect(() => {
    runTests()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>

      {loading ? (
        <div>Running tests...</div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 border rounded">
            <h2 className="font-semibold">Auth Connection:</h2>
            <pre className="text-sm mt-2">{JSON.stringify(testResults.authConnection, null, 2)}</pre>
          </div>

          <div className="p-4 border rounded">
            <h2 className="font-semibold">Profile Query:</h2>
            <pre className="text-sm mt-2">{JSON.stringify(testResults.profileQuery, null, 2)}</pre>
          </div>

          {testResults.ownProfile && (
            <div className="p-4 border rounded">
              <h2 className="font-semibold">Own Profile:</h2>
              <pre className="text-sm mt-2">{JSON.stringify(testResults.ownProfile, null, 2)}</pre>
            </div>
          )}

          <div className="p-4 border rounded">
            <h2 className="font-semibold">Realtime:</h2>
            <pre className="text-sm mt-2">{JSON.stringify(testResults.realtime, null, 2)}</pre>
          </div>

          <button
            onClick={runTests}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Run Tests Again
          </button>
        </div>
      )}
    </div>
  )
}