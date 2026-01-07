import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Channel } from "@/types/api";

export type UpdateChannelBody = Partial<{
	code: string;
	name: string;
	unit: string;
	metric: string;
	role: string;
	display_name: string;
	meta: any;
	is_active: boolean;
}>;

export function useUpdateChannel(deviceId: number, channelId: number) {
	const qc = useQueryClient();
	return useMutation<Channel, any, UpdateChannelBody>({
		mutationFn: async (body) => {
			const res = await api.patch<Channel>(
				`/devices/${deviceId}/channels/${channelId}`,
				body
			);
			return res.data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["devices.tree"] });
			qc.invalidateQueries({ queryKey: ["device.channels", deviceId] });
		},
	});
}
