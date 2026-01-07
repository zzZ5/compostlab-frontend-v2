import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type DeviceCommand = {
	command_id: number;
	device_id: number;
	status: "queued" | "sent" | "acked" | "failed";
	command?: string;
	payload: any;
	result?: any;
	created_at?: string;
	sent_at?: string | null;
	acked_at?: string | null;
};

type ListResp<T> = { count: number; data: T[] };

export function useDeviceCommands(deviceId: number, limit = 50, status?: string) {
	const q = new URLSearchParams();
	q.set("limit", String(limit));
	if (status) q.set("status", status);

	return useQuery({
		queryKey: ["device.commands", deviceId, q.toString()],
		queryFn: async () => {
			const res = await api.get<ListResp<DeviceCommand>>(
				`/devices/${deviceId}/commands?${q.toString()}`
			);
			return res.data;
		},
		enabled: Number.isFinite(deviceId),
		refetchInterval: 5000, // 5秒刷新命令列表（你现在不需要 ACK 也无所谓）
	});
}
