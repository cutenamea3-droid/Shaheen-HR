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
  public: {
    Tables: {
      app_state: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      /** Phase B — awaiting apply approval. Not present until migration runs. */
      hr_employee_roster: {
        Row: {
          employee_id: string
          joining_date: string | null
          status: string
          deactivated_at: string | null
          reactivated_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          employee_id: string
          joining_date?: string | null
          status?: string
          deactivated_at?: string | null
          reactivated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          employee_id?: string
          joining_date?: string | null
          status?: string
          deactivated_at?: string | null
          reactivated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hr_banking_accounts: {
        Row: {
          id: string
          employee_id: string
          provider_id: string
          other_label: string | null
          holder_name: string
          is_iban: boolean
          account_ref_ciphertext: string
          account_last4: string
          effective_from: string
          superseded_at: string | null
          note: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          provider_id: string
          other_label?: string | null
          holder_name: string
          is_iban?: boolean
          account_ref_ciphertext: string
          account_last4: string
          effective_from?: string
          superseded_at?: string | null
          note?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          provider_id?: string
          other_label?: string | null
          holder_name?: string
          is_iban?: boolean
          account_ref_ciphertext?: string
          account_last4?: string
          effective_from?: string
          superseded_at?: string | null
          note?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      hr_salary_payments: {
        Row: {
          id: string
          employee_id: string
          month: string
          amount_due_pkr: number
          amount_paid_pkr: number
          status: string
          banking_account_id: string | null
          paid_on: string | null
          note: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          month: string
          amount_due_pkr: number
          amount_paid_pkr?: number
          status?: string
          banking_account_id?: string | null
          paid_on?: string | null
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          month?: string
          amount_due_pkr?: number
          amount_paid_pkr?: number
          status?: string
          banking_account_id?: string | null
          paid_on?: string | null
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hr_salary_payment_events: {
        Row: {
          id: string
          payment_id: string
          event_type: string
          amount_pkr: number | null
          status_after: string | null
          note: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          payment_id: string
          event_type: string
          amount_pkr?: number | null
          status_after?: string | null
          note?: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          payment_id?: string
          event_type?: string
          amount_pkr?: number | null
          status_after?: string | null
          note?: string
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hr_finance_audit_log: {
        Row: {
          id: number
          at: string
          actor: string | null
          actor_email: string | null
          action: string
          employee_id: string | null
          entity_id: string | null
          detail: Json
        }
        Insert: {
          id?: number
          at?: string
          actor?: string | null
          actor_email?: string | null
          action: string
          employee_id?: string | null
          entity_id?: string | null
          detail?: Json
        }
        Update: {
          id?: number
          at?: string
          actor?: string | null
          actor_email?: string | null
          action?: string
          employee_id?: string | null
          entity_id?: string | null
          detail?: Json
        }
        Relationships: []
      }
      /** Expenses — awaiting apply approval. No bank/IBAN columns. */
      hr_expense_categories: {
        Row: {
          id: string
          name: string
          custom: boolean
          archived: boolean
          created_at: string
        }
        Insert: {
          id: string
          name: string
          custom?: boolean
          archived?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          custom?: boolean
          archived?: boolean
          created_at?: string
        }
        Relationships: []
      }
      hr_expenses: {
        Row: {
          id: string
          title: string
          category_id: string
          amount_pkr: number
          expense_date: string
          scope: string
          employee_ids: string[]
          status: string
          note: string
          deleted_at: string | null
          template_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          category_id: string
          amount_pkr: number
          expense_date: string
          scope: string
          employee_ids?: string[]
          status: string
          note?: string
          deleted_at?: string | null
          template_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          category_id?: string
          amount_pkr?: number
          expense_date?: string
          scope?: string
          employee_ids?: string[]
          status?: string
          note?: string
          deleted_at?: string | null
          template_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_expense_templates: {
        Row: {
          id: string
          name: string
          title: string
          category_id: string
          amount_pkr: number
          scope: string
          employee_ids: string[]
          note: string
          cadence: string
          active: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          title: string
          category_id: string
          amount_pkr: number
          scope: string
          employee_ids?: string[]
          note?: string
          cadence: string
          active?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          title?: string
          category_id?: string
          amount_pkr?: number
          scope?: string
          employee_ids?: string[]
          note?: string
          cadence?: string
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hr_expense_budgets: {
        Row: {
          id: string
          month: string
          category_id: string
          limit_pkr: number
          note: string
        }
        Insert: {
          id?: string
          month: string
          category_id: string
          limit_pkr: number
          note?: string
        }
        Update: {
          id?: string
          month?: string
          category_id?: string
          limit_pkr?: number
          note?: string
        }
        Relationships: []
      }
      hr_expense_audit_log: {
        Row: {
          id: number
          expense_id: string | null
          actor_email: string
          action: string
          detail: Json
          created_at: string
        }
        Insert: {
          id?: number
          expense_id?: string | null
          actor_email: string
          action: string
          detail?: Json
          created_at?: string
        }
        Update: {
          id?: number
          expense_id?: string | null
          actor_email?: string
          action?: string
          detail?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      hr_banking_accounts_masked: {
        Row: {
          id: string
          employee_id: string
          provider_id: string
          other_label: string | null
          holder_name: string
          is_iban: boolean
          account_last4: string
          effective_from: string
          superseded_at: string | null
          note: string
          created_by: string | null
          created_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      hr_list_banking_masked: {
        Args: { p_employee_id?: string | null }
        Returns: Database["public"]["Views"]["hr_banking_accounts_masked"]["Row"][]
      }
      hr_upsert_employee_roster: {
        Args: {
          p_employee_id: string
          p_status: string
          p_joining_date?: string | null
          p_confirm_deactivate?: boolean
        }
        Returns: Database["public"]["Tables"]["hr_employee_roster"]["Row"]
      }
      hr_add_banking_account: {
        Args: {
          p_employee_id: string
          p_provider_id: string
          p_holder_name: string
          p_account_ref: string
          p_is_iban: boolean
          p_effective_from?: string
          p_other_label?: string | null
          p_note?: string
        }
        Returns: Database["public"]["Views"]["hr_banking_accounts_masked"]["Row"]
      }
      hr_reveal_banking_account: {
        Args: { p_account_id: string }
        Returns: string
      }
      hr_upsert_salary_due: {
        Args: {
          p_employee_id: string
          p_month: string
          p_amount_due_pkr: number
          p_banking_account_id?: string | null
        }
        Returns: Database["public"]["Tables"]["hr_salary_payments"]["Row"]
      }
      hr_record_salary_payment: {
        Args: {
          p_payment_id: string
          p_add_pkr: number
          p_paid_on?: string
          p_note?: string
        }
        Returns: Database["public"]["Tables"]["hr_salary_payments"]["Row"]
      }
      hr_set_salary_status: {
        Args: { p_payment_id: string; p_status: string }
        Returns: Database["public"]["Tables"]["hr_salary_payments"]["Row"]
      }
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
  public: {
    Enums: {},
  },
} as const
