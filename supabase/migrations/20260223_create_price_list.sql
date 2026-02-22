-- 가격표 테이블 생성
CREATE TABLE price_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,           -- '장비' | '설치비'
  product_name TEXT NOT NULL,       -- 상품명
  specification TEXT,               -- 규격
  unit TEXT,                        -- 단위 (EA, M, 식 등)
  unit_price INTEGER DEFAULT 0,     -- 단가
  tags TEXT,                        -- #태그
  notes TEXT,                       -- 비고 (설치비만)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_price_list_category ON price_list(category);
CREATE INDEX idx_price_list_product_name ON price_list(product_name);
