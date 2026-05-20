const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔗 Conectando a Supabase:', supabaseUrl);

// Cliente público — usa anon key, respeta Row Level Security (RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Cliente administrador — usa service_role, bypasea RLS (solo para operaciones admin)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = supabase;
module.exports.supabase = supabase;
module.exports.supabaseAdmin = supabaseAdmin;