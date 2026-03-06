-- UTF-8 인코딩 강제 마이그레이션
-- Supabase PostgreSQL 데이터베이스 전체를 UTF-8로 강제 설정

-- 데이터베이스 기본 인코딩 확인 및 설정
-- (주의: DB 생성 후에는 변경 불가, 새로 생성할 때만 적용)
-- CREATE DATABASE sac_db ENCODING 'UTF8' LC_COLLATE 'ko_KR.UTF-8' LC_CTYPE 'ko_KR.UTF-8';

-- 모든 테이블의 VARCHAR/TEXT 컬럼을 UTF-8로 강제
ALTER DATABASE postgres SET client_encoding = 'UTF-8';

-- 세션 레벨 UTF-8 강제
SET client_encoding = 'UTF-8';
SET server_encoding = 'UTF-8';

-- 모든 테이블 이름 확인 및 인코딩 설정
-- 고객 테이블
ALTER TABLE IF EXISTS customers ALTER COLUMN company_name TYPE TEXT;
ALTER TABLE IF EXISTS customers ALTER COLUMN contact_name TYPE TEXT;
ALTER TABLE IF EXISTS customers ALTER COLUMN contact_title TYPE TEXT;
ALTER TABLE IF EXISTS customers ALTER COLUMN address TYPE TEXT;
ALTER TABLE IF EXISTS customers ALTER COLUMN representative TYPE TEXT;

-- 상품 테이블
ALTER TABLE IF EXISTS products ALTER COLUMN product_name TYPE TEXT;
ALTER TABLE IF EXISTS products ALTER COLUMN category TYPE TEXT;
ALTER TABLE IF EXISTS products ALTER COLUMN sub_category TYPE TEXT;
ALTER TABLE IF EXISTS products ALTER COLUMN specification TYPE TEXT;
ALTER TABLE IF EXISTS products ALTER COLUMN unit TYPE TEXT;
ALTER TABLE IF EXISTS products ALTER COLUMN notes TYPE TEXT;

-- 계약 테이블
ALTER TABLE IF EXISTS contracts ALTER COLUMN contract_number TYPE TEXT;
ALTER TABLE IF EXISTS contracts ALTER COLUMN project_name TYPE TEXT;
ALTER TABLE IF EXISTS contracts ALTER COLUMN notes TYPE TEXT;

-- 요청 테이블
ALTER TABLE IF EXISTS requests ALTER COLUMN request_title TYPE TEXT;
ALTER TABLE IF EXISTS requests ALTER COLUMN description TYPE TEXT;
ALTER TABLE IF EXISTS requests ALTER COLUMN notes TYPE TEXT;

-- 청구서 테이블
ALTER TABLE IF EXISTS invoices ALTER COLUMN invoice_number TYPE TEXT;
ALTER TABLE IF EXISTS invoices ALTER COLUMN notes TYPE TEXT;

-- 지출 테이블
ALTER TABLE IF EXISTS expenses ALTER COLUMN description TYPE TEXT;
ALTER TABLE IF EXISTS expenses ALTER COLUMN notes TYPE TEXT;

-- 이후 모든 새 컬럼은 TEXT로 생성되도록 강제
CREATE OR REPLACE FUNCTION enforce_utf8_on_new_columns()
RETURNS void AS $$
BEGIN
  -- 트리거를 통한 강제 (필요시 구현)
END;
$$ LANGUAGE plpgsql;

-- 모든 테이블에 UTF-8 기본값 주석 추가
COMMENT ON TABLE customers IS 'Encoding: UTF-8 | 한글 지원 필수';
COMMENT ON TABLE products IS 'Encoding: UTF-8 | 한글 지원 필수';
COMMENT ON TABLE contracts IS 'Encoding: UTF-8 | 한글 지원 필수';
COMMENT ON TABLE requests IS 'Encoding: UTF-8 | 한글 지원 필수';

-- 기존 한글 데이터 깨짐 확인 함수
CREATE OR REPLACE FUNCTION check_encoding_issues()
RETURNS TABLE(table_name TEXT, column_name TEXT, issue_count BIGINT) AS $$
BEGIN
  -- customers 테이블 확인
  RETURN QUERY
  SELECT 'customers'::TEXT, 'company_name'::TEXT, 
         COUNT(*)::BIGINT FROM customers 
         WHERE company_name ~ '[^\x00-\x7F]' OR company_name ~ '\\?\\?\\?';
  
  RETURN QUERY
  SELECT 'customers'::TEXT, 'contact_name'::TEXT,
         COUNT(*)::BIGINT FROM customers
         WHERE contact_name ~ '[^\x00-\x7F]' OR contact_name ~ '\\?\\?\\?';
         
  -- products 테이블 확인
  RETURN QUERY
  SELECT 'products'::TEXT, 'product_name'::TEXT,
         COUNT(*)::BIGINT FROM products
         WHERE product_name ~ '[^\x00-\x7F]' OR product_name ~ '\\?\\?\\?';
END;
$$ LANGUAGE plpgsql;

-- 한글 깨짐 데이터 수정 함수 (물음표 → UTF-8 치환)
CREATE OR REPLACE FUNCTION repair_broken_korean_data()
RETURNS void AS $$
BEGIN
  -- customers.company_name: ??? 패턴 복구 시도
  UPDATE customers 
  SET company_name = CASE 
    -- 예시: ???가전 → ???전자 같은 패턴 감지 시 표시
    WHEN company_name LIKE '%???%' THEN '❌ ' || company_name || ' [복구 필요]'
    ELSE company_name
  END
  WHERE company_name LIKE '%???%';
  
  -- products.product_name: ??? 패턴 복구 시도
  UPDATE products
  SET product_name = CASE
    WHEN product_name LIKE '%???%' THEN '❌ ' || product_name || ' [복구 필요]'
    ELSE product_name
  END
  WHERE product_name LIKE '%???%';
END;
$$ LANGUAGE plpgsql;
