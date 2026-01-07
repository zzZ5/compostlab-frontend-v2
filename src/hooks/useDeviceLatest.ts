import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type LatestRow = {
	code: string;
	ts: string;
	value: number;
	unit?: string;
};

type LatestResp = {
	device_id: number;
	count: number;
	data: LatestRow[];
};

export function useDeviceLatest(deviceId: number, channels: string[]) {
	const qs = channels.length ? `?channels=${channels.join(",")}` : "";
	return useQuery({
		queryKey: ["device.latest", deviceId, channels.join(",")],
		queryFn: async () => {
			const res = await api.get<LatestResp>(`/devices/${deviceId}/latest${qs}`);
			return res.data;
		},
		enabled: Number.isFinite(deviceId),
		refetchInterval: 5000,
	});
}
