"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
	Button,
	Card,
	Col,
	Grid,
	Input,
	Modal,
	Row,
	Select,
	Space,
	Spin,
	Switch,
	Table,
	Tag,
	Typography,
	Tooltip,
	message,
} from "antd";

import Page from "@/components/Page";
import DeviceFormModal, { type DeviceFormValues } from "@/components/DeviceFormModal";
import { useDevicesTree } from "@/features/devices/queries";
import { useCreateDevice } from "@/features/devices/mutations";
import { useUpdateDevice } from "@/features/devices/mutations";
import { useDeleteDevice } from "@/features/devices/mutations";

import { emptyObjectToUndefined } from "@/lib/kv";
import { getErrorMessage } from "@/lib/errors";

import { getOnlineState, onlineTag } from "@/lib/status";
import { evalO2, evalTemp, sevToColor } from "@/lib/alerts";
import { channelByMetric } from "@/lib/channel";
import { MetricKey, metricLabel, normalizeMetric } from "@/lib/metrics";

const { Text } = Typography;
const { useBreakpoint } = Grid;

function sevRank(sev: "danger" | "warn" | "ok" | "none") {
	if (sev === "danger") return 3;
	if (sev === "warn") return 2;
	if (sev === "ok") return 1;
	return 0;
}

function overallSev(tempSev: any, o2Sev: any): "danger" | "warn" | "ok" | "none" {
	const r = Math.max(sevRank(tempSev), sevRank(o2Sev));
	return r === 3 ? "danger" : r === 2 ? "warn" : r === 1 ? "ok" : "none";
}

export default function DevicesPage() {
	const screens = useBreakpoint();
	const isMobile = !screens.md;
	const router = useRouter();

	const devicesQ = useDevicesTree(true);
	const devices = devicesQ.data || [];

	const [q, setQ] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [alertFilter, setAlertFilter] = useState<string>("all");
	const [manage, setManage] = useState(true);

	const createDevice = useCreateDevice();
	const [editing, setEditing] = useState<any | null>(null);
	const updateDevice = useUpdateDevice(editing?.device_id || 0);
	const deleteDevice = useDeleteDevice();

	const [modalOpen, setModalOpen] = useState(false);

	function openCreate() {
		setEditing(null);
		setModalOpen(true);
	}

	function openEdit(d: any) {
		setEditing(d);
		setModalOpen(true);
	}

	async function submitDevice(values: DeviceFormValues) {
		try {
			const body: any = {
				code: String(values.code || "").trim(),
				name: String(values.name || "").trim(),
				post_topic: (values.post_topic || "").trim() || null,
				response_topic: (values.response_topic || "").trim() || null,
				note: (values.note || "").trim(),
				is_active: !!values.is_active,
			};
			const meta = emptyObjectToUndefined(values.meta);
			if (meta !== undefined) body.meta = meta;

			if (editing) {
				await updateDevice.mutateAsync(body);
				message.success("设备已更新");
			} else {
				await createDevice.mutateAsync(body);
				message.success("设备已创建");
			}
			setModalOpen(false);
		} catch (e: any) {
			message.error(getErrorMessage(e, editing ? "更新失败" : "创建失败"));
		}
	}

	function confirmDelete(d: any) {
		Modal.confirm({
			title: "确认删除设备？",
			content: `将删除设备：${d?.name || d?.code || d?.device_id}（同时可能影响关联数据）`,
			okText: "删除",
			okButtonProps: { danger: true },
			cancelText: "取消",
			onOk: async () => {
				try {
					await deleteDevice.mutateAsync({ device_id: d.device_id });
					message.success("设备已删除");
				} catch (e) {
					message.error(getErrorMessage(e, "删除失败"));
				}
			},
		});
	}

	const filtered = useMemo(() => {
		const qq = q.trim().toLowerCase();

		return devices.filter((d) => {
			const state = getOnlineState(d.last_seen_at);
			if (statusFilter !== "all" && state !== statusFilter) return false;

			const tempCh = channelByMetric(d.channels, "temperature");
			const o2Ch = channelByMetric(d.channels, "o2");
			const tempV = typeof tempCh?.latest?.value === "number" ? tempCh.latest.value : null;
			const o2V = typeof o2Ch?.latest?.value === "number" ? o2Ch.latest.value : null;

			const tA = evalTemp(tempV);
			const oA = evalO2(o2V);
			const ov = overallSev(tA.sev, oA.sev);
			if (alertFilter !== "all" && ov !== alertFilter) return false;

			if (!qq) return true;
			const hay = `${d.name || ""} ${d.code || ""}`.toLowerCase();
			return hay.includes(qq);
		});
	}, [devices, q, statusFilter, alertFilter]);

	const columns = useMemo(() => {
		const cols: any[] = [
			{
				title: "Device",
				key: "device",
				render: (_: any, d: any) => (
					<Space orientation="vertical" size={2}>
						<Link href={`/devices/${d.device_id}`} style={{ fontWeight: 700 }}>
							{d.name || d.code}
						</Link>
						<Text type="secondary" style={{ fontSize: 12 }}>
							{d.code}
						</Text>
					</Space>
				),
			},
			{
				title: "Status",
				key: "status",
				width: 140,
				render: (_: any, d: any) => {
					const st = onlineTag(getOnlineState(d.last_seen_at));
					return <Tag color={st.color}>{st.text}</Tag>;
				},
			},
			{
				title: "Alerts",
				key: "alerts",
				width: 160,
				render: (_: any, d: any) => {
					const tempCh = channelByMetric(d.channels, "temperature");
					const o2Ch = channelByMetric(d.channels, "o2");
					const tempV = typeof tempCh?.latest?.value === "number" ? tempCh.latest.value : null;
					const o2V = typeof o2Ch?.latest?.value === "number" ? o2Ch.latest.value : null;

					const tA = evalTemp(tempV);
					const oA = evalO2(o2V);
					const ov = overallSev(tA.sev, oA.sev);

					const color = ov === "danger" ? "red" : ov === "warn" ? "orange" : ov === "ok" ? "green" : "default";
					const text = ov === "danger" ? "Danger" : ov === "warn" ? "Warn" : ov === "ok" ? "OK" : "No Data";

					return (
						<Space>
							<Tag color={color}>{text}</Tag>
							<Tooltip title={`温度：${tA.tip}；氧气：${oA.tip}`}>
								<span style={{ color: "rgba(0,0,0,.45)" }}>ⓘ</span>
							</Tooltip>
						</Space>
					);
				},
			},
			{
				title: "Metrics",
				key: "metrics",
				render: (_: any, d: any) => {
					const ms = Array.from(
						new Set((d.channels || []).map((c: any) => normalizeMetric(c.metric)))
					).filter((m) => m !== "unknown") as MetricKey[];

					return ms.length ? (
						<Space wrap size={6}>
							{ms.map((m) => (
								<Tag key={m}>{metricLabel(m)}</Tag>
							))}
						</Space>
					) : (
						<Tag>未分类</Tag>
					);
				},
			},
			{
				title: "Latest",
				key: "latest",
				width: 280,
				render: (_: any, d: any) => {
					const tempCh = channelByMetric(d.channels, "temperature");
					const o2Ch = channelByMetric(d.channels, "o2");
					const co2Ch = channelByMetric(d.channels, "co2");
					const moisCh = channelByMetric(d.channels, "moisture");

					const tempV = typeof tempCh?.latest?.value === "number" ? tempCh.latest.value : null;
					const o2V = typeof o2Ch?.latest?.value === "number" ? o2Ch.latest.value : null;
					const tA = evalTemp(tempV);
					const oA = evalO2(o2V);

					return (
						<Space orientation="vertical" size={6}>
							<Space wrap>
								<Text type="secondary">{tempCh?.display_name || "温度"}</Text>
								<Tag color={sevToColor(tA.sev)}>{tempCh?.latest ? `${tempCh.latest.value} ${tempCh.unit || ""}` : "-"}</Tag>
							</Space>

							<Space wrap>
								<Text type="secondary">{o2Ch?.display_name || "氧气"}</Text>
								<Tag color={sevToColor(oA.sev)}>{o2Ch?.latest ? `${o2Ch.latest.value} ${o2Ch.unit || ""}` : "-"}</Tag>
							</Space>

							<Space wrap>
								<Text type="secondary">{co2Ch?.display_name || "二氧化碳"}</Text>
								<Tag>{co2Ch?.latest ? `${co2Ch.latest.value} ${co2Ch.unit || ""}` : "-"}</Tag>
							</Space>

							<Space wrap>
								<Text type="secondary">{moisCh?.display_name || "含水率"}</Text>
								<Tag>{moisCh?.latest ? `${moisCh.latest.value} ${moisCh.unit || ""}` : "-"}</Tag>
							</Space>
						</Space>
					);
				},
			},
			{
				title: "Last seen",
				dataIndex: "last_seen_at",
				key: "last_seen_at",
				width: 170,
				render: (v: any) => <Text style={{ fontSize: 12 }}>{v || "-"}</Text>,
				sorter: (a: any, b: any) => String(a.last_seen_at || "").localeCompare(String(b.last_seen_at || "")),
			},
		];

		if (manage) {
			cols.push({
				title: "操作",
				key: "actions",
				width: 180,
				render: (_: any, d: any) => (
					<Space>
						<Button size="small" onClick={() => openEdit(d)}>
							编辑
						</Button>
						<Button size="small" danger onClick={() => confirmDelete(d)}>
							删除
						</Button>
					</Space>
				),
			});
		}

		return cols;
	}, [manage]);

	if (devicesQ.isLoading) {
		return (
			<div style={{ padding: 48 }}>
				<Spin />
			</div>
		);
	}

	return (
		<Page
			title="Devices"
			extra={
				<Space wrap>
					<Input.Search
						placeholder="搜索设备（name / code）"
						allowClear
						style={{ width: isMobile ? 220 : 320 }}
						value={q}
						onChange={(e) => setQ(e.target.value)}
					/>
					<Select
						style={{ width: 150 }}
						value={statusFilter}
						onChange={setStatusFilter}
						options={[
							{ value: "all", label: "全部状态" },
							{ value: "online", label: "Online" },
							{ value: "idle", label: "Idle" },
							{ value: "offline", label: "Offline" },
							{ value: "unknown", label: "Unknown" },
						]}
					/>
					<Select
						style={{ width: 160 }}
						value={alertFilter}
						onChange={setAlertFilter}
						options={[
							{ value: "all", label: "全部告警" },
							{ value: "danger", label: "Danger" },
							{ value: "warn", label: "Warn" },
							{ value: "ok", label: "OK" },
							{ value: "none", label: "No Data" },
						]}
					/>
					<Space size={6}>
						<Text type="secondary">管理模式</Text>
						<Switch checked={manage} onChange={setManage} />
					</Space>
					{manage && (
						<Button type="primary" onClick={openCreate}>
							新建设备
						</Button>
					)}
				</Space>
			}
		>
			{/* Mobile CardList */}
			{isMobile ? (
				<Row gutter={[12, 12]}>
					{filtered.map((d) => {
						const st = onlineTag(getOnlineState(d.last_seen_at));

						const tempCh = channelByMetric(d.channels, "temperature");
						const o2Ch = channelByMetric(d.channels, "o2");
						const co2Ch = channelByMetric(d.channels, "co2");
						const moisCh = channelByMetric(d.channels, "moisture");

						const tempV = typeof tempCh?.latest?.value === "number" ? tempCh.latest.value : null;
						const o2V = typeof o2Ch?.latest?.value === "number" ? o2Ch.latest.value : null;
						const tA = evalTemp(tempV);
						const oA = evalO2(o2V);
						const ov = overallSev(tA.sev, oA.sev);

						const ovTagColor = ov === "danger" ? "red" : ov === "warn" ? "orange" : ov === "ok" ? "green" : "default";
						const ovText = ov === "danger" ? "Danger" : ov === "warn" ? "Warn" : ov === "ok" ? "OK" : "No Data";

						return (
							<Col xs={24} key={d.device_id}>
								<Card hoverable onClick={() => router.push(`/devices/${d.device_id}`)}>
									<div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
										<div style={{ minWidth: 0 }}>
											<div
												style={{
													fontSize: 16,
													fontWeight: 700,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{d.name || d.code}
											</div>

											<Space size={6} wrap style={{ marginTop: 8 }}>
												<Tag color={st.color}>{st.text}</Tag>
												<Tag color="blue">{d.code}</Tag>
												<Tag color={ovTagColor}>{ovText}</Tag>
											</Space>

											{manage && (
												<div style={{ marginTop: 12 }}>
													<Space>
														<Button
															size="small"
															onClick={(e) => {
																e.stopPropagation();
																openEdit(d);
															}}
														>
															编辑
														</Button>
														<Button
															size="small"
															danger
															onClick={(e) => {
																e.stopPropagation();
																confirmDelete(d);
															}}
														>
															删除
														</Button>
													</Space>
												</div>
											)}
										</div>

										<div style={{ textAlign: "right" }}>
											<div style={{ fontSize: 12, color: "rgba(0,0,0,.45)" }}>Last seen</div>
											<div style={{ fontSize: 12 }}>{d.last_seen_at || "-"}</div>
										</div>
									</div>

									<div style={{ marginTop: 12, display: "grid", gap: 8 }}>
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<Text type="secondary">{tempCh?.display_name || "温度"}</Text>
											<Tag color={sevToColor(tA.sev)}>
												{tempCh?.latest ? `${tempCh.latest.value} ${tempCh.unit || ""}` : "-"}
											</Tag>
										</div>
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<Text type="secondary">{o2Ch?.display_name || "氧气"}</Text>
											<Tag color={sevToColor(oA.sev)}>
												{o2Ch?.latest ? `${o2Ch.latest.value} ${o2Ch.unit || ""}` : "-"}
											</Tag>
										</div>
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<Text type="secondary">{co2Ch?.display_name || "二氧化碳"}</Text>
											<Tag>{co2Ch?.latest ? `${co2Ch.latest.value} ${co2Ch.unit || ""}` : "-"}</Tag>
										</div>
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<Text type="secondary">{moisCh?.display_name || "含水率"}</Text>
											<Tag>{moisCh?.latest ? `${moisCh.latest.value} ${moisCh.unit || ""}` : "-"}</Tag>
										</div>
									</div>
								</Card>
							</Col>
						);
					})}
				</Row>
			) : (
				// Desktop Table
				<Table
					rowKey="device_id"
					columns={columns as any}
					dataSource={filtered as any}
					pagination={{ pageSize: 10 }}
				/>
			)}

			<DeviceFormModal
				open={modalOpen}
				title={editing ? "编辑设备" : "新建设备"}
				okText={editing ? "保存" : "创建"}
				initialValues={
					editing
						? {
							code: editing.code,
							name: editing.name,
							post_topic: editing.post_topic || "",
							response_topic: editing.response_topic || "",
							note: editing.note || "",
							is_active: editing.is_active !== false,
							meta: editing.meta || {},
						}
						: { is_active: true, meta: {} }
				}
				confirmLoading={createDevice.isPending || updateDevice.isPending}
				onCancel={() => setModalOpen(false)}
				onSubmit={submitDevice}
			/>
		</Page>
	);
}