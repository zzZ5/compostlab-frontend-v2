import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RunDetailResp, Run } from "@/types/api";

export function useRunDetail(runId: number) {
	return useQuery<Run>({
		queryKey: ["run.detail", runId],
		queryFn: async () => {
			const res = await api.get<RunDetailResp>(`/runs/${runId}`);
			return res.data;
		},
		enabled: Number.isFinite(runId),
	});
}
