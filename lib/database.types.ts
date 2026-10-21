export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'citizen' | 'authority' | 'admin';
export type ReportStatus =
  | 'submitted'
  | 'ai_analyzed'
  | 'assigned'
  | 'under_review'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'duplicate'
  | 'invalid'
  | 'escalated'
  | 'manual_review_required';

export type ReportSeverity = 'Low' | 'Medium' | 'High' | 'Critical' | 'Requires Review';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          department_id: string | null;
          full_name: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          department_id?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          department_id?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
      };
      departments: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          description?: string | null;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          label: string;
          department_id: string | null;
          department: string;
          default_severity: ReportSeverity;
          min_conf: number | null;
          max_conf: number | null;
          active: boolean;
          explanation: string | null;
          severity_reason: string | null;
          keywords: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          label: string;
          department_id?: string | null;
          department: string;
          default_severity: ReportSeverity;
          min_conf?: number | null;
          max_conf?: number | null;
          active?: boolean;
          explanation?: string | null;
          severity_reason?: string | null;
          keywords?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          department_id?: string | null;
          department?: string;
          default_severity?: ReportSeverity;
          min_conf?: number | null;
          max_conf?: number | null;
          active?: boolean;
          explanation?: string | null;
          severity_reason?: string | null;
          keywords?: string[];
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          report_code: string | null;
          user_id: string;
          category_id: string | null;
          category: string | null;
          status: ReportStatus;
          severity: ReportSeverity | null;
          confidence: number | null;
          description: string | null;
          area_name: string | null;
          location: string | null;
          latitude: number | null;
          longitude: number | null;
          image_path: string | null;
          explanation: string | null;
          department: string | null;
          secondary_issues: string[];
          requires_manual_review: boolean;
          duplicate_of: string | null;
          assigned_department_id: string | null;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          report_code?: string | null;
          user_id?: string;
          category_id?: string | null;
          category?: string | null;
          status?: ReportStatus;
          severity?: ReportSeverity | null;
          confidence?: number | null;
          description?: string | null;
          area_name?: string | null;
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          image_path?: string | null;
          explanation?: string | null;
          department?: string | null;
          secondary_issues?: string[];
          requires_manual_review?: boolean;
          duplicate_of?: string | null;
          assigned_department_id?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          report_code?: string | null;
          user_id?: string;
          category_id?: string | null;
          category?: string | null;
          status?: ReportStatus;
          severity?: ReportSeverity | null;
          confidence?: number | null;
          description?: string | null;
          area_name?: string | null;
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          image_path?: string | null;
          explanation?: string | null;
          department?: string | null;
          secondary_issues?: string[];
          requires_manual_review?: boolean;
          duplicate_of?: string | null;
          assigned_department_id?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
      };
      report_events: {
        Row: {
          id: string;
          report_id: string;
          changed_by: string | null;
          actor_id: string | null;
          actor_role: string | null;
          old_status: string | null;
          new_status: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          changed_by?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          old_status?: string | null;
          new_status: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          changed_by?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          old_status?: string | null;
          new_status?: string;
          note?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          report_id: string | null;
          type: string | null;
          title: string;
          body: string;
          read_at: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          report_id?: string | null;
          type?: string | null;
          title: string;
          body: string;
          read_at?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          report_id?: string | null;
          type?: string | null;
          title?: string;
          body?: string;
          read_at?: string | null;
          read?: boolean;
          created_at?: string;
        };
      };
      ai_requests: {
        Row: {
          id: string;
          user_id: string;
          report_id: string | null;
          status: 'success' | 'failed';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          report_id?: string | null;
          status: 'success' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          report_id?: string | null;
          status?: 'success' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_authority: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
  };
}
