import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Device } from "@/types/api";

export type UpdateDeviceBody = Partial<{
	code: string;
	name: string;
	post_topic: string | null;
	response_topic: string | null;
	note: string;
	meta: any;
	is_active: boolean;
}>;

export function useUpdateDevice(deviceId: number) {
	const qc = useQueryClient();
	return useMutation<Device, any, UpdateDeviceBody>({
		mutationFn: async (body) => {
			const res = await api.patch<Device>(`/devices/${deviceId}`, body);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["devices.tree"] });
			qc.invalidateQueries({ queryKey: ["device.detail", deviceId] });
		},
	});
}
