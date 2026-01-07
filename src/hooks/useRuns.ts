import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api";
import type { Run, RunListResp } from "@/types/api";

export function useRuns(args?: { q?: string }) {
	return useQuery<Run[]>({
		queryKey: ["runs.list", args?.q || ""],
		queryFn: async () => {
			const qs = buildQuery({ q: args?.q || null });
			const res = await api.get<RunListResp>(`/runs${qs}`);
			return res.data.data;
		},
	});
}
