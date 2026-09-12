import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, DatePicker, Row, Segmented, Space, Typography } from "antd";
import { BarChartOutlined, CarOutlined, ContainerOutlined, DollarOutlined, ReloadOutlined, ShopOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { CmSearchInput } from "../../design-system/components/CmSearchInput";
import { getCurrentAdminUsername } from "../../utils/session";
import { usePermissions } from "../../authz/usePermissions";
import { fetchGateEntryTokens, fetchGatePassTokens, fetchWeighmentTickets } from "../../services/gateOpsApi";
import { fetchLots } from "../../services/lotsApi";
import { getAuctionSessions } from "../../services/auctionOpsApi";
import { getSettlements } from "../../services/settlementsApi";

const { Text } = Typography;
const { RangePicker } = DatePicker;
const items = (r:any) => r?.data?.items || r?.response?.data?.items || [];
const total = (r:any, fallback=0) => Number(r?.data?.total_records ?? r?.response?.data?.total_records ?? fallback) || 0;

export const MandiManagerReports: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [range, setRange] = useState<[Dayjs,Dayjs]>([dayjs().subtract(29,"day"), dayjs()]);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [stats,setStats]=useState({arrivals:0,lots:0,weighments:0,auctions:0,settlements:0});

  const load=useCallback(async()=>{
    const username=getCurrentAdminUsername(); if(!username) return;
    setLoading(true); setError(null);
    const filters={page:1,page_size:25,date_from:range[0].startOf("day").toISOString(),date_to:range[1].endOf("day").toISOString()};
    try{
      const [gp,ge,w,l,a,s]=await Promise.allSettled([
        can("gate_pass_tokens.view","VIEW")?fetchGatePassTokens({username,language:i18n.language||"en",filters}):Promise.resolve(null),
        can("gate_entry_tokens.list","VIEW")?fetchGateEntryTokens({username,language:i18n.language||"en",filters}):Promise.resolve(null),
        can("weighment_tickets.view","VIEW")?fetchWeighmentTickets({username,language:i18n.language||"en",filters}):Promise.resolve(null),
        can("lots.list","VIEW")||can("lots.view","VIEW")?fetchLots({username,language:i18n.language||"en",filters}):Promise.resolve(null),
        can("auction_sessions.list","VIEW")?getAuctionSessions({username,language:i18n.language||"en",filters}):Promise.resolve(null),
        can("settlements.list","VIEW")?getSettlements({username,language:i18n.language||"en",filters}):Promise.resolve(null),
      ]);
      const val=(x:any)=>x.status==="fulfilled"?x.value:null;
      setStats({
        arrivals: total(val(gp),items(val(gp)).length)+total(val(ge),items(val(ge)).length),
        weighments: total(val(w),items(val(w)).length), lots: total(val(l),items(val(l)).length),
        auctions: total(val(a),items(val(a)).length), settlements: total(val(s),items(val(s)).length),
      });
    }catch(e:any){setError(e?.message||"Unable to load report summary.");}finally{setLoading(false)}
  },[range,can,i18n.language]);
  useEffect(()=>{load()},[load]);

  const reportLinks=useMemo(()=>[
    ["Daily Operations","/operations"],["Arrivals","/gate-tokens"],["Lots","/lots"],["Weighment","/weighment-tickets"],
    ["Auctions","/auction-sessions"],["Sold / Unsold","/auction-results"],["Settlements","/settlements"],["Gate Activity","/gate-movements"],
    ["Staff Activity","/staff"],["Monthly MIS","/reports"],
  ],[]);

  return <PageContainer>
    <CmPageHeader title="Reports & MIS" subtitle="Operational reporting for your authorised mandi scope." actions={<Button icon={<ReloadOutlined/>} onClick={load} loading={loading}>Refresh</Button>} />
    {error && <Alert className="cm-page-alert" type="error" showIcon message={error}/>} 
    <CmSectionCard className="cm-report-toolbar-card">
      <div className="cm-report-toolbar">
        <div><Text strong>Date range</Text><RangePicker value={range} onChange={(v)=>v&&v[0]&&v[1]&&setRange([v[0],v[1]])} allowClear={false}/></div>
        <CmSearchInput value={search} onChange={setSearch} placeholder="Search report or operational area" width={390}/>
        <Segmented options={["Summary","Operational"]} defaultValue="Summary" />
      </div>
    </CmSectionCard>
    <Row gutter={[14,14]} className="cm-report-kpis">
      <Col xs={24} sm={12} lg={6}><CmStatCard label="Arrivals" value={stats.arrivals} icon={<CarOutlined/>}/></Col>
      <Col xs={24} sm={12} lg={6}><CmStatCard label="Lots Created" value={stats.lots} icon={<ContainerOutlined/>}/></Col>
      <Col xs={24} sm={12} lg={6}><CmStatCard label="Auction Sessions" value={stats.auctions} icon={<ShopOutlined/>}/></Col>
      <Col xs={24} sm={12} lg={6}><CmStatCard label="Settlements" value={stats.settlements} icon={<DollarOutlined/>}/></Col>
    </Row>
    <CmSectionCard title="Report Library" subtitle="Open a live operational view. Export actions remain disabled until the scoped report-export API is available.">
      <Row gutter={[14,14]}>
        {reportLinks.filter(([label])=>!search||label.toLowerCase().includes(search.toLowerCase())).map(([label,path])=><Col xs={24} sm={12} lg={8} key={label}>
          <Card hoverable className="cm-report-link-card" onClick={()=>navigate(path)}><Space><span className="cm-report-link-icon"><BarChartOutlined/></span><div><Text strong>{label}</Text><div><Text type="secondary">View live scoped data</Text></div></div></Space></Card>
        </Col>)}
      </Row>
    </CmSectionCard>
  </PageContainer>;
};
export default MandiManagerReports;
