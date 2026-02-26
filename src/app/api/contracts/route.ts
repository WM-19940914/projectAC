import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const supabase = createAdminClient();

        const { data: insertedData, error } = await supabase
            .from('contracts')
            .insert([data])
            .select();

        if (error) throw error;

        const contract = insertedData?.[0];
        if (!contract) throw new Error('데이터가 생성되었으나 반환되지 않았습니다.');

        revalidatePath('/contracts');
        return NextResponse.json({ success: true, data: contract });
    } catch (error) {
        console.error('계약 생성 오류:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        const data = await req.json();
        const { id, ...updateData } = data;
        const supabase = createAdminClient();

        // 필드명 매핑 (name -> title, amount -> contract_amount)
        const mappedData: Record<string, unknown> = { ...updateData };
        if (mappedData.name) {
            mappedData.title = mappedData.name;
            delete mappedData.name;
        }
        if (mappedData.amount !== undefined) {
            mappedData.contract_amount = mappedData.amount;
            delete mappedData.amount;
        }

        const { data: contract, error } = await supabase
            .from('contracts')
            .update(mappedData)
            .eq('id', id)
            .select();

        if (error) throw error;

        revalidatePath('/contracts');
        return NextResponse.json({ success: true, data: contract?.[0] });
    } catch (error) {
        console.error('계약 수정 오류:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
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

        const { error } = await supabase
            .from('contracts')
            .update({
                deleted_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (error) throw error;

        revalidatePath('/contracts');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('계약 삭제 오류:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
