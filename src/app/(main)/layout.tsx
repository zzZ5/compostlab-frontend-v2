"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Spin, Button, Space } from "antd";
import { DashboardOutlined, DatabaseOutlined, ExperimentOutlined } from "@ant-design/icons";
import { hasBasicAuth, clearBasicAuth } from "@/lib/auth";

const { Header, Content, Sider } = Layout;

export default function MainLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const [ready, setReady] = useState(false);

	// 选中菜单
	const selectedKey = useMemo(() => {
		if (pathname.startsWith("/runs")) return "/runs";
		if (pathname.startsWith("/devices")) return "/devices";
		return "/";
	}, [pathname]);

	useEffect(() => {
		const ok = typeof window !== "undefined" ? hasBasicAuth() : true;
		if (!ok) {
			const next = encodeURIComponent(pathname);
			router.replace(`/login?next=${next}`);
			return;
		}
		setReady(true);
	}, [pathname, router]);

	// ✅ 未 ready：显示“跳转/加载中”
	if (!ready) {
		return (
			<div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
				<Spin />
			</div>
		);
	}

	// ✅ ready：正常渲染整个布局 + children
	return (
		<Layout style={{ minHeight: "100vh" }}>
			<Header
				style={{
					color: "white",
					fontSize: 18,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<div>CompostLab</div>
				<Space>
					<Button
						onClick={() => {
							clearBasicAuth();
							const next = encodeURIComponent(window.location.pathname + window.location.search);
							window.location.href = `/login?next=${next}`;
						}}
					>
						退出
					</Button>
				</Space>
			</Header>

			<Layout>
				<Sider width={220} theme="light">
					<Menu
						mode="inline"
						selectedKeys={[selectedKey]}
						items={[
							{ key: "/", icon: <DashboardOutlined />, label: <Link href="/">Dashboard</Link> },
							{ key: "/devices", icon: <DatabaseOutlined />, label: <Link href="/devices">Devices</Link> },
							{ key: "/runs", icon: <ExperimentOutlined />, label: <Link href="/runs">Runs</Link> },
						]}
					/>
				</Sider>

				<Content style={{ padding: 24 }}>{children}</Content>
			</Layout>
		</Layout>
	);
}
