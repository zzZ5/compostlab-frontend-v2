import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSendDeviceCommand(deviceId: number) {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: async (body: { commands: any[] }) => {
			const res = await api.post(`/devices/${deviceId}/commands`, body);
			return res.data;
		},
		onSuccess: () => {
			// 发送成功后刷新命令历史
			qc.invalidateQueries({ queryKey: ["device.commands", deviceId] });
		},
	});
}
