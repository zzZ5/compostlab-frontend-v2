import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDeleteChannel(deviceId: number) {
	const qc = useQueryClient();
	return useMutation<{ detail: string; device_id: number; channel_id: number }, any, { channel_id: number }>({
		mutationFn: async ({ channel_id }) => {
			const res = await api.delete(`/devices/${deviceId}/channels/${channel_id}`);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["devices.tree"] });
			qc.invalidateQueries({ queryKey: ["device.channels", deviceId] });
		},
	});
}
