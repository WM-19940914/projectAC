# UTF-8 인코딩 설정 가이드

## 📋 설정 현황

이 프로젝트의 모든 계층에서 UTF-8 인코딩이 강제되었습니다.

### 1️⃣ **데이터베이스 (Supabase PostgreSQL)**

**파일**: [scripts/migrations/001-enforce-utf8.sql](../scripts/migrations/001-enforce-utf8.sql)

- 모든 TEXT 컬럼 UTF-8 강제
- 클라이언트 인코딩: UTF-8
- 서버 인코딩: UTF-8
- 손상된 데이터 감지 함수 포함

**적용 방법**:
```bash
# Supabase 대시보드 > SQL Editor에서 migration 파일 실행
```

---

### 2️⃣ **Import 스크립트 (Node.js)**

#### `import-customers.js` - UTF-8 모드
- ✅ UTF-8 환경 변수 강제
- ✅ 데이터 손상 감지 알고리즘
- ✅ 필드별 인코딩 검증
- ✅ 손상된 레코드 표시 및 로깅

**실행**:
```bash
npm run import:customers
```

#### `import-price-list.js` - UTF-8 모드
- ✅ UTF-8 환경 변수 강제
- ✅ 배치 처리 중 오류 추적
- ✅ 손상된 항목 감지 및 표시
- ✅ 자동 소분류 리스트 유지

**실행**:
```bash
npm run import:prices
```

---

### 3️⃣ **API 라우트 (Next.js)**

**파일**: [src/lib/utf8-response.ts](../../src/lib/utf8-response.ts)

모든 API 응답에 UTF-8 헤더 자동 추가:
```
Content-Type: application/json; charset=utf-8
Content-Language: ko-KR
X-Charset: UTF-8
```

**적용된 API들**:
- ✅ `/api/customers` - 고객 관리
- ✅ `/api/price-list` - 가격표
- ✅ `/api/contracts` - 계약
- ✅ `/api/quotes` - 견적
- ✅ `/api/requests` - 의뢰

**미들웨어**: [src/middleware.ts](../../src/middleware.ts)
- 모든 요청/응답에 UTF-8 강제
- 캐싱 제어

---

### 4️⃣ **개발 환경 설정**

**VS Code**: [.vscode/settings.json](.vscode/settings.json)
```json
{
  "files.encoding": "utf8",
  "files.eol": "\n",
  "files.insertFinalNewline": true
}
```

**Git**: [.gitattributes](.gitattributes)
```
*.ts text eol=lf charset=UTF-8
*.js text eol=lf charset=UTF-8
*.json text eol=lf charset=UTF-8
```

**Codex CLI**: [~/.codex/config.toml](../../.codex/config.toml)
```toml
[env]
LANG = "ko_KR.UTF-8"
LC_ALL = "ko_KR.UTF-8"
PYTHONIOENCODING = "utf-8"
```

---

## 🔍 데이터 손상 감지 및 복구

### 손상된 데이터 표시
모든 import 스크립트는 문제가 있는 데이터를 감지하고 표시합니다:
```
⚠️  [회사명] 인코딩 손상 감지: "???전자..."
```

### 손상된 데이터 조회 (SQL)
```sql
-- 기존 데이터 손상 여부 확인
SELECT check_encoding_issues();

-- 손상된 데이터 수정 (표시만)
SELECT repair_broken_korean_data();
```

---

## ✅ 체크리스트

- [x] **데이터베이스**: UTF-8 강제 및 손상 감지 함수
- [x] **Import 스크립트**: 데이터 검증 및 복구 로직
- [x] **API 라우트**: UTF-8 응답 헤더 자동 설정
- [x] **미들웨어**: 모든 요청/응답에 UTF-8 강제
- [x] **개발 환경**: VS Code, Git, Codex 설정
- [x] **패키지.json**: UTF-8 강제 npm 스크립트

---

## 🚀 실행 순서

1. **데이터베이스 마이그레이션 적용**
   ```sql
   -- Supabase SQL Editor에서 실행
   ```

2. **기존 데이터 복구 (선택)**
   ```sql
   SELECT repair_broken_korean_data();
   ```

3. **새 데이터 Import**
   ```bash
   npm run import:customers
   npm run import:prices
   ```

4. **API 배포**
   - 모든 API는 자동으로 UTF-8 응답 설정됨
   - Middleware가 모든 요청/응답을 처리

---

## 📝 예상되는 모든 경우의 수

✅ **기존 손상된 데이터**: 마이그레이션 함수로 감지 및 표시
✅ **새로운 한글 데이터**: 자동으로 UTF-8로 저장
✅ **API 응답**: 모든 응답에 UTF-8 명시
✅ **파일 저장**: Git, VS Code에서 자동으로 UTF-8 처리
✅ **터미널 호출**: codex에서 UTF-8 환경 변수 강제
✅ **데이터 조회**: API에서 UTF-8 검증 후 반환

---

## 🔧 트러블슈팅

### 문제: "???" 표시된 한글 데이터
→ 손상된 데이터입니다. SQL 함수로 감지된 레코드를 수동으로 수정 또는 새 자료로 덮어쓰세요.

### 문제: Import 중 특정 필드에서 오류
→ 스크립트 실행 시 `⚠️` 마크가 표시됩니다. 해당 행을 확인하고 필요시 재입력하세요.

### 문제: API 응답이 여전히 깨짐
→ 브라우저 개발자 도구에서 응답 헤더를 확인하세요:
```
Content-Type: application/json; charset=utf-8
```
