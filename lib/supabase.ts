import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types'

// サーバーサイド用のSupabaseクライアント（サービスロールキー使用）
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY 
   ? createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) 
   : null;

// クライアントサイド用のSupabaseクライアント（匿名キー使用）
const supabaseClient = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   ? createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
   : null;

// 型安全なクライアント作成関数
export const createSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase環境変数が設定されていません');
    return null;
  }
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};

// サーバーサイド用の型安全なクライアント作成関数
export const createSupabaseServerClient = (): SupabaseClient<Database> | null => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabaseサーバー環境変数が設定されていません');
    return null;
  }
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

export { supabase, supabaseClient };
export default supabaseClient;