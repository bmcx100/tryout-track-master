export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      associations: {
        Row: {
          abbreviation: string
          created_at: string
          data_purge_date: string | null
          id: string
          join_code: string
          join_enabled: boolean
          logo_url: string | null
          name: string
          season_end_date: string | null
          updated_at: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          data_purge_date?: string | null
          id?: string
          join_code: string
          join_enabled?: boolean
          logo_url?: string | null
          name: string
          season_end_date?: string | null
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          data_purge_date?: string | null
          id?: string
          join_code?: string
          join_enabled?: boolean
          logo_url?: string | null
          name?: string
          season_end_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          association_id: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          target_id: string
          target_table: string
          user_id: string
        }
        Insert: {
          action: string
          association_id: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          target_id: string
          target_table: string
          user_id: string
        }
        Update: {
          action?: string
          association_id?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string
          target_table?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      continuation_rounds: {
        Row: {
          association_id: string
          created_at: string
          division: string
          estimated_players: number | null
          estimated_players_d: number | null
          estimated_players_f: number | null
          estimated_players_g: number | null
          id: string
          ip_players: string[]
          is_final_team: boolean
          jersey_numbers: string[]
          round_number: number
          scraped_at: string | null
          session_info: string | null
          sessions: Json
          source_url: string | null
          status: string
          team_level: string
        }
        Insert: {
          association_id: string
          created_at?: string
          division: string
          estimated_players?: number | null
          estimated_players_d?: number | null
          estimated_players_f?: number | null
          estimated_players_g?: number | null
          id?: string
          ip_players?: string[]
          is_final_team?: boolean
          jersey_numbers: string[]
          round_number: number
          scraped_at?: string | null
          session_info?: string | null
          sessions?: Json
          source_url?: string | null
          status?: string
          team_level: string
        }
        Update: {
          association_id?: string
          created_at?: string
          division?: string
          estimated_players?: number | null
          estimated_players_d?: number | null
          estimated_players_f?: number | null
          estimated_players_g?: number | null
          id?: string
          ip_players?: string[]
          is_final_team?: boolean
          jersey_numbers?: string[]
          round_number?: number
          scraped_at?: string | null
          session_info?: string | null
          sessions?: Json
          source_url?: string | null
          status?: string
          team_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuation_rounds_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      continuations_urls: {
        Row: {
          association_id: string
          created_at: string
          division: string
          id: string
          updated_at: string
          url: string
        }
        Insert: {
          association_id: string
          created_at?: string
          division: string
          id?: string
          updated_at?: string
          url: string
        }
        Update: {
          association_id?: string
          created_at?: string
          division?: string
          id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuations_urls_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrections: {
        Row: {
          association_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string
          note: string | null
          old_value: string
          player_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["correction_status"]
          user_id: string
        }
        Insert: {
          association_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          note?: string | null
          old_value: string
          player_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          user_id: string
        }
        Update: {
          association_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          note?: string | null
          old_value?: string
          player_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrections_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tryout_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_annotations: {
        Row: {
          created_at: string
          custom_name: string | null
          id: string
          is_favorite: boolean
          notes: string | null
          player_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string | null
          player_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string | null
          player_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_annotations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tryout_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_hearts: {
        Row: {
          created_at: string
          player_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          player_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_hearts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tryout_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_predictions: {
        Row: {
          association_id: string
          created_at: string
          division: string
          id: string
          player_order: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          association_id: string
          created_at?: string
          division: string
          id?: string
          player_order?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          association_id?: string
          created_at?: string
          division?: string
          id?: string
          player_order?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_predictions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_configs: {
        Row: {
          association_id: string
          created_at: string
          id: string
          label: string
          last_scraped_at: string | null
          selectors: Json
          updated_at: string
          url: string
        }
        Insert: {
          association_id: string
          created_at?: string
          id?: string
          label: string
          last_scraped_at?: string | null
          selectors: Json
          updated_at?: string
          url: string
        }
        Update: {
          association_id?: string
          created_at?: string
          id?: string
          label?: string
          last_scraped_at?: string | null
          selectors?: Json
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraper_configs_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          association_id: string
          created_at: string
          display_order: number
          division: string
          id: string
          is_archived: boolean
          max_roster_size: number
          name: string
        }
        Insert: {
          association_id: string
          created_at?: string
          display_order?: number
          division: string
          id?: string
          is_archived?: boolean
          max_roster_size: number
          name: string
        }
        Update: {
          association_id?: string
          created_at?: string
          display_order?: number
          division?: string
          id?: string
          is_archived?: boolean
          max_roster_size?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      tryout_players: {
        Row: {
          association_id: string
          created_at: string
          deleted_at: string | null
          division: string
          id: string
          jersey_number: string
          name: string
          position: string
          previous_team: string | null
          status: Database["public"]["Enums"]["player_status"]
          status_updated_at: string
          suggested_by: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          association_id: string
          created_at?: string
          deleted_at?: string | null
          division: string
          id?: string
          jersey_number: string
          name: string
          position?: string
          previous_team?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          status_updated_at?: string
          suggested_by?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          deleted_at?: string | null
          division?: string
          id?: string
          jersey_number?: string
          name?: string
          position?: string
          previous_team?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          status_updated_at?: string
          suggested_by?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryout_players_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tryout_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_associations: {
        Row: {
          association_id: string
          consent_given_at: string | null
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          association_id: string
          consent_given_at?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          association_id?: string
          consent_given_at?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_associations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tracked_groups: {
        Row: {
          association_id: string
          created_at: string
          division: string
          id: string
          is_active: boolean
          label: string
          user_id: string
        }
        Insert: {
          association_id: string
          created_at?: string
          division: string
          id?: string
          is_active?: boolean
          label: string
          user_id: string
        }
        Update: {
          association_id?: string
          created_at?: string
          division?: string
          id?: string
          is_active?: boolean
          label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tracked_groups_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_belongs_to_association: {
        Args: { assoc_id: string }
        Returns: boolean
      }
      user_is_admin: { Args: never; Returns: boolean }
      user_is_group_admin: { Args: { assoc_id: string }; Returns: boolean }
      user_is_group_admin_or_admin: {
        Args: { assoc_id: string }
        Returns: boolean
      }
    }
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "group_admin", "member"],
      correction_status: ["pending", "approved", "rejected"],
      player_status: [
        "registered",
        "trying_out",
        "cut",
        "made_team",
        "moved_up",
        "moved_down",
        "withdrew",
      ],
    },
  },
} as const
