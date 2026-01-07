import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Channel, DeviceChannelsResp } from "@/types/api";

export function useDeviceChannels(deviceId: number) {
	return useQuery<Channel[]>({
		queryKey: ["device.channels", deviceId],
		queryFn: async () => {
			const res = await api.get<DeviceChannelsResp>(`/devices/${deviceId}/channels`);
			return res.data.data;
		},
		enabled: Number.isFinite(deviceId),
	});
}
