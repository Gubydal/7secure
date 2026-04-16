import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";


export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

export const getSupabaseAdmin = () => {
  return createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  source_name: string;
  source_url: string;
  original_url: string;
  published_at: string;
  is_featured: boolean;
  tags: string[];
  image_url?: string | null;
}
