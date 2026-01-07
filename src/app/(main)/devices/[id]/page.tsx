"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactECharts from "echarts-for-react";
import {
	Button,
	Card,
	Col,
	DatePicker,
	Divider,
	Form,
	Grid,
	Input,
	Modal,
	Row,
	Select,
	Space,
	Spin,
	Switch,
	Table,
	Tabs,
	Tag,
	Typography,
	message,
} from "antd";
import dayjs from "dayjs";

import Page from "@/components/Page";
import KeyValueEditor from "@/components/KeyValueEditor";

import { useDevicesTree } from "@/hooks/useDevicesTree";
import { useDeviceTelemetry } from "@/hooks/useDeviceTelemetry";
import { useDeviceChannels } from "@/hooks/useDeviceChannels";
import { useCreateChannel } from "@/hooks/useCreateChannel";
import { useUpdateChannel } from "@/hooks/useUpdateChannel";
import { useDeleteChannel } from "@/hooks/useDeleteChannel";
import { useUpdateDevice } from "@/hooks/useUpdateDevice";
import { useDeleteDevice } from "@/hooks/useDeleteDevice";
import { useDeviceCommands } from "@/hooks/useDeviceCommands";
import { useSendDeviceCommand } from "@/hooks/useSendDeviceCommand";

import { api, buildQuery, downloadBlob, getErrorMessage } from "@/lib/api";
import { emptyObjectToUndefined } from "@/lib/kv";
import { channelByMetric } from "@/lib/channel";
import { MetricKey, metricLabel, normalizeMetric } from "@/lib/metrics";

import type { Channel } from "@/types/api";

const { Text } = Typography;

type CmdBody = {
	commands: any[];
};

function fmt(dt?: any | null) {
	if (!dt) return null;
	return dayjs(dt).format("YYYY-MM-DD HH:mm:ss");
}

export default function DeviceDetailPage() {
	const params = useParams<{ id: string }>();
	const deviceId = Number(params.id);
	const router = useRouter();

	const screens = Grid.useBreakpoint();
	const isMobile = !screens.md;

	// ✅ 管理模式默认开启
	const [manage, setManage] = useState(true);

	// === 基础数据：device / channels ===
	const devicesQ = useDevicesTree(true);
	const device = useMemo(() => {
		return (devicesQ.data || []).find((d) => d.device_id === deviceId) || null;
	}, [devicesQ.data, deviceId]);

	const channelsQ = useDeviceChannels(deviceId);
	const channelsFromApi: Channel[] = channelsQ.data || [];
	const channels: Channel[] = useMemo(() => {
		// 优先使用 /devices/<id>/channels（更“权威”），否则退回 tree 里的 channels
		if (channelsFromApi.length) return channelsFromApi;
		return device?.channels || [];
	}, [channelsFromApi, device?.channels]);

	const latestByCode = useMemo(() => {
		const m = new Map<string, any>();
		for (const ch of device?.channels || []) m.set(ch.code, ch.latest);
		return m;
	}, [device?.channels]);

	// === Telemetry: metric + channel selector ===
	const [activeMetric, setActiveMetric] = useState<MetricKey>("temperature");
	const [activeCode, setActiveCode] = useState<string | null>(null);

	const metricChannels = useMemo(() => {
		const list = device?.channels || channels || [];
		return list
			.filter((c) => normalizeMetric(c.metric) === activeMetric)
			.sort((a, b) => a.code.localeCompare(b.code));
	}, [activeMetric, device?.channels, channels]);

	const activeChannel = useMemo(() => {
		if (!device) return null;
		if (activeCode) {
			return device.channels.find((c) => c.code === activeCode) || null;
		}
		return channelByMetric(device.channels, activeMetric);
	}, [device, activeMetric, activeCode]);

	// time range
	const [range, setRange] = useState<[any, any] | null>(null);
	// bucket: "" 表示 raw
	const [bucket, setBucket] = useState<string>("10m");

	const from = range?.[0] ? fmt(range[0]) : null;
	const to = range?.[1] ? fmt(range[1]) : null;

	const telemetryQ = useDeviceTelemetry({
		deviceId,
		from,
		to,
		bucket: bucket ? bucket : null,
		channels: activeChannel?.code ? [activeChannel.code] : null,
	});

	const points = telemetryQ.data?.data || [];

	const chartOption = useMemo(() => {
		const data = points.map((p: any) => [p.ts, p.value]);
		return {
			tooltip: { trigger: "axis" },
			grid: { left: 52, right: 18, top: 20, bottom: 36 },
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

	// === Export ===
	async function exportCsv() {
		if (!device) return;
		try {
			const qs = buildQuery({
				from,
				to,
				channels: activeChannel?.code ? [activeChannel.code] : null,
				bucket: bucket ? bucket : null,
			});

			await downloadBlob(
				api,
				`/devices/${deviceId}/export${qs}`,
				`device_${device.code}_${activeChannel?.code || "all"}.csv`,
				"text/csv;charset=utf-8"
			);
		} catch (e) {
			message.error(getErrorMessage(e, "导出失败"));
		}
	}

	// === Device CRUD ===
	const [deviceModalOpen, setDeviceModalOpen] = useState(false);
	const [deviceForm] = Form.useForm();
	const updateDevice = useUpdateDevice(deviceId);
	const deleteDevice = useDeleteDevice();

	function openDeviceEdit() {
		if (!device) return;
		deviceForm.resetFields();
		deviceForm.setFieldsValue({
			code: device.code,
			name: device.name || "",
			post_topic: device.post_topic || "",
			response_topic: device.response_topic || "",
			note: device.note || "",
			is_active: device.is_active !== false,
			meta: device.meta || {},
		});
		setDeviceModalOpen(true);
	}

	async function submitDevice() {
		try {
			const v = await deviceForm.validateFields();
			const body: any = {
				code: String(v.code || "").trim(),
				name: (v.name || "").trim() || null,
				post_topic: (v.post_topic || "").trim() || null,
				response_topic: (v.response_topic || "").trim() || null,
				note: (v.note || "").trim() || "",
				is_active: v.is_active !== false,
			};
			const meta = emptyObjectToUndefined(v.meta);
			if (meta !== undefined) body.meta = meta;

			await updateDevice.mutateAsync(body);
			message.success("设备已保存");
			setDeviceModalOpen(false);
		} catch (err) {
			if ((err as any)?.errorFields) return;
			message.error(getErrorMessage(err, "保存失败"));
		}
	}

	function confirmDeleteDevice() {
		Modal.confirm({
			title: "确认删除该设备？",
			content: "删除后将无法恢复。",
			okText: "删除",
			okButtonProps: { danger: true },
			cancelText: "取消",
			onOk: async () => {
				try {
					await deleteDevice.mutateAsync({ device_id: deviceId });
					message.success("设备已删除");
					router.push("/devices");
				} catch (e) {
					message.error(getErrorMessage(e, "删除失败"));
				}
			},
		});
	}

	// === Channel CRUD ===
	const [channelModalOpen, setChannelModalOpen] = useState(false);
	const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
	const [channelForm] = Form.useForm();

	const createChannel = useCreateChannel(deviceId);
	const updateChannel = useUpdateChannel(deviceId, editingChannel?.channel_id || 0);
	const deleteChannel = useDeleteChannel(deviceId);

	function openChannelCreate() {
		setEditingChannel(null);
		channelForm.resetFields();
		channelForm.setFieldsValue({
			code: "",
			name: "",
			display_name: "",
			metric: activeMetric,
			role: "",
			unit: "",
			is_active: true,
			meta: {},
		});
		setChannelModalOpen(true);
	}

	function openChannelEdit(ch: Channel) {
		setEditingChannel(ch);
		channelForm.resetFields();
		channelForm.setFieldsValue({
			code: ch.code,
			name: ch.name || "",
			display_name: ch.display_name || "",
			metric: (ch.metric as any) || "unknown",
			role: ch.role || "",
			unit: ch.unit || "",
			is_active: ch.is_active !== false,
			meta: ch.meta || {},
		});
		setChannelModalOpen(true);
	}

	async function submitChannel() {
		try {
			const v = await channelForm.validateFields();
			const body: any = {
				code: String(v.code || "").trim(),
				name: (v.name || "").trim() || null,
				display_name: (v.display_name || "").trim() || null,
				metric: (v.metric || "").trim() || null,
				role: (v.role || "").trim() || null,
				unit: (v.unit || "").trim() || null,
				is_active: v.is_active !== false,
			};
			const meta = emptyObjectToUndefined(v.meta);
			if (meta !== undefined) body.meta = meta;

			if (editingChannel) {
				await updateChannel.mutateAsync(body);
				message.success("通道已更新");
			} else {
				await createChannel.mutateAsync(body);
				message.success("通道已创建");
			}

			setChannelModalOpen(false);
		} catch (err) {
			if ((err as any)?.errorFields) return;
			message.error(getErrorMessage(err, "操作失败"));
		}
	}

	function confirmDeleteChannel(ch: Channel) {
		Modal.confirm({
			title: `确认删除通道 ${ch.code}？`,
			okText: "删除",
			okButtonProps: { danger: true },
			cancelText: "取消",
			onOk: async () => {
				try {
					await deleteChannel.mutateAsync({ channel_id: ch.channel_id });
					message.success("通道已删除");
				} catch (e) {
					message.error(getErrorMessage(e, "删除失败"));
				}
			},
		});
	}

	// === Commands ===
	const sendCmd = useSendDeviceCommand(deviceId);
	const commandsQ = useDeviceCommands(deviceId, 30);

	const CMD_TEMPLATES: Record<string, any> = {
		set_aeration: {
			commands: [{ command: "set_aeration", params: { on: 1, ms: 60000 } }],
		},
		config_update: {
			commands: [
				{
					command: "config_update",
					config: { pump_run_time: 60000, read_interval: 600000 },
				},
			],
		},
	};

	const [cmdTemplate, setCmdTemplate] = useState<string>("set_aeration");
	const [cmdJson, setCmdJson] = useState<string>(
		JSON.stringify(CMD_TEMPLATES.set_aeration, null, 2)
	);

	function insertTemplate(key: string) {
		const t = CMD_TEMPLATES[key] || CMD_TEMPLATES.set_aeration;
		setCmdJson(JSON.stringify(t, null, 2));
	}

	async function sendCommand() {
		if (!device) return;

		let body: CmdBody;
		try {
			body = JSON.parse(cmdJson);
		} catch {
			message.error("命令 JSON 格式错误");
			return;
		}

		if (!body?.commands || !Array.isArray(body.commands) || body.commands.length === 0) {
			message.error("commands 必须是非空数组");
			return;
		}

		try {
			await sendCmd.mutateAsync(body);
			message.success("已下发（MQTT publish 已触发）");
		} catch (e) {
			message.error(getErrorMessage(e, "下发失败"));
		}
	}

	// === Loading / Not found ===
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

	// === Channels table ===
	const channelRows = channels;
	const channelColumns: any[] = [
		{
			title: "Code",
			dataIndex: "code",
			key: "code",
			render: (v: string, r: Channel) => (
				<Space orientation="vertical" size={0}>
					<Text strong>{v}</Text>
					<Text type="secondary" style={{ fontSize: 12 }}>
						{r.display_name || r.name || "-"}
					</Text>
				</Space>
			),
		},
		{
			title: "Metric",
			dataIndex: "metric",
			key: "metric",
			render: (v: any) => <Tag>{v || "-"}</Tag>,
		},
		{
			title: "Unit",
			dataIndex: "unit",
			key: "unit",
		},
		{
			title: "Active",
			dataIndex: "is_active",
			key: "is_active",
			render: (v: any) => (v === false ? <Tag color="red">OFF</Tag> : <Tag color="green">ON</Tag>),
		},
		{
			title: "Latest",
			key: "latest",
			render: (_: any, r: Channel) => {
				const l = (r as any).latest || latestByCode.get(r.code) || null;
				if (!l) return <Text type="secondary">-</Text>;
				return (
					<Space orientation="vertical" size={0}>
						<Text>
							{l.value ?? "-"} {r.unit || ""}
						</Text>
						<Text type="secondary" style={{ fontSize: 12 }}>
							{l.ts || "-"}
						</Text>
					</Space>
				);
			},
		},
		{
			title: "操作",
			key: "actions",
			render: (_: any, r: Channel) => (
				<Space size={6} wrap>
					<Button size="small" onClick={() => {
						setActiveMetric((normalizeMetric(r.metric) as MetricKey) || "unknown");
						setActiveCode(r.code);
					}}>
						查看
					</Button>
					{manage && (
						<>
							<Button size="small" onClick={() => openChannelEdit(r)}>
								编辑
							</Button>
							<Button size="small" danger onClick={() => confirmDeleteChannel(r)}>
								删除
							</Button>
						</>
					)}
				</Space>
			),
		},
	];

	return (
		<Page
			title={device.name || device.code}
			extra={
				<Space wrap>
					<Tag color="blue">{device.code}</Tag>
					<Tag>{device.is_active === false ? "Inactive" : "Active"}</Tag>

					<Space size={6}>
						<Text type="secondary">管理</Text>
						<Switch checked={manage} onChange={setManage} />
					</Space>

					<Button onClick={exportCsv}>导出 CSV</Button>

					{manage && (
						<>
							<Button onClick={openDeviceEdit}>编辑设备</Button>
							<Button danger onClick={confirmDeleteDevice}>
								删除设备
							</Button>
							<Button type="primary" onClick={openChannelCreate}>
								新建通道
							</Button>
						</>
					)}
				</Space>
			}
		>
			<Tabs
				defaultActiveKey="telemetry"
				items={[
					{
						key: "telemetry",
						label: "Telemetry",
						children: (
							<>
								{/* KPI */}
								<Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
									{latestCards.map(({ k, ch }) => (
										<Col xs={12} md={6} key={k}>
											<Card
												hoverable
												onClick={() => {
													setActiveMetric(k);
													setActiveCode(null);
												}}
												style={{
													cursor: "pointer",
													border: k === activeMetric ? "1px solid rgba(22,119,255,.6)" : undefined,
												}}
											>
												<Text type="secondary">{ch?.display_name || metricLabel(k)}</Text>
												<div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
													{ch?.latest ? `${ch.latest.value ?? "-"} ${ch.unit || ""}` : "-"}
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
									<Col xs={24} md={24}>
										<Card>
											<Space orientation="vertical" style={{ width: "100%" }} size={12}>
												<Tabs
													activeKey={activeMetric}
													onChange={(k) => {
														setActiveMetric(k as MetricKey);
														setActiveCode(null);
													}}
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
														style={{ width: isMobile ? "100%" : 380 }}
													/>

													<Select
														style={{ width: 120 }}
														value={bucket}
														onChange={setBucket}
														options={[
															{ value: "", label: "raw" },
															{ value: "1m", label: "1m" },
															{ value: "10m", label: "10m" },
															{ value: "1h", label: "1h" },
														]}
													/>

													<Select
														style={{ width: isMobile ? "100%" : 260 }}
														value={activeChannel?.code || undefined}
														placeholder="选择通道"
														options={metricChannels.map((c) => ({
															value: c.code,
															label: `${c.code}${c.display_name ? ` · ${c.display_name}` : ""}`,
														}))}
														onChange={(v) => setActiveCode(v)}
														allowClear
													/>

													<Tag>
														当前：{activeChannel?.code || "-"}（{activeChannel?.display_name || metricLabel(activeMetric)}）
													</Tag>
												</Space>

												<div style={{ height: 420 }}>
													<ReactECharts option={chartOption} style={{ height: "100%", width: "100%" }} />
												</div>

												{telemetryQ.isFetching && <Text type="secondary">加载中...</Text>}
												{telemetryQ.isError && <Text type="danger">Telemetry 加载失败</Text>}
												{!telemetryQ.isFetching && !points.length && (
													<Text type="secondary">暂无数据（检查时间范围 / bucket / 通道）</Text>
												)}
											</Space>
										</Card>
									</Col>
								</Row>
							</>
						),
					},
					{
						key: "channels",
						label: "Channels",
						children: (
							<Card
								title="通道列表"
								extra={
									manage ? (
										<Button type="primary" onClick={openChannelCreate}>
											新建通道
										</Button>
									) : null
								}
							>
								<Space orientation="vertical" style={{ width: "100%" }} size={10}>
									<Text type="secondary">
										说明：metric/role/display_name 用于把原始 code 映射到“温度/氧气/二氧化碳/含水率”等语义层。
									</Text>
									<Table
										rowKey="channel_id"
										columns={channelColumns}
										dataSource={channelRows}
										pagination={{ pageSize: 12, hideOnSinglePage: true }}
										size="small"
										scroll={isMobile ? { x: 820 } : undefined}
										loading={channelsQ.isLoading}
									/>
								</Space>
							</Card>
						),
					},
					{
						key: "control",
						label: "Control",
						children: (
							<Row gutter={[12, 12]}>
								<Col xs={24} md={12}>
									<Card title="下发命令">
										<Space orientation="vertical" style={{ width: "100%" }} size={10}>
											<Text type="secondary">
												这里直接下发结构化 JSON 命令到设备的 response_topic。当前阶段不需要 ack 回执，因此请求不会长轮询。
											</Text>

											<Divider style={{ margin: "8px 0" }} />

											<Space wrap>
												<Select
													style={{ width: 200 }}
													value={cmdTemplate}
													onChange={(k) => {
														setCmdTemplate(k);
														insertTemplate(k);
													}}
													options={[
														{ value: "set_aeration", label: "set_aeration（曝气开关）" },
														{ value: "config_update", label: "config_update（配置更新）" },
													]}
												/>
												<Button onClick={() => insertTemplate(cmdTemplate)}>
													插入模板
												</Button>
											</Space>

											<Text strong>Command JSON</Text>
											<Input.TextArea
												value={cmdJson}
												onChange={(e) => setCmdJson(e.target.value)}
												rows={isMobile ? 12 : 14}
												style={{
													fontFamily:
														"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
												}}
											/>

											<Button type="primary" onClick={sendCommand} block loading={sendCmd.isPending}>
												下发命令
											</Button>

											<Divider style={{ margin: "8px 0" }} />

											<Text type="secondary">Topics</Text>
											<Tag style={{ wordBreak: "break-all" }}>post: {device.post_topic || "-"}</Tag>
											<Tag style={{ wordBreak: "break-all" }}>resp: {device.response_topic || "-"}</Tag>
										</Space>
									</Card>
								</Col>

								<Col xs={24} md={12}>
									<Card title="命令历史（最近30条）" extra={commandsQ.isFetching ? <Text type="secondary">刷新中…</Text> : null}>
										<Table
											rowKey="command_id"
											size="small"
											pagination={{ pageSize: 10, hideOnSinglePage: true }}
											dataSource={commandsQ.data?.data || []}
											columns={[
												{
													title: "ID",
													dataIndex: "command_id",
													width: 80,
												},
												{
													title: "status",
													dataIndex: "status",
													render: (v: string) => {
														const color = v === "failed" ? "red" : v === "acked" ? "green" : v === "sent" ? "blue" : "gold";
														return <Tag color={color}>{v}</Tag>;
													},
													width: 90,
												},
												{
													title: "command",
													dataIndex: "command",
													render: (v: any) => <Text>{v || "-"}</Text>,
												},
												{
													title: "created",
													dataIndex: "created_at",
													render: (v: any) => <Text style={{ fontSize: 12 }}>{v || "-"}</Text>,
												},
											]}
											expandable={{
												expandedRowRender: (r: any) => (
													<div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
														<div style={{ marginBottom: 8 }}>
															<Text type="secondary">payload</Text>
															<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(r.payload, null, 2)}</pre>
														</div>
														<div>
															<Text type="secondary">result</Text>
															<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(r.result, null, 2)}</pre>
														</div>
													</div>
												),
												rowExpandable: () => true,
											}}
											loading={commandsQ.isLoading}
										/>
									</Card>
								</Col>
							</Row>
						),
					},
				]}
			/>

			{/* ===== Device 编辑 ===== */}
			<Modal
				open={deviceModalOpen}
				title="编辑设备"
				onCancel={() => setDeviceModalOpen(false)}
				onOk={submitDevice}
				okText="保存"
				destroyOnHidden
				confirmLoading={updateDevice.isPending}
			>
				<Form layout="vertical" form={deviceForm}>
					<Row gutter={12}>
						<Col xs={24} md={12}>
							<Form.Item label="code" name="code" rules={[{ required: true, message: "请输入 code" }]}>
								<Input placeholder="例如：KgSERnY2Zn" />
							</Form.Item>
						</Col>
						<Col xs={24} md={12}>
							<Form.Item label="name" name="name" rules={[{ required: true, message: "请输入 name" }]}>
								<Input placeholder="设备名称" />
							</Form.Item>
						</Col>
					</Row>

					<Form.Item label="post_topic" name="post_topic">
						<Input placeholder="可留空" />
					</Form.Item>
					<Form.Item label="response_topic" name="response_topic">
						<Input placeholder="可留空" />
					</Form.Item>
					<Form.Item label="note" name="note">
						<Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder="可选" />
					</Form.Item>

					<Form.Item label="is_active" name="is_active" valuePropName="checked">
						<Switch />
					</Form.Item>

					<Divider style={{ margin: "8px 0" }} />
					<Text strong>meta（Key-Value）</Text>
					<Form.Item name="meta" style={{ marginTop: 8 }}>
						<KeyValueEditor placeholderKey="key" placeholderValue="value" />
					</Form.Item>
				</Form>
			</Modal>

			{/* ===== Channel 新建 / 编辑 ===== */}
			<Modal
				open={channelModalOpen}
				title={editingChannel ? `编辑通道 ${editingChannel.code}` : "新建通道"}
				onCancel={() => setChannelModalOpen(false)}
				onOk={submitChannel}
				okText={editingChannel ? "保存" : "创建"}
				destroyOnHidden
				confirmLoading={createChannel.isPending || updateChannel.isPending}
			>
				<Form layout="vertical" form={channelForm}>
					<Row gutter={12}>
						<Col xs={24} md={12}>
							<Form.Item label="code" name="code" rules={[{ required: true, message: "请输入 code" }]}>
								<Input placeholder="例如：Temp" />
							</Form.Item>
						</Col>
						<Col xs={24} md={12}>
							<Form.Item label="metric" name="metric" rules={[{ required: true, message: "请选择 metric" }]}>
								<Select
									options={[
										{ value: "temperature", label: "temperature" },
										{ value: "o2", label: "o2" },
										{ value: "co2", label: "co2" },
										{ value: "moisture", label: "moisture" },
										{ value: "unknown", label: "unknown" },
									]}
								/>
							</Form.Item>
						</Col>
					</Row>

					<Row gutter={12}>
						<Col xs={24} md={12}>
							<Form.Item label="display_name" name="display_name">
								<Input placeholder="例如：堆体温度" />
							</Form.Item>
						</Col>
						<Col xs={24} md={12}>
							<Form.Item label="unit" name="unit">
								<Input placeholder="例如：℃ / %" />
							</Form.Item>
						</Col>
					</Row>

					<Row gutter={12}>
						<Col xs={24} md={12}>
							<Form.Item label="name" name="name">
								<Input placeholder="可选" />
							</Form.Item>
						</Col>
						<Col xs={24} md={12}>
							<Form.Item label="role" name="role">
								<Input placeholder="可选（例如：T1/T2/T3）" />
							</Form.Item>
						</Col>
					</Row>

					<Form.Item label="is_active" name="is_active" valuePropName="checked">
						<Switch />
					</Form.Item>

					<Divider style={{ margin: "8px 0" }} />
					<Text strong>meta（Key-Value）</Text>
					<Form.Item name="meta" style={{ marginTop: 8 }}>
						<KeyValueEditor placeholderKey="key" placeholderValue="value" />
					</Form.Item>
				</Form>
			</Modal>
		</Page>
	);
}
