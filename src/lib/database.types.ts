export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      automation_rules: {
        Row: {
          action: string
          category_id: string | null
          conditions: Json | null
          created_at: string
          enabled: boolean
          household_id: string
          id: string
          pattern: string
          position: number
          replacement: string | null
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          category_id?: string | null
          conditions?: Json | null
          created_at?: string
          enabled?: boolean
          household_id: string
          id?: string
          pattern: string
          position: number
          replacement?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          category_id?: string | null
          conditions?: Json | null
          created_at?: string
          enabled?: boolean
          household_id?: string
          id?: string
          pattern?: string
          position?: number
          replacement?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "automation_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_household_id_subcategory_id_fkey"
            columns: ["household_id", "subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          household_id: string
          icon: string
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          monthly_budget: number | null
          name: string
          system_key: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          household_id: string
          icon?: string
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          monthly_budget?: number | null
          name: string
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          household_id?: string
          icon?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          monthly_budget?: number | null
          name?: string
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_allowed_members: {
        Row: {
          created_at: string
          email: string
          household_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          household_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          household_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_allowed_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          color: string
          household_id: string
          joined_at: string
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Insert: {
          color?: string
          household_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Update: {
          color?: string
          household_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          opening_balance: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          opening_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_cards: {
        Row: {
          created_at: string
          household_id: string
          last_four: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          last_four: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          last_four?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_cards_household_id_user_id_fkey"
            columns: ["household_id", "user_id"]
            isOneToOne: true
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_transaction_schedule_events: {
        Row: {
          actor_id: string | null
          created_at: string
          household_id: string
          id: string
          new_status: Database["public"]["Enums"]["recurring_schedule_status"]
          previous_status: Database["public"]["Enums"]["recurring_schedule_status"]
          reason: string | null
          schedule_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          new_status: Database["public"]["Enums"]["recurring_schedule_status"]
          previous_status: Database["public"]["Enums"]["recurring_schedule_status"]
          reason?: string | null
          schedule_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["recurring_schedule_status"]
          previous_status?: Database["public"]["Enums"]["recurring_schedule_status"]
          reason?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transaction_schedule_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transaction_schedule_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transaction_schedule_events_schedule_fkey"
            columns: ["household_id", "schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_transaction_schedules"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      recurring_transaction_schedules: {
        Row: {
          amount: number
          anchor_date: string
          cadence: Database["public"]["Enums"]["recurring_schedule_cadence"]
          category_id: string | null
          created_at: string
          created_by: string
          enabled: boolean | null
          household_id: string
          id: string
          interval_count: number
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant: string
          next_occurrence_index: number
          next_occurs_on: string
          note: string
          paid_by: string | null
          service_period_end: string | null
          service_period_start: string | null
          status: Database["public"]["Enums"]["recurring_schedule_status"]
          status_reason: string | null
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          anchor_date: string
          cadence: Database["public"]["Enums"]["recurring_schedule_cadence"]
          category_id?: string | null
          created_at?: string
          created_by: string
          enabled?: boolean | null
          household_id: string
          id?: string
          interval_count?: number
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string
          next_occurrence_index?: number
          next_occurs_on: string
          note?: string
          paid_by?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          status?: Database["public"]["Enums"]["recurring_schedule_status"]
          status_reason?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          anchor_date?: string
          cadence?: Database["public"]["Enums"]["recurring_schedule_cadence"]
          category_id?: string | null
          created_at?: string
          created_by?: string
          enabled?: boolean | null
          household_id?: string
          id?: string
          interval_count?: number
          kind?: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string
          next_occurrence_index?: number
          next_occurs_on?: string
          note?: string
          paid_by?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          status?: Database["public"]["Enums"]["recurring_schedule_status"]
          status_reason?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transaction_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transaction_schedules_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_transaction_schedules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transaction_schedules_household_id_subcategory_id_fke"
            columns: ["household_id", "subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_transaction_schedules_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          saved_amount: number
          target_amount: number
          target_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          saved_amount?: number
          target_amount: number
          target_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          saved_amount?: number
          target_amount?: number
          target_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          archived_at: string | null
          category_id: string
          color: string
          created_at: string
          household_id: string
          icon: string | null
          id: string
          monthly_budget: number | null
          name: string
          system_key: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category_id: string
          color: string
          created_at?: string
          household_id: string
          icon?: string | null
          id?: string
          monthly_budget?: number | null
          name: string
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string
          color?: string
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          monthly_budget?: number | null
          name?: string
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "subcategories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          import_file_hash: string | null
          import_row_number: number | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant: string
          note: string
          occurred_on: string
          paid_by: string | null
          recurring_schedule_id: string | null
          scheduled_for: string | null
          service_period_end: string | null
          service_period_start: string | null
          source: Database["public"]["Enums"]["transaction_source"]
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          import_file_hash?: string | null
          import_row_number?: number | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string
          note?: string
          occurred_on: string
          paid_by?: string | null
          recurring_schedule_id?: string | null
          scheduled_for?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          import_file_hash?: string | null
          import_row_number?: number | null
          kind?: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string
          note?: string
          occurred_on?: string
          paid_by?: string | null
          recurring_schedule_id?: string | null
          scheduled_for?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_subcategory_id_fkey"
            columns: ["household_id", "subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_schedule_id_fkey"
            columns: ["household_id", "recurring_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_transaction_schedules"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_automation_results: {
        Args: {
          changes: Json
          expected_rule_set: Json
          target_household_id: string
        }
        Returns: number
      }
      convert_transaction_to_recurring_schedule: {
        Args: {
          target_amount?: number
          target_cadence?: Database["public"]["Enums"]["recurring_schedule_cadence"]
          target_category_id?: string
          target_interval_count?: number
          target_kind?: Database["public"]["Enums"]["transaction_kind"]
          target_merchant?: string
          target_note?: string
          target_occurred_on?: string
          target_paid_by?: string
          target_service_period_end?: string
          target_service_period_start?: string
          target_subcategory_id?: string
          target_transaction_id: string
        }
        Returns: string
      }
      create_category: {
        Args: {
          category_color?: string
          category_icon?: string
          category_kind: Database["public"]["Enums"]["category_kind"]
          category_name: string
        }
        Returns: string
      }
      create_recurring_transaction_schedule: {
        Args: {
          target_amount?: number
          target_cadence?: Database["public"]["Enums"]["recurring_schedule_cadence"]
          target_category_id?: string
          target_household_id: string
          target_interval_count?: number
          target_kind?: Database["public"]["Enums"]["transaction_kind"]
          target_merchant?: string
          target_note?: string
          target_occurred_on?: string
          target_paid_by?: string
          target_service_period_end?: string
          target_service_period_start?: string
          target_subcategory_id?: string
        }
        Returns: string
      }
      create_recurring_transaction_schedule_after_duplicate: {
        Args: {
          target_amount?: number
          target_cadence?: Database["public"]["Enums"]["recurring_schedule_cadence"]
          target_category_id?: string
          target_existing_transaction_id?: string
          target_household_id: string
          target_interval_count?: number
          target_kind?: Database["public"]["Enums"]["transaction_kind"]
          target_merchant?: string
          target_note?: string
          target_occurred_on?: string
          target_paid_by?: string
          target_service_period_end?: string
          target_service_period_start?: string
          target_subcategory_id?: string
        }
        Returns: string
      }
      dashboard_monthly_review: {
        Args: { p_month: string }
        Returns: {
          expenses: number
          income: number
          month: string
          savings: number
        }[]
      }
      dashboard_spending_breakdown: {
        Args: {
          p_category_ids?: string[]
          p_month: string
          p_range_from?: string
          p_range_to?: string
          p_subcategories?: boolean
        }
        Returns: {
          amount: number
          category_id: string
          category_name: string
        }[]
      }
      dashboard_summary: {
        Args: { p_month: string; p_range_from?: string; p_range_to?: string }
        Returns: {
          balance_change_percentage: number
          expense_change_percentage: number
          expenses: number
          income: number
          income_change_percentage: number
        }[]
      }
      delete_recurring_transaction_schedule: {
        Args: { target_schedule_id: string }
        Returns: undefined
      }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      is_household_owner: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      process_due_recurring_transaction_schedules: {
        Args: { target_today?: string }
        Returns: Json
      }
      reorder_automation_rules: {
        Args: { ordered_rule_ids: string[]; target_household_id: string }
        Returns: undefined
      }
      save_current_settings: {
        Args: {
          household_name?: string
          member_card_last_four?: string
          member_color?: string
          profile_name?: string
        }
        Returns: string
      }
      save_recurring_transaction_occurrence: {
        Args: {
          target_amount?: number
          target_cadence?: Database["public"]["Enums"]["recurring_schedule_cadence"]
          target_category_id?: string
          target_interval_count?: number
          target_kind?: Database["public"]["Enums"]["transaction_kind"]
          target_merchant?: string
          target_note?: string
          target_occurred_on?: string
          target_paid_by?: string
          target_scope?: string
          target_service_period_end?: string
          target_service_period_start?: string
          target_subcategory_id?: string
          target_transaction_id: string
        }
        Returns: undefined
      }
      set_current_household_member_color: {
        Args: { target_color: string }
        Returns: undefined
      }
      set_recurring_transaction_schedule_enabled: {
        Args: { target_enabled: boolean; target_schedule_id: string }
        Returns: undefined
      }
      set_recurring_transaction_schedule_status: {
        Args: {
          target_schedule_id: string
          target_status: Database["public"]["Enums"]["recurring_schedule_status"]
        }
        Returns: undefined
      }
      update_recurring_transaction_occurrence: {
        Args: {
          target_amount: number
          target_category_id: string
          target_merchant: string
          target_note: string
          target_paid_by: string
          target_scope: string
          target_service_period_end: string
          target_service_period_start: string
          target_subcategory_id: string
          target_transaction_id: string
        }
        Returns: undefined
      }
      update_recurring_transaction_schedule: {
        Args: {
          target_amount: number
          target_cadence: Database["public"]["Enums"]["recurring_schedule_cadence"]
          target_interval_count: number
          target_merchant: string
          target_note: string
          target_schedule_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      category_kind: "income" | "expense"
      household_role: "owner" | "member"
      recurring_schedule_cadence:
        | "weekly"
        | "monthly"
        | "custom_weekly"
        | "custom_monthly"
      recurring_schedule_status: "active" | "paused" | "stopped" | "blocked"
      transaction_kind: "income" | "expense"
      transaction_source: "manual" | "statement_import"
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
      category_kind: ["income", "expense"],
      household_role: ["owner", "member"],
      recurring_schedule_cadence: [
        "weekly",
        "monthly",
        "custom_weekly",
        "custom_monthly",
      ],
      recurring_schedule_status: ["active", "paused", "stopped", "blocked"],
      transaction_kind: ["income", "expense"],
      transaction_source: ["manual", "statement_import"],
    },
  },
} as const
