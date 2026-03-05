import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

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

    return Object.keys(next).length > 0 ? next : null;
}

function parseContractMemo(rawMemo: unknown) {
    const memoText = typeof rawMemo === 'string' ? rawMemo : '';
    if (!memoText.trim()) {
        return { note: '', meta: null as Record<string, unknown> | null, hadEnvelope: false };
    }

    try {
        const parsed = JSON.parse(memoText) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && '__sac_contract_meta' in parsed) {
            return {
                note: typeof parsed.note === 'string' ? parsed.note : '',
                meta: sanitizeContractMeta(parsed.__sac_contract_meta),
                hadEnvelope: true,
            };
        }
    } catch {
        // 일반 텍스트 메모는 파싱 실패가 정상
    }

    return { note: memoText, meta: null as Record<string, unknown> | null, hadEnvelope: false };
}

function buildContractMemo(note: string, meta: Record<string, unknown> | null) {
    const trimmedNote = note.trim();
    if (!meta) return trimmedNote || null;

    const envelope: Record<string, unknown> = {
        __sac_contract_meta: meta,
    };
    if (trimmedNote) envelope.note = trimmedNote;
    return JSON.stringify(envelope);
}

function toModernContractInput(
    input: Record<string, unknown>,
    options?: { existingMemo?: unknown }
) {
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

    const incomingMeta = sanitizeContractMeta(mappedData.contract_meta);
    delete mappedData.contract_meta;

    const memoSource = mappedData.memo !== undefined ? mappedData.memo : options?.existingMemo;
    const parsedMemo = parseContractMemo(memoSource);
    const mergedMeta = incomingMeta
        ? { ...(parsedMemo.meta ?? {}), ...incomingMeta }
        : parsedMemo.meta;
    const nextMemo = buildContractMemo(parsedMemo.note, mergedMeta);

    if (nextMemo === null) {
        delete mappedData.memo;
    } else {
        mappedData.memo = nextMemo;
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

    const parsedMemo = parseContractMemo(mappedData.memo);
    if (parsedMemo.meta) {
        mappedData.contract_meta = parsedMemo.meta;
    }
    if (parsedMemo.hadEnvelope) {
        mappedData.memo = parsedMemo.note;
    }

    return mappedData;
}

function getErrorText(error: unknown) {
    const message = error instanceof Error
        ? error.message.toLowerCase()
        : String((error as { message?: unknown })?.message ?? '').toLowerCase();

    return message;
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
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data: normalizeContractOutput(data as Record<string, unknown>) });
    } catch (error) {
        console.error('계약 조회 오류:', error);
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

        revalidatePath('/contracts');
        return NextResponse.json({ success: true, data: normalizeContractOutput(contract as Record<string, unknown>) });
    } catch (error) {
        console.error('계약 생성 오류:', error);
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
        let existingMemo: unknown = undefined;

        if (
            updateData &&
            typeof updateData === 'object' &&
            'contract_meta' in updateData &&
            !('memo' in updateData)
        ) {
            const existing = await supabase
                .from('contracts')
                .select('memo')
                .eq('id', id)
                .single();
            if (!existing.error) {
                existingMemo = (existing.data as { memo?: unknown } | null)?.memo;
            }
        }

        let attemptPayload = toModernContractInput(updateData, { existingMemo });

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

        revalidatePath('/contracts');
        return NextResponse.json({ success: true, data: contract ? normalizeContractOutput(contract as Record<string, unknown>) : null });
    } catch (error) {
        console.error('계약 수정 오류:', error);
        return NextResponse.json(
            { success: false, error: extractErrorMessage(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID is required' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();
        const nowIso = new Date().toISOString();

        // 연결된 요청 카드 참조 해제
        const { error: unlinkError } = await supabase
            .from('requests')
            .update({ contract_id: null, updated_at: nowIso })
            .eq('contract_id', id);
        if (unlinkError) throw unlinkError;

        // 관련 테이블 데이터 정리(테이블이 없는 환경은 건너뜀)
        const relatedTables = ['settlements', 'expenses', 'transactions'];
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
        console.error('계약 삭제 오류:', error);
        return NextResponse.json(
            { success: false, error: extractErrorMessage(error) },
            { status: 500 }
        );
    }
}
