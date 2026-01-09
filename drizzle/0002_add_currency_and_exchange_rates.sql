-- Add currency column to budgets table
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MYR';

-- Add currency column to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MYR';

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(19,6) NOT NULL,
  source TEXT DEFAULT 'manual',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create unique constraint on (from_currency, to_currency)
CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_unique_pair ON exchange_rates(from_currency, to_currency);

-- Insert default exchange rates (relative to MYR as base)
INSERT INTO exchange_rates (from_currency, to_currency, rate, source)
VALUES
  ('MYR', 'MYR', 1.0, 'manual'),
  ('MYR', 'SGD', 0.31, 'manual'),
  ('MYR', 'USD', 0.22, 'manual'),
  ('SGD', 'MYR', 3.23, 'manual'),
  ('SGD', 'SGD', 1.0, 'manual'),
  ('SGD', 'USD', 0.71, 'manual'),
  ('USD', 'MYR', 4.55, 'manual'),
  ('USD', 'SGD', 1.41, 'manual'),
  ('USD', 'USD', 1.0, 'manual')
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- Update existing budgets to have MYR as currency
UPDATE budgets SET currency = 'MYR' WHERE currency IS NULL;

-- Update existing goals to have MYR as currency
UPDATE goals SET currency = 'MYR' WHERE currency IS NULL;
