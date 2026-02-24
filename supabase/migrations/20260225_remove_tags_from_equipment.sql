-- 장비 카테고리의 tags 데이터 삭제 (설치비는 유지)
UPDATE price_list SET tags = NULL WHERE category = '장비';
