-- 의뢰(request) 및 계약(contract) 삭제 시 트랜잭션 보호를 위한 stored procedure
-- 기존: 순차적 DELETE → 중간 실패 시 고아 데이터 발생
-- 개선: 단일 트랜잭션으로 래핑 → 중간 실패 시 자동 ROLLBACK

-- ============================================================
-- 1. 의뢰 삭제 RPC (연관 견적서 + 계약 + 정산/지출 모두 삭제)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_request_cascade(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract_id UUID;
  v_quotation_ids UUID[];
BEGIN
  -- 1) 의뢰 조회 (contract_id 추출)
  SELECT contract_id INTO v_contract_id
  FROM requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '의뢰를 찾을 수 없습니다');
  END IF;

  -- 2) 연관 견적서 ID 수집
  SELECT array_agg(id) INTO v_quotation_ids
  FROM quotations
  WHERE request_id = p_request_id;

  -- 3) 견적서 참조 해제 + 품목/견적서 삭제
  IF v_quotation_ids IS NOT NULL AND array_length(v_quotation_ids, 1) > 0 THEN
    -- 다른 의뢰의 확정 견적 참조 해제
    UPDATE requests
    SET confirmed_quote_id = NULL
    WHERE confirmed_quote_id = ANY(v_quotation_ids);

    UPDATE requests
    SET confirmed_quotation_id = NULL
    WHERE confirmed_quotation_id = ANY(v_quotation_ids);

    -- 견적 품목 삭제
    DELETE FROM quotation_items
    WHERE quotation_id = ANY(v_quotation_ids);

    -- 견적서 삭제
    DELETE FROM quotations
    WHERE id = ANY(v_quotation_ids);
  END IF;

  -- 4) 연결된 계약 처리
  IF v_contract_id IS NOT NULL THEN
    -- 다른 의뢰의 contract_id 참조 해제
    UPDATE requests
    SET contract_id = NULL
    WHERE contract_id = v_contract_id AND id != p_request_id;

    -- 정산 메타데이터 삭제 (테이블 존재 시)
    BEGIN
      DELETE FROM contract_settlement_meta WHERE contract_id = v_contract_id;
    EXCEPTION WHEN undefined_table THEN
      NULL; -- 테이블 미존재 시 무시
    END;

    -- 정산 기록 삭제
    BEGIN
      DELETE FROM settlements WHERE contract_id = v_contract_id;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

    -- 지출 삭제
    BEGIN
      DELETE FROM expenses WHERE contract_id = v_contract_id;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

    -- 거래 기록 삭제
    BEGIN
      DELETE FROM transactions WHERE contract_id = v_contract_id;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

    -- 계약 삭제
    DELETE FROM contracts WHERE id = v_contract_id;
  END IF;

  -- 5) 의뢰 삭제
  DELETE FROM requests WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'deleted_request_id', p_request_id);

EXCEPTION WHEN OTHERS THEN
  -- 전체 트랜잭션 자동 ROLLBACK
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- 2. 계약 삭제 RPC (연관 정산/지출/메타 모두 삭제)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_contract_cascade(p_contract_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1) 연결된 의뢰의 contract_id 참조 해제
  UPDATE requests
  SET contract_id = NULL, updated_at = NOW()
  WHERE contract_id = p_contract_id;

  -- 2) 정산 메타데이터 삭제
  BEGIN
    DELETE FROM contract_settlement_meta WHERE contract_id = p_contract_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 3) 정산 기록 삭제
  BEGIN
    DELETE FROM settlements WHERE contract_id = p_contract_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 4) 지출 삭제
  BEGIN
    DELETE FROM expenses WHERE contract_id = p_contract_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 5) 거래 기록 삭제
  BEGIN
    DELETE FROM transactions WHERE contract_id = p_contract_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 6) 계약 삭제
  DELETE FROM contracts WHERE id = p_contract_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '계약을 찾을 수 없습니다');
  END IF;

  RETURN json_build_object('success', true, 'deleted_contract_id', p_contract_id);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
