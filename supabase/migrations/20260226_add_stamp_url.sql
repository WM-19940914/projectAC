-- 도장(stamp) 이미지 URL 컬럼 추가
ALTER TABLE business_settings
ADD COLUMN IF NOT EXISTS stamp_url TEXT;
