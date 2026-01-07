"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Col, Grid, Input, Row, Space, Spin, Table, Tag, Typography } from "antd";

import Page from "@/components/Page";
import { useRuns } from "@/hooks/useRuns";

const { Text } = Typography;
const { useBreakpoint } = Grid;

export default function RunsPage() {
	const screens = useBreakpoint();
	const isMobile = !screens.md;

	const [q, setQ] = useState("");
	const runsQ = useRuns({ q: q.trim() || "" });
	const runs = runsQ.data || [];

	const data = useMemo(() => runs, [runs]);

	const columns = [
		{
			title: "Run",
			key: "run",
			render: (_: any, r: any) => (
				<Space orientation="vertical" size={2}>
					<Link href={`/runs/${r.run_id}`} style={{ fontWeight: 700 }}>
						{r.name || `Run #${r.run_id}`}
					</Link>
					<Text type="secondary" style={{ fontSize: 12 }}>
						ID: {r.run_id}
					</Text>
				</Space>
			),
		},
		{
			title: "Time",
			key: "time",
			width: 260,
			render: (_: any, r: any) => (
				<Space orientation="vertical" size={2}>
					<Text style={{ fontSize: 12 }}>start: {r.start_at || "-"}</Text>
					<Text style={{ fontSize: 12 }}>end: {r.end_at || "-"}</Text>
				</Space>
			),
		},
		{
			title: "Note",
			dataIndex: "note",
			key: "note",
			render: (v: any) => <Text type="secondary">{v || "-"}</Text>,
		},
		{
			title: "Updated",
			dataIndex: "updated_at",
			key: "updated_at",
			width: 180,
			render: (v: any) => <Text style={{ fontSize: 12 }}>{v || "-"}</Text>,
		},
	];

	if (runsQ.isLoading) {
		return (
			<div style={{ padding: 48 }}>
				<Spin />
			</div>
		);
	}

	return (
		<Page
			title="Runs"
			extra={
				<Input.Search
					placeholder="搜索 run（name）"
					allowClear
					style={{ width: isMobile ? 220 : 320 }}
					value={q}
					onChange={(e) => setQ(e.target.value)}
				/>
			}
		>
			{isMobile ? (
				<Row gutter={[12, 12]}>
					{data.map((r: any) => (
						<Col xs={24} key={r.run_id}>
							<Link href={`/runs/${r.run_id}`} style={{ display: "block" }}>
								<Card hoverable>
									<div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
										<div style={{ minWidth: 0 }}>
											<div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
												{r.name || `Run #${r.run_id}`}
											</div>
											<Space size={6} wrap style={{ marginTop: 8 }}>
												<Tag color="blue">ID {r.run_id}</Tag>
											</Space>
										</div>
										<div style={{ textAlign: "right" }}>
											<div style={{ fontSize: 12, color: "rgba(0,0,0,.45)" }}>Updated</div>
											<div style={{ fontSize: 12 }}>{r.updated_at || "-"}</div>
										</div>
									</div>

									<div style={{ marginTop: 10, display: "grid", gap: 6 }}>
										<Text style={{ fontSize: 12 }}>start: {r.start_at || "-"}</Text>
										<Text style={{ fontSize: 12 }}>end: {r.end_at || "-"}</Text>
										<Text type="secondary" style={{ fontSize: 12 }}>
											{r.note || "-"}
										</Text>
									</div>
								</Card>
							</Link>
						</Col>
					))}
				</Row>
			) : (
				<Table rowKey="run_id" columns={columns as any} dataSource={data as any} pagination={{ pageSize: 10 }} />
			)}
		</Page>
	);
}