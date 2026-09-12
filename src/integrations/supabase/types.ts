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
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          at: string
          before: Json | null
          entity: string
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity?: string
          id?: string
        }
        Relationships: []
      }
      choice_feedback: {
        Row: {
          chosen: Json | null
          chosen_reference: string | null
          created_at: string
          id: string
          item_kind: string
          reason: string | null
          recommended: Json | null
          rejected_reference: string | null
          trip_card_id: string | null
          user_id: string
        }
        Insert: {
          chosen?: Json | null
          chosen_reference?: string | null
          created_at?: string
          id?: string
          item_kind: string
          reason?: string | null
          recommended?: Json | null
          rejected_reference?: string | null
          trip_card_id?: string | null
          user_id: string
        }
        Update: {
          chosen?: Json | null
          chosen_reference?: string | null
          created_at?: string
          id?: string
          item_kind?: string
          reason?: string | null
          recommended?: Json | null
          rejected_reference?: string | null
          trip_card_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choice_feedback_card_id_fkey"
            columns: ["trip_card_id"]
            isOneToOne: false
            referencedRelation: "trip_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          address_extra: string | null
          building: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          invoice_email: string | null
          invoice_emails: Json
          is_default: boolean
          legal_form: string | null
          name: string
          postcode: string | null
          street: string | null
          updated_at: string
          user_id: string
          vat_id: string | null
        }
        Insert: {
          address?: string | null
          address_extra?: string | null
          building?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          invoice_email?: string | null
          invoice_emails?: Json
          is_default?: boolean
          legal_form?: string | null
          name: string
          postcode?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
          vat_id?: string | null
        }
        Update: {
          address?: string | null
          address_extra?: string | null
          building?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          invoice_email?: string | null
          invoice_emails?: Json
          is_default?: boolean
          legal_form?: string | null
          name?: string
          postcode?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
          vat_id?: string | null
        }
        Relationships: []
      }
      hotel_requests_missed: {
        Row: {
          checkin_date: string | null
          created_at: string
          destination_iata: string | null
          id: string
          name_requested: string
        }
        Insert: {
          checkin_date?: string | null
          created_at?: string
          destination_iata?: string | null
          id?: string
          name_requested: string
        }
        Update: {
          checkin_date?: string | null
          created_at?: string
          destination_iata?: string | null
          id?: string
          name_requested?: string
        }
        Relationships: []
      }
      insurance_rates: {
        Row: {
          active: boolean
          base_daily_minor: number
          created_at: string
          currency: string
          effective_from: string
          id: string
          minimum_minor: number
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_daily_minor?: number
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          minimum_minor?: number
          name?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_daily_minor?: number
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          minimum_minor?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          provider: string
          provider_ref: string | null
          status: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          provider: string
          provider_ref?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          airlines: Json
          budget_band: string | null
          cabin_class: string
          cabin_rule: string | null
          car_brands: Json
          car_child_seat: boolean
          car_class: string | null
          car_companies: Json
          car_navigation: boolean
          car_transmission: string
          created_at: string
          cuisines: Json
          diets: Json
          hotel_amenities: Json
          hotel_chains: Json
          hotel_max_km: number | null
          hotel_min_rating: number
          hotel_rating_level: string | null
          hotel_rules: string | null
          hotel_stars: Json
          hotel_types: Json
          interests: Json
          max_connections: number
          music: Json
          seat: string
          seat_front: boolean
          seat_legroom: boolean
          trip_purpose: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          airlines?: Json
          budget_band?: string | null
          cabin_class?: string
          cabin_rule?: string | null
          car_brands?: Json
          car_child_seat?: boolean
          car_class?: string | null
          car_companies?: Json
          car_navigation?: boolean
          car_transmission?: string
          created_at?: string
          cuisines?: Json
          diets?: Json
          hotel_amenities?: Json
          hotel_chains?: Json
          hotel_max_km?: number | null
          hotel_min_rating?: number
          hotel_rating_level?: string | null
          hotel_rules?: string | null
          hotel_stars?: Json
          hotel_types?: Json
          interests?: Json
          max_connections?: number
          music?: Json
          seat?: string
          seat_front?: boolean
          seat_legroom?: boolean
          trip_purpose?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          airlines?: Json
          budget_band?: string | null
          cabin_class?: string
          cabin_rule?: string | null
          car_brands?: Json
          car_child_seat?: boolean
          car_class?: string | null
          car_companies?: Json
          car_navigation?: boolean
          car_transmission?: string
          created_at?: string
          cuisines?: Json
          diets?: Json
          hotel_amenities?: Json
          hotel_chains?: Json
          hotel_max_km?: number | null
          hotel_min_rating?: number
          hotel_rating_level?: string | null
          hotel_rules?: string | null
          hotel_stars?: Json
          hotel_types?: Json
          interests?: Json
          max_connections?: number
          music?: Json
          seat?: string
          seat_front?: boolean
          seat_legroom?: boolean
          trip_purpose?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          change_fee_minor: number
          created_at: string
          currency: string
          discount_bps: number
          effective_from: string
          id: string
          line_type: string
          markup_bps: number
          plan: string
        }
        Insert: {
          change_fee_minor?: number
          created_at?: string
          currency?: string
          discount_bps?: number
          effective_from?: string
          id?: string
          line_type: string
          markup_bps?: number
          plan: string
        }
        Update: {
          change_fee_minor?: number
          created_at?: string
          currency?: string
          discount_bps?: number
          effective_from?: string
          id?: string
          line_type?: string
          markup_bps?: number
          plan?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          budget_per_trip: number | null
          cabin_class: string | null
          company: string | null
          created_at: string
          currency: string
          diet: string | null
          full_name: string | null
          home_airport: string
          hotel_chains: string | null
          id: string
          onboarded: boolean
          plan: string
          preferred_airlines: string | null
          seat_preference: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          budget_per_trip?: number | null
          cabin_class?: string | null
          company?: string | null
          created_at?: string
          currency?: string
          diet?: string | null
          full_name?: string | null
          home_airport?: string
          hotel_chains?: string | null
          id: string
          onboarded?: boolean
          plan?: string
          preferred_airlines?: string | null
          seat_preference?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          budget_per_trip?: number | null
          cabin_class?: string | null
          company?: string | null
          created_at?: string
          currency?: string
          diet?: string | null
          full_name?: string | null
          home_airport?: string
          hotel_chains?: string | null
          id?: string
          onboarded?: boolean
          plan?: string
          preferred_airlines?: string | null
          seat_preference?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          label: string
          priority: number
          provider: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          priority?: number
          provider: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          priority?: number
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_cards: {
        Row: {
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          items: Json
          markup_minor: number
          saved_minor: number
          saved_minutes: number
          status: string
          total_minor: number
          trip_request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          items?: Json
          markup_minor?: number
          saved_minor?: number
          saved_minutes?: number
          status?: string
          total_minor?: number
          trip_request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          items?: Json
          markup_minor?: number
          saved_minor?: number
          saved_minutes?: number
          status?: string
          total_minor?: number
          trip_request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cards_trip_request_id_fkey"
            columns: ["trip_request_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_items: {
        Row: {
          amount: number
          created_at: string
          currency: string
          detail: string | null
          documents: Json
          gross_minor: number
          id: string
          kind: string
          net_minor: number
          offer_reference: string | null
          payload: Json
          position: number
          provider: string | null
          status: string
          supplier: string | null
          supplier_order_id: string | null
          title: string
          trip_id: string
          type: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          detail?: string | null
          documents?: Json
          gross_minor?: number
          id?: string
          kind: string
          net_minor?: number
          offer_reference?: string | null
          payload?: Json
          position?: number
          provider?: string | null
          status?: string
          supplier?: string | null
          supplier_order_id?: string | null
          title: string
          trip_id: string
          type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          detail?: string | null
          documents?: Json
          gross_minor?: number
          id?: string
          kind?: string
          net_minor?: number
          offer_reference?: string | null
          payload?: Json
          position?: number
          provider?: string | null
          status?: string
          supplier?: string | null
          supplier_order_id?: string | null
          title?: string
          trip_id?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_reminders: {
        Row: {
          id: string
          kind: string
          sent_at: string
          trip_id: string
        }
        Insert: {
          id?: string
          kind: string
          sent_at?: string
          trip_id: string
        }
        Update: {
          id?: string
          kind?: string
          sent_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_reminders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_requests: {
        Row: {
          created_at: string
          id: string
          parsed: Json
          raw_sentence: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parsed?: Json
          raw_sentence: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parsed?: Json
          raw_sentence?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          booked_at: string | null
          card_id: string | null
          city: string | null
          company_id: string | null
          created_at: string
          currency: string
          data_source: string
          document_number: string | null
          end_date: string | null
          id: string
          origin: string | null
          segments: Json
          start_date: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booked_at?: string | null
          card_id?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          data_source?: string
          document_number?: string | null
          end_date?: string | null
          id?: string
          origin?: string | null
          segments?: Json
          start_date?: string | null
          status?: string
          title: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booked_at?: string | null
          card_id?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          data_source?: string
          document_number?: string | null
          end_date?: string | null
          id?: string
          origin?: string | null
          segments?: Json
          start_date?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "trip_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          referral_code: string
          sentence: string | null
          type: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          referral_code: string
          sentence?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          referral_code?: string
          sentence?: string | null
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
