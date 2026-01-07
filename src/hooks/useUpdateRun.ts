import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Run } from "@/types/api";

export type UpdateRunBody = Partial<{
	name: string;
	note: string;
	recipe: any;
	settings: any;
	start_at: string;
	end_at: string | null;
}>;

export function useUpdateRun(runId: number) {
	const qc = useQueryClient();
	return useMutation<Run, any, UpdateRunBody>({
		mutationFn: async (body) => {
			const res = await api.patch<Run>(`/runs/${runId}`, body);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["runs.list"] });
			qc.invalidateQueries({ queryKey: ["run.detail", runId] });
			qc.invalidateQueries({ queryKey: ["run.windows", runId] });
		},
	});
}
