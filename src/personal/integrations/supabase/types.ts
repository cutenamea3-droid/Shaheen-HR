/**
 * Minimal Personal-only Database types.
 * Never import Driver or Admin Database types here.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      personal_profiles: {
        Row: {
          id: string;
          handle: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_study_state: {
        Row: {
          owner_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          data?: Json;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          data?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
