import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCreateRunWindow(runId: number) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (body: {
			device_id: number;
			group?: string;
			treatment?: string;
			start_at?: string | null;
			end_at?: string | null;
		}) => {
			const res = await api.post(`/runs/${runId}/windows`, body);
			return res.data;
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ["run.windows", runId] }),
	});
}
