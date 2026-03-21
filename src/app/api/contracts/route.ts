import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import { requireAdminOrSales } from '@/lib/api-auth';

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

const CONTRACT_SETTLEMENT_META_TABLE = 'contract_settlement_meta';

function sanitizeContractMeta(input: unknown) {
    if (!input || typeof input !== 'object') return null;
    const src = input as Record<string, unknown>;
    const next: Record<string, unknown> = {};

    if (src.stage_ratios && typeof src.stage_ratios === 'object') {
        next.stage_ratios = src.stage_ratios;
    }
    if (src.middle_installments !== undefined) {
        const parsed = Number(src.middle_installments);
        if (Number.isFinite(parsed)) next.middle_installments = Math.max(1, Math.min(5, Math.round(parsed)));
    }
    if (src.stage_scheduled_dates && typeof src.stage_scheduled_dates === 'object') {
        next.stage_scheduled_dates = src.stage_scheduled_dates;
    }
    if (src.settlement_status_map && typeof src.settlement_status_map === 'object') {
        next.settlement_status_map = src.settlement_status_map;
    }
    if (src.stage_conditions && typeof src.stage_conditions === 'object') {
        next.stage_conditions = src.stage_conditions;
    }
    // VAT포함 금액 override (공급가액 × 1.1 로 딱 안 떨어질 때 사용자가 직접 입력한 VAT포함 금액)
    if (src.vat_total_override !== undefined) {
        const parsed = Number(src.vat_total_override);
        next.vat_total_override = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    return Object.keys(next).length > 0 ? next : null;
}

// 기존 memo에 __sac_contract_meta JSON envelope이 있을 경우 순수 note만 추출
// 새 코드에서는 meta를 memo에 저장하지 않으므로, 읽기 전용 호환 함수
function extractNoteFromMemo(rawMemo: unknown): string {
    const memoText = typeof rawMemo === 'string' ? rawMemo : '';
    if (!memoText.trim()) return '';

    try {
        const parsed = JSON.parse(memoText) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && '__sac_contract_meta' in parsed) {
            // 레거시 JSON envelope → note만 추출
            return typeof parsed.note === 'string' ? parsed.note : '';
        }
    } catch {
        // 일반 텍스트 메모는 파싱 실패가 정상
    }

    return memoText;
}

// memo는 이제 순수 텍스트만 저장. meta는 contract_settlement_meta 테이블에만 저장.
function buildPlainMemo(note: string): string | null {
    const trimmedNote = note.trim();
    return trimmedNote || null;
}

function toModernContractInput(input: Record<string, unknown>) {
    const mappedData: Record<string, unknown> = { ...input };

    // 레거시 필드명 호환
    if (typeof mappedData.name === 'string' && mappedData.name.trim()) {
        mappedData.title = mappedData.name.trim();
    }
    if (mappedData.amount !== undefined && mappedData.amount !== null) {
        mappedData.contract_amount = mappedData.amount;
    }

    delete mappedData.name;
    delete mappedData.amount;
    delete mappedData.status;

    // settlement_type: 프론트에서 배열로 오면 쉼표 구분 문자열로 변환 (DB는 TEXT 필드)
    if (Array.isArray(mappedData.settlement_type)) {
        mappedData.settlement_type = mappedData.settlement_type.join(',');
    }

    // contract_meta는 DB 컬럼이 아님 — contract_settlement_meta 테이블에 별도 저장
    // 여기서는 제거만 하고, POST/PATCH 핸들러에서 saveContractMetaToTable() 호출
    delete mappedData.contract_meta;

    // memo: 순수 텍스트만 저장. 기존 레거시 JSON envelope이 있으면 note만 추출
    if (mappedData.memo !== undefined) {
        const plainNote = extractNoteFromMemo(mappedData.memo);
        const nextMemo = buildPlainMemo(plainNote);
        if (nextMemo === null) {
            delete mappedData.memo;
        } else {
            mappedData.memo = nextMemo;
        }
    }

    return mappedData;
}

function normalizeContractOutput(data: Record<string, unknown>) {
    const mappedData: Record<string, unknown> = { ...data };

    if ((typeof mappedData.title !== 'string' || !mappedData.title.trim()) && typeof mappedData.name === 'string') {
        mappedData.title = mappedData.name;
    }
    if ((mappedData.contract_amount === undefined || mappedData.contract_amount === null) && mappedData.amount !== undefined) {
        mappedData.contract_amount = mappedData.amount;
    }

    // memo: 레거시 JSON envelope이 있으면 순수 note만 추출하여 노출
    // meta는 contract_settlement_meta 테이블에서만 로드 (normalizeContractOutputWithTableMeta에서 처리)
    mappedData.memo = extractNoteFromMemo(mappedData.memo);

    // settlement_type: DB TEXT 필드 → 프론트 배열로 복원
    // 가능한 저장 형태: "선금,잔금" (쉼표 구분) 또는 '["선금","잔금"]' (JSON 문자열)
    if (typeof mappedData.settlement_type === 'string' && mappedData.settlement_type) {
        let parts: string[] = [];
        const raw = mappedData.settlement_type.trim();
        // JSON 배열 문자열인 경우 (예: '["선금","잔금"]')
        if (raw.startsWith('[')) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parts = parsed.map(String).map(s => s.trim()).filter(Boolean);
                }
            } catch {
                // JSON 파싱 실패 시 쉼표 구분으로 폴백
                parts = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
        } else {
            // 쉼표 구분 문자열 (예: "선금,잔금")
            parts = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        mappedData.settlement_type = parts;
    }

    return mappedData;
}

function getErrorText(error: unknown) {
    const message = error instanceof Error
        ? error.message.toLowerCase()
        : String((error as { message?: unknown })?.message ?? '').toLowerCase();

    return message;
}

function isMissingContractMetaTableError(error: unknown) {
    const code = (error as { code?: string })?.code;
    const message = getErrorText(error);
    return (
        code === '42P01' ||
        code === 'PGRST204' ||
        message.includes(`could not find the '${CONTRACT_SETTLEMENT_META_TABLE}'`) ||
        message.includes(`relation "${CONTRACT_SETTLEMENT_META_TABLE}" does not exist`)
    );
}

// contract_settlement_meta 테이블에서만 메타 로드
// vat_total_override 컬럼이 없을 수 있으므로 기본 필드만 조회 후 확장 시도
async function loadContractMetaFromTable(
    supabase: SupabaseAdminClient,
    contractId: string,
) {
    // vat_total_override 포함 시도 → 컬럼 없으면 기본 필드만 재시도
    let data: Record<string, unknown> | null = null;

    const { data: fullData, error: fullError } = await supabase
        .from(CONTRACT_SETTLEMENT_META_TABLE)
        .select('stage_ratios, middle_installments, stage_scheduled_dates, settlement_status_map, vat_total_override')
        .eq('contract_id', contractId)
        .maybeSingle();

    if (fullError) {
        // vat_total_override 컬럼이 아직 없는 경우 (42703) → 기본 필드만 조회
        const errCode = (fullError as { code?: string })?.code;
        const errMsg = typeof fullError.message === 'string' ? fullError.message : '';
        if (errCode === '42703' || errMsg.includes('vat_total_override')) {
            const { data: basicData, error: basicError } = await supabase
                .from(CONTRACT_SETTLEMENT_META_TABLE)
                .select('stage_ratios, middle_installments, stage_scheduled_dates, settlement_status_map')
                .eq('contract_id', contractId)
                .maybeSingle();

            if (basicError) {
                if (isMissingContractMetaTableError(basicError)) return null;
                throw basicError;
            }
            data = basicData as Record<string, unknown> | null;
        } else if (isMissingContractMetaTableError(fullError)) {
            return null;
        } else {
            throw fullError;
        }
    } else {
        data = fullData as Record<string, unknown> | null;
    }

    if (!data) return null;
    return sanitizeContractMeta(data);
}

async function saveContractMetaToTable(
    supabase: SupabaseAdminClient,
    contractId: string,
    meta: Record<string, unknown> | null
) {
    if (!meta) return;

    // vat_total_override 값 정규화
    const vatOverride = meta.vat_total_override !== undefined
        ? (Number.isFinite(Number(meta.vat_total_override)) && Number(meta.vat_total_override) > 0
            ? Number(meta.vat_total_override)
            : null)
        : undefined;

    const payload: Record<string, unknown> = {
        contract_id: contractId,
        stage_ratios: meta.stage_ratios ?? {},
        middle_installments: Number.isFinite(Number(meta.middle_installments))
            ? Math.max(1, Math.min(5, Math.round(Number(meta.middle_installments))))
            : 1,
        stage_scheduled_dates: meta.stage_scheduled_dates ?? {},
        settlement_status_map: meta.settlement_status_map ?? {},
        updated_at: new Date().toISOString(),
    };

    // vat_total_override가 명시적으로 전달된 경우에만 포함 (undefined면 기존 값 유지)
    if (vatOverride !== undefined) {
        payload.vat_total_override = vatOverride;
    }

    const { error } = await supabase
        .from(CONTRACT_SETTLEMENT_META_TABLE)
        .upsert(payload, { onConflict: 'contract_id' });

    if (error) {
        // vat_total_override 컬럼이 아직 없는 경우 → 해당 필드 제거 후 재시도
        const errCode = (error as { code?: string })?.code;
        const errMsg = typeof error.message === 'string' ? error.message : '';
        if ((errCode === '42703' || errMsg.includes('vat_total_override')) && 'vat_total_override' in payload) {
            delete payload.vat_total_override;
            const { error: retryError } = await supabase
                .from(CONTRACT_SETTLEMENT_META_TABLE)
                .upsert(payload, { onConflict: 'contract_id' });
            if (retryError && !isMissingContractMetaTableError(retryError)) {
                throw retryError;
            }
        } else if (!isMissingContractMetaTableError(error)) {
            throw error;
        }
    }
}

async function normalizeContractOutputWithTableMeta(
    supabase: SupabaseAdminClient,
    data: Record<string, unknown>
) {
    const normalized = normalizeContractOutput(data);
    const contractId = typeof normalized.id === 'string' ? normalized.id : '';
    if (!contractId) return normalized;

    const tableMeta = await loadContractMetaFromTable(supabase, contractId);
    if (tableMeta) {
        normalized.contract_meta = tableMeta;
    } else if ('contract_meta' in normalized) {
        delete normalized.contract_meta;
    }
    return normalized;
}

function shouldRetryWithCompatiblePayload(error: unknown) {
    const message = getErrorText(error);
    const code = (error as { code?: string })?.code;

    return (
        code === 'PGRST204' ||
        message.includes('could not find the') ||
        message.includes('null value in column "name"') ||
        message.includes('null value in column "amount"') ||
        message.includes('is of type text but expression is of type text[]') ||
        message.includes('is of type text[] but expression is of type text')
    );
}

function nextCompatiblePayload(
    payload: Record<string, unknown>,
    error: unknown
) {
    const message = getErrorText(error);
    const next: Record<string, unknown> = { ...payload };
    let changed = false;

    const move = (from: string, to: string) => {
        if (from in next) {
            if (!(to in next)) next[to] = next[from];
            delete next[from];
            changed = true;
        }
    };
    const drop = (key: string) => {
        if (key in next) {
            delete next[key];
            changed = true;
        }
    };

    if (message.includes("'title'") || message.includes('"title"')) {
        move('title', 'name');
    }
    if (message.includes("'name'") || message.includes('"name"')) {
        if (message.includes('could not find')) move('name', 'title');
        if (message.includes('null value in column "name"')) move('title', 'name');
    }

    if (message.includes("'contract_amount'") || message.includes('"contract_amount"')) {
        move('contract_amount', 'amount');
    }
    if (message.includes("'amount'") || message.includes('"amount"')) {
        if (message.includes('could not find')) move('amount', 'contract_amount');
        if (message.includes('null value in column "amount"')) move('contract_amount', 'amount');
    }

    if (message.includes('settlement_type') && 'settlement_type' in next) {
        const current = next.settlement_type;
        if (
            message.includes('is of type text but expression is of type text[]') &&
            Array.isArray(current)
        ) {
            next.settlement_type = current.join(',');
            changed = true;
        } else if (
            message.includes('is of type text[] but expression is of type text') &&
            typeof current === 'string'
        ) {
            next.settlement_type = current
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            changed = true;
        }
    }

    const missingColumnMatch = message.match(/could not find the '([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];
    if (missingColumn) {
        if (missingColumn === 'title') move('title', 'name');
        else if (missingColumn === 'name') move('name', 'title');
        else if (missingColumn === 'contract_amount') move('contract_amount', 'amount');
        else if (missingColumn === 'amount') move('amount', 'contract_amount');
        else drop(missingColumn);
    }

    return changed ? next : null;
}

function extractErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error;

    if (error && typeof error === 'object') {
        const obj = error as {
            message?: unknown;
            details?: unknown;
            hint?: unknown;
            code?: unknown;
        };
        const parts = [
            typeof obj.message === 'string' ? obj.message : '',
            typeof obj.details === 'string' ? obj.details : '',
            typeof obj.hint === 'string' ? obj.hint : '',
            typeof obj.code === 'string' ? `code:${obj.code}` : '',
        ].filter(Boolean);
        if (parts.length > 0) return parts.join(' | ');
    }

    return '계약 저장 중 알 수 없는 오류가 발생했습니다.';
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'id가 필요합니다.' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('contracts')
            .select(`
                *,
                customer:customers(id, company_name, deleted_at)
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Contract not found', data: null },
                { status: 200 }
            );
        }

        const normalized = await normalizeContractOutputWithTableMeta(supabase, data as Record<string, unknown>);
        return NextResponse.json({ success: true, data: normalized });
    } catch (error) {
        logError('계약 조회 오류:', error);
        return NextResponse.json(
            {
                success: false,
                error: extractErrorMessage(error)
            },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const supabase = createAdminClient();
        let attemptPayload = toModernContractInput(data);

        let insertedData: Record<string, unknown> | null = null;
        let error: unknown = null;
        for (let i = 0; i < 4; i += 1) {
            const result = await supabase
                .from('contracts')
                .insert([attemptPayload])
                .select()
                .single();

            insertedData = result.data as Record<string, unknown> | null;
            error = result.error;
            if (!error) break;
            if (!shouldRetryWithCompatiblePayload(error)) break;

            const nextPayload = nextCompatiblePayload(attemptPayload, error);
            if (!nextPayload) break;

            const prevJson = JSON.stringify(attemptPayload);
            const nextJson = JSON.stringify(nextPayload);
            if (prevJson === nextJson) break;
            attemptPayload = nextPayload;
        }

        if (error) throw error;

        const contract = insertedData;
        if (!contract) throw new Error('데이터가 생성되었으나 반환되지 않았습니다.');

        const normalized = normalizeContractOutput(contract as Record<string, unknown>);
        const contractId = typeof normalized.id === 'string' ? normalized.id : '';
        // meta는 원본 요청 데이터에서 추출 (memo가 아닌 contract_meta 필드)
        const contractMeta = sanitizeContractMeta(data.contract_meta);
        if (contractId && contractMeta) {
            await saveContractMetaToTable(supabase, contractId, contractMeta);
        }
        const normalizedWithTableMeta = contractId
            ? await normalizeContractOutputWithTableMeta(supabase, contract as Record<string, unknown>)
            : normalized;

        revalidatePath('/contracts');
        revalidatePath('/requests');
        return NextResponse.json({ success: true, data: normalizedWithTableMeta });
    } catch (error) {
        logError('계약 생성 오류:', error);
        return NextResponse.json(
            {
                success: false,
                error: extractErrorMessage(error)
            },
            { status: 500 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        const data = await req.json();
        const { id, ...updateData } = data;
        if (!id) {
            return NextResponse.json(
                { success: false, error: 'id가 필요합니다.' },
                { status: 400 }
            );
        }
        const supabase = createAdminClient();

        // meta는 원본 요청 데이터에서 추출 (contract_settlement_meta 테이블에 별도 저장)
        const incomingMeta = sanitizeContractMeta(updateData.contract_meta);

        let attemptPayload = toModernContractInput(updateData);

        let contract: Record<string, unknown> | null = null;
        let error: unknown = null;
        for (let i = 0; i < 4; i += 1) {
            const result = await supabase
                .from('contracts')
                .update(attemptPayload)
                .eq('id', id)
                .select()
                .single();

            contract = result.data as Record<string, unknown> | null;
            error = result.error;
            if (!error) break;
            if (!shouldRetryWithCompatiblePayload(error)) break;

            const nextPayload = nextCompatiblePayload(attemptPayload, error);
            if (!nextPayload) break;

            const prevJson = JSON.stringify(attemptPayload);
            const nextJson = JSON.stringify(nextPayload);
            if (prevJson === nextJson) break;
            attemptPayload = nextPayload;
        }

        if (error) throw error;

        const normalized = contract ? normalizeContractOutput(contract as Record<string, unknown>) : null;
        const contractId = typeof normalized?.id === 'string' ? normalized.id : '';
        // meta는 원본 요청에서 추출한 것을 테이블에 저장
        if (contractId && incomingMeta) {
            await saveContractMetaToTable(supabase, contractId, incomingMeta);
        }
        const normalizedWithTableMeta = (contract && contractId)
            ? await normalizeContractOutputWithTableMeta(supabase, contract as Record<string, unknown>)
            : normalized;

        revalidatePath('/contracts');
        revalidatePath('/requests');
        return NextResponse.json({ success: true, data: normalizedWithTableMeta });
    } catch (error) {
        logError('계약 수정 오류:', error);
        return NextResponse.json(
            { success: false, error: extractErrorMessage(error) },
            { status: 500 }
        );
    }
}

// 계약 삭제 (트랜잭션 보호: RPC 우선, 폴백 순차 삭제)
export async function DELETE(req: NextRequest) {
    try {
        // 역할 검증: admin 또는 sales만 삭제 가능
        const denied = await requireAdminOrSales(req)
        if (denied) return denied

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID is required' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // RPC 호출 시도 — 단일 트랜잭션으로 안전하게 삭제
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
            'delete_contract_cascade',
            { p_contract_id: id }
        );

        if (!rpcError && rpcResult) {
            const result = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;
            if (result.success) {
                revalidatePath('/contracts');
                revalidatePath('/requests');
                return NextResponse.json({ success: true });
            }
            logError('계약 삭제 RPC 오류:', result.error);
            return NextResponse.json(
                { success: false, error: result.error || '삭제 실패' },
                { status: 500 }
            );
        }

        // RPC 함수 미존재(42883) → 기존 순차 삭제로 폴백
        if (rpcError && rpcError.code !== '42883') {
            logError('계약 삭제 RPC 오류:', rpcError.message);
            return NextResponse.json(
                { success: false, error: extractErrorMessage(rpcError) },
                { status: 500 }
            );
        }

        // ── 폴백: 순차 삭제 (RPC 마이그레이션 전 호환용) ──
        const nowIso = new Date().toISOString();

        // 연결된 요청 카드 참조 해제
        const { error: unlinkError } = await supabase
            .from('requests')
            .update({ contract_id: null, updated_at: nowIso })
            .eq('contract_id', id);
        if (unlinkError) throw unlinkError;

        // 관련 테이블 데이터 정리(테이블이 없는 환경은 건너뜀)
        const relatedTables = [CONTRACT_SETTLEMENT_META_TABLE, 'settlements', 'expenses', 'transactions'];
        for (const table of relatedTables) {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('contract_id', id);

            if (error && error.code !== '42P01') {
                throw error;
            }
        }

        // 계약 물리 삭제
        const { error: deleteError } = await supabase
            .from('contracts')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        revalidatePath('/contracts');
        revalidatePath('/requests');
        return NextResponse.json({ success: true });
    } catch (error) {
        logError('계약 삭제 오류:', error);
        return NextResponse.json(
            { success: false, error: extractErrorMessage(error) },
            { status: 500 }
        );
    }
}
