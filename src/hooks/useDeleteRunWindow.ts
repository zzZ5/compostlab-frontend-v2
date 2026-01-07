import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDeleteRunWindow(runId: number) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (windowId: number) => {
			const res = await api.delete(`/runs/${runId}/windows/${windowId}`);
			return res.data;
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ["run.windows", runId] }),
	});
}
