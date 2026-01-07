import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUpdateRunWindow(runId: number) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (args: { windowId: number; body: any }) => {
			const res = await api.patch(`/runs/${runId}/windows/${args.windowId}`, args.body);
			return res.data;
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ["run.windows", runId] }),
	});
}
