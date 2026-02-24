-- business_settings에 회사 로고 URL 컬럼 추가
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;
