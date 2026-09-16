export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      applied_migrations: {
        Row: {
          applied_at: string;
          name: string;
        };
        Insert: {
          applied_at?: string;
          name: string;
        };
        Update: {
          applied_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          after: Json | null;
          at: string;
          before: Json | null;
          entity: string;
          id: string;
        };
        Insert: {
          action: string;
          actor?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity: string;
          id?: string;
        };
        Update: {
          action?: string;
          actor?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity?: string;
          id?: string;
        };
        Relationships: [];
      };
      booking_delegations: {
        Row: {
          assistant_id: string;
          company_id: string;
          created_at: string;
          id: string;
          traveller_id: string;
        };
        Insert: {
          assistant_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          traveller_id: string;
        };
        Update: {
          assistant_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          traveller_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_delegations_assistant_id_fkey";
            columns: ["assistant_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_delegations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_delegations_traveller_id_fkey";
            columns: ["traveller_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          active: boolean;
          aliases: string[];
          alliance_or_group: string | null;
          created_at: string;
          id: string;
          kind: string;
          name: string;
          popularity_rank: number;
          regions: string[];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          aliases?: string[];
          alliance_or_group?: string | null;
          created_at?: string;
          id: string;
          kind: string;
          name: string;
          popularity_rank?: number;
          regions?: string[];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          aliases?: string[];
          alliance_or_group?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string;
          popularity_rank?: number;
          regions?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_entries: {
        Row: {
          amount_minor: number;
          budget_id: string;
          company_id: string;
          created_at: string;
          currency: string;
          id: string;
          kind: string;
          member_id: string | null;
          note: string | null;
          trip_id: string | null;
        };
        Insert: {
          amount_minor: number;
          budget_id: string;
          company_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          kind: string;
          member_id?: string | null;
          note?: string | null;
          trip_id?: string | null;
        };
        Update: {
          amount_minor?: number;
          budget_id?: string;
          company_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          kind?: string;
          member_id?: string | null;
          note?: string | null;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "budget_entries_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "travel_budgets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_entries_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_entries_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_releases: {
        Row: {
          amount_minor: number;
          budget_id: string;
          company_id: string;
          created_at: string;
          currency: string;
          id: string;
          kind: string;
          reason: string;
          released_by: string;
          requested_by: string | null;
          trip_id: string | null;
        };
        Insert: {
          amount_minor: number;
          budget_id: string;
          company_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          kind?: string;
          reason: string;
          released_by: string;
          requested_by?: string | null;
          trip_id?: string | null;
        };
        Update: {
          amount_minor?: number;
          budget_id?: string;
          company_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          kind?: string;
          reason?: string;
          released_by?: string;
          requested_by?: string | null;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "budget_releases_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "travel_budgets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_releases_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_releases_released_by_fkey";
            columns: ["released_by"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_releases_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_connections: {
        Row: {
          access_token: string | null;
          account_email: string | null;
          calendar_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          provider: string;
          read_enabled: boolean;
          refresh_token: string | null;
          time_zone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token?: string | null;
          account_email?: string | null;
          calendar_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider: string;
          read_enabled?: boolean;
          refresh_token?: string | null;
          time_zone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string | null;
          account_email?: string | null;
          calendar_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider?: string;
          read_enabled?: boolean;
          refresh_token?: string | null;
          time_zone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      calendar_feeds: {
        Row: {
          created_at: string;
          id: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      calendar_oauth_states: {
        Row: {
          created_at: string;
          provider: string;
          redirect_uri: string;
          state: string;
          time_zone: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          provider: string;
          redirect_uri: string;
          state: string;
          time_zone?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          provider?: string;
          redirect_uri?: string;
          state?: string;
          time_zone?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      calendar_trip_hints: {
        Row: {
          city: string;
          created_at: string;
          dismissed_at: string | null;
          ends_at: string;
          event_id: string;
          iata: string | null;
          id: string;
          location: string;
          provider: string;
          starts_at: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          city: string;
          created_at?: string;
          dismissed_at?: string | null;
          ends_at: string;
          event_id: string;
          iata?: string | null;
          id?: string;
          location: string;
          provider: string;
          starts_at: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          city?: string;
          created_at?: string;
          dismissed_at?: string | null;
          ends_at?: string;
          event_id?: string;
          iata?: string | null;
          id?: string;
          location?: string;
          provider?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      choice_feedback: {
        Row: {
          chosen: Json | null;
          chosen_reference: string | null;
          created_at: string;
          id: string;
          item_kind: string;
          reason: string | null;
          recommended: Json | null;
          rejected_reference: string | null;
          trip_card_id: string | null;
          user_id: string;
        };
        Insert: {
          chosen?: Json | null;
          chosen_reference?: string | null;
          created_at?: string;
          id?: string;
          item_kind: string;
          reason?: string | null;
          recommended?: Json | null;
          rejected_reference?: string | null;
          trip_card_id?: string | null;
          user_id: string;
        };
        Update: {
          chosen?: Json | null;
          chosen_reference?: string | null;
          created_at?: string;
          id?: string;
          item_kind?: string;
          reason?: string | null;
          recommended?: Json | null;
          rejected_reference?: string | null;
          trip_card_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "choice_feedback_card_id_fkey";
            columns: ["trip_card_id"];
            isOneToOne: false;
            referencedRelation: "trip_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          address: string | null;
          address_extra: string | null;
          building: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          id: string;
          invoice_email: string | null;
          invoice_emails: Json;
          is_default: boolean;
          legal_form: string | null;
          name: string;
          postcode: string | null;
          street: string | null;
          updated_at: string;
          user_id: string;
          vat_id: string | null;
        };
        Insert: {
          address?: string | null;
          address_extra?: string | null;
          building?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          invoice_email?: string | null;
          invoice_emails?: Json;
          is_default?: boolean;
          legal_form?: string | null;
          name: string;
          postcode?: string | null;
          street?: string | null;
          updated_at?: string;
          user_id: string;
          vat_id?: string | null;
        };
        Update: {
          address?: string | null;
          address_extra?: string | null;
          building?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          invoice_email?: string | null;
          invoice_emails?: Json;
          is_default?: boolean;
          legal_form?: string | null;
          name?: string;
          postcode?: string | null;
          street?: string | null;
          updated_at?: string;
          user_id?: string;
          vat_id?: string | null;
        };
        Relationships: [];
      };
      company_audit: {
        Row: {
          action: string;
          actor_id: string | null;
          company_id: string;
          created_at: string;
          detail: Json;
          id: string;
          target: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          company_id: string;
          created_at?: string;
          detail?: Json;
          id?: string;
          target?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          company_id?: string;
          created_at?: string;
          detail?: Json;
          id?: string;
          target?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_audit_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_audit_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      company_domains: {
        Row: {
          company_id: string;
          created_at: string;
          domain: string;
          id: string;
          verification_token: string;
          verified_at: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          domain: string;
          id?: string;
          verification_token: string;
          verified_at?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          domain?: string;
          id?: string;
          verification_token?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_domains_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      company_members: {
        Row: {
          approver_id: string | null;
          company_id: string;
          cost_centre_id: string | null;
          created_at: string;
          employee_number: string | null;
          grade_id: string | null;
          id: string;
          left_on: string | null;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          approver_id?: string | null;
          company_id: string;
          cost_centre_id?: string | null;
          created_at?: string;
          employee_number?: string | null;
          grade_id?: string | null;
          id?: string;
          left_on?: string | null;
          role?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          approver_id?: string | null;
          company_id?: string;
          cost_centre_id?: string | null;
          created_at?: string;
          employee_number?: string | null;
          grade_id?: string | null;
          id?: string;
          left_on?: string | null;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_cost_centre_id_fkey";
            columns: ["cost_centre_id"];
            isOneToOne: false;
            referencedRelation: "cost_centres";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_grade_id_fkey";
            columns: ["grade_id"];
            isOneToOne: false;
            referencedRelation: "travel_grades";
            referencedColumns: ["id"];
          },
        ];
      };
      cost_centres: {
        Row: {
          active: boolean;
          code: string;
          company_id: string;
          created_at: string;
          id: string;
          ledger_account: string | null;
          name: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          company_id: string;
          created_at?: string;
          id?: string;
          ledger_account?: string | null;
          name: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          ledger_account?: string | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cost_centres_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_attributions: {
        Row: {
          attributed_at: string;
          attribution_expires_at: string;
          code: string;
          created_at: string;
          creator_id: string;
          earning_until: string;
          id: string;
          user_id: string;
        };
        Insert: {
          attributed_at?: string;
          attribution_expires_at?: string;
          code: string;
          created_at?: string;
          creator_id: string;
          earning_until?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          attributed_at?: string;
          attribution_expires_at?: string;
          code?: string;
          created_at?: string;
          creator_id?: string;
          earning_until?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_attributions_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_clicks: {
        Row: {
          created_at: string;
          creator_id: string;
          id: string;
          source: string;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          id?: string;
          source?: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_clicks_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_commission_rules: {
        Row: {
          active: boolean;
          created_at: string;
          currency: string;
          earning_window_months: number;
          flat_minor: number;
          id: string;
          kind: string;
          line_type: string | null;
          plan: string | null;
          share_bps: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          currency?: string;
          earning_window_months?: number;
          flat_minor?: number;
          id?: string;
          kind: string;
          line_type?: string | null;
          plan?: string | null;
          share_bps?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          currency?: string;
          earning_window_months?: number;
          flat_minor?: number;
          id?: string;
          kind?: string;
          line_type?: string | null;
          plan?: string | null;
          share_bps?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_earnings: {
        Row: {
          amount_minor: number;
          basis: string;
          confirmable_at: string | null;
          created_at: string;
          creator_id: string;
          currency: string;
          id: string;
          kind: string;
          line_type: string | null;
          margin_minor: number;
          note: string | null;
          payout_id: string | null;
          share_bps: number;
          status: string;
          trip_id: string | null;
          trip_item_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_minor?: number;
          basis?: string;
          confirmable_at?: string | null;
          created_at?: string;
          creator_id: string;
          currency?: string;
          id?: string;
          kind?: string;
          line_type?: string | null;
          margin_minor?: number;
          note?: string | null;
          payout_id?: string | null;
          share_bps?: number;
          status?: string;
          trip_id?: string | null;
          trip_item_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          basis?: string;
          confirmable_at?: string | null;
          created_at?: string;
          creator_id?: string;
          currency?: string;
          id?: string;
          kind?: string;
          line_type?: string | null;
          margin_minor?: number;
          note?: string | null;
          payout_id?: string | null;
          share_bps?: number;
          status?: string;
          trip_id?: string | null;
          trip_item_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_earnings_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "creator_earnings_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "creator_payouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "creator_earnings_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "creator_earnings_trip_item_id_fkey";
            columns: ["trip_item_id"];
            isOneToOne: false;
            referencedRelation: "trip_items";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_payouts: {
        Row: {
          amount_minor: number;
          created_at: string;
          creator_id: string;
          currency: string;
          id: string;
          paid_at: string | null;
          paid_by: string | null;
          period_month: string;
          reference: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_minor?: number;
          created_at?: string;
          creator_id: string;
          currency?: string;
          id?: string;
          paid_at?: string | null;
          paid_by?: string | null;
          period_month: string;
          reference?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          creator_id?: string;
          currency?: string;
          id?: string;
          paid_at?: string | null;
          paid_by?: string | null;
          period_month?: string;
          reference?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_payouts_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      creators: {
        Row: {
          applied_at: string;
          approved_at: string | null;
          approved_by: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          licence_accepted_at: string | null;
          payout_entity: string | null;
          payout_iban_encrypted: string | null;
          payout_iban_last4: string | null;
          payout_vat_status: string | null;
          platforms: Json;
          review_note: string | null;
          short_code: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          applied_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          handle: string;
          id?: string;
          licence_accepted_at?: string | null;
          payout_entity?: string | null;
          payout_iban_encrypted?: string | null;
          payout_iban_last4?: string | null;
          payout_vat_status?: string | null;
          platforms?: Json;
          review_note?: string | null;
          short_code: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          applied_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string;
          id?: string;
          licence_accepted_at?: string | null;
          payout_entity?: string | null;
          payout_iban_encrypted?: string | null;
          payout_iban_last4?: string | null;
          payout_vat_status?: string | null;
          platforms?: Json;
          review_note?: string | null;
          short_code?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      credits: {
        Row: {
          amount_minor: number;
          created_at: string;
          currency: string;
          id: string;
          kind: string;
          reason: string;
          referral_id: string | null;
          trip_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          currency?: string;
          id?: string;
          kind: string;
          reason: string;
          referral_id?: string | null;
          trip_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          kind?: string;
          reason?: string;
          referral_id?: string | null;
          trip_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credits_referral_id_fkey";
            columns: ["referral_id"];
            isOneToOne: false;
            referencedRelation: "referrals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credits_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      error_log: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          route: string | null;
          stack: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          route?: string | null;
          stack?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          route?: string | null;
          stack?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          props: Json;
          session_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          props?: Json;
          session_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          props?: Json;
          session_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      getaway_destination_themes: {
        Row: {
          created_at: string;
          destination_id: string;
          editorial_angle: string | null;
          id: string;
          season_months: number[];
          theme_id: string;
        };
        Insert: {
          created_at?: string;
          destination_id: string;
          editorial_angle?: string | null;
          id?: string;
          season_months?: number[];
          theme_id: string;
        };
        Update: {
          created_at?: string;
          destination_id?: string;
          editorial_angle?: string | null;
          id?: string;
          season_months?: number[];
          theme_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "getaway_destination_themes_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "getaway_destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "getaway_destination_themes_theme_id_fkey";
            columns: ["theme_id"];
            isOneToOne: false;
            referencedRelation: "getaway_themes";
            referencedColumns: ["id"];
          },
        ];
      };
      getaway_destinations: {
        Row: {
          active: boolean;
          avoid_when: string | null;
          best_for: string | null;
          country: string;
          created_at: string;
          drivable_from: string[];
          editorial_note: string | null;
          hero_image_credit: string | null;
          hero_image_credit_url: string | null;
          hero_image_email_url: string | null;
          hero_image_fallback_url: string | null;
          hero_image_source: string | null;
          hero_image_url: string | null;
          id: string;
          latitude: number;
          longitude: number;
          name: string;
          nearest_airport_iata: string;
          travel_tips: Json;
          typical_nights: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          avoid_when?: string | null;
          best_for?: string | null;
          country: string;
          created_at?: string;
          drivable_from?: string[];
          editorial_note?: string | null;
          hero_image_credit?: string | null;
          hero_image_credit_url?: string | null;
          hero_image_email_url?: string | null;
          hero_image_fallback_url?: string | null;
          hero_image_source?: string | null;
          hero_image_url?: string | null;
          id?: string;
          latitude: number;
          longitude: number;
          name: string;
          nearest_airport_iata: string;
          travel_tips?: Json;
          typical_nights?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          avoid_when?: string | null;
          best_for?: string | null;
          country?: string;
          created_at?: string;
          drivable_from?: string[];
          editorial_note?: string | null;
          hero_image_credit?: string | null;
          hero_image_credit_url?: string | null;
          hero_image_email_url?: string | null;
          hero_image_fallback_url?: string | null;
          hero_image_source?: string | null;
          hero_image_url?: string | null;
          id?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
          nearest_airport_iata?: string;
          travel_tips?: Json;
          typical_nights?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      getaway_itineraries: {
        Row: {
          active: boolean;
          countries: string[];
          created_at: string;
          destination_id: string | null;
          featured: boolean;
          hero_image_credit: string | null;
          hero_image_credit_url: string | null;
          hero_image_url: string | null;
          id: string;
          nights: number;
          season: string | null;
          slug: string | null;
          stops_count: number;
          summary: string | null;
          themes: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          countries?: string[];
          created_at?: string;
          destination_id?: string | null;
          featured?: boolean;
          hero_image_credit?: string | null;
          hero_image_credit_url?: string | null;
          hero_image_url?: string | null;
          id?: string;
          nights?: number;
          season?: string | null;
          slug?: string | null;
          stops_count?: number;
          summary?: string | null;
          themes?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          countries?: string[];
          created_at?: string;
          destination_id?: string | null;
          featured?: boolean;
          hero_image_credit?: string | null;
          hero_image_credit_url?: string | null;
          hero_image_url?: string | null;
          id?: string;
          nights?: number;
          season?: string | null;
          slug?: string | null;
          stops_count?: number;
          summary?: string | null;
          themes?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "getaway_itineraries_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "getaway_destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      getaway_itinerary_days: {
        Row: {
          afternoon: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          day_number: number;
          drive_minutes: number | null;
          evening: string | null;
          id: string;
          image_credit: string | null;
          image_credit_url: string | null;
          image_fallback_url: string | null;
          image_source: string | null;
          image_url: string | null;
          itinerary_id: string;
          latitude: number | null;
          longitude: number | null;
          meal_place_ids: string[];
          morning: string | null;
          sleep_place_id: string | null;
          travel_note: string | null;
        };
        Insert: {
          afternoon?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          day_number: number;
          drive_minutes?: number | null;
          evening?: string | null;
          id?: string;
          image_credit?: string | null;
          image_credit_url?: string | null;
          image_fallback_url?: string | null;
          image_source?: string | null;
          image_url?: string | null;
          itinerary_id: string;
          latitude?: number | null;
          longitude?: number | null;
          meal_place_ids?: string[];
          morning?: string | null;
          sleep_place_id?: string | null;
          travel_note?: string | null;
        };
        Update: {
          afternoon?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          day_number?: number;
          drive_minutes?: number | null;
          evening?: string | null;
          id?: string;
          image_credit?: string | null;
          image_credit_url?: string | null;
          image_fallback_url?: string | null;
          image_source?: string | null;
          image_url?: string | null;
          itinerary_id?: string;
          latitude?: number | null;
          longitude?: number | null;
          meal_place_ids?: string[];
          morning?: string | null;
          sleep_place_id?: string | null;
          travel_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "getaway_itinerary_days_itinerary_id_fkey";
            columns: ["itinerary_id"];
            isOneToOne: false;
            referencedRelation: "getaway_itineraries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "getaway_itinerary_days_sleep_place_id_fkey";
            columns: ["sleep_place_id"];
            isOneToOne: false;
            referencedRelation: "getaway_places";
            referencedColumns: ["id"];
          },
        ];
      };
      getaway_places: {
        Row: {
          active: boolean;
          address: string | null;
          created_at: string;
          destination_id: string;
          editorial_note: string | null;
          family_friendly: boolean;
          id: string;
          kind: string;
          latitude: number | null;
          licence_accepted_at: string | null;
          longitude: number | null;
          name: string;
          photos: Json;
          post_url: string | null;
          price_band: string | null;
          review_note: string | null;
          review_status: string;
          submitted_by_creator_id: string | null;
          updated_at: string;
          visited_on: string | null;
          why_this_one: string | null;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          created_at?: string;
          destination_id: string;
          editorial_note?: string | null;
          family_friendly?: boolean;
          id?: string;
          kind: string;
          latitude?: number | null;
          licence_accepted_at?: string | null;
          longitude?: number | null;
          name: string;
          photos?: Json;
          post_url?: string | null;
          price_band?: string | null;
          review_note?: string | null;
          review_status?: string;
          submitted_by_creator_id?: string | null;
          updated_at?: string;
          visited_on?: string | null;
          why_this_one?: string | null;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          created_at?: string;
          destination_id?: string;
          editorial_note?: string | null;
          family_friendly?: boolean;
          id?: string;
          kind?: string;
          latitude?: number | null;
          licence_accepted_at?: string | null;
          longitude?: number | null;
          name?: string;
          photos?: Json;
          post_url?: string | null;
          price_band?: string | null;
          review_note?: string | null;
          review_status?: string;
          submitted_by_creator_id?: string | null;
          updated_at?: string;
          visited_on?: string | null;
          why_this_one?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "getaway_places_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "getaway_destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "getaway_places_submitted_by_creator_id_fkey";
            columns: ["submitted_by_creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      getaway_prices: {
        Row: {
          checked_at: string;
          currency: string;
          depart_date: string;
          destination_id: string;
          flight_minor: number | null;
          id: string;
          origin_iata: string;
          return_date: string;
          stay_minor: number | null;
        };
        Insert: {
          checked_at?: string;
          currency?: string;
          depart_date: string;
          destination_id: string;
          flight_minor?: number | null;
          id?: string;
          origin_iata: string;
          return_date: string;
          stay_minor?: number | null;
        };
        Update: {
          checked_at?: string;
          currency?: string;
          depart_date?: string;
          destination_id?: string;
          flight_minor?: number | null;
          id?: string;
          origin_iata?: string;
          return_date?: string;
          stay_minor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "getaway_prices_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "getaway_destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      getaway_proposals: {
        Row: {
          created_at: string;
          destination_id: string;
          emailed_at: string | null;
          id: string;
          reasons: Json;
          theme_id: string | null;
          user_id: string;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          destination_id: string;
          emailed_at?: string | null;
          id?: string;
          reasons?: Json;
          theme_id?: string | null;
          user_id: string;
          week_start: string;
        };
        Update: {
          created_at?: string;
          destination_id?: string;
          emailed_at?: string | null;
          id?: string;
          reasons?: Json;
          theme_id?: string | null;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "getaway_proposals_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "getaway_destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "getaway_proposals_theme_id_fkey";
            columns: ["theme_id"];
            isOneToOne: false;
            referencedRelation: "getaway_themes";
            referencedColumns: ["id"];
          },
        ];
      };
      getaway_theme_optouts: {
        Row: {
          created_at: string;
          id: string;
          theme_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          theme_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          theme_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "getaway_theme_optouts_theme_id_fkey";
            columns: ["theme_id"];
            isOneToOne: false;
            referencedRelation: "getaway_themes";
            referencedColumns: ["id"];
          },
        ];
      };
      getaway_themes: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          id: string;
          interest_tags: string[];
          name: string;
          season_months: number[];
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          interest_tags?: string[];
          name: string;
          season_months?: number[];
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          interest_tags?: string[];
          name?: string;
          season_months?: number[];
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      global_stay_rules: {
        Row: {
          allowed_types: string[];
          created_at: string;
          enabled: boolean;
          hint: string | null;
          id: string;
          label: string;
          rule_key: string;
          terms: string[];
          updated_at: string;
        };
        Insert: {
          allowed_types?: string[];
          created_at?: string;
          enabled?: boolean;
          hint?: string | null;
          id?: string;
          label: string;
          rule_key: string;
          terms?: string[];
          updated_at?: string;
        };
        Update: {
          allowed_types?: string[];
          created_at?: string;
          enabled?: boolean;
          hint?: string | null;
          id?: string;
          label?: string;
          rule_key?: string;
          terms?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      hotel_requests_missed: {
        Row: {
          checkin_date: string | null;
          created_at: string;
          destination_iata: string | null;
          id: string;
          name_requested: string;
        };
        Insert: {
          checkin_date?: string | null;
          created_at?: string;
          destination_iata?: string | null;
          id?: string;
          name_requested: string;
        };
        Update: {
          checkin_date?: string | null;
          created_at?: string;
          destination_iata?: string | null;
          id?: string;
          name_requested?: string;
        };
        Relationships: [];
      };
      insurance_rates: {
        Row: {
          active: boolean;
          base_daily_minor: number;
          created_at: string;
          currency: string;
          effective_from: string;
          id: string;
          minimum_minor: number;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          base_daily_minor?: number;
          created_at?: string;
          currency?: string;
          effective_from?: string;
          id?: string;
          minimum_minor?: number;
          name?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          base_daily_minor?: number;
          created_at?: string;
          currency?: string;
          effective_from?: string;
          id?: string;
          minimum_minor?: number;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      learned_overrides: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          kind: string;
          subject: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          kind: string;
          subject: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          subject?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      loyalty_earning_rules: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          matcher: string;
          note: string | null;
          programme_code: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          matcher: string;
          note?: string | null;
          programme_code: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          matcher?: string;
          note?: string | null;
          programme_code?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      loyalty_memberships: {
        Row: {
          airline_iata: string | null;
          category: string;
          created_at: string;
          id: string;
          member_number_encrypted: string | null;
          member_number_last4: string | null;
          programme_code: string;
          programme_label: string;
          tier: string | null;
          traveller_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          airline_iata?: string | null;
          category: string;
          created_at?: string;
          id?: string;
          member_number_encrypted?: string | null;
          member_number_last4?: string | null;
          programme_code: string;
          programme_label: string;
          tier?: string | null;
          traveller_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          airline_iata?: string | null;
          category?: string;
          created_at?: string;
          id?: string;
          member_number_encrypted?: string | null;
          member_number_last4?: string | null;
          programme_code?: string;
          programme_label?: string;
          tier?: string | null;
          traveller_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_memberships_traveller_id_fkey";
            columns: ["traveller_id"];
            isOneToOne: false;
            referencedRelation: "travel_companions";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_log: {
        Row: {
          channel: string;
          created_at: string;
          detail: string | null;
          id: string;
          kind: string;
          status: string;
          template: string;
          user_id: string | null;
        };
        Insert: {
          channel: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          kind: string;
          status: string;
          template: string;
          user_id?: string | null;
        };
        Update: {
          channel?: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          kind?: string;
          status?: string;
          template?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      payment_providers: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          label: string;
          priority: number;
          provider: string;
          settlement_model: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          label: string;
          priority?: number;
          provider: string;
          settlement_model?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          label?: string;
          priority?: number;
          provider?: string;
          settlement_model?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_minor: number;
          capture_note: string | null;
          captured_minor: number;
          card_brand: string | null;
          card_last4: string | null;
          created_at: string;
          currency: string;
          failure_note: string | null;
          id: string;
          idempotency_key: string;
          method: string | null;
          provider: string;
          provider_ref: string | null;
          settlement_model: string | null;
          status: string;
          three_ds_status: string | null;
          trip_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_minor?: number;
          capture_note?: string | null;
          captured_minor?: number;
          card_brand?: string | null;
          card_last4?: string | null;
          created_at?: string;
          currency?: string;
          failure_note?: string | null;
          id?: string;
          idempotency_key: string;
          method?: string | null;
          provider: string;
          provider_ref?: string | null;
          settlement_model?: string | null;
          status?: string;
          three_ds_status?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_minor?: number;
          capture_note?: string | null;
          captured_minor?: number;
          card_brand?: string | null;
          card_last4?: string | null;
          created_at?: string;
          currency?: string;
          failure_note?: string | null;
          id?: string;
          idempotency_key?: string;
          method?: string | null;
          provider?: string;
          provider_ref?: string | null;
          settlement_model?: string | null;
          status?: string;
          three_ds_status?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      place_cache: {
        Row: {
          cache_key: string;
          fetched_at: string;
          payload: Json;
        };
        Insert: {
          cache_key: string;
          fetched_at?: string;
          payload?: Json;
        };
        Update: {
          cache_key?: string;
          fetched_at?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      planning_rules: {
        Row: {
          active: boolean;
          business_extra_margin_min: number;
          created_at: string;
          id: string;
          name: string;
          non_schengen_clear_min: number;
          safety_margin_min: number;
          schengen_clear_min: number;
          transfer_base_min: number;
          transfer_min_per_km: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          business_extra_margin_min?: number;
          created_at?: string;
          id?: string;
          name: string;
          non_schengen_clear_min?: number;
          safety_margin_min?: number;
          schengen_clear_min?: number;
          transfer_base_min?: number;
          transfer_min_per_km?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          business_extra_margin_min?: number;
          created_at?: string;
          id?: string;
          name?: string;
          non_schengen_clear_min?: number;
          safety_margin_min?: number;
          schengen_clear_min?: number;
          transfer_base_min?: number;
          transfer_min_per_km?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      preferences: {
        Row: {
          accessibility_note: string | null;
          airlines: Json;
          avoid_note: string | null;
          budget_band: string | null;
          business_prefs: Json;
          cabin_class: string;
          cabin_rule: string | null;
          car_brands: Json;
          car_child_seat: boolean;
          car_class: string | null;
          car_companies: Json;
          car_navigation: boolean;
          car_transmission: string;
          created_at: string;
          cuisines: Json;
          dealbreakers: Json;
          diets: Json;
          extra_answers: Json;
          hotel_amenities: Json;
          hotel_chains: Json;
          hotel_max_km: number | null;
          hotel_min_rating: number;
          hotel_rating_level: string | null;
          hotel_rules: string | null;
          hotel_stars: Json;
          hotel_types: Json;
          interests: Json;
          location_consent: string;
          max_connections: number;
          music: Json;
          seat: string;
          seat_front: boolean;
          seat_legroom: boolean;
          trip_purpose: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accessibility_note?: string | null;
          airlines?: Json;
          avoid_note?: string | null;
          budget_band?: string | null;
          business_prefs?: Json;
          cabin_class?: string;
          cabin_rule?: string | null;
          car_brands?: Json;
          car_child_seat?: boolean;
          car_class?: string | null;
          car_companies?: Json;
          car_navigation?: boolean;
          car_transmission?: string;
          created_at?: string;
          cuisines?: Json;
          dealbreakers?: Json;
          diets?: Json;
          extra_answers?: Json;
          hotel_amenities?: Json;
          hotel_chains?: Json;
          hotel_max_km?: number | null;
          hotel_min_rating?: number;
          hotel_rating_level?: string | null;
          hotel_rules?: string | null;
          hotel_stars?: Json;
          hotel_types?: Json;
          interests?: Json;
          location_consent?: string;
          max_connections?: number;
          music?: Json;
          seat?: string;
          seat_front?: boolean;
          seat_legroom?: boolean;
          trip_purpose?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accessibility_note?: string | null;
          airlines?: Json;
          avoid_note?: string | null;
          budget_band?: string | null;
          business_prefs?: Json;
          cabin_class?: string;
          cabin_rule?: string | null;
          car_brands?: Json;
          car_child_seat?: boolean;
          car_class?: string | null;
          car_companies?: Json;
          car_navigation?: boolean;
          car_transmission?: string;
          created_at?: string;
          cuisines?: Json;
          dealbreakers?: Json;
          diets?: Json;
          extra_answers?: Json;
          hotel_amenities?: Json;
          hotel_chains?: Json;
          hotel_max_km?: number | null;
          hotel_min_rating?: number;
          hotel_rating_level?: string | null;
          hotel_rules?: string | null;
          hotel_stars?: Json;
          hotel_types?: Json;
          interests?: Json;
          location_consent?: string;
          max_connections?: number;
          music?: Json;
          seat?: string;
          seat_front?: boolean;
          seat_legroom?: boolean;
          trip_purpose?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          change_fee_minor: number;
          created_at: string;
          currency: string;
          discount_bps: number;
          effective_from: string;
          id: string;
          line_type: string;
          markup_bps: number;
          plan: string;
        };
        Insert: {
          change_fee_minor?: number;
          created_at?: string;
          currency?: string;
          discount_bps?: number;
          effective_from?: string;
          id?: string;
          line_type: string;
          markup_bps?: number;
          plan: string;
        };
        Update: {
          change_fee_minor?: number;
          created_at?: string;
          currency?: string;
          discount_bps?: number;
          effective_from?: string;
          id?: string;
          line_type?: string;
          markup_bps?: number;
          plan?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          budget_per_trip: number | null;
          cabin_class: string | null;
          company: string | null;
          created_at: string;
          currency: string;
          diet: string | null;
          full_name: string | null;
          home_airport: string;
          hotel_chains: string | null;
          id: string;
          is_admin: boolean;
          notify_channel: string;
          onboarded: boolean;
          plan: string;
          preferred_airlines: string | null;
          seat_preference: string | null;
          tax_id: string | null;
          traveller_born_on: string | null;
          traveller_email: string | null;
          traveller_family_name: string | null;
          traveller_gender: string | null;
          traveller_given_name: string | null;
          traveller_phone: string | null;
          traveller_title: string | null;
          updated_at: string;
          whatsapp_phone: string | null;
          whatsapp_verified_at: string | null;
        };
        Insert: {
          budget_per_trip?: number | null;
          cabin_class?: string | null;
          company?: string | null;
          created_at?: string;
          currency?: string;
          diet?: string | null;
          full_name?: string | null;
          home_airport?: string;
          hotel_chains?: string | null;
          id: string;
          is_admin?: boolean;
          notify_channel?: string;
          onboarded?: boolean;
          plan?: string;
          preferred_airlines?: string | null;
          seat_preference?: string | null;
          tax_id?: string | null;
          traveller_born_on?: string | null;
          traveller_email?: string | null;
          traveller_family_name?: string | null;
          traveller_gender?: string | null;
          traveller_given_name?: string | null;
          traveller_phone?: string | null;
          traveller_title?: string | null;
          updated_at?: string;
          whatsapp_phone?: string | null;
          whatsapp_verified_at?: string | null;
        };
        Update: {
          budget_per_trip?: number | null;
          cabin_class?: string | null;
          company?: string | null;
          created_at?: string;
          currency?: string;
          diet?: string | null;
          full_name?: string | null;
          home_airport?: string;
          hotel_chains?: string | null;
          id?: string;
          is_admin?: boolean;
          notify_channel?: string;
          onboarded?: boolean;
          plan?: string;
          preferred_airlines?: string | null;
          seat_preference?: string | null;
          tax_id?: string | null;
          traveller_born_on?: string | null;
          traveller_email?: string | null;
          traveller_family_name?: string | null;
          traveller_gender?: string | null;
          traveller_given_name?: string | null;
          traveller_phone?: string | null;
          traveller_title?: string | null;
          updated_at?: string;
          whatsapp_phone?: string | null;
          whatsapp_verified_at?: string | null;
        };
        Relationships: [];
      };
      providers: {
        Row: {
          category: string;
          created_at: string;
          enabled: boolean;
          id: string;
          label: string;
          priority: number;
          provider: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          label: string;
          priority?: number;
          provider: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          label?: string;
          priority?: number;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      referral_codes: {
        Row: {
          code: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          code: string;
          created_at: string;
          granted_at: string | null;
          id: string;
          referred_email: string | null;
          referred_user_id: string | null;
          referrer_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          granted_at?: string | null;
          id?: string;
          referred_email?: string | null;
          referred_user_id?: string | null;
          referrer_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          granted_at?: string | null;
          id?: string;
          referred_email?: string | null;
          referred_user_id?: string | null;
          referrer_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_cards: {
        Row: {
          brand: string | null;
          cardholder_name: string | null;
          created_at: string;
          exp_month: number | null;
          exp_year: number | null;
          id: string;
          is_default: boolean;
          last4: string | null;
          provider: string;
          provider_card_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          brand?: string | null;
          cardholder_name?: string | null;
          created_at?: string;
          exp_month?: number | null;
          exp_year?: number | null;
          id?: string;
          is_default?: boolean;
          last4?: string | null;
          provider?: string;
          provider_card_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand?: string | null;
          cardholder_name?: string | null;
          created_at?: string;
          exp_month?: number | null;
          exp_year?: number | null;
          id?: string;
          is_default?: boolean;
          last4?: string | null;
          provider?: string;
          provider_card_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          id: string;
          plan: string;
          status: string;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          plan?: string;
          status?: string;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          plan?: string;
          status?: string;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      supplier_events: {
        Row: {
          event_id: string;
          event_kind: string;
          id: string;
          order_reference: string | null;
          provider: string;
          received_at: string;
        };
        Insert: {
          event_id: string;
          event_kind: string;
          id?: string;
          order_reference?: string | null;
          provider?: string;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          event_kind?: string;
          id?: string;
          order_reference?: string | null;
          provider?: string;
          received_at?: string;
        };
        Relationships: [];
      };
      support_requests: {
        Row: {
          admin_note: string | null;
          category: string;
          contact_email: string | null;
          created_at: string;
          description: string;
          id: string;
          status: string;
          trip_id: string | null;
          trip_reference: string | null;
          updated_at: string;
          urgency: string;
          user_id: string;
        };
        Insert: {
          admin_note?: string | null;
          category?: string;
          contact_email?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          status?: string;
          trip_id?: string | null;
          trip_reference?: string | null;
          updated_at?: string;
          urgency?: string;
          user_id: string;
        };
        Update: {
          admin_note?: string | null;
          category?: string;
          contact_email?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          status?: string;
          trip_id?: string | null;
          trip_reference?: string | null;
          updated_at?: string;
          urgency?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_requests_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      travel_budgets: {
        Row: {
          active: boolean;
          company_id: string;
          cost_centre_id: string | null;
          created_at: string;
          currency: string;
          deputy_after_hours: number | null;
          deputy_id: string | null;
          id: string;
          limit_minor: number;
          member_id: string | null;
          name: string;
          period: string;
          period_start: string;
          project_code: string | null;
          rebillable: boolean;
          release_authority_id: string;
          rolls_over: boolean;
          scope: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          cost_centre_id?: string | null;
          created_at?: string;
          currency?: string;
          deputy_after_hours?: number | null;
          deputy_id?: string | null;
          id?: string;
          limit_minor: number;
          member_id?: string | null;
          name: string;
          period?: string;
          period_start: string;
          project_code?: string | null;
          rebillable?: boolean;
          release_authority_id: string;
          rolls_over?: boolean;
          scope: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          cost_centre_id?: string | null;
          created_at?: string;
          currency?: string;
          deputy_after_hours?: number | null;
          deputy_id?: string | null;
          id?: string;
          limit_minor?: number;
          member_id?: string | null;
          name?: string;
          period?: string;
          period_start?: string;
          project_code?: string | null;
          rebillable?: boolean;
          release_authority_id?: string;
          rolls_over?: boolean;
          scope?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "travel_budgets_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "travel_budgets_cost_centre_id_fkey";
            columns: ["cost_centre_id"];
            isOneToOne: false;
            referencedRelation: "cost_centres";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "travel_budgets_deputy_id_fkey";
            columns: ["deputy_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "travel_budgets_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "travel_budgets_release_authority_id_fkey";
            columns: ["release_authority_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
        ];
      };
      travel_companions: {
        Row: {
          address_city: string | null;
          address_country: string | null;
          address_line1: string | null;
          address_line2: string | null;
          address_postcode: string | null;
          born_on_encrypted: string | null;
          created_at: string;
          email_encrypted: string | null;
          family_name_encrypted: string;
          gender: string | null;
          given_name_encrypted: string;
          id: string;
          is_self: boolean;
          label: string;
          passport_country: string | null;
          passport_expiry: string | null;
          passport_last4: string | null;
          passport_number_encrypted: string | null;
          phone_encrypted: string | null;
          relationship: string | null;
          sort_order: number;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address_city?: string | null;
          address_country?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          address_postcode?: string | null;
          born_on_encrypted?: string | null;
          created_at?: string;
          email_encrypted?: string | null;
          family_name_encrypted: string;
          gender?: string | null;
          given_name_encrypted: string;
          id?: string;
          is_self?: boolean;
          label: string;
          passport_country?: string | null;
          passport_expiry?: string | null;
          passport_last4?: string | null;
          passport_number_encrypted?: string | null;
          phone_encrypted?: string | null;
          relationship?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address_city?: string | null;
          address_country?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          address_postcode?: string | null;
          born_on_encrypted?: string | null;
          created_at?: string;
          email_encrypted?: string | null;
          family_name_encrypted?: string;
          gender?: string | null;
          given_name_encrypted?: string;
          id?: string;
          is_self?: boolean;
          label?: string;
          passport_country?: string | null;
          passport_expiry?: string | null;
          passport_last4?: string | null;
          passport_number_encrypted?: string | null;
          phone_encrypted?: string | null;
          relationship?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      travel_grades: {
        Row: {
          cabin: string;
          cabin_from_hours: number;
          car_class: string;
          company_id: string;
          created_at: string;
          hotel_cap_minor: number;
          id: string;
          key: string;
          lounge: string;
          name: string;
          notice_days: number;
          per_diem_minor: number;
          rail_class: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          cabin?: string;
          cabin_from_hours?: number;
          car_class?: string;
          company_id: string;
          created_at?: string;
          hotel_cap_minor?: number;
          id?: string;
          key: string;
          lounge?: string;
          name: string;
          notice_days?: number;
          per_diem_minor?: number;
          rail_class?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          cabin?: string;
          cabin_from_hours?: number;
          car_class?: string;
          company_id?: string;
          created_at?: string;
          hotel_cap_minor?: number;
          id?: string;
          key?: string;
          lounge?: string;
          name?: string;
          notice_days?: number;
          per_diem_minor?: number;
          rail_class?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "travel_grades_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      traveller_patterns: {
        Row: {
          asked_at: string | null;
          confidence: number;
          created_at: string;
          evidence_count: number;
          first_seen: string;
          id: string;
          last_seen: string;
          pattern_kind: string;
          status: string;
          updated_at: string;
          user_id: string;
          value: string;
        };
        Insert: {
          asked_at?: string | null;
          confidence?: number;
          created_at?: string;
          evidence_count?: number;
          first_seen?: string;
          id?: string;
          last_seen?: string;
          pattern_kind: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          value: string;
        };
        Update: {
          asked_at?: string | null;
          confidence?: number;
          created_at?: string;
          evidence_count?: number;
          first_seen?: string;
          id?: string;
          last_seen?: string;
          pattern_kind?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          value?: string;
        };
        Relationships: [];
      };
      traveller_place_memory: {
        Row: {
          created_at: string;
          id: string;
          item_kind: string;
          item_name: string;
          item_ref: string | null;
          last_chosen_at: string;
          place: string;
          source: string;
          times_chosen: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_kind: string;
          item_name: string;
          item_ref?: string | null;
          last_chosen_at?: string;
          place: string;
          source?: string;
          times_chosen?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_kind?: string;
          item_name?: string;
          item_ref?: string | null;
          last_chosen_at?: string;
          place?: string;
          source?: string;
          times_chosen?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trip_approvals: {
        Row: {
          amount_minor: number;
          company_id: string;
          created_at: string;
          currency: string;
          decided_at: string | null;
          decided_note: string | null;
          decider_id: string;
          detail: Json;
          escalate_after: string | null;
          id: string;
          member_id: string;
          reason: string;
          status: string;
          trip_id: string | null;
        };
        Insert: {
          amount_minor?: number;
          company_id: string;
          created_at?: string;
          currency?: string;
          decided_at?: string | null;
          decided_note?: string | null;
          decider_id: string;
          detail?: Json;
          escalate_after?: string | null;
          id?: string;
          member_id: string;
          reason: string;
          status?: string;
          trip_id?: string | null;
        };
        Update: {
          amount_minor?: number;
          company_id?: string;
          created_at?: string;
          currency?: string;
          decided_at?: string | null;
          decided_note?: string | null;
          decider_id?: string;
          detail?: Json;
          escalate_after?: string | null;
          id?: string;
          member_id?: string;
          reason?: string;
          status?: string;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_approvals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_approvals_decider_id_fkey";
            columns: ["decider_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_approvals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_cards: {
        Row: {
          created_at: string;
          currency: string;
          expires_at: string | null;
          id: string;
          items: Json;
          markup_minor: number;
          saved_minor: number;
          saved_minutes: number;
          status: string;
          total_minor: number;
          trip_request_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          items?: Json;
          markup_minor?: number;
          saved_minor?: number;
          saved_minutes?: number;
          status?: string;
          total_minor?: number;
          trip_request_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          items?: Json;
          markup_minor?: number;
          saved_minor?: number;
          saved_minutes?: number;
          status?: string;
          total_minor?: number;
          trip_request_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_cards_trip_request_id_fkey";
            columns: ["trip_request_id"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_changes: {
        Row: {
          after: Json;
          before: Json;
          created_at: string;
          currency: string;
          difference_minor: number;
          fee_minor: number;
          id: string;
          kind: string;
          method: string;
          note: string | null;
          status: string;
          trip_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          after?: Json;
          before?: Json;
          created_at?: string;
          currency?: string;
          difference_minor?: number;
          fee_minor?: number;
          id?: string;
          kind: string;
          method: string;
          note?: string | null;
          status?: string;
          trip_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          after?: Json;
          before?: Json;
          created_at?: string;
          currency?: string;
          difference_minor?: number;
          fee_minor?: number;
          id?: string;
          kind?: string;
          method?: string;
          note?: string | null;
          status?: string;
          trip_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_changes_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_feedback: {
        Row: {
          booking_reference: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          occasion: string | null;
          party: string | null;
          purpose: string | null;
          rating: number;
          rating_key: string;
          trip_card_id: string | null;
          user_id: string;
        };
        Insert: {
          booking_reference?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          occasion?: string | null;
          party?: string | null;
          purpose?: string | null;
          rating: number;
          rating_key: string;
          trip_card_id?: string | null;
          user_id: string;
        };
        Update: {
          booking_reference?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          occasion?: string | null;
          party?: string | null;
          purpose?: string | null;
          rating?: number;
          rating_key?: string;
          trip_card_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_feedback_trip_card_id_fkey";
            columns: ["trip_card_id"];
            isOneToOne: false;
            referencedRelation: "trip_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_items: {
        Row: {
          amount: number;
          ancillaries: Json;
          calendar_event_ids: Json;
          created_at: string;
          currency: string;
          detail: string | null;
          documents: Json;
          gross_minor: number;
          id: string;
          kind: string;
          net_minor: number;
          offer_reference: string | null;
          payload: Json;
          position: number;
          provider: string | null;
          status: string;
          supplier: string | null;
          supplier_order_id: string | null;
          title: string;
          trip_id: string;
          type: string | null;
          user_id: string;
        };
        Insert: {
          amount?: number;
          ancillaries?: Json;
          calendar_event_ids?: Json;
          created_at?: string;
          currency?: string;
          detail?: string | null;
          documents?: Json;
          gross_minor?: number;
          id?: string;
          kind: string;
          net_minor?: number;
          offer_reference?: string | null;
          payload?: Json;
          position?: number;
          provider?: string | null;
          status?: string;
          supplier?: string | null;
          supplier_order_id?: string | null;
          title: string;
          trip_id: string;
          type?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          ancillaries?: Json;
          calendar_event_ids?: Json;
          created_at?: string;
          currency?: string;
          detail?: string | null;
          documents?: Json;
          gross_minor?: number;
          id?: string;
          kind?: string;
          net_minor?: number;
          offer_reference?: string | null;
          payload?: Json;
          position?: number;
          provider?: string | null;
          status?: string;
          supplier?: string | null;
          supplier_order_id?: string | null;
          title?: string;
          trip_id?: string;
          type?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_items_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_reminders: {
        Row: {
          id: string;
          kind: string;
          sent_at: string;
          trip_id: string;
        };
        Insert: {
          id?: string;
          kind: string;
          sent_at?: string;
          trip_id: string;
        };
        Update: {
          id?: string;
          kind?: string;
          sent_at?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_reminders_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_requests: {
        Row: {
          created_at: string;
          id: string;
          parsed: Json;
          raw_sentence: string;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parsed?: Json;
          raw_sentence: string;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parsed?: Json;
          raw_sentence?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          booked_at: string | null;
          card_id: string | null;
          city: string | null;
          company_id: string | null;
          created_at: string;
          currency: string;
          data_source: string;
          document_number: string | null;
          end_date: string | null;
          id: string;
          origin: string | null;
          segments: Json;
          start_date: string | null;
          status: string;
          title: string;
          total_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          booked_at?: string | null;
          card_id?: string | null;
          city?: string | null;
          company_id?: string | null;
          created_at?: string;
          currency?: string;
          data_source?: string;
          document_number?: string | null;
          end_date?: string | null;
          id?: string;
          origin?: string | null;
          segments?: Json;
          start_date?: string | null;
          status?: string;
          title: string;
          total_amount?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          booked_at?: string | null;
          card_id?: string | null;
          city?: string | null;
          company_id?: string | null;
          created_at?: string;
          currency?: string;
          data_source?: string;
          document_number?: string | null;
          end_date?: string | null;
          id?: string;
          origin?: string | null;
          segments?: Json;
          start_date?: string | null;
          status?: string;
          title?: string;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "trip_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          invite_error: string | null;
          invited_at: string | null;
          referral_code: string;
          sentence: string | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          invite_error?: string | null;
          invited_at?: string | null;
          referral_code: string;
          sentence?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          invite_error?: string | null;
          invited_at?: string | null;
          referral_code?: string;
          sentence?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      whatsapp_verifications: {
        Row: {
          attempts: number;
          code_hash: string;
          created_at: string;
          expires_at: string;
          phone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          created_at?: string;
          expires_at: string;
          phone: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          created_at?: string;
          expires_at?: string;
          phone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_analytics: { Args: never; Returns: Json };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_company_admin: { Args: { _company_id: string }; Returns: boolean };
      members_i_oversee: { Args: never; Returns: string[] };
      my_company_id: { Args: never; Returns: string };
      my_member_id: { Args: never; Returns: string };
      owns_creator: { Args: { _creator_id: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
