import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCreateRun() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (body: { name: string; start_at?: string | null; note?: string }) => {
			const res = await api.post("/runs", body);
			return res.data;
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ["runs.list"] }),
	});
}
