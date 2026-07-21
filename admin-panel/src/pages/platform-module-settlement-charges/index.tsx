import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";
import { usePermissions } from "../../authz/usePermissions";
import { listPlatformModuleSettlementCharges, savePlatformModuleSettlementCharges } from "../../api/platformModuleSettlementCharges";

type Line = { charge_code: string; charge_label: string; charge_category: string; enabled: boolean; charge_type: "FIXED" | "PERCENTAGE"; fixed_amount: number; percentage: number; min_amount: number; max_amount: number | null; tax_percentage: number; charged_to: "TRADER" | "FARMER" | "PLATFORM"; beneficiary_account_type: string; sort_order: number };
const defaults: Line[] = [
  { charge_code:"PLATFORM_FEE", charge_label:"Platform Fee", charge_category:"PLATFORM", enabled:false, charge_type:"PERCENTAGE", fixed_amount:0, percentage:0, min_amount:0, max_amount:null, tax_percentage:18, charged_to:"TRADER", beneficiary_account_type:"PLATFORM", sort_order:10 },
  { charge_code:"PAYMENT_GATEWAY_FEE", charge_label:"Payment Gateway Fee", charge_category:"GATEWAY", enabled:false, charge_type:"PERCENTAGE", fixed_amount:0, percentage:0, min_amount:0, max_amount:null, tax_percentage:18, charged_to:"TRADER", beneficiary_account_type:"GATEWAY", sort_order:20 },
  { charge_code:"SETTLEMENT_PROCESSING_FEE", charge_label:"Settlement Processing Fee", charge_category:"SETTLEMENT", enabled:false, charge_type:"FIXED", fixed_amount:0, percentage:0, min_amount:0, max_amount:null, tax_percentage:18, charged_to:"FARMER", beneficiary_account_type:"PLATFORM", sort_order:30 },
  { charge_code:"REFUND_PROCESSING_FEE", charge_label:"Refund Processing Fee", charge_category:"REFUND", enabled:false, charge_type:"FIXED", fixed_amount:0, percentage:0, min_amount:0, max_amount:null, tax_percentage:18, charged_to:"TRADER", beneficiary_account_type:"PLATFORM", sort_order:40 },
];
function username(){ try{return JSON.parse(localStorage.getItem("cd_user")||"{}").username||"";}catch{return "";} }
export default function PlatformModuleSettlementChargesPage(){
  const { can } = usePermissions();
  const [moduleCode,setModuleCode]=useState("DIRECT_TRADE"); const [provider,setProvider]=useState("DEFAULT");
  const [rounding,setRounding]=useState("NONE"); const [lines,setLines]=useState<Line[]>(defaults); const [active,setActive]=useState(true);
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const canSave = can("platform_module_settlement_charges.save","UPDATE");
  const load=async()=>{ setLoading(true); setError(""); try{ const r:any=await listPlatformModuleSettlementCharges(username(),{module_code:moduleCode,provider_code:provider}); const row=r?.data?.settings?.[0]||r?.settings?.[0]; if(row){setLines(row.charge_lines||defaults);setRounding(row.rounding_rule||"NONE");setActive(row.is_active!=="N");}else setLines(defaults);}catch(e:any){setError(e?.message||"Unable to load charge settings.");}finally{setLoading(false);} };
  useEffect(()=>{load();},[moduleCode,provider]);
  const update=(i:number,key:keyof Line,value:any)=>setLines(v=>v.map((x,idx)=>idx===i?{...x,[key]:value}:x));
  const save=async()=>{setLoading(true);setError("");setMessage("");try{await savePlatformModuleSettlementCharges(username(),{module_code:moduleCode,provider_code:provider,rounding_rule:rounding,is_active:active?"Y":"N",charge_lines:lines});setMessage("Platform module settlement charges saved successfully.");await load();}catch(e:any){setError(e?.message||"Unable to save charge settings.");}finally{setLoading(false);}};
  return <PageContainer>
    <Stack spacing={2}>
      <Box><Typography variant="h4" fontWeight={700}>Platform Module Settlement Charge Settings</Typography><Typography color="text.secondary">Configure CiberMandi-owned charges for Direct Trade, Contract Farming and Weekly Haat.</Typography></Box>
      {error&&<Alert severity="error">{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}
      <Card variant="outlined"><CardContent><Stack direction={{xs:"column",md:"row"}} spacing={2}>
        <TextField select label="Module" value={moduleCode} onChange={e=>setModuleCode(e.target.value)} sx={{minWidth:220}}><MenuItem value="DIRECT_TRADE">Direct Trade</MenuItem><MenuItem value="CONTRACT_FARMING">Contract Farming</MenuItem><MenuItem value="WEEKLY_HAAT">Weekly Haat</MenuItem></TextField>
        <TextField label="Provider" value={provider} onChange={e=>setProvider(e.target.value.toUpperCase())} sx={{minWidth:220}} />
        <TextField select label="Rounding" value={rounding} onChange={e=>setRounding(e.target.value)} sx={{minWidth:220}}><MenuItem value="NONE">No rounding</MenuItem><MenuItem value="NEAREST_RUPEE">Nearest rupee</MenuItem><MenuItem value="ROUND_UP">Round up</MenuItem><MenuItem value="ROUND_DOWN">Round down</MenuItem></TextField>
        <FormControlLabel control={<Switch checked={active} onChange={e=>setActive(e.target.checked)} />} label="Active" />
      </Stack></CardContent></Card>
      {lines.map((line,i)=><Card key={line.charge_code} variant="outlined"><CardContent><Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={700}>{line.charge_label}</Typography><Chip size="small" label={line.charge_code} sx={{mt:0.5}} /></Box><Switch checked={line.enabled} onChange={e=>update(i,"enabled",e.target.checked)} /></Stack>
        <Stack direction={{xs:"column",md:"row"}} spacing={2}>
          <TextField select label="Type" value={line.charge_type} onChange={e=>update(i,"charge_type",e.target.value)}><MenuItem value="FIXED">Fixed</MenuItem><MenuItem value="PERCENTAGE">Percentage</MenuItem></TextField>
          <TextField label={line.charge_type==="FIXED"?"Fixed amount (₹)":"Percentage (%)"} type="number" value={line.charge_type==="FIXED"?line.fixed_amount:line.percentage} onChange={e=>update(i,line.charge_type==="FIXED"?"fixed_amount":"percentage",Number(e.target.value))}/>
          <TextField label="Tax (GST %)" type="number" value={line.tax_percentage} onChange={e=>update(i,"tax_percentage",Number(e.target.value))}/>
          <TextField select label="Charged to" value={line.charged_to} onChange={e=>update(i,"charged_to",e.target.value)}><MenuItem value="TRADER">Trader</MenuItem><MenuItem value="FARMER">Farmer</MenuItem><MenuItem value="PLATFORM">Platform</MenuItem></TextField>
          <TextField label="Minimum (₹)" type="number" value={line.min_amount} onChange={e=>update(i,"min_amount",Number(e.target.value))}/>
          <TextField label="Maximum (₹)" type="number" value={line.max_amount??""} onChange={e=>update(i,"max_amount",e.target.value===""?null:Number(e.target.value))}/>
        </Stack>
      </Stack></CardContent></Card>)}
      <Box display="flex" justifyContent="flex-end"><Button variant="contained" disabled={!canSave||loading} onClick={save} sx={{backgroundColor:"#4f6726",minWidth:180}}>Save Settings</Button></Box>
    </Stack>
  </PageContainer>;
}
