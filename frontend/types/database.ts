// Auto-generated Supabase types
// Regenerate with: cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
// This placeholder allows TypeScript compilation before types are generated.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      app_role: "admin" | "group_admin" | "member"
      correction_status: "pending" | "approved" | "rejected"
      player_status:
        | "registered"
        | "trying_out"
        | "cut"
        | "made_team"
        | "moved_up"
        | "moved_down"
        | "withdrew"
    }
    CompositeTypes: Record<string, never>
  }
}
