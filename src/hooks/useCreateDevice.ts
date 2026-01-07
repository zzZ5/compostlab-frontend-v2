import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Device } from "@/types/api";

export type CreateDeviceBody = {
	code: string;
	name?: string;
	post_topic?: string | null;
	response_topic?: string | null;
	note?: string;
	meta?: any;
	is_active?: boolean;
};

export function useCreateDevice() {
	const qc = useQueryClient();
	return useMutation<Device, any, CreateDeviceBody>({
		mutationFn: async (body) => {
			const res = await api.post<Device>(`/devices`, body);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["devices.tree"] });
		},
	});
}
