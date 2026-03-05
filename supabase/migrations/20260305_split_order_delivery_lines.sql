BEGIN;

CREATE TABLE IF NOT EXISTS order_delivery_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_delivery_id UUID NOT NULL REFERENCES order_deliveries(id) ON DELETE CASCADE,
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
  row_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_delivery_lines_order_delivery_id
  ON order_delivery_lines(order_delivery_id);

CREATE INDEX IF NOT EXISTS idx_order_delivery_lines_row_order
  ON order_delivery_lines(order_delivery_id, row_order);

INSERT INTO order_delivery_lines (
  order_delivery_id,
  supplier,
  site_name,
  order_date,
  order_number,
  model_name,
  quantity,
  delivery_request_date,
  delivery_expected_date,
  delivery_confirmed_date,
  delivery_place,
  delivery_address,
  row_order,
  created_at,
  updated_at
)
SELECT
  od.id,
  od.supplier,
  od.site_name,
  od.order_date,
  od.order_number,
  od.model_name,
  od.quantity,
  od.delivery_request_date,
  od.delivery_expected_date,
  od.delivery_confirmed_date,
  od.delivery_place,
  od.delivery_address,
  1,
  COALESCE(od.created_at, now()),
  COALESCE(od.updated_at, now())
FROM order_deliveries od
WHERE NOT EXISTS (
  SELECT 1
  FROM order_delivery_lines l
  WHERE l.order_delivery_id = od.id
)
AND (
  od.supplier IS NOT NULL
  OR od.site_name IS NOT NULL
  OR od.order_date IS NOT NULL
  OR od.order_number IS NOT NULL
  OR od.model_name IS NOT NULL
  OR COALESCE(od.quantity, 0) > 0
  OR od.delivery_request_date IS NOT NULL
  OR od.delivery_expected_date IS NOT NULL
  OR od.delivery_confirmed_date IS NOT NULL
  OR od.delivery_place IS NOT NULL
  OR od.delivery_address IS NOT NULL
);

ALTER TABLE order_deliveries DROP COLUMN IF EXISTS supplier;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS site_name;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS order_date;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS order_number;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS model_name;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS quantity;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS delivery_request_date;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS delivery_expected_date;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS delivery_confirmed_date;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS delivery_place;
ALTER TABLE order_deliveries DROP COLUMN IF EXISTS delivery_address;

COMMIT;
