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
	Input,
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
import { useDeviceTelemetry } from "@/hooks/useDeviceTelemetry";

import { api, buildQuery, downloadBlob, getErrorMessage } from "@/lib/api";
import { channelByMetric } from "@/lib/channel";
import { MetricKey, metricLabel } from "@/lib/metrics";

const { Text } = Typography;

type CmdBody = {
	commands: any[];
};

export default function DeviceDetailPage() {
	const params = useParams<{ id: string }>();
	const deviceId = Number(params.id);

	const screens = Grid.useBreakpoint();
	const isMobile = !screens.md;

	const devicesQ = useDevicesTree(true);
	const device = useMemo(() => {
		return (devicesQ.data || []).find((d) => d.device_id === deviceId) || null;
	}, [devicesQ.data, deviceId]);

	// metric tabs
	const [activeMetric, setActiveMetric] = useState<MetricKey>("temperature");

	// time range
	const [range, setRange] = useState<[any, any] | null>(null);
	const [bucket, setBucket] = useState<string>("10m");

	// command JSON input
	const [cmdJson, setCmdJson] = useState<string>(
		JSON.stringify(
			{
				commands: [
					{
						command: "set_aeration",
						params: { on: 1, ms: 60000 },
					},
				],
			},
			null,
			2
		)
	);

	const from = range?.[0] ? dayjs(range[0]).format("YYYY-MM-DD HH:mm:ss") : null;
	const to = range?.[1] ? dayjs(range[1]).format("YYYY-MM-DD HH:mm:ss") : null;

	// resolve channel by metric -> use code for telemetry query
	const activeChannel = useMemo(() => {
		if (!device) return null;
		return channelByMetric(device.channels, activeMetric);
	}, [device, activeMetric]);

	const telemetryQ = useDeviceTelemetry({
		deviceId,
		from,
		to,
		bucket: bucket || null,
		channels: activeChannel?.code ? [activeChannel.code] : null,
	});

	const points = telemetryQ.data?.data || [];

	const chartOption = useMemo(() => {
		const data = points.map((p: any) => [p.ts, p.value]);

		return {
			tooltip: { trigger: "axis" },
			grid: { left: 48, right: 18, top: 20, bottom: 36 },
			xAxis: { type: "time" },
			yAxis: { type: "value", name: activeChannel?.unit || "" },
			series: [
				{
					name: activeChannel?.display_name || metricLabel(activeMetric),
					type: "line",
					showSymbol: false,
					data,
				},
			],
		};
	}, [points, activeMetric, activeChannel]);

	const latestCards = useMemo(() => {
		if (!device) return [];
		const temp = channelByMetric(device.channels, "temperature");
		const o2 = channelByMetric(device.channels, "o2");
		const co2 = channelByMetric(device.channels, "co2");
		const mois = channelByMetric(device.channels, "moisture");

		return [
			{ k: "temperature" as MetricKey, ch: temp },
			{ k: "o2" as MetricKey, ch: o2 },
			{ k: "co2" as MetricKey, ch: co2 },
			{ k: "moisture" as MetricKey, ch: mois },
		];
	}, [device]);

	async function sendCommand() {
		if (!device) return;

		let body: CmdBody;
		try {
			body = JSON.parse(cmdJson);
		} catch (e) {
			message.error("命令 JSON 格式错误");
			return;
		}

		if (!body?.commands || !Array.isArray(body.commands) || body.commands.length === 0) {
			message.error("commands 必须是非空数组");
			return;
		}

		try {
			// 只要成功发布即可，不要长轮询
			await api.post(`/devices/${deviceId}/commands`, body, { timeout: 15000 });
			message.success("已下发（MQTT publish 已触发）");
		} catch (e) {
			message.error(getErrorMessage(e, "下发失败"));
		}
	}

	async function exportCsv() {
		if (!device) return;

		const qs = buildQuery({
			from,
			to,
			channels: activeChannel?.code ? [activeChannel.code] : null,
			bucket: bucket || null,
		});

		// 注意：你后端 export 是 streaming csv，responseType blob
		try {
			await downloadBlob(api, `/devices/${deviceId}/export${qs}`, `device_${device.code}_${activeChannel?.code || "all"}.csv`, "text/csv;charset=utf-8");
		} catch (e) {
			message.error(getErrorMessage(e, "导出失败"));
		}
	}

	if (devicesQ.isLoading) {
		return (
			<div style={{ padding: 48 }}>
				<Spin />
			</div>
		);
	}

	if (!device) {
		return (
			<div style={{ padding: 24 }}>
				<Text type="secondary">Device not found.</Text>
			</div>
		);
	}

	return (
		<Page
			title={device.name || device.code}
			extra={
				<Space wrap>
					<Tag color="blue">{device.code}</Tag>
					<Tag>{device.is_active ? "Active" : "Inactive"}</Tag>
					<Button onClick={exportCsv}>导出 CSV</Button>
				</Space>
			}
		>
			{/* KPI */}
			<Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
				{latestCards.map(({ k, ch }) => (
					<Col xs={12} md={6} key={k}>
						<Card
							hoverable
							onClick={() => setActiveMetric(k)}
							style={{
								cursor: "pointer",
								border: k === activeMetric ? "1px solid rgba(22,119,255,.6)" : undefined,
							}}
						>
							<Text type="secondary">{ch?.display_name || metricLabel(k)}</Text>
							<div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
								{ch?.latest ? `${ch.latest.value} ${ch.unit || ""}` : "-"}
							</div>
							<div style={{ fontSize: 12, color: "rgba(0,0,0,.45)", marginTop: 6 }}>
								{ch?.latest?.ts || "-"}
							</div>
						</Card>
					</Col>
				))}
			</Row>

			<Row gutter={[12, 12]}>
				{/* Chart */}
				<Col xs={24} md={16}>
					<Card>
						<Space orientation="vertical" style={{ width: "100%" }} size={12}>
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
								<DatePicker.RangePicker
									showTime
									value={range as any}
									onChange={(v) => setRange(v as any)}
									style={{ width: isMobile ? "100%" : 360 }}
								/>

								<Select
									style={{ width: 120 }}
									value={bucket}
									onChange={setBucket}
									options={[
										{ value: "raw", label: "raw" },
										{ value: "1m", label: "1m" },
										{ value: "10m", label: "10m" },
										{ value: "1h", label: "1h" },
									]}
								/>

								<Tag>
									当前通道：{activeChannel?.code || "-"}（{activeChannel?.display_name || metricLabel(activeMetric)}）
								</Tag>
							</Space>

							<div style={{ height: 360 }}>
								<ReactECharts option={chartOption} style={{ height: "100%", width: "100%" }} />
							</div>

							{telemetryQ.isFetching && <Text type="secondary">加载中...</Text>}
							{telemetryQ.isError && <Text type="danger">Telemetry 加载失败</Text>}
						</Space>
					</Card>
				</Col>

				{/* Control */}
				<Col xs={24} md={8}>
					<Card title="Control">
						<Space orientation="vertical" style={{ width: "100%" }} size={10}>
							<Text type="secondary">
								这里直接下发结构化 JSON 命令到设备的 response_topic。当前阶段不需要 ack 回执，因此请求不会长轮询。
							</Text>

							<Divider style={{ margin: "8px 0" }} />

							<Text strong>Command JSON</Text>
							<Input.TextArea
								value={cmdJson}
								onChange={(e) => setCmdJson(e.target.value)}
								rows={isMobile ? 10 : 14}
								style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
							/>

							<Button type="primary" onClick={sendCommand} block>
								下发命令
							</Button>

							<Divider style={{ margin: "8px 0" }} />

							<Text type="secondary">Topics</Text>
							<Tag style={{ wordBreak: "break-all" }}>post: {device.post_topic}</Tag>
							<Tag style={{ wordBreak: "break-all" }}>resp: {device.response_topic}</Tag>
						</Space>
					</Card>
				</Col>
			</Row>
		</Page>
	);
}