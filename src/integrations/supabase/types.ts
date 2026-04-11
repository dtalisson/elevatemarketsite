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
  public: {
    Tables: {
      account_lockouts: {
        Row: {
          application_id: string
          failed_attempts: number
          id: string
          last_attempt_at: string | null
          locked_until: string | null
          username: string
        }
        Insert: {
          application_id: string
          failed_attempts?: number
          id?: string
          last_attempt_at?: string | null
          locked_until?: string | null
          username: string
        }
        Update: {
          application_id?: string
          failed_attempts?: number
          id?: string
          last_attempt_at?: string | null
          locked_until?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_lockouts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_login_logs: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          failure_reason: string | null
          fingerprint: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          username_attempted: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          failure_reason?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          username_attempted: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          failure_reason?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          username_attempted?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          created_at: string
          current_version: string | null
          description: string | null
          enabled: boolean
          id: string
          min_version: string | null
          msg_disabled: string | null
          msg_maintenance: string | null
          msg_outdated: string | null
          name: string
          owner_id: string
          secret_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          min_version?: string | null
          msg_disabled?: string | null
          msg_maintenance?: string | null
          msg_outdated?: string | null
          name: string
          owner_id: string
          secret_key?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          min_version?: string | null
          msg_disabled?: string | null
          msg_maintenance?: string | null
          msg_outdated?: string | null
          name?: string
          owner_id?: string
          secret_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      auth_logs: {
        Row: {
          application_id: string
          created_at: string
          details: string | null
          event_type: string
          hwid: string | null
          id: string
          ip_address: string | null
          license_id: string | null
          success: boolean
          username: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          details?: string | null
          event_type: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          license_id?: string | null
          success?: boolean
          username?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          details?: string | null
          event_type?: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          license_id?: string | null
          success?: boolean
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_logs_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklist: {
        Row: {
          active: boolean
          application_id: string
          created_at: string
          created_by: string
          details: string | null
          hwid: string | null
          id: string
          ip_address: string | null
          reason: string | null
          source_log_id: string | null
        }
        Insert: {
          active?: boolean
          application_id: string
          created_at?: string
          created_by: string
          details?: string | null
          hwid?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          source_log_id?: string | null
        }
        Update: {
          active?: boolean
          application_id?: string
          created_at?: string
          created_by?: string
          details?: string | null
          hwid?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          source_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          application_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          updated_at: string
          version: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downloads_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          activated_at: string | null
          application_id: string
          ban_reason: string | null
          claimed_by: string | null
          created_at: string
          created_by: string
          current_uses: number
          expires_at: string | null
          hwid: string | null
          id: string
          license_key: string
          max_uses: number
          note: string | null
          panel_user_id: string | null
          remaining_seconds: number | null
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          application_id: string
          ban_reason?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by: string
          current_uses?: number
          expires_at?: string | null
          hwid?: string | null
          id?: string
          license_key?: string
          max_uses?: number
          note?: string | null
          panel_user_id?: string | null
          remaining_seconds?: number | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          application_id?: string
          ban_reason?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string
          current_uses?: number
          expires_at?: string | null
          hwid?: string | null
          id?: string
          license_key?: string
          max_uses?: number
          note?: string | null
          panel_user_id?: string | null
          remaining_seconds?: number | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_panel_user_id_fkey"
            columns: ["panel_user_id"]
            isOneToOne: false
            referencedRelation: "panel_users"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_user_applications: {
        Row: {
          application_id: string
          id: string
          panel_user_id: string
        }
        Insert: {
          application_id: string
          id?: string
          panel_user_id: string
        }
        Update: {
          application_id?: string
          id?: string
          panel_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panel_user_applications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panel_user_applications_panel_user_id_fkey"
            columns: ["panel_user_id"]
            isOneToOne: false
            referencedRelation: "panel_users"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_user_logs: {
        Row: {
          created_at: string
          details: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          panel_user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          panel_user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          panel_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panel_user_logs_panel_user_id_fkey"
            columns: ["panel_user_id"]
            isOneToOne: false
            referencedRelation: "panel_users"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_users: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          password_hash: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean
          password_hash: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          password_hash?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      pre_auth_tokens: {
        Row: {
          application_id: string
          created_at: string
          expires_at: string
          hwid: string | null
          id: string
          token: string
          used: boolean
          username: string
        }
        Insert: {
          application_id: string
          created_at?: string
          expires_at: string
          hwid?: string | null
          id?: string
          token: string
          used?: boolean
          username: string
        }
        Update: {
          application_id?: string
          created_at?: string
          expires_at?: string
          hwid?: string | null
          id?: string
          token?: string
          used?: boolean
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_auth_tokens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          id: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          id?: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          application_id: string
          client_timestamp: number | null
          created_at: string
          details: string | null
          event_type: string
          hwid: string | null
          id: string
          ip_address: string | null
          username: string | null
        }
        Insert: {
          application_id: string
          client_timestamp?: number | null
          created_at?: string
          details?: string | null
          event_type: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          username?: string | null
        }
        Update: {
          application_id?: string
          client_timestamp?: number | null
          created_at?: string
          details?: string | null
          event_type?: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      session_tokens: {
        Row: {
          application_id: string
          created_at: string
          expires_at: string
          hwid: string | null
          id: string
          ip_address: string | null
          revoked: boolean
          token: string
          username: string
        }
        Insert: {
          application_id: string
          created_at?: string
          expires_at: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          revoked?: boolean
          token: string
          username: string
        }
        Update: {
          application_id?: string
          created_at?: string
          expires_at?: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          revoked?: boolean
          token?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_tokens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      software_users: {
        Row: {
          application_id: string
          created_at: string
          hwid: string | null
          id: string
          ip_address: string | null
          last_ip: string | null
          last_login_at: string | null
          license_id: string
          password_hash: string
          updated_at: string
          username: string
        }
        Insert: {
          application_id: string
          created_at?: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          license_id: string
          password_hash: string
          updated_at?: string
          username: string
        }
        Update: {
          application_id?: string
          created_at?: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          license_id?: string
          password_hash?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "software_users_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_users_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      software_users_safe: {
        Row: {
          application_id: string | null
          created_at: string | null
          hwid: string | null
          id: string | null
          ip_address: string | null
          last_ip: string | null
          last_login_at: string | null
          license_id: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          hwid?: string | null
          id?: string | null
          ip_address?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          license_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          hwid?: string | null
          id?: string | null
          ip_address?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          license_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "software_users_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_users_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_key: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      clear_lockout: {
        Args: { p_app_id: string; p_username: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_locked: {
        Args: { p_app_id: string; p_username: string }
        Returns: boolean
      }
      is_blacklisted: {
        Args: { p_app_id: string; p_hwid?: string; p_ip?: string }
        Returns: {
          block_reason: string
          blocked: boolean
        }[]
      }
      record_failed_login: {
        Args: {
          p_app_id: string
          p_lockout_seconds?: number
          p_max_attempts?: number
          p_username: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      license_status: "active" | "expired" | "banned" | "unused"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
      license_status: ["active", "expired", "banned", "unused"],
    },
  },
} as const
