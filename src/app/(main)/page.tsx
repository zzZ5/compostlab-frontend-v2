"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Col, Grid, Input, Row, Select, Space, Spin, Tag, Tooltip, Typography } from "antd";

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

export default function DashboardPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const devicesQ = useDevicesTree(true);
  const devices = devicesQ.data || [];

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return devices.filter((d) => {
      // status filter
      const state = getOnlineState(d.last_seen_at);
      if (statusFilter !== "all" && state !== statusFilter) return false;

      // alerts (O2 + Temp)
      const tempCh = channelByMetric(d.channels, "temperature");
      const o2Ch = channelByMetric(d.channels, "o2");

      const tempV = typeof tempCh?.latest?.value === "number" ? tempCh.latest.value : null;
      const o2V = typeof o2Ch?.latest?.value === "number" ? o2Ch.latest.value : null;

      const tA = evalTemp(tempV);
      const oA = evalO2(o2V);

      const overall = overallSev(tA.sev, oA.sev);
      if (alertFilter !== "all" && overall !== alertFilter) return false;

      // keyword filter
      if (!qq) return true;
      const hay = `${d.name || ""} ${d.code || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [devices, q, statusFilter, alertFilter]);

  // KPI
  const kpi = useMemo(() => {
    const total = devices.length;
    let online = 0;
    let danger = 0;

    for (const d of devices) {
      const st = getOnlineState(d.last_seen_at);
      if (st === "online") online++;

      const tempCh = channelByMetric(d.channels, "temperature");
      const o2Ch = channelByMetric(d.channels, "o2");
      const tempV = typeof tempCh?.latest?.value === "number" ? tempCh.latest.value : null;
      const o2V = typeof o2Ch?.latest?.value === "number" ? o2Ch.latest.value : null;
      const tA = evalTemp(tempV);
      const oA = evalO2(o2V);
      if (overallSev(tA.sev, oA.sev) === "danger") danger++;
    }

    return { total, online, danger };
  }, [devices]);

  if (devicesQ.isLoading) {
    return (
      <div style={{ padding: 48 }}>
        <Spin />
      </div>
    );
  }

  return (
    <Page
      title="Dashboard"
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
            style={{ width: 180 }}
            value={alertFilter}
            onChange={setAlertFilter}
            options={[
              { value: "all", label: "全部告警" },
              { value: "danger", label: "仅危险（低氧/过热）" },
              { value: "warn", label: "仅预警（偏离）" },
              { value: "ok", label: "仅正常" },
              { value: "none", label: "仅无数据" },
            ]}
          />
        </Space>
      }
    >
      {/* KPI */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}>
          <Card>
            <Text type="secondary">设备总数</Text>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{kpi.total}</div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Text type="secondary">Online</Text>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{kpi.online}</div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Text type="secondary">危险告警</Text>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{kpi.danger}</div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Text type="secondary">当前展示</Text>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{filtered.length}</div>
          </Card>
        </Col>
      </Row>

      {/* Cards */}
      <Row gutter={[12, 12]}>
        {filtered.map((d) => {
          const st = onlineTag(getOnlineState(d.last_seen_at));

          // by metric
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

          // show metrics present
          const ms = Array.from(
            new Set((d.channels || []).map((c: any) => normalizeMetric(c.metric)))
          ).filter((m) => m !== "unknown") as MetricKey[];

          return (
            <Col key={d.device_id} xs={24} md={12} lg={8}>
              <Link href={`/devices/${d.device_id}`} style={{ display: "block" }}>
                <Card hoverable>
                  {/* header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

                  {/* metrics chips */}
                  <div style={{ marginTop: 10 }}>
                    {ms.length ? ms.map((m) => <Tag key={m}>{metricLabel(m)}</Tag>) : <Tag>未分类</Tag>}
                  </div>

                  {/* values */}
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text type="secondary">{tempCh?.display_name || "温度"}</Text>
                      <Space size={6}>
                        <Tag color={sevToColor(tA.sev)}>{tempCh?.latest ? `${tempCh.latest.value} ${tempCh.unit || ""}` : "-"}</Tag>
                        <Tooltip title={tA.tip}><span style={{ color: "rgba(0,0,0,.45)" }}>ⓘ</span></Tooltip>
                      </Space>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text type="secondary">{o2Ch?.display_name || "氧气"}</Text>
                      <Space size={6}>
                        <Tag color={sevToColor(oA.sev)}>{o2Ch?.latest ? `${o2Ch.latest.value} ${o2Ch.unit || ""}` : "-"}</Tag>
                        <Tooltip title={oA.tip}><span style={{ color: "rgba(0,0,0,.45)" }}>ⓘ</span></Tooltip>
                      </Space>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text type="secondary">{co2Ch?.display_name || "二氧化碳"}</Text>
                      <Tag>{co2Ch?.latest ? `${co2Ch.latest.value} ${co2Ch.unit || ""}` : "-"}</Tag>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
    </Page>
  );
}
