import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDeleteRun() {
	const qc = useQueryClient();
	return useMutation<{ detail: string; run_id: number }, any, { run_id: number }>({
		mutationFn: async ({ run_id }) => {
			const res = await api.delete(`/runs/${run_id}`);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["runs.list"] });
		},
	});
}
