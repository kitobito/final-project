// frontend/src/supabaseClient.js

import { createClient } from "@supabase/supabase-js";

// Vite only exposes envs starting with VITE_
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If either of those is undefined, the client will fail silently later
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
