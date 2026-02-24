-- 가격표에 소분류(sub_category) 컬럼 추가
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS sub_category TEXT DEFAULT NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_price_list_sub_category ON price_list(sub_category);
