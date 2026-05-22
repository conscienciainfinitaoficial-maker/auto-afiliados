-- SQL para crear la tabla de leads en Supabase
-- Ejecutá esto en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS leads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  niche TEXT DEFAULT 'general',
  product TEXT DEFAULT 'N/A',
  source TEXT DEFAULT 'landing',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permitir lectura y escritura anónima (usando service_role key)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for all" ON leads
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable read for all" ON leads
  FOR SELECT
  USING (true);
