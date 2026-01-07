"use client";

import { Button, Card, Form, Input, Typography, message } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { setBasicAuth } from "@/lib/auth";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

export default function LoginPage() {
	const router = useRouter();
	const sp = useSearchParams();
	const next = sp.get("next") || "/";

	return (
		<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
			<Card style={{ width: 420 }}>
				<Title level={3} style={{ marginTop: 0 }}>CompostLab 登录</Title>
				<Text type="secondary">使用后端 Basic Auth 账号密码</Text>

				<Form
					layout="vertical"
					style={{ marginTop: 16 }}
					onFinish={async (v) => {
						try {
							// 1) 存 token
							setBasicAuth(v.username, v.password);

							// 2) 立刻验证：随便请求一个轻量接口（devices/tree 不带 latest 更快）
							await api.get("/devices/tree");

							message.success("登录成功");
							router.replace(next);
						} catch (e: any) {
							message.error("登录失败：账号或密码错误，或后端不可达");
							// 登录失败就清掉 token，避免死循环
							sessionStorage.removeItem("basic_auth");
						}
					}}
				>
					<Form.Item label="Username" name="username" rules={[{ required: true }]}>
						<Input autoFocus />
					</Form.Item>

					<Form.Item label="Password" name="password" rules={[{ required: true }]}>
						<Input.Password />
					</Form.Item>

					<Button type="primary" htmlType="submit" block>
						Login
					</Button>
				</Form>
			</Card>
		</div>
	);
}
