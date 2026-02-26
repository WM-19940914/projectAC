import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const supabase = createAdminClient();

        const { data: contract, error } = await supabase
            .from('contracts')
            .insert([data])
            .select()
            .single();

        if (error) throw error;

        revalidatePath('/contracts');
        return NextResponse.json({ success: true, data: contract });
    } catch (error: any) {
        console.error('계약 생성 오류:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        const data = await req.json();
        const { id, ...updateData } = data;
        const supabase = createAdminClient();

        const { data: contract, error } = await supabase
            .from('contracts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        revalidatePath('/contracts');
        return NextResponse.json({ success: true, data: contract });
    } catch (error: any) {
        console.error('계약 수정 오류:', error);
        return NextResponse.json(
            { success: false, error: error.message },
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
    } catch (error: any) {
        console.error('계약 삭제 오류:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
