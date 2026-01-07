import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Channel } from "@/types/api";

export type CreateChannelBody = {
	code: string;
	name?: string;
	unit?: string;
	metric?: string;
	role?: string;
	display_name?: string;
	meta?: any;
	is_active?: boolean;
};

export function useCreateChannel(deviceId: number) {
	const qc = useQueryClient();
	return useMutation<Channel, any, CreateChannelBody>({
		mutationFn: async (body) => {
			const res = await api.post<Channel>(`/devices/${deviceId}/channels`, body);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["devices.tree"] });
			qc.invalidateQueries({ queryKey: ["device.channels", deviceId] });
		},
	});
}
