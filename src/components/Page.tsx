"use client";

import { ReactNode } from "react";
import { Typography, Space } from "antd";

type PageProps = {
	title: string;
	extra?: ReactNode;
	children: ReactNode;
};

export default function Page({ title, extra, children }: PageProps) {
	return (
		<div style={{ maxWidth: 1280, margin: "0 auto" }}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 16,
					gap: 12,
					flexWrap: "wrap",
				}}
			>
				<Typography.Title level={3} style={{ margin: 0 }}>
					{title}
				</Typography.Title>

				{extra && <Space wrap>{extra}</Space>}
			</div>

			{children}
		</div>
	);
}
