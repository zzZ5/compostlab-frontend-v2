"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ReactECharts from "echarts-for-react";
import {
	Button,
	Card,
	Col,
	DatePicker,
	Divider,
	Grid,
	message,
	Row,
	Select,
	Space,
	Spin,
	Tabs,
	Tag,
	Typography,
} from "antd";
import dayjs from "dayjs";

import Page from "@/components/Page";

import { useDevicesTree } from "@/hooks/useDevicesTree";
import { useRunDetail } from "@/hooks/useRunDetail";
import { useRunWindows } from "@/hooks/useRunWindows";
import { useRunTelemetry } from "@/hooks/useRunTelemetry";

import { api, buildQuery, downloadBlob, getErrorMessage } from "@/lib/api";
import { normalizeMetric, MetricKey, metricLabel } from "@/lib/metrics";

import type { RunWindow } from "@/types/api";

const { Text } = Typography;
const { useBreakpoint } = Grid;

type Opt = { value: string; label: string };

export default function RunDetailPage() {
	const params = useParams<{ id: string }>();
	const runId = Number(params.id);

	const screens = useBreakpoint();
	const isMobile = !screens.md;

	const runQ = useRunDetail(runId);
	const devicesQ = useDevicesTree(true);

	// filters
	const [group, setGroup] = useState<string | null>(null);
	const [treatment, setTreatment] = useState<string | null>(null);

	const windowsQ = useRunWindows(runId, { group, treatment });
	const windows: RunWindow[] = windowsQ.data || [];

	// metric & time
	const [activeMetric, setActiveMetric] = useState<MetricKey>("temperature");
	const [range, setRange] = useState<[any, any] | null>(null);

	/**
	 * bucket：
	 * - 为了最大兼容你的后端 parse_bucket：
	 *   raw 用空字符串表示“不传 bucket”
	 * - export_wide 必须 bucket 不能为空（raw 不支持）
	 */
	const [bucket, setBucket] = useState<string>("10m");

	const from = range?.[0] ? dayjs(range[0]).format("YYYY-MM-DD HH:mm:ss") : null;
	const to = range?.[1] ? dayjs(range[1]).format("YYYY-MM-DD HH:mm:ss") : null;

	// window devices
	const windowDeviceIds = useMemo(() => {
		const s = new Set<number>();
		for (const w of windows) {
			if (typeof w.device_id === "number") s.add(w.device_id);
		}
		return Array.from(s);
	}, [windows]);

	const devices = devicesQ.data || [];
	const deviceMap = useMemo(() => {
		const m = new Map<number, any>();
		for (const d of devices) m.set(d.device_id, d);
		return m;
	}, [devices]);

	const windowDevices = useMemo(() => {
		return windowDeviceIds.map((id) => deviceMap.get(id)).filter(Boolean);
	}, [windowDeviceIds, deviceMap]);

	// codes for current metric across window devices
	const codesForMetric = useMemo(() => {
		const s = new Set<string>();
		for (const d of windowDevices) {
			for (const ch of d.channels || []) {
				if (normalizeMetric(ch.metric) === activeMetric && ch?.code) s.add(ch.code);
			}
		}
		return Array.from(s);
	}, [windowDevices, activeMetric]);

	const telemetryQ = useRunTelemetry({
		runId,
		from,
		to,
		bucket: bucket ? bucket : null, // raw -> null
		group,
		treatment,
		channels: codesForMetric.length ? codesForMetric : null,
	});

	const points = telemetryQ.data?.data || [];

	// options from windows
	const groupOptions: Opt[] = useMemo(() => {
		const s = new Set<string>();
		for (const w of windows) if (w.group) s.add(w.group);
		return Array.from(s)
			.sort()
			.map((x) => ({ value: x, label: x }));
	}, [windows]);

	const treatmentOptions: Opt[] = useMemo(() => {
		const s = new Set<string>();
		for (const w of windows) if (w.treatment) s.add(w.treatment);
		return Array.from(s)
			.sort()
			.map((x) => ({ value: x, label: x }));
	}, [windows]);

	const chartOption = useMemo(() => {
		// group by code
		const byCode = new Map<string, Array<[string, number]>>();
		for (const p of points as any[]) {
			const code = p.code || "UNKNOWN";
			const v = typeof p.value === "number" ? p.value : Number(p.value);
			if (!Number.isFinite(v)) continue;
			if (!byCode.has(code)) byCode.set(code, []);
			byCode.get(code)!.push([p.ts, v]);
		}

		const series = Array.from(byCode.entries()).map(([code, data]) => ({
			name: code,
			type: "line",
			showSymbol: false,
			data,
		}));

		return {
			tooltip: { trigger: "axis" },
			legend: { type: "scroll" },
			grid: { left: 52, right: 18, top: 36, bottom: 36 },
			xAxis: { type: "time" },
			yAxis: { type: "value" },
			series,
		};
	}, [points]);

	async function exportRunRaw() {
		try {
			const qs = buildQuery({
				from,
				to,
				group,
				treatment,
				// raw export 不要求 bucket/channels，但允许你带上（也不影响）
				bucket: bucket ? bucket : null,
				channels: codesForMetric.length ? codesForMetric : null,
			});

			await downloadBlob(
				api,
				`/runs/${runId}/export${qs}`,
				`run_${runId}_${activeMetric}_raw.csv`,
				"text/csv;charset=utf-8"
			);
		} catch (e) {
			message.error(getErrorMessage(e, "导出 Raw 失败"));
		}
	}

	async function exportRunWide() {
		// 你的后端 export_wide：必须 bucket + channels
		if (!bucket) {
			message.warning("Wide 导出必须选择 bucket（例如 10m/1h），raw 不支持。");
			return;
		}
		if (!codesForMetric.length) {
			message.warning("Wide 导出必须指定 channels（当前 metric 下未找到通道 code）。");
			return;
		}

		try {
			const qs = buildQuery({
				from,
				to,
				group,
				treatment,
				bucket, // ✅ 必须
				channels: codesForMetric, // ✅ 必须
			});

			await downloadBlob(
				api,
				`/runs/${runId}/export_wide${qs}`,
				`run_${runId}_${activeMetric}_wide_${bucket}.csv`,
				"text/csv;charset=utf-8"
			);
		} catch (e) {
			message.error(getErrorMessage(e, "导出 Wide 失败"));
		}
	}

	const loading = runQ.isLoading || devicesQ.isLoading || windowsQ.isLoading;

	if (loading) {
		return (
			<div style={{ padding: 48 }}>
				<Spin />
			</div>
		);
	}

	const run = runQ.data;

	if (!run) {
		return (
			<div style={{ padding: 24 }}>
				<Text type="secondary">Run not found.</Text>
			</div>
		);
	}

	return (
		<Page
			title={run.name || `Run #${runId}`}
			extra={
				<Space wrap>
					<Tag color="blue">ID {runId}</Tag>
					<Button onClick={exportRunRaw}>导出 Raw</Button>
					<Button onClick={exportRunWide}>导出 Wide</Button>
				</Space>
			}
		>
			<Row gutter={[12, 12]}>
				<Col xs={24} md={16}>
					<Card>
						<Space orientation="vertical" style={{ width: "100%" }} size={12}>
							<Space wrap>
								<Text type="secondary">start</Text>
								<Tag>{run.start_at || "-"}</Tag>
								<Text type="secondary">end</Text>
								<Tag>{run.end_at || "-"}</Tag>
							</Space>

							<Space wrap>
								<Select
									style={{ width: 160 }}
									allowClear
									placeholder="group"
									value={group}
									onChange={(v) => setGroup((v as string) ?? null)}
									options={groupOptions}
								/>
								<Select
									style={{ width: 160 }}
									allowClear
									placeholder="treatment"
									value={treatment}
									onChange={(v) => setTreatment((v as string) ?? null)}
									options={treatmentOptions}
								/>
								<DatePicker.RangePicker
									showTime
									value={range as any}
									onChange={(v) => setRange(v as any)}
									style={{ width: isMobile ? "100%" : 380 }}
								/>
								<Select
									style={{ width: 120 }}
									value={bucket}
									onChange={setBucket}
									options={[
										{ value: "", label: "raw" }, // ✅ raw：不传 bucket（export_wide 会提示不支持）
										{ value: "1m", label: "1m" },
										{ value: "10m", label: "10m" },
										{ value: "1h", label: "1h" },
									]}
								/>
							</Space>

							<Tabs
								activeKey={activeMetric}
								onChange={(k) => setActiveMetric(k as MetricKey)}
								items={[
									{ key: "temperature", label: "温度" },
									{ key: "o2", label: "氧气" },
									{ key: "co2", label: "二氧化碳" },
									{ key: "moisture", label: "含水率" },
								]}
							/>

							<Space wrap>
								<Tag>metric: {metricLabel(activeMetric)}</Tag>
								<Tag>codes: {codesForMetric.length ? codesForMetric.join(", ") : "-"}</Tag>
								<Tag>devices: {windowDevices.length}</Tag>
								<Tag>windows: {windows.length}</Tag>
							</Space>

							<div style={{ height: 420 }}>
								<ReactECharts option={chartOption} style={{ height: "100%", width: "100%" }} />
							</div>

							{telemetryQ.isFetching && <Text type="secondary">加载中...</Text>}
							{telemetryQ.isError && <Text type="danger">Telemetry 加载失败</Text>}
							{!telemetryQ.isFetching && !points.length && (
								<Text type="secondary">暂无数据（检查时间范围 / bucket / group / treatment）</Text>
							)}
						</Space>
					</Card>
				</Col>

				<Col xs={24} md={8}>
					<Card title="Windows">
						<Space orientation="vertical" style={{ width: "100%" }} size={8}>
							<Text type="secondary">命中的窗口用于确定参与设备与有效时间段。</Text>
							<Divider style={{ margin: "8px 0" }} />

							<div style={{ maxHeight: 520, overflow: "auto" }}>
								<Space orientation="vertical" style={{ width: "100%" }} size={8}>
									{windows.map((w) => (
										<Card key={w.window_id} size="small">
											<Space orientation="vertical" size={2} style={{ width: "100%" }}>
												<Space wrap>
													<Tag>window {w.window_id}</Tag>
													<Tag color="blue">device {w.device_id}</Tag>
												</Space>
												<Text style={{ fontSize: 12 }}>group: {w.group || "-"}</Text>
												<Text style={{ fontSize: 12 }}>treatment: {w.treatment || "-"}</Text>
												<Text style={{ fontSize: 12 }}>start: {w.start_at || "-"}</Text>
												<Text style={{ fontSize: 12 }}>end: {w.end_at || "-"}</Text>
											</Space>
										</Card>
									))}
								</Space>
							</div>
						</Space>
					</Card>
				</Col>
			</Row>
		</Page>
	);
}