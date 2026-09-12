import React, { useMemo, useState } from "react";
import { Alert, Card, Col, Row, Space, Tag, Typography } from "antd";
import { BankOutlined, BellOutlined, ClockCircleOutlined, DollarOutlined, EnvironmentOutlined, GatewayOutlined, ShopOutlined, TeamOutlined, ToolOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSearchInput } from "../../design-system/components/CmSearchInput";
import { usePermissions } from "../../authz/usePermissions";
const { Text }=Typography;

type Item={title:string;desc:string;path:string;icon:React.ReactNode;mode:"edit"|"view"|"admin";resource?:string;action?:string};
export const MandiManagerManagement:React.FC=()=>{
 const navigate=useNavigate(); const {can}=usePermissions(); const [search,setSearch]=useState("");
 const all:Item[]=[
  {title:"Mandi Profile",desc:"Basic mandi information and contact details.",path:"/mandis",icon:<BankOutlined/>,mode:"edit",resource:"mandis.edit",action:"UPDATE"},
  {title:"Operating Hours",desc:"Working days, timings and holiday schedules.",path:"/mandi-hours-templates",icon:<ClockCircleOutlined/>,mode:"edit",resource:"mandi_hours.edit",action:"UPDATE"},
  {title:"Facilities",desc:"Amenities and infrastructure available at your mandi.",path:"/mandi-facilities",icon:<ToolOutlined/>,mode:"view",resource:"mandi_facilities.list",action:"VIEW"},
  {title:"Mandi Prices",desc:"Reference prices and local market information.",path:"/mandi-prices",icon:<DollarOutlined/>,mode:"view",resource:"mandi_prices.list",action:"VIEW"},
  {title:"Gates",desc:"Entry/exit gate structure and configuration.",path:"/mandi-gates",icon:<GatewayOutlined/>,mode:"admin",resource:"mandi_gates.list",action:"VIEW"},
  {title:"Weighbridge",desc:"Weighment visibility and operational tickets.",path:"/weighment-tickets",icon:<EnvironmentOutlined/>,mode:"admin",resource:"weighment_tickets.view",action:"VIEW"},
  {title:"Auction & Lanes",desc:"Auction sessions and lane operations.",path:"/auction-sessions",icon:<ShopOutlined/>,mode:"admin",resource:"auction_sessions.list",action:"VIEW"},
  {title:"Staff Assignments",desc:"Operational staff within the assigned mandi.",path:"/staff",icon:<TeamOutlined/>,mode:"edit",resource:"mandi_staff.list",action:"VIEW"},
  {title:"Notifications",desc:"Mandi alerts and notification preferences.",path:"/system/notifications/templates",icon:<BellOutlined/>,mode:"view",resource:"notification_templates.menu",action:"VIEW"},
 ];
 const items=useMemo(()=>all.filter(x=>(!x.resource||can(x.resource,x.action||"VIEW"))&&(!search||`${x.title} ${x.desc}`.toLowerCase().includes(search.toLowerCase()))),[search,can]);
 const tag=(m:Item["mode"])=>m==="edit"?<Tag color="green">Editable</Tag>:m==="admin"?<Tag color="orange">Admin only</Tag>:<Tag>View only</Tag>;
 return <PageContainer>
   <CmPageHeader title="Mandi Management" eyebrow={<Tag color="gold">Own Mandi Only</Tag>} subtitle="Manage information and operational settings for your assigned mandi." />
   <div className="cm-management-search"><CmSearchInput value={search} onChange={setSearch} placeholder="Find a mandi setting or operational area" width={430}/></div>
   <Row gutter={[14,14]}>{items.map(item=><Col xs={24} lg={12} key={item.title}><Card hoverable className="cm-management-card" onClick={()=>navigate(item.path)}>
     <Space align="start" size={14}><span className="cm-management-icon">{item.icon}</span><div className="cm-management-copy"><div className="cm-management-title-row"><Text strong>{item.title}</Text>{tag(item.mode)}</div><Text type="secondary">{item.desc}</Text></div></Space>
   </Card></Col>)}</Row>
   <Alert className="cm-management-note" type="warning" showIcon message="Structural changes remain higher-admin controlled" description="Gate/device structure, auction policy and hardware configuration stay read-only for MANDI_MANAGER. The backend remains authoritative for every action."/>
 </PageContainer>
};
export default MandiManagerManagement;
