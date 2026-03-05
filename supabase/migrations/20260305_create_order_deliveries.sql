BEGIN;

CREATE TABLE IF NOT EXISTS order_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  opti_name TEXT,
  opti_number TEXT,
  contract_number TEXT,
  supplier TEXT,
  site_name TEXT,
  order_date DATE,
  order_number TEXT,
  model_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  delivery_request_date DATE,
  delivery_expected_date DATE,
  delivery_confirmed_date DATE,
  delivery_place TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_request_id
  ON order_deliveries(request_id);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_created_at
  ON order_deliveries(created_at DESC);

COMMIT;
