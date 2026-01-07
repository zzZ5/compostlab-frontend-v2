"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
	Button,
	Card,
	Col,
	Grid,
	Input,
	Row,
	Select,
	Space,
	Spin,
	Table,
	Tag,
	Typography,
	Tooltip,
} from "antd";

import Page from "@/components/Page";
import { useDevicesTree } from "@/hooks/useDevicesTree";

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

	const devicesQ = useDevicesTree(true);
	const devices = devicesQ.data || [];

	const [q, setQ] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [alertFilter, setAlertFilter] = useState<string>("all");

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
		return [
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
	}, []);

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
								<Link href={`/devices/${d.device_id}`} style={{ display: "block" }}>
									<Card hoverable>
										<div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
											<div style={{ minWidth: 0 }}>
												<div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
													{d.name || d.code}
												</div>
												<Space size={6} wrap style={{ marginTop: 8 }}>
													<Tag color={st.color}>{st.text}</Tag>
													<Tag color="blue">{d.code}</Tag>
													<Tag color={ovTagColor}>{ovText}</Tag>
												</Space>
											</div>
											<div style={{ textAlign: "right" }}>
												<div style={{ fontSize: 12, color: "rgba(0,0,0,.45)" }}>Last seen</div>
												<div style={{ fontSize: 12 }}>{d.last_seen_at || "-"}</div>
											</div>
										</div>

										<div style={{ marginTop: 12, display: "grid", gap: 8 }}>
											<div style={{ display: "flex", justifyContent: "space-between" }}>
												<Text type="secondary">{tempCh?.display_name || "温度"}</Text>
												<Tag color={sevToColor(tA.sev)}>{tempCh?.latest ? `${tempCh.latest.value} ${tempCh.unit || ""}` : "-"}</Tag>
											</div>
											<div style={{ display: "flex", justifyContent: "space-between" }}>
												<Text type="secondary">{o2Ch?.display_name || "氧气"}</Text>
												<Tag color={sevToColor(oA.sev)}>{o2Ch?.latest ? `${o2Ch.latest.value} ${o2Ch.unit || ""}` : "-"}</Tag>
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
								</Link>
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
		</Page>
	);
}