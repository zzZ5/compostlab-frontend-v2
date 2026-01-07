import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDeleteDevice() {
	const qc = useQueryClient();
	return useMutation<{ detail: string; device_id: number }, any, { device_id: number }>({
		mutationFn: async ({ device_id }) => {
			const res = await api.delete(`/devices/${device_id}`);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["devices.tree"] });
		},
	});
}
