import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

// Create request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, customer_id, inquiry_date, memo } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("requests")
      .insert({
        title: title.trim(),
        status: "견적 문의",
        customer_id: customer_id || null,
        inquiry_date: inquiry_date || null,
        memo: memo || null,
      })
      .select()
      .single()

    if (error) {
      console.error("[POST /api/requests]", error.message)
      return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true, data })
  } catch (e: unknown) {
    console.error("[POST /api/requests]", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Update request
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const allowedFields = [
      "hidden",
      "title",
      "customer_id",
      "contract_id",
      "confirmed_quote_id",
      "inquiry_date",
      "memo",
      "status",
      "manual_incentive",
    ] as const

    const updateData: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in fields) updateData[key] = fields[key]
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    if ("hidden" in updateData) {
      updateData.hidden = !!updateData.hidden
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("requests")
      .update(updateData)
      .eq("id", id)

    if (error) {
      console.error("[PATCH /api/requests]", error.message)
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[PATCH /api/requests]", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Delete request + linked contract
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: targetRequest, error: requestFetchError } = await supabase
      .from("requests")
      .select("id, contract_id")
      .eq("id", id)
      .single()

    if (requestFetchError) {
      console.error("[DELETE /api/requests] fetch", requestFetchError.message)
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const contractId = (targetRequest?.contract_id as string | null) ?? null

    const { data: quotations, error: quotationsFetchError } = await supabase
      .from("quotations")
      .select("id")
      .eq("request_id", id)
    if (quotationsFetchError) {
      console.error("[DELETE /api/requests] quotations fetch", quotationsFetchError.message)
      return NextResponse.json({ error: "Failed to fetch linked quotations" }, { status: 500 })
    }

    const quotationIds = (quotations || []).map((q) => q.id as string).filter(Boolean)
    if (quotationIds.length > 0) {
      const { error: clearConfirmedQuoteError } = await supabase
        .from("requests")
        .update({ confirmed_quote_id: null })
        .in("confirmed_quote_id", quotationIds)
      if (clearConfirmedQuoteError) {
        console.error("[DELETE /api/requests] clear confirmed_quote_id", clearConfirmedQuoteError.message)
        return NextResponse.json({ error: "Failed to clear confirmed quote references" }, { status: 500 })
      }

      const { error: clearConfirmedQuotationError } = await supabase
        .from("requests")
        .update({ confirmed_quotation_id: null })
        .in("confirmed_quotation_id", quotationIds)
      if (clearConfirmedQuotationError) {
        console.error("[DELETE /api/requests] clear confirmed_quotation_id", clearConfirmedQuotationError.message)
        return NextResponse.json({ error: "Failed to clear confirmed quotation references" }, { status: 500 })
      }

      const { error: quotationItemsDeleteError } = await supabase
        .from("quotation_items")
        .delete()
        .in("quotation_id", quotationIds)
      if (quotationItemsDeleteError) {
        console.error("[DELETE /api/requests] quotation_items", quotationItemsDeleteError.message)
        return NextResponse.json({ error: "Failed to delete linked quotation items" }, { status: 500 })
      }

      const { error: quotationsDeleteError } = await supabase
        .from("quotations")
        .delete()
        .in("id", quotationIds)
      if (quotationsDeleteError) {
        console.error("[DELETE /api/requests] quotations", quotationsDeleteError.message)
        return NextResponse.json({ error: "Failed to delete linked quotations" }, { status: 500 })
      }
    }

    if (contractId) {
      const { error: unlinkError } = await supabase
        .from("requests")
        .update({ contract_id: null })
        .eq("contract_id", contractId)
      if (unlinkError) {
        console.error("[DELETE /api/requests] unlink", unlinkError.message)
        return NextResponse.json({ error: "Failed to unlink contract" }, { status: 500 })
      }

      const relatedTables = ["settlements", "expenses", "transactions"] as const
      for (const table of relatedTables) {
        const { error: relatedDeleteError } = await supabase
          .from(table)
          .delete()
          .eq("contract_id", contractId)

        // 42P01: table does not exist in this environment
        if (relatedDeleteError && relatedDeleteError.code !== "42P01") {
          console.error(`[DELETE /api/requests] ${table}`, relatedDeleteError.message)
          return NextResponse.json({ error: "Failed to clean linked contract data" }, { status: 500 })
        }
      }

      const { error: contractDeleteError } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contractId)

      if (contractDeleteError) {
        console.error("[DELETE /api/requests] contract", contractDeleteError.message)
        return NextResponse.json({ error: "Failed to delete linked contract" }, { status: 500 })
      }
    }

    const { error } = await supabase.from("requests").delete().eq("id", id)
    if (error) {
      console.error("[DELETE /api/requests]", error.message)
      return NextResponse.json({ error: "Failed to delete request" }, { status: 500 })
    }

    revalidatePath("/requests")
    revalidatePath("/contracts")
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[DELETE /api/requests]", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
