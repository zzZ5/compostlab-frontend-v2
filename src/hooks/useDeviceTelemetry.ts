import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api";
import type { DeviceTelemetryResp } from "@/types/api";

export function useDeviceTelemetry(args: {
	deviceId: number;
	from?: string | null;
	to?: string | null;
	channels?: string[] | null; // 注意：这里仍是 code 列表
	bucket?: string | null;
}) {
	const { deviceId, from, to, channels, bucket } = args;

	return useQuery<DeviceTelemetryResp>({
		queryKey: ["device.telemetry", deviceId, from, to, channels?.join(","), bucket],
		queryFn: async () => {
			const qs = buildQuery({
				from,
				to,
				channels: channels && channels.length ? channels : null,
				bucket,
			});
			const res = await api.get<DeviceTelemetryResp>(`/devices/${deviceId}/telemetry${qs}`);
			return res.data;
		},
		enabled: Number.isFinite(deviceId),
	});
}
