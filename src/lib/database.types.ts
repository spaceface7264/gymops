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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          gym_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          gym_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          gym_id?: string | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_acks: {
        Row: {
          acknowledged_at: string
          guide_id: string
          user_id: string
          version: number
        }
        Insert: {
          acknowledged_at?: string
          guide_id: string
          user_id: string
          version: number
        }
        Update: {
          acknowledged_at?: string
          guide_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guide_acks_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_acks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_categories: {
        Row: {
          created_at: string
          created_by: string | null
          gym_id: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gym_id?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gym_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_categories_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "guide_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          body: Json
          body_text: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          gym_id: string | null
          id: string
          published_at: string | null
          requires_ack: boolean
          search_vector: unknown
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          body?: Json
          body_text?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gym_id?: string | null
          id?: string
          published_at?: string | null
          requires_ack?: boolean
          search_vector?: unknown
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          body?: Json
          body_text?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gym_id?: string | null
          id?: string
          published_at?: string | null
          requires_ack?: boolean
          search_vector?: unknown
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guides_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "guide_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guides_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          gym_id: string
          id: string
          role: Database["public"]["Enums"]["gym_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gym_id: string
          id?: string
          role: Database["public"]["Enums"]["gym_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gym_id?: string
          id?: string
          role?: Database["public"]["Enums"]["gym_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_memberships_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          as_admin: boolean
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          gym_id: string | null
          id: string
          role: Database["public"]["Enums"]["gym_role"] | null
          status: Database["public"]["Enums"]["invite_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          as_admin?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["gym_role"] | null
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          as_admin?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["gym_role"] | null
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reads: {
        Row: {
          acknowledged_at: string | null
          post_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          post_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          post_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reads_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: Json
          body_text: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          gym_id: string | null
          id: string
          pinned: boolean
          published_at: string | null
          requires_ack: boolean
          search_vector: unknown
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: Json
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gym_id?: string | null
          id?: string
          pinned?: boolean
          published_at?: string | null
          requires_ack?: boolean
          search_vector?: unknown
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: Json
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gym_id?: string | null
          id?: string
          pinned?: boolean
          published_at?: string | null
          requires_ack?: boolean
          search_vector?: unknown
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_admin: boolean
          is_superadmin: boolean
          locale: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          is_superadmin?: boolean
          locale?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          is_superadmin?: boolean
          locale?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_publish_content: { Args: { target_gym_id: string }; Returns: boolean }
      can_read_content: { Args: { target_gym_id: string }; Returns: boolean }
      content_object_gym: { Args: { object_name: string }; Returns: string }
      content_search_vector: {
        Args: { doc: Json; title: string }
        Returns: unknown
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      managed_gym_ids: { Args: never; Returns: string[] }
      member_gym_ids: { Args: never; Returns: string[] }
      tiptap_text: { Args: { doc: Json }; Returns: string }
    }
    Enums: {
      content_status: "draft" | "published"
      gym_role: "manager" | "staff"
      invite_status: "pending" | "accepted" | "revoked"
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
      content_status: ["draft", "published"],
      gym_role: ["manager", "staff"],
      invite_status: ["pending", "accepted", "revoked"],
    },
  },
} as const

