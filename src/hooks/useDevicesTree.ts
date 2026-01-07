import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api";
import type { DeviceTreeResp, DeviceTreeItem } from "@/types/api";

export function useDevicesTree(withLatest = true) {
	return useQuery<DeviceTreeItem[]>({
		queryKey: ["devices.tree", withLatest],
		queryFn: async () => {
			const qs = buildQuery({ with_latest: withLatest ? 1 : 0 });
			const res = await api.get<DeviceTreeResp>(`/devices/tree${qs}`);
			return res.data.data;
		},
	});
}
