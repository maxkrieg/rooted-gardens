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
      accounts: {
        Row: {
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_state: string | null
          billing_type: string
          billing_zip: string | null
          contact_name: string | null
          contract_period: string | null
          contract_rate: number | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          price_per_visit: number | null
          qbo_customer_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_type: string
          billing_zip?: string | null
          contact_name?: string | null
          contract_period?: string | null
          contract_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          price_per_visit?: number | null
          qbo_customer_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_type?: string
          billing_zip?: string | null
          contact_name?: string | null
          contract_period?: string | null
          contract_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          price_per_visit?: number | null
          qbo_customer_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_invoices: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          invoiced_at: string
          period_end: string
          period_label: string
          period_start: string
          qbo_invoice_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          invoiced_at?: string
          period_end: string
          period_label: string
          period_start: string
          qbo_invoice_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          invoiced_at?: string
          period_end?: string
          period_label?: string
          period_start?: string
          qbo_invoice_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          name: string
          phone: string | null
          role: string
          side: string | null
          sms_opt_out: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          phone?: string | null
          role: string
          side?: string | null
          sms_opt_out?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          phone?: string | null
          role?: string
          side?: string | null
          sms_opt_out?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          created_at: string
          id: string
          last_serviced: string | null
          name: string
          notes: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_serviced?: string | null
          name: string
          notes?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_serviced?: string | null
          name?: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          realm_id: string | null
          refresh_token: string | null
          service: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          realm_id?: string | null
          refresh_token?: string | null
          service: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          realm_id?: string | null
          refresh_token?: string | null
          service?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          property_id: string
          storage_path: string
          type: string
          uploaded_by: string | null
          visit_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          property_id: string
          storage_path: string
          type?: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          property_id?: string
          storage_path?: string
          type?: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          access_notes: string | null
          account_id: string
          address: string
          created_at: string
          crew_notes: string | null
          frequency: string
          id: string
          lat: number | null
          lng: number | null
          parking_notes: string | null
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          account_id: string
          address: string
          created_at?: string
          crew_notes?: string | null
          frequency?: string
          id?: string
          lat?: number | null
          lng?: number | null
          parking_notes?: string | null
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          account_id?: string
          address?: string
          created_at?: string
          crew_notes?: string | null
          frequency?: string
          id?: string
          lat?: number | null
          lng?: number | null
          parking_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_route_groups: {
        Row: {
          property_id: string
          route_group_id: string
          sort_order: number
        }
        Insert: {
          property_id: string
          route_group_id: string
          sort_order?: number
        }
        Update: {
          property_id?: string
          route_group_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_route_groups_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_route_groups_route_group_id_fkey"
            columns: ["route_group_id"]
            isOneToOne: false
            referencedRelation: "route_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      route_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          approved: boolean
          approved_by: string | null
          break_minutes: number
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          approved?: boolean
          approved_by?: string | null
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          approved?: boolean
          approved_by?: string | null
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          plate: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          plate?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          plate?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      visit_crew: {
        Row: {
          created_at: string
          employee_id: string
          relation: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          relation: string
          visit_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          relation?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_crew_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_crew_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          account_id: string
          completion_note: string | null
          created_at: string
          crew_instruction: string | null
          ended_at: string | null
          id: string
          invoice_amount: number | null
          invoiced_at: string | null
          property_id: string
          qbo_invoice_id: string | null
          service_types: string[] | null
          skip_reason: string | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
          week_start: string
        }
        Insert: {
          account_id: string
          completion_note?: string | null
          created_at?: string
          crew_instruction?: string | null
          ended_at?: string | null
          id?: string
          invoice_amount?: number | null
          invoiced_at?: string | null
          property_id: string
          qbo_invoice_id?: string | null
          service_types?: string[] | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
          week_start: string
        }
        Update: {
          account_id?: string
          completion_note?: string | null
          created_at?: string
          crew_instruction?: string | null
          ended_at?: string | null
          id?: string
          invoice_amount?: number | null
          invoiced_at?: string | null
          property_id?: string
          qbo_invoice_id?: string | null
          service_types?: string[] | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_employee_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const
