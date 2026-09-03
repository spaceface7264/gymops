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
      channel_members: {
        Row: {
          channel_id: string
          created_at: string
          last_read_at: string
          muted: boolean
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          last_read_at?: string
          muted?: boolean
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          last_read_at?: string
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gym_id: string | null
          id: string
          is_private: boolean
          kind: Database["public"]["Enums"]["channel_kind"]
          member_hash: string | null
          name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id?: string | null
          id?: string
          is_private?: boolean
          kind: Database["public"]["Enums"]["channel_kind"]
          member_hash?: string | null
          name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id?: string | null
          id?: string
          is_private?: boolean
          kind?: Database["public"]["Enums"]["channel_kind"]
          member_hash?: string | null
          name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_run_items: {
        Row: {
          done_at: string | null
          done_by: string | null
          id: string
          label: string
          note: string | null
          position: number
          required: boolean
          run_id: string
          template_item_id: string | null
        }
        Insert: {
          done_at?: string | null
          done_by?: string | null
          id?: string
          label: string
          note?: string | null
          position: number
          required?: boolean
          run_id: string
          template_item_id?: string | null
        }
        Update: {
          done_at?: string | null
          done_by?: string | null
          id?: string
          label?: string
          note?: string | null
          position?: number
          required?: boolean
          run_id?: string
          template_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_run_items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "checklist_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_run_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_runs: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          run_date: string
          template_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          run_date: string
          template_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          run_date?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_runs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          position: number
          required: boolean
          template_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          position: number
          required?: boolean
          template_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          position?: number
          required?: boolean
          template_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          gym_id: string | null
          id: string
          kind: Database["public"]["Enums"]["checklist_kind"]
          name: string
          updated_at: string
          updated_by: string | null
          weekdays: number[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          gym_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["checklist_kind"]
          name: string
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          gym_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["checklist_kind"]
          name?: string
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_log_entries: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          gym_id: string
          id: string
          kind: Database["public"]["Enums"]["daily_log_kind"]
          tags: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gym_id: string
          id?: string
          kind?: Database["public"]["Enums"]["daily_log_kind"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gym_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["daily_log_kind"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_log_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_entries_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_gyms: {
        Row: {
          event_id: string
          gym_id: string
        }
        Insert: {
          event_id: string
          gym_id: string
        }
        Update: {
          event_id?: string
          gym_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_gyms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gyms_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          end_time: string | null
          ends_on: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          last_on: string | null
          link: string | null
          start_time: string | null
          starts_on: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          end_time?: string | null
          ends_on?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          last_on?: string | null
          link?: string | null
          start_time?: string | null
          starts_on: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          end_time?: string | null
          ends_on?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          last_on?: string | null
          link?: string | null
          start_time?: string | null
          starts_on?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      incident_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          incident_id: string
          mime_type: string | null
          path: string
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id: string
          mime_type?: string | null
          path: string
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string
          mime_type?: string | null
          path?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_attachments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_comments: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          incident_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_comments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assignee_id: string | null
          body: string
          created_at: string
          created_by: string | null
          gym_id: string
          id: string
          kind: Database["public"]["Enums"]["incident_kind"]
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignee_id?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          gym_id: string
          id?: string
          kind?: Database["public"]["Enums"]["incident_kind"]
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignee_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          gym_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["incident_kind"]
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      message_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message_id: string
          mime_type: string | null
          path: string
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message_id: string
          mime_type?: string | null
          path: string
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message_id?: string
          mime_type?: string | null
          path?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          id: string
          mentions: string[]
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          mentions?: string[]
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          mentions?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          email: boolean
          in_app: boolean
          push: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          push?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          push?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          email_requested: boolean
          gym_id: string | null
          id: string
          read_at: string | null
          subject_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          email_requested?: boolean
          gym_id?: string | null
          id?: string
          read_at?: string | null
          subject_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          email_requested?: boolean
          gym_id?: string | null
          id?: string
          read_at?: string | null
          subject_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_complete_in: { Args: { target_gym_id: string }; Returns: boolean }
      can_listen_to_chat: { Args: { topic: string }; Returns: boolean }
      can_listen_to_checklists: { Args: { topic: string }; Returns: boolean }
      can_listen_to_notifications: { Args: { topic: string }; Returns: boolean }
      can_moderate_channel: {
        Args: { target_channel: string }
        Returns: boolean
      }
      can_publish_content: { Args: { target_gym_id: string }; Returns: boolean }
      can_read_channel: { Args: { target_channel: string }; Returns: boolean }
      can_read_content: { Args: { target_gym_id: string }; Returns: boolean }
      can_read_event: { Args: { target_event_id: string }; Returns: boolean }
      chat_object_channel: { Args: { object_name: string }; Returns: string }
      content_audience: { Args: { target_gym: string }; Returns: string[] }
      content_object_gym: { Args: { object_name: string }; Returns: string }
      content_search_vector: {
        Args: { doc: Json; title: string }
        Returns: unknown
      }
      dm_member_hash: { Args: { target_channel: string }; Returns: string }
      generate_checklist_runs: { Args: { as_of?: string }; Returns: number }
      gym_overseers: { Args: { target_gym: string }; Returns: string[] }
      incident_object_gym: { Args: { object_name: string }; Returns: string }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_channel_member: { Args: { target_channel: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      managed_gym_ids: { Args: never; Returns: string[] }
      member_gym_ids: { Args: never; Returns: string[] }
      notification_pref: {
        Args: {
          target_type: Database["public"]["Enums"]["notification_type"]
          target_user: string
        }
        Returns: {
          email: boolean
          in_app: boolean
          push: boolean
        }[]
      }
      raise_notification: {
        Args: {
          body_text?: string
          data_json?: Json
          dedupe_within?: string
          email_wanted?: boolean
          link?: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          recipients: string[]
          subject?: string
          target_gym?: string
          title_text: string
        }
        Returns: number
      }
      send_ack_reminders: { Args: { as_of?: string }; Returns: number }
      shares_gym_with: { Args: { target_user: string }; Returns: boolean }
      tiptap_text: { Args: { doc: Json }; Returns: string }
    }
    Enums: {
      channel_kind: "gym" | "company" | "custom" | "dm"
      checklist_kind: "opening" | "closing" | "custom"
      content_status: "draft" | "published"
      daily_log_kind: "handover" | "note" | "issue"
      event_type: "community" | "campaign" | "groups" | "offer" | "other"
      gym_role: "manager" | "staff"
      incident_kind: "injury" | "equipment" | "cleaning" | "other"
      incident_severity: "low" | "medium" | "high"
      incident_status: "open" | "in_progress" | "resolved"
      invite_status: "pending" | "accepted" | "revoked"
      notification_type:
        | "incident_reported"
        | "incident_status_changed"
        | "ack_reminder"
        | "invite"
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
      channel_kind: ["gym", "company", "custom", "dm"],
      checklist_kind: ["opening", "closing", "custom"],
      content_status: ["draft", "published"],
      daily_log_kind: ["handover", "note", "issue"],
      event_type: ["community", "campaign", "groups", "offer", "other"],
      gym_role: ["manager", "staff"],
      incident_kind: ["injury", "equipment", "cleaning", "other"],
      incident_severity: ["low", "medium", "high"],
      incident_status: ["open", "in_progress", "resolved"],
      invite_status: ["pending", "accepted", "revoked"],
      notification_type: [
        "incident_reported",
        "incident_status_changed",
        "ack_reminder",
        "invite",
      ],
    },
  },
} as const

