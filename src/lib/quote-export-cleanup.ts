import { logError } from "@/lib/logger"

const QUOTE_EXPORTS_BUCKET = "quote-exports"
const IGNORABLE_DB_ERROR_CODES = new Set(["42P01", "PGRST205"])

export async function cleanupQuoteExports(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  quotationIds: string[],
  logPrefix: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const targetIds = quotationIds.filter(Boolean)
  if (targetIds.length === 0) return { ok: true }

  const { data: exportRows, error: exportFetchError } = await supabase
    .from("quote_exports")
    .select("id, storage_path")
    .in("quotation_id", targetIds)

  if (exportFetchError) {
    if (IGNORABLE_DB_ERROR_CODES.has(exportFetchError.code)) return { ok: true }
    logError(`${logPrefix} quote_exports fetch`, exportFetchError.message)
    return { ok: false, error: "견적서 내보내기 이력 조회에 실패했습니다." }
  }

  const storagePaths = (exportRows || [])
    .map((row: { storage_path?: string | null }) => row.storage_path || "")
    .filter(Boolean)

  if (storagePaths.length > 0) {
    const { error: storageRemoveError } = await supabase.storage
      .from(QUOTE_EXPORTS_BUCKET)
      .remove(storagePaths)

    if (storageRemoveError) {
      logError(`${logPrefix} quote_exports storage`, storageRemoveError.message)
      return { ok: false, error: "견적서 내보내기 파일 삭제에 실패했습니다." }
    }
  }

  const { error: exportDeleteError } = await supabase
    .from("quote_exports")
    .delete()
    .in("quotation_id", targetIds)

  if (exportDeleteError) {
    if (IGNORABLE_DB_ERROR_CODES.has(exportDeleteError.code)) return { ok: true }
    logError(`${logPrefix} quote_exports delete`, exportDeleteError.message)
    return { ok: false, error: "견적서 내보내기 이력 삭제에 실패했습니다." }
  }

  return { ok: true }
}
