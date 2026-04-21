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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_type: string
          city: string
          company_id: string
          country: string
          created_at: string
          id: string
          is_default: boolean | null
          postal_code: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_type: string
          city: string
          company_id?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_type?: string
          city?: string
          company_id?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          logo_url: string | null
          name: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_components: {
        Row: {
          bundle_variant_id: string
          company_id: string
          component_variant_id: string
          created_at: string | null
          id: string
          price_adjustment: number | null
          quantity_included: number
          updated_at: string | null
        }
        Insert: {
          bundle_variant_id: string
          company_id: string
          component_variant_id: string
          created_at?: string | null
          id?: string
          price_adjustment?: number | null
          quantity_included: number
          updated_at?: string | null
        }
        Update: {
          bundle_variant_id?: string
          company_id?: string
          component_variant_id?: string
          created_at?: string | null
          id?: string
          price_adjustment?: number | null
          quantity_included?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_components_bundle_variant_id_fkey"
            columns: ["bundle_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_components_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string | null
          company_id: string
          created_at: string | null
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          tax_amount: number
          tax_percentage: number
          unit_price: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          cart_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_percentage?: number
          unit_price?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          cart_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_percentage?: number
          unit_price?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bank_details: Json | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          slug: string
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bank_details?: Json | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          slug: string
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bank_details?: Json | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          slug?: string
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_modules: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_enabled: boolean | null
          module_code: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_code: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_code?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_parties: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_customer: boolean
          is_supplier: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_customer?: boolean
          is_supplier?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_customer?: boolean
          is_supplier?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_parties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          cd_percentage: number
          cn_date: string
          cn_number: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          order_id: string | null
          reason: string
          status: string
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          cd_percentage?: number
          cn_date?: string
          cn_number?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reason?: string
          status?: string
          tax_amount?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          cd_percentage?: number
          cn_date?: string
          cn_number?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reason?: string
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_periods: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          customer_id: string | null
          description: string | null
          end_date: string
          id: string
          order_id: string | null
          period: number
          start_date: string
          type: string
        }
        Insert: {
          amount: number
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          end_date: string
          id?: string
          order_id?: string | null
          period: number
          start_date: string
          type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          end_date?: string
          id?: string
          order_id?: string | null
          period?: number
          start_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_periods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_periods_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cd_days: number
          cd_enabled: boolean
          cd_percentage: number
          cd_settlement_mode: string
          company_id: string
          created_at: string | null
          credit_limit: number | null
          credit_period_days: number | null
          current_credit: number | null
          email: string | null
          id: string
          name: string
          party_id: string | null
          phone: string | null
          sales_executive_id: string | null
          source: string | null
          trn_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cd_days?: number
          cd_enabled?: boolean
          cd_percentage?: number
          cd_settlement_mode?: string
          company_id?: string
          created_at?: string | null
          credit_limit?: number | null
          credit_period_days?: number | null
          current_credit?: number | null
          email?: string | null
          id?: string
          name: string
          party_id?: string | null
          phone?: string | null
          sales_executive_id?: string | null
          source?: string | null
          trn_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cd_days?: number
          cd_enabled?: boolean
          cd_percentage?: number
          cd_settlement_mode?: string
          company_id?: string
          created_at?: string | null
          credit_limit?: number | null
          credit_period_days?: number | null
          current_credit?: number | null
          email?: string | null
          id?: string
          name?: string
          party_id?: string | null
          phone?: string | null
          sales_executive_id?: string | null
          source?: string | null
          trn_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "contact_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          effective_date: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_date: string
          from_currency: string
          id?: string
          rate: number
          to_currency: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          company_id: string | null
          config: Json | null
          created_at: string | null
          flag_name: string
          id: string
          is_enabled: boolean | null
          outlet_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          config?: Json | null
          created_at?: string | null
          flag_name: string
          id?: string
          is_enabled?: boolean | null
          outlet_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          config?: Json | null
          created_at?: string | null
          flag_name?: string
          id?: string
          is_enabled?: boolean | null
          outlet_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          company_name: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          contact_position: string | null
          converted_at: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          last_follow_up: string | null
          lost_at: string | null
          lost_reason: string | null
          next_follow_up: string | null
          notes: string | null
          postal_code: string | null
          priority: string
          sales_executive_id: string
          source: string
          stage: string
          state: string | null
          title: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string
          company_name?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          contact_position?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          last_follow_up?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string | null
          postal_code?: string | null
          priority?: string
          sales_executive_id: string
          source?: string
          stage?: string
          state?: string | null
          title: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          contact_position?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          last_follow_up?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string | null
          postal_code?: string | null
          priority?: string
          sales_executive_id?: string
          source?: string
          stage?: string
          state?: string | null
          title?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          max_select: number | null
          min_select: number
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_select?: number | null
          min_select?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_select?: number | null
          min_select?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          company_id: string
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          modifier_group_id: string
          name: string
          price_adjust: number
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          modifier_group_id: string
          name: string
          price_adjust?: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          modifier_group_id?: string
          name?: string
          price_adjust?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          company_id: string
          id: string
          modifier_id: string
          order_item_id: string
          price_adjust: number | null
        }
        Insert: {
          company_id?: string
          id?: string
          modifier_id: string
          order_item_id: string
          price_adjust?: number | null
        }
        Update: {
          company_id?: string
          id?: string
          modifier_id?: string
          order_item_id?: string
          price_adjust?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          company_id: string
          created_at: string | null
          discount_amount: number
          discount_percentage: number
          id: string
          line_total: number
          order_id: string | null
          product_id: string | null
          quantity: number
          tax_amount: number | null
          tax_percentage: number
          unit_price: number
          variant_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          discount_amount?: number
          discount_percentage?: number
          id?: string
          line_total?: number
          order_id?: string | null
          product_id?: string | null
          quantity: number
          tax_amount?: number | null
          tax_percentage?: number
          unit_price: number
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          discount_amount?: number
          discount_percentage?: number
          id?: string
          line_total?: number
          order_id?: string | null
          product_id?: string | null
          quantity?: number
          tax_amount?: number | null
          tax_percentage?: number
          unit_price?: number
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          status: string
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address_id: string | null
          cd_amount: number
          cd_days: number
          cd_enabled: boolean
          cd_percentage: number
          cd_settlement_mode: string
          cd_valid_until: string | null
          company_id: string
          created_at: string | null
          customer_id: string | null
          delivery_address: Json | null
          estimated_delivery: string | null
          extra_charges: Json
          extra_discount_amount: number
          extra_discount_percentage: number
          fulfillment_type: string | null
          id: string
          industry_context: string | null
          inventory_updated: boolean | null
          lead_id: string | null
          notes: string | null
          order_source: string | null
          order_type: string | null
          original_order_id: string | null
          outlet_id: string | null
          payment_intent_id: string | null
          payment_method: string | null
          payment_status: string | null
          pos_session_id: string | null
          quotation_id: string | null
          receipt_number: string | null
          round_off_amount: number
          sales_executive_id: string | null
          shipping_address_id: string | null
          status: string
          subtotal: number
          taxable_value: number
          total_amount: number
          total_discount: number
          total_extra_charges: number
          total_tax: number
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_address_id?: string | null
          cd_amount?: number
          cd_days?: number
          cd_enabled?: boolean
          cd_percentage?: number
          cd_settlement_mode?: string
          cd_valid_until?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          estimated_delivery?: string | null
          extra_charges?: Json
          extra_discount_amount?: number
          extra_discount_percentage?: number
          fulfillment_type?: string | null
          id?: string
          industry_context?: string | null
          inventory_updated?: boolean | null
          lead_id?: string | null
          notes?: string | null
          order_source?: string | null
          order_type?: string | null
          original_order_id?: string | null
          outlet_id?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pos_session_id?: string | null
          quotation_id?: string | null
          receipt_number?: string | null
          round_off_amount?: number
          sales_executive_id?: string | null
          shipping_address_id?: string | null
          status?: string
          subtotal?: number
          taxable_value?: number
          total_amount: number
          total_discount?: number
          total_extra_charges?: number
          total_tax?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_address_id?: string | null
          cd_amount?: number
          cd_days?: number
          cd_enabled?: boolean
          cd_percentage?: number
          cd_settlement_mode?: string
          cd_valid_until?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          estimated_delivery?: string | null
          extra_charges?: Json
          extra_discount_amount?: number
          extra_discount_percentage?: number
          fulfillment_type?: string | null
          id?: string
          industry_context?: string | null
          inventory_updated?: boolean | null
          lead_id?: string | null
          notes?: string | null
          order_source?: string | null
          order_type?: string | null
          original_order_id?: string | null
          outlet_id?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pos_session_id?: string | null
          quotation_id?: string | null
          receipt_number?: string | null
          round_off_amount?: number
          sales_executive_id?: string | null
          shipping_address_id?: string | null
          status?: string
          subtotal?: number
          taxable_value?: number
          total_amount?: number
          total_discount?: number
          total_extra_charges?: number
          total_tax?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_billing_address_id_fkey"
            columns: ["billing_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_recipe_inputs: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          notes: string | null
          product_id: string
          quantity_per_batch: number
          recipe_id: string
          variant_id: string
          wastage_per_unit: number
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity_per_batch?: number
          recipe_id: string
          variant_id: string
          wastage_per_unit?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity_per_batch?: number
          recipe_id?: string
          variant_id?: string
          wastage_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "packaging_recipe_inputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "packaging_recipe_inputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_recipe_inputs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "packaging_recipe_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_recipe_inputs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_recipe_outputs: {
        Row: {
          additional_cost_per_unit: number
          company_id: string
          created_at: string | null
          id: string
          notes: string | null
          product_id: string
          quantity_per_batch: number
          recipe_id: string
          variant_id: string
        }
        Insert: {
          additional_cost_per_unit?: number
          company_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity_per_batch?: number
          recipe_id: string
          variant_id: string
        }
        Update: {
          additional_cost_per_unit?: number
          company_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity_per_batch?: number
          recipe_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packaging_recipe_outputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "packaging_recipe_outputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_recipe_outputs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "packaging_recipe_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_recipe_outputs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_recipe_templates: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          recipe_type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          recipe_type?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          recipe_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_recipe_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cash_tendered: number | null
          change_given: number | null
          cheque_no: string | null
          company_id: string
          created_at: string | null
          id: string
          order_id: string | null
          payment_date: string | null
          payment_gateway_response: Json | null
          payment_method: string
          status: string
          stripe_payment_intent_id: string | null
          transaction_id: string | null
          transaction_references: Json | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          cash_tendered?: number | null
          change_given?: number | null
          cheque_no?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          payment_date?: string | null
          payment_gateway_response?: Json | null
          payment_method: string
          status: string
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          transaction_references?: Json | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cash_tendered?: number | null
          change_given?: number | null
          cheque_no?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          payment_date?: string | null
          payment_gateway_response?: Json | null
          payment_method?: string
          status?: string
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          transaction_references?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      pos_sessions: {
        Row: {
          cashier_id: string
          closed_at: string | null
          closing_cash: number | null
          company_id: string
          expected_cash: number | null
          id: string
          opened_at: string | null
          opening_cash: number | null
          outlet_id: string
          status: string | null
        }
        Insert: {
          cashier_id: string
          closed_at?: string | null
          closing_cash?: number | null
          company_id: string
          expected_cash?: number | null
          id?: string
          opened_at?: string | null
          opening_cash?: number | null
          outlet_id: string
          status?: string | null
        }
        Update: {
          cashier_id?: string
          closed_at?: string | null
          closing_cash?: number | null
          company_id?: string
          expected_cash?: number | null
          id?: string
          opened_at?: string | null
          opening_cash?: number | null
          outlet_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          company_id: string
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string | null
          variant_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id?: string | null
          variant_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          brand_id: string | null
          company_id: string
          created_at: string | null
          id: string
          mrp_price: number
          outlet_id: string | null
          price_type: string | null
          product_id: string | null
          sale_price: number
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
          variant_id: string | null
        }
        Insert: {
          brand_id?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          mrp_price: number
          outlet_id?: string | null
          price_type?: string | null
          product_id?: string | null
          sale_price: number
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          variant_id?: string | null
        }
        Update: {
          brand_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          mrp_price?: number
          outlet_id?: string | null
          price_type?: string | null
          product_id?: string | null
          sale_price?: number
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          badge: string | null
          best_before: string | null
          brand_id: string | null
          company_id: string
          created_at: string | null
          hsn: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_bundle: boolean
          is_default: boolean | null
          is_featured: boolean | null
          name: string
          packing_type: string | null
          price_id: string
          product_id: string
          sku: string | null
          stock_count: number | null
          tax_id: string | null
          type: string | null
          unit: number | null
          unit_type: string | null
          updated_at: string | null
        }
        Insert: {
          badge?: string | null
          best_before?: string | null
          brand_id?: string | null
          company_id: string
          created_at?: string | null
          hsn?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_bundle?: boolean
          is_default?: boolean | null
          is_featured?: boolean | null
          name: string
          packing_type?: string | null
          price_id: string
          product_id: string
          sku?: string | null
          stock_count?: number | null
          tax_id?: string | null
          type?: string | null
          unit?: number | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          badge?: string | null
          best_before?: string | null
          brand_id?: string | null
          company_id?: string
          created_at?: string | null
          hsn?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_bundle?: boolean
          is_default?: boolean | null
          is_featured?: boolean | null
          name?: string
          packing_type?: string | null
          price_id?: string
          product_id?: string
          sku?: string | null
          stock_count?: number | null
          tax_id?: string | null
          type?: string | null
          unit?: number | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "product_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          best_before: string | null
          brand_id: string | null
          category_id: string | null
          company_id: string
          created_at: string | null
          description: string | null
          hsn_code: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          nutritional_info: string | null
          origin: string | null
          price: number
          product_code: string | null
          sale_price: number | null
          slug: string
          stock_count: number | null
          subcategory_id: string | null
          tax: number | null
          unit: number | null
          unit_type: string | null
          updated_at: string | null
        }
        Insert: {
          badge?: string | null
          best_before?: string | null
          brand_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          nutritional_info?: string | null
          origin?: string | null
          price: number
          product_code?: string | null
          sale_price?: number | null
          slug: string
          stock_count?: number | null
          subcategory_id?: string | null
          tax?: number | null
          unit?: number | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          badge?: string | null
          best_before?: string | null
          brand_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          nutritional_info?: string | null
          origin?: string | null
          price?: number
          product_code?: string | null
          sale_price?: number | null
          slug?: string
          stock_count?: number | null
          subcategory_id?: string | null
          tax?: number | null
          unit?: number | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          company_id: string
          created_at: string
          discount_amount: number
          discount_percentage: number
          id: string
          line_total: number
          notes: string | null
          product_id: string | null
          quantity: number
          quotation_id: string
          tax_amount: number
          tax_percentage: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          discount_amount?: number
          discount_percentage?: number
          id?: string
          line_total?: number
          notes?: string | null
          product_id?: string | null
          quantity: number
          quotation_id: string
          tax_amount?: number
          tax_percentage?: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          discount_amount?: number
          discount_percentage?: number
          id?: string
          line_total?: number
          notes?: string | null
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          tax_amount?: number
          tax_percentage?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          company_id: string
          converted_to_order_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          extra_charges: Json
          extra_discount_amount: number | null
          extra_discount_percentage: number
          id: string
          lead_id: string | null
          notes: string | null
          parent_quotation_id: string | null
          quotation_number: string | null
          round_off_amount: number
          sales_executive_id: string | null
          status: string
          subtotal: number
          taxable_value: number
          terms_and_conditions: string | null
          total_amount: number | null
          total_discount: number | null
          total_extra_charges: number
          total_tax: number | null
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          company_id?: string
          converted_to_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          extra_charges?: Json
          extra_discount_amount?: number | null
          extra_discount_percentage?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          parent_quotation_id?: string | null
          quotation_number?: string | null
          round_off_amount?: number
          sales_executive_id?: string | null
          status?: string
          subtotal?: number
          taxable_value?: number
          terms_and_conditions?: string | null
          total_amount?: number | null
          total_discount?: number | null
          total_extra_charges?: number
          total_tax?: number | null
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          converted_to_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          extra_charges?: Json
          extra_discount_amount?: number | null
          extra_discount_percentage?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          parent_quotation_id?: string | null
          quotation_number?: string | null
          round_off_amount?: number
          sales_executive_id?: string | null
          status?: string
          subtotal?: number
          taxable_value?: number
          terms_and_conditions?: string | null
          total_amount?: number | null
          total_discount?: number | null
          total_extra_charges?: number
          total_tax?: number | null
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_parent_quotation_id_fkey"
            columns: ["parent_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      repack_order_inputs: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          input_quantity: number
          product_id: string
          repack_order_id: string
          variant_id: string
          wastage_quantity: number
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          id?: string
          input_quantity: number
          product_id: string
          repack_order_id: string
          variant_id: string
          wastage_quantity?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          input_quantity?: number
          product_id?: string
          repack_order_id?: string
          variant_id?: string
          wastage_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "repack_order_inputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "repack_order_inputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repack_order_inputs_repack_order_id_fkey"
            columns: ["repack_order_id"]
            isOneToOne: false
            referencedRelation: "repack_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repack_order_inputs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      repack_order_outputs: {
        Row: {
          additional_cost_per_unit: number
          company_id: string
          created_at: string | null
          id: string
          output_quantity: number
          product_id: string
          repack_order_id: string
          unit_cost: number
          variant_id: string
        }
        Insert: {
          additional_cost_per_unit?: number
          company_id?: string
          created_at?: string | null
          id?: string
          output_quantity: number
          product_id: string
          repack_order_id: string
          unit_cost?: number
          variant_id: string
        }
        Update: {
          additional_cost_per_unit?: number
          company_id?: string
          created_at?: string | null
          id?: string
          output_quantity?: number
          product_id?: string
          repack_order_id?: string
          unit_cost?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repack_order_outputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "repack_order_outputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repack_order_outputs_repack_order_id_fkey"
            columns: ["repack_order_id"]
            isOneToOne: false
            referencedRelation: "repack_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repack_order_outputs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      repack_orders: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          recipe_template_id: string | null
          status: string
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          recipe_template_id?: string | null
          status?: string
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          recipe_template_id?: string | null
          status?: string
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repack_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repack_orders_recipe_template_id_fkey"
            columns: ["recipe_template_id"]
            isOneToOne: false
            referencedRelation: "packaging_recipe_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repack_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          id: string
          is_system_role: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          period_end: string
          period_start: string
          period_type: string
          sales_executive_id: string
          target_amount: number
          updated_at: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          period_end: string
          period_start: string
          period_type: string
          sales_executive_id: string
          target_amount: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          period_end?: string
          period_start?: string
          period_type?: string
          sales_executive_id?: string
          target_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          outlet_id: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          source_type: string | null
          variant_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          outlet_id: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          source_type?: string | null
          variant_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          outlet_id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          source_type?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bank_accounts: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          bank_address: string | null
          bank_name: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string | null
          id: string
          ifsc_code: string | null
          is_primary: boolean | null
          postal_code: string | null
          state: string | null
          supplier_id: string
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_address?: string | null
          bank_name?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          is_primary?: boolean | null
          postal_code?: string | null
          state?: string | null
          supplier_id: string
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_address?: string | null
          bank_name?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          is_primary?: boolean | null
          postal_code?: string | null
          state?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_accounts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          closing_balance: number | null
          company_id: string
          contact_name: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          gst_no: string | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          name: string
          notes: string | null
          opening_balance: number | null
          pan_number: string | null
          party_id: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          supplier_code: string | null
          trade_name: string | null
          udyam_registration_number: string | null
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          closing_balance?: number | null
          company_id?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gst_no?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name: string
          notes?: string | null
          opening_balance?: number | null
          pan_number?: string | null
          party_id?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          supplier_code?: string | null
          trade_name?: string | null
          udyam_registration_number?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          closing_balance?: number | null
          company_id?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gst_no?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          opening_balance?: number | null
          pan_number?: string | null
          party_id?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          supplier_code?: string | null
          trade_name?: string | null
          udyam_registration_number?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "contact_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      taxes: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rate: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          role_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          role_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          role_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_collections: {
        Row: {
          collection_id: string
          display_order: number
          variant_id: string
        }
        Insert: {
          collection_id: string
          display_order?: number
          variant_id: string
        }
        Update: {
          collection_id?: string
          display_order?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_collections_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_modifier_groups: {
        Row: {
          display_order: number
          modifier_group_id: string
          variant_id: string
        }
        Insert: {
          display_order?: number
          modifier_group_id: string
          variant_id: string
        }
        Update: {
          display_order?: number
          modifier_group_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_modifier_groups_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_modifier_groups_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_inventory: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          location: string | null
          product_id: string
          reserved_stock: number | null
          stock_count: number | null
          updated_at: string | null
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          id?: string
          location?: string | null
          product_id: string
          reserved_stock?: number | null
          stock_count?: number | null
          updated_at?: string | null
          variant_id: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          location?: string | null
          product_id?: string
          reserved_stock?: number | null
          stock_count?: number | null
          updated_at?: string | null
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "warehouse_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_managers: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_managers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_managers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          postal_code: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_sales_daily: {
        Row: {
          company_id: string | null
          gross_amount: number | null
          net_amount: number | null
          order_count: number | null
          product_id: string | null
          sale_date: string | null
          sales_executive_id: string | null
          total_qty: number | null
          total_tax: number | null
          variant_id: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_outlet_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      party_ledger: {
        Row: {
          amount: number | null
          company_id: string | null
          doc_date: string | null
          doc_id: string | null
          doc_type: string | null
          ledger_side: string | null
          name: string | null
          party_id: string | null
          status: string | null
        }
        Relationships: []
      }
      product_stock_view: {
        Row: {
          name: string | null
          product_id: string | null
          total_stock: number | null
          warehouse_count: number | null
        }
        Relationships: []
      }
      stock_movements_expanded: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          movement_type: string | null
          notes: string | null
          outlet_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          source_type: string | null
          variant_id: string | null
          variant_name: string | null
          variant_sku: string | null
          warehouse_code: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_inventory_expanded: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string | null
          location: string | null
          product_id: string | null
          product_name: string | null
          reserved_stock: number | null
          stock_count: number | null
          updated_at: string | null
          variant_id: string | null
          variant_name: string | null
          variant_sku: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "warehouse_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_quotation: { Args: { p_quotation_id: string }; Returns: string }
      adjust_stock: {
        Args: {
          p_company_id: string
          p_created_by?: string
          p_physical_quantity: number
          p_product_id: string
          p_reason: string
          p_variant_id: string
          p_warehouse_id: string
        }
        Returns: Json
      }
      assign_user_roles: {
        Args: {
          p_company_id: string
          p_role_names: string[]
          p_user_id: string
        }
        Returns: Json
      }
      call_inventory_update: { Args: { order_id: string }; Returns: undefined }
      create_company_with_admin: {
        Args: {
          p_company_name: string
          p_company_slug: string
          p_email: string
          p_first_name?: string
          p_last_name?: string
          p_password: string
          p_phone?: string
        }
        Returns: Json
      }
      create_customer_with_user: {
        Args: {
          p_credit_limit?: number
          p_credit_period_days?: number
          p_current_credit?: number
          p_email?: string
          p_name: string
          p_password?: string
          p_phone?: string
          p_sales_executive_id?: string
          p_trn_number?: string
        }
        Returns: Json
      }
      current_company_id: { Args: never; Returns: string }
      decrement_quantity: {
        Args: { amount: number; item_id: string }
        Returns: number
      }
      get_company_modules: {
        Args: { p_company_id: string }
        Returns: {
          is_enabled: boolean
          module_code: string
          settings: Json
        }[]
      }
      get_user_accessible_modules: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: {
          module_code: string
        }[]
      }
      get_user_permissions: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: {
          action: string
          module: string
          permission_code: string
        }[]
      }
      get_user_role: { Args: { user_id: string }; Returns: string }
      get_user_roles: {
        Args: { p_company_id?: string; p_user_id: string }
        Returns: string[]
      }
      has_all_roles: {
        Args: {
          p_company_id?: string
          p_role_names: string[]
          p_user_id: string
        }
        Returns: boolean
      }
      has_any_role: {
        Args: {
          p_company_id?: string
          p_role_names: string[]
          p_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: { p_company_id?: string; p_role_name: string; p_user_id: string }
        Returns: boolean
      }
      has_warehouse_access: {
        Args: {
          p_company_id?: string
          p_user_id: string
          p_warehouse_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_admin_or_sales: { Args: { p_user_id: string }; Returns: boolean }
      is_sales: { Args: { p_user_id: string }; Returns: boolean }
      is_warehouse_manager: { Args: { p_user_id: string }; Returns: boolean }
      process_repack_order_v3: {
        Args: {
          p_company_id: string
          p_created_by: string
          p_repack_order_id: string
        }
        Returns: Json
      }
      profile_company_id: { Args: { user_id: string }; Returns: string }
      refresh_materialized_view: {
        Args: { view_name: string }
        Returns: undefined
      }
      sync_missing_profiles: { Args: never; Returns: number }
      transfer_stock: {
        Args: {
          p_company_id: string
          p_created_by?: string
          p_destination_warehouse_id: string
          p_items: Json
          p_notes?: string
          p_source_warehouse_id: string
        }
        Returns: Json
      }
      update_stock: {
        Args: { amount: number; p_id: string }
        Returns: undefined
      }
      user_has_permission: {
        Args: {
          p_company_id: string
          p_permission_code: string
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "user" | "admin" | "sales" | "accounts"
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
      user_role: ["user", "admin", "sales", "accounts"],
    },
  },
} as const
