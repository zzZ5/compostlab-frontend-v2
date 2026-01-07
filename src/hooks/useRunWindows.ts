import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api";
import type { RunWindow, RunWindowsResp } from "@/types/api";

/**
 * Runs Windows
 * - 永远只返回 RunWindow[]（页面可直接 map/for-of）
 * - 支持 group / treatment 过滤（与你后端一致）
 */
export function useRunWindows(
	runId: number,
	args?: { group?: string | null; treatment?: string | null }
) {
	return useQuery<RunWindow[]>({
		queryKey: ["run.windows", runId, args?.group || "", args?.treatment || ""],
		queryFn: async () => {
			const qs = buildQuery({
				group: args?.group ?? null,
				treatment: args?.treatment ?? null,
			});

			const res = await api.get<RunWindowsResp>(`/runs/${runId}/windows${qs}`);
			return res.data.data; // ✅ 只返回数组
		},
		enabled: Number.isFinite(runId),
	});
}