import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api";
import type { RunTelemetryResp } from "@/types/api";

export function useRunTelemetry(args: {
	runId: number;
	from?: string | null;
	to?: string | null;
	channels?: string[] | null; // code 列表
	bucket?: string | null;
	group?: string | null;
	treatment?: string | null;
}) {
	const { runId, from, to, channels, bucket, group, treatment } = args;

	return useQuery<RunTelemetryResp>({
		queryKey: ["run.telemetry", runId, from, to, channels?.join(","), bucket, group, treatment],
		queryFn: async () => {
			const qs = buildQuery({
				from,
				to,
				channels: channels && channels.length ? channels : null,
				bucket,
				group,
				treatment,
			});
			const res = await api.get<RunTelemetryResp>(`/runs/${runId}/telemetry${qs}`);
			return res.data;
		},
		enabled: Number.isFinite(runId),
	});
}
