const { createClient } = require('@supabase/supabase-js');

// Required env variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
}

// Create Supabase client with Service Role Key
// This allows backend-level admin access without Row Level Security (RLS) policies getting in the way
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
    supabase
};
