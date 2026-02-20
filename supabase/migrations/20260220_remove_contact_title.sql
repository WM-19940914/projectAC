-- 고객 테이블에서 직책(contact_title) 컬럼 삭제
ALTER TABLE customers DROP COLUMN IF EXISTS contact_title;
