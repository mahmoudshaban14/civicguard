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
    PostgrestVersion: "14.18"
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
      ai_requests: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          image_path: string | null
          latency_ms: number | null
          model: string | null
          report_id: string | null
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          image_path?: string | null
          latency_ms?: number | null
          model?: string | null
          report_id?: string | null
          result?: Json | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          image_path?: string | null
          latency_ms?: number | null
          model?: string | null
          report_id?: string | null
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          default_severity: string | null
          department: string
          department_id: string | null
          explanation: string | null
          id: string
          keywords: string[] | null
          label: string
          max_conf: number | null
          min_conf: number | null
          severity_reason: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_severity?: string | null
          department: string
          department_id?: string | null
          explanation?: string | null
          id: string
          keywords?: string[] | null
          label: string
          max_conf?: number | null
          min_conf?: number | null
          severity_reason?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          default_severity?: string | null
          department?: string
          department_id?: string | null
          explanation?: string | null
          id?: string
          keywords?: string[] | null
          label?: string
          max_conf?: number | null
          min_conf?: number | null
          severity_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          read_at: string | null
          report_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          report_id?: string | null
          title: string
          type?: string | null
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          report_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          national_id: string | null
          phone_number: string | null
          role: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          national_id?: string | null
          phone_number?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          national_id?: string | null
          phone_number?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      report_duplicate_candidates: {
        Row: {
          ai_checked: boolean
          ai_confidence: number | null
          ai_model: string | null
          ai_reason: string | null
          ai_same_issue: boolean | null
          candidate_report_id: string
          created_at: string
          distance_m: number
          id: string
          report_id: string
        }
        Insert: {
          ai_checked?: boolean
          ai_confidence?: number | null
          ai_model?: string | null
          ai_reason?: string | null
          ai_same_issue?: boolean | null
          candidate_report_id: string
          created_at?: string
          distance_m: number
          id?: string
          report_id: string
        }
        Update: {
          ai_checked?: boolean
          ai_confidence?: number | null
          ai_model?: string | null
          ai_reason?: string | null
          ai_same_issue?: boolean | null
          candidate_report_id?: string
          created_at?: string
          distance_m?: number
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_duplicate_candidates_candidate_report_id_fkey"
            columns: ["candidate_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_duplicate_candidates_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          report_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          report_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          action_status: string | null
          area_name: string | null
          assigned_department_id: string | null
          assigned_to: string | null
          category: string | null
          category_id: string | null
          confidence: number | null
          created_at: string
          department: string | null
          description: string | null
          duplicate_of: string | null
          explanation: string | null
          id: string
          image_description: string | null
          image_path: string | null
          latitude: number | null
          location: unknown
          longitude: number | null
          report_code: string | null
          requires_manual_review: boolean
          resolved_at: string | null
          secondary_issues: string[] | null
          severity: string | null
          status: string
          status_changed_by: string | null
          status_note: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          action_status?: string | null
          area_name?: string | null
          assigned_department_id?: string | null
          assigned_to?: string | null
          category?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          department?: string | null
          description?: string | null
          duplicate_of?: string | null
          explanation?: string | null
          id?: string
          image_description?: string | null
          image_path?: string | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          report_code?: string | null
          requires_manual_review?: boolean
          resolved_at?: string | null
          secondary_issues?: string[] | null
          severity?: string | null
          status?: string
          status_changed_by?: string | null
          status_note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Update: {
          action_status?: string | null
          area_name?: string | null
          assigned_department_id?: string | null
          assigned_to?: string | null
          category?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          department?: string | null
          description?: string | null
          duplicate_of?: string | null
          explanation?: string | null
          id?: string
          image_description?: string | null
          image_path?: string | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          report_code?: string | null
          requires_manual_review?: boolean
          resolved_at?: string | null
          secondary_issues?: string[] | null
          severity?: string | null
          status?: string
          status_changed_by?: string | null
          status_note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_department_id_fkey"
            columns: ["assigned_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_authority: { Args: never; Returns: boolean }
      is_trusted_caller: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {},
  },
} as const
