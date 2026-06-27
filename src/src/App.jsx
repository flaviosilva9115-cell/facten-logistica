import { useState, useEffect } from "react";
import { BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,PieChart,Pie,Cell,LineChart,Line,CartesianGrid,Legend } from "recharts";
import { G,STATUS,TSTAT,TCAT,ROLES,RCOL,USERS0,uid,nowTs,fmtD,fmtDT,isAtrasado,hashPass,ld,sv } from "./constants.js";
import { buildAcompanhamentoTask } from "./store.js";
import { Av,Chip,Toast,Btn,Modal,Inp,Sel,Txa,Fld,Logo,Badge,EmptyState,Section } from "./atoms.jsx";
import PedidoForm   from "./PedidoForm.jsx";
import PedidoDetail from "./PedidoDetail.jsx";
import Settings     from "./Settings.jsx";

// ── PERSIST KEYS ─────────────────────────────────────────────────────────────
const K={users:"fl5_users",obras:"fl5_obras",fornecedores:"fl5_forn",pedidos:"fl5_pedidos",tarefas:"fl5_tarefas",events:"fl5_events",atas:"fl5_atas",li:"fl5_li",cu:"fl5_cu"};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({pedidos,tarefas,users,obras,fornecedores,cu,onOpenPedido,onOpenObra}){
  const atrasados=pedidos.filter(isAtrasado);
  const byStat=Object.entries(STATUS).filter(([k])=>k!=="atrasado").map(([k,v])=>({name:v.label.split(" ")[0],value:pedidos.filter(p=>p.status===k).length,color:v.color}));
  const byObra=obras.filter(o=>o.active).map(o=>({name:o.code,E:pedidos.filter(p=>String(p.obra)===String(o.id)&&p.status==="entregue").length,P:pedidos.filter(p=>String(p.obra)===String(o.id)&&p.status==="pendente").length,T:pedidos.filter(p=>String(p.obra)===String(o.id)).length})).filter(o=>o.T>0).sort((a,b)=>b.T-a.T).slice(0,8);
  const week=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const ds=d.toISOString().slice(0,10);return{dia:d.toLocaleDateString("pt-BR",{weekday:"short"}),Criados:pedidos.filter(p=>p.createdAt?.slice(0,10)===ds).length,Entregues:pedidos.filter(p=>p.createdAt?.slice(0,10)===ds&&p.status==="entregue").length};});

  // Pedidos do usuário atual
  const isAlmoxU = ["almoxarife","aux_almoxarife"].includes(cu.role);
  const isCompU  = ["comprador","coordenador"].includes(cu.role);
  const meusObras = isAlmoxU ? obras.filter(o=>(cu.obras||[]).includes(o.id)) : [];
  const meusPedidos = isCompU
    ? pedidos.filter(p=>String(p.comprador)===String(cu.id)).slice(0,5)
    : isAlmoxU
    ? pedidos.filter(p=>meusObras.find(o=>String(o.id)===String(p.obra))).slice(0,5)
    : [];

  const cards=[
    {l:"Total",v:pedidos.length,c:G.greenDark,i:"📋",bg:"#E8F5E9"},
    {l:"Pendentes",v:pedidos.filter(p=>p.status==="pendente").length,c:G.gold,i:"⏳",bg:"#FFF8E1"},
    {l:"Atrasados",v:atrasados.length,c:G.orange,i:"⚠️",bg:"#FBE9E7"},
    {l:"Parciais",v:pedidos.filter(p=>p.status==="parcial").length,c:G.blue,i:"📦",bg:"#E3F2FD"},
    {l:"Entregues",v:pedidos.filter(p=>p.status==="entregue").length,c:G.green,i:"✅",bg:"#E8F5E9"},
    {l:"Tarefas Abertas",v:tarefas.filter(t=>t.status==="aberta").length,c:G.red,i:"🔴",bg:"#FFEBEE"},
    {l:"Fornecedores",v:fornecedores.length,c:G.teal,i:"🏢",bg:"#E0F2F1"},
    {l:"Obras Ativas",v:obras.filter(o=>o.active).length,c:G.purple,i:"🏗️",bg:"#F3E5F5"},
  ];

  return<div>
    {/* KPI cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:20}}>
      {cards.map(c=><div key={c.l} style={{background:c.bg,borderRadius:12,padding:"14px 14px",border:"1px solid "+c.c+"25",cursor:"default"}}>
        <div style={{fontSize:22,marginBottom:4}}>{c.i}</div>
        <div style={{fontSize:28,fontWeight:800,color:c.c,lineHeight:1}}>{c.v}</div>
        <div style={{fontSize:10,color:G.muted,fontWeight:700,marginTop:4,textTransform:"uppercase"}}>{c.l}</div>
      </div>)}
    </div>

    {/* CARD PERSONALIZADO DO USUÁRIO */}
    {(isCompU||isAlmoxU)&&meusPedidos.length>0&&(
      <div style={{background:G.surface,borderRadius:14,padding:18,border:"1px solid "+G.border,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:800,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>{isAlmoxU?"📦 Minha(s) Obra(s)":"🛒 Meus Pedidos Recentes"}</span>
          {isAlmoxU&&meusObras.length>0&&<div style={{display:"flex",gap:6}}>
            {meusObras.map(o=>(
              <button key={o.id} onClick={()=>onOpenObra&&onOpenObra(o)} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid "+G.blue,background:"#E3F2FD",cursor:"pointer",fontSize:11,fontWeight:700,color:G.blue}}>
                🏗️ {o.code} — {o.name}
              </button>
            ))}
          </div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {meusPedidos.map(p=>{
            const obra=obras.find(o=>String(o.id)===String(p.obra));
            const atrasado=isAtrasado(p);
            const cfg=STATUS[atrasado?"atrasado":p.status]||STATUS.pendente;
            const itens=p.itens||[];
            const nEnt=itens.filter(i=>i.status==="entregue").length;
            const nTot=itens.length;
            return(
              <div key={p.id} onClick={()=>onOpenPedido(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,background:G.alt,cursor:"pointer",border:"1px solid "+G.border}}>
                <span style={{fontSize:15}}>{cfg.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Ped. {p.numero} — {p.fornecedor||"—"}</div>
                  <div style={{fontSize:11,color:G.muted}}>{obra?obra.code+" — "+obra.name:"—"} · Prev: {fmtD(p.previsaoEntrega)}{nTot>0?" · "+nEnt+"/"+nTot+" entregues":""}</div>
                </div>
                <Chip color={cfg.color} bg={cfg.bg} style={{fontSize:10}}>{cfg.label}</Chip>
                {atrasado&&<Chip color={G.orange} bg="#FBE9E7" style={{fontSize:10}}>⚠️</Chip>}
              </div>
            );
          })}
        </div>
      </div>
    )}

    {atrasados.length>0&&<div style={{background:"#FBE9E7",border:"1px solid "+G.orange+"40",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
      <div style={{fontWeight:700,fontSize:13,color:G.orange,marginBottom:8}}>⚠️ {atrasados.length} pedido(s) com entrega atrasada</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{atrasados.map(p=><button key={p.id} onClick={()=>onOpenPedido(p)} style={{padding:"5px 12px",borderRadius:8,border:"1px solid "+G.orange+"60",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:G.orange}}>Ped. {p.numero} — {p.fornecedor}</button>)}</div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
      <div style={{background:G.surface,borderRadius:14,padding:18,border:"1px solid "+G.border}}><div style={{fontSize:13,fontWeight:800,marginBottom:14}}>Pedidos por Status</div><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={byStat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,value})=>value>0?`${name}(${value})`:""} labelLine={false} fontSize={10}>{byStat.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
      <div style={{background:G.surface,borderRadius:14,padding:18,border:"1px solid "+G.border}}><div style={{fontSize:13,fontWeight:800,marginBottom:14}}>Atividade — 7 Dias</div><ResponsiveContainer width="100%" height={180}><LineChart data={week}><CartesianGrid strokeDasharray="3 3" stroke={G.border}/><XAxis dataKey="dia" tick={{fontSize:10}} stroke={G.light}/><YAxis tick={{fontSize:10}} stroke={G.light}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/><Line type="monotone" dataKey="Criados" stroke={G.green} strokeWidth={2} dot={{r:3}}/><Line type="monotone" dataKey="Entregues" stroke={G.blue} strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></div>
    </div>
    <div style={{background:G.surface,borderRadius:14,padding:18,border:"1px solid "+G.border}}><div style={{fontSize:13,fontWeight:800,marginBottom:14}}>Pedidos por Obra</div><ResponsiveContainer width="100%" height={160}><BarChart data={byObra} barSize={14}><CartesianGrid strokeDasharray="3 3" stroke={G.border}/><XAxis dataKey="name" tick={{fontSize:10}} stroke={G.light}/><YAxis tick={{fontSize:10}} stroke={G.light}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="E" name="Entregues" fill={G.green} radius={[3,3,0,0]}/><Bar dataKey="P" name="Pendentes" fill={G.gold} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
  </div>;
}

// ── LISTA DE PEDIDOS (compacta, expansível) ──────────────────────────────────
function PedidoRow({p,users,obras,fornecedores,tarefas,onClick}){
  const atrasado=isAtrasado(p);
  const cfg=STATUS[atrasado?"atrasado":p.status]||STATUS.pendente;
  const obra=obras.find(o=>String(o.id)===String(p.obra));
  const alm=obra?users.find(u=>u.id===obra.almoxarife):null;
  const comp=users.find(u=>String(u.id)===String(p.comprador));
  const itens=p.itens||[];
  const nEnt=itens.filter(i=>i.status==="entregue").length,nTot=itens.length;
  const tvAb=tarefas.filter(t=>t.pedidoId===p.id&&t.status!=="resolvida").length;
  return(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:G.surface,border:"1.5px solid "+(atrasado?G.orange+"50":G.border),borderLeft:"4px solid "+cfg.color,borderRadius:10,cursor:"pointer",transition:"box-shadow .15s"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,.08)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      {/* número */}
      <div style={{width:50,height:50,borderRadius:10,background:cfg.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <div style={{fontSize:9,color:cfg.color,fontWeight:700,textTransform:"uppercase"}}>Ped.</div>
        <div style={{fontSize:15,fontWeight:800,color:cfg.color}}>{p.numero}</div>
      </div>
      {/* info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
          <span style={{fontWeight:700,fontSize:13}}>{p.fornecedor||"—"}</span>
          <Chip color={cfg.color} bg={cfg.bg} style={{fontSize:10}}>{cfg.icon} {cfg.label}</Chip>
          {atrasado&&<Chip color={G.orange} bg="#FBE9E7" style={{fontSize:10}}>⚠️ Atrasado</Chip>}
          {p.status==="parcial"&&<Chip color={G.blue} bg="#E3F2FD" style={{fontSize:10}}>📦 Parcial</Chip>}
          {tvAb>0&&<Chip color={G.red} bg="#FFEBEE" style={{fontSize:10}}>🔴 {tvAb} tar.</Chip>}
        </div>
        <div style={{fontSize:11,color:G.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {obra&&<span>🏗️ {obra.code} </span>}
          {alm&&<span>· 📦 {alm.name} </span>}
          {comp&&<span>· 🛒 {comp.name} </span>}
          {p.previsaoEntrega&&<span>· 📅 {fmtD(p.previsaoEntrega)}</span>}
          {p.valor&&<span>· 💰 R$ {p.valor}</span>}
        </div>
        {itens.length>0&&<div style={{fontSize:10,color:G.light,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{itens.slice(0,3).map(i=>i.descricao).join(", ")+(itens.length>3?" +mais…":"")}</div>}
      </div>
      {/* right: progress + meta */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
        {nTot>0&&<div>
          <div style={{fontSize:10,color:G.muted,textAlign:"right"}}>{nEnt}/{nTot}</div>
          <div style={{background:G.border,borderRadius:3,height:5,width:60,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,background:G.green,width:Math.round((nEnt/nTot)*100)+"%"}}/></div>
        </div>}
        <div style={{fontSize:10,color:G.light}}>{fmtD(p.createdAt)}</div>
        <div style={{display:"flex",gap:4}}>
          {p.messages?.length>0&&<span style={{fontSize:10,color:G.muted}}>💬{p.messages.length}</span>}
        </div>
      </div>
    </div>
  );
}

// ── LISTA DE TAREFAS (compacta, por categoria) ────────────────────────────────
function TarefaRow({t,pedidos,users,obras,onClick,onQuickStatus,toast}){
  const ts=TSTAT[t.status]||TSTAT.aberta;
  const tc=TCAT[t.categoria]||TCAT.acompanhamento;
  const resp=users.find(u=>u.id===t.assignedTo);
  const obra=obras.find(o=>String(o.id)===String(t.obra));
  const ped=pedidos.find(p=>p.id===t.pedidoId);
  const overdue=t.due&&new Date(t.due)<new Date()&&t.status!=="resolvida";
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 13px",background:t.status==="resolvida"?"#fafafa":G.surface,border:"1.5px solid "+(overdue?G.orange+"50":G.border),borderLeft:"4px solid "+ts.color,borderRadius:10,cursor:"pointer",marginBottom:4}}
      onClick={onClick}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.07)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{tc.icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:300}}>{t.title}</span>
          <Chip color={ts.color} bg={ts.bg} style={{fontSize:10}}>{ts.icon} {ts.label}</Chip>
          <Chip color={tc.color} bg={tc.bg} style={{fontSize:10}}>{tc.label}</Chip>
          {overdue&&<Chip color={G.orange} bg="#FBE9E7" style={{fontSize:10}}>⚠️ Atrasada</Chip>}
          {t.status==="resolvida"&&<Chip color={G.green} bg="#E8F5E9" style={{fontSize:10}}>🔔 Checar retorno</Chip>}
        </div>
        <div style={{fontSize:10,color:G.muted}}>
          {resp&&<span>👤 {resp.name} </span>}
          {obra&&<span>· 🏗️ {obra.code} </span>}
          {ped&&<span>· 📋 Ped. {ped.numero} </span>}
          {t.due&&<span>· 📅 {fmtD(t.due)}</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
        {t.status==="aberta"&&<button onClick={()=>{onQuickStatus(t.id,"andamento");toast("▶ Em andamento!");}} style={{padding:"4px 9px",borderRadius:6,border:"1.5px solid "+G.gold,background:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:G.goldDark}}>▶</button>}
        {t.status!=="resolvida"&&<button onClick={()=>{onQuickStatus(t.id,"resolvida");toast("✅ Concluída!");}} style={{padding:"4px 9px",borderRadius:6,border:"1.5px solid "+G.green,background:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:G.greenDark}}>✅</button>}
      </div>
    </div>
  );
}

// ── TAREFAS PAGE ──────────────────────────────────────────────────────────────
function TarefasPage({tarefas,setTarefas,pedidos,users,obras,cu,toast}){
  const [filterCat,setFilterCat]=useState("all");
  const [filterStat,setFilterStat]=useState("abertas");
  const [selTarefa,setSelTarefa]=useState(null);
  const [showNew,setShowNew]=useState(false);
  const [nf,setNf]=useState({title:"",description:"",categoria:"acompanhamento",assignedTo:"",due:"",obra:""});

  const filtered=tarefas.filter(t=>{
    if(filterCat!=="all"&&t.categoria!==filterCat)return false;
    if(filterStat==="abertas"&&t.status==="resolvida")return false;
    if(filterStat==="resolvidas"&&t.status!=="resolvida")return false;
    return true;
  }).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  function createTask(){
    if(!nf.title){alert("Título obrigatório.");return;}
    const nova={...nf,id:uid(),status:"aberta",pedidoId:null,messages:[],createdBy:cu.name,createdAt:nowTs()};
    setTarefas(ts=>[nova,...ts]);
    setNf({title:"",description:"",categoria:"acompanhamento",assignedTo:"",due:"",obra:""});
    setShowNew(false); toast("Tarefa criada!");
  }
  function quickStatus(id,status){
    setTarefas(ts=>ts.map(t=>t.id===id?{...t,status}:t));
    if(selTarefa?.id===id)setSelTarefa(st=>({...st,status}));
  }

  const catCounts=Object.keys(TCAT).reduce((acc,k)=>({...acc,[k]:tarefas.filter(t=>t.categoria===k&&t.status!=="resolvida").length}),{});
  const tDetail=selTarefa?tarefas.find(t=>t.id===selTarefa.id)||selTarefa:null;

  return<div>
    {/* filtros e controles */}
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        <button onClick={()=>setFilterCat("all")} style={{padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterCat==="all"?G.green:G.alt,color:filterCat==="all"?"#fff":G.muted}}>Todas ({tarefas.filter(t=>t.status!=="resolvida").length})</button>
        {Object.entries(TCAT).map(([k,v])=><button key={k} onClick={()=>setFilterCat(k)} style={{padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterCat===k?v.color:G.alt,color:filterCat===k?"#fff":G.muted}}>{v.icon} {v.label} {catCounts[k]>0&&"("+catCounts[k]+")"}</button>)}
      </div>
      <div style={{flex:1}}/>
      <div style={{display:"flex",gap:4}}>
        {[["abertas","Abertas"],["resolvidas","Resolvidas"],["all","Todas"]].map(([k,l])=><button key={k} onClick={()=>setFilterStat(k)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid "+(filterStat===k?G.greenDark:G.border),background:filterStat===k?G.alt:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:filterStat===k?G.greenDark:G.muted}}>{l}</button>)}
      </div>
      <Btn onClick={()=>setShowNew(true)} size="sm">+ Nova</Btn>
    </div>

    {showNew&&<div style={{background:G.surface,border:"1px solid "+G.border,borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>Nova Tarefa</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"0 12px"}}>
        <Fld label="Título" required><Inp value={nf.title} onChange={e=>setNf(p=>({...p,title:e.target.value}))}/></Fld>
        <Fld label="Categoria"><Sel value={nf.categoria} onChange={e=>setNf(p=>({...p,categoria:e.target.value}))}>{Object.entries(TCAT).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</Sel></Fld>
      </div>
      <Fld label="Descrição"><Txa rows={2} value={nf.description} onChange={e=>setNf(p=>({...p,description:e.target.value}))}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
        <Fld label="Responsável"><Sel value={nf.assignedTo} onChange={e=>setNf(p=>({...p,assignedTo:Number(e.target.value)}))}><option value="">—</option>{users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</Sel></Fld>
        <Fld label="Prazo"><Inp type="date" value={nf.due} onChange={e=>setNf(p=>({...p,due:e.target.value}))}/></Fld>
        <Fld label="Obra"><Sel value={nf.obra} onChange={e=>setNf(p=>({...p,obra:e.target.value}))}><option value="">—</option>{obras.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.code}</option>)}</Sel></Fld>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={()=>setShowNew(false)}>Cancelar</Btn><Btn onClick={createTask}>Criar</Btn></div>
    </div>}

    {filtered.length===0
      ?<EmptyState icon="✅" title="Nenhuma tarefa nesta categoria" subtitle="As tarefas criadas ao importar pedidos aparecerão aqui."/>
      :<div>{filtered.map(t=><TarefaRow key={t.id} t={t} pedidos={pedidos} users={users} obras={obras} onClick={()=>setSelTarefa(t)} onQuickStatus={quickStatus} toast={toast}/>)}</div>}

    {/* Detalhe Tarefa */}
    {tDetail&&<Modal open={!!selTarefa} onClose={()=>setSelTarefa(null)} title={"Tarefa — "+(TCAT[tDetail.categoria]?.icon||"📋")+" "+(TCAT[tDetail.categoria]?.label||"")} width={660}>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <Chip color={(TCAT[tDetail.categoria]||TCAT.acompanhamento).color} bg={(TCAT[tDetail.categoria]||TCAT.acompanhamento).bg}>{(TCAT[tDetail.categoria]||TCAT.acompanhamento).icon} {(TCAT[tDetail.categoria]||TCAT.acompanhamento).label}</Chip>
        <Chip color={(TSTAT[tDetail.status]||TSTAT.aberta).color} bg={(TSTAT[tDetail.status]||TSTAT.aberta).bg}>{(TSTAT[tDetail.status]||TSTAT.aberta).icon} {(TSTAT[tDetail.status]||TSTAT.aberta).label}</Chip>
      </div>
      <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{tDetail.title}</div>
      {tDetail.description&&<div style={{background:G.alt,borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:13,lineHeight:1.6}}>{tDetail.description}</div>}
      {tDetail.status==="resolvida"&&<div style={{background:"#E8F5E9",border:"1px solid #A5D6A7",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:13,color:G.greenDark}}>🔔 Concluída — verifique o retorno do comprador e confirme o fechamento.</div>}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:8}}>Alterar Status</div>
        <div style={{display:"flex",gap:8}}>
          {Object.entries(TSTAT).map(([k,v])=><button key={k} onClick={()=>{quickStatus(tDetail.id,k);setSelTarefa(st=>({...st,status:k}));}} style={{padding:"7px 16px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"2px solid "+(tDetail.status===k?v.color:"#DDE8DD"),background:tDetail.status===k?v.bg:"none",color:tDetail.status===k?v.color:G.muted}}>{v.icon} {v.label}</button>)}
        </div>
      </div>
      <Fld label="Responsável">
        <Sel value={tDetail.assignedTo||""} onChange={e=>{const v=Number(e.target.value);setTarefas(ts=>ts.map(t=>t.id===tDetail.id?{...t,assignedTo:v}:t));setSelTarefa(st=>({...st,assignedTo:v}));}}>
          {users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.name} — {ROLES[u.role]}</option>)}
        </Sel>
      </Fld>
      <Fld label="Prazo">
        <Inp type="date" value={tDetail.due||""} onChange={e=>{setTarefas(ts=>ts.map(t=>t.id===tDetail.id?{...t,due:e.target.value}:t));setSelTarefa(st=>({...st,due:e.target.value}));}}/>
      </Fld>
      <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:6}}>Criado por {tDetail.createdBy} · {fmtD(tDetail.createdAt)}</div>
    </Modal>}
  </div>;
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [users,        setUsers]        = useState(()=>ld(K.users,        USERS0));
  const [obras,        setObras]        = useState(()=>ld(K.obras,        []));
  const [fornecedores, setFornecedores] = useState(()=>ld(K.fornecedores, []));
  const [pedidos,      setPedidos]      = useState(()=>ld(K.pedidos,      []));
  const [tarefas,      setTarefas]      = useState(()=>ld(K.tarefas,      []));
  const [events,       setEvents]       = useState(()=>ld(K.events,       []));
  const [atas,         setAtas]         = useState(()=>ld(K.atas,         []));

  const [loggedIn,setLoggedIn] = useState(()=>ld(K.li, false));
  const [cu,setCu]             = useState(()=>ld(K.cu, USERS0[0]));
  const [loginEmail,setLoginEmail] = useState("");
  const [loginPass, setLoginPass]  = useState("");
  const [loginErr,  setLoginErr]   = useState("");

  const [page,    setPage]    = useState("dashboard");
  const [toastMsg,setToastMsg]= useState("");
  const [search,  setSearch]  = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fObra,   setFObra]   = useState("all");
  const [fCat,    setFCat]    = useState("all");
  const [showPF,  setShowPF]  = useState(false);
  const [detailP, setDetailP] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [notifOpen,setNotifOpen] = useState(false);

  useEffect(()=>sv(K.users,        users),        [users]);
  useEffect(()=>sv(K.obras,        obras),        [obras]);
  useEffect(()=>sv(K.fornecedores, fornecedores), [fornecedores]);
  useEffect(()=>sv(K.pedidos,      pedidos),      [pedidos]);
  useEffect(()=>sv(K.tarefas,      tarefas),      [tarefas]);
  useEffect(()=>sv(K.events,       events),       [events]);
  useEffect(()=>sv(K.atas,         atas),         [atas]);
  useEffect(()=>sv(K.li,           loggedIn),     [loggedIn]);
  useEffect(()=>sv(K.cu,           cu),           [cu]);

  const toast = m => setToastMsg(m);

  // auto-criar tarefas de atraso
  useEffect(()=>{
    const novos=pedidos.filter(p=>isAtrasado(p)&&!tarefas.find(t=>t.pedidoId===p.id&&t.categoria==="atraso"&&t.status!=="resolvida")).map(p=>({id:uid(),categoria:"atraso",title:"Entrega atrasada — Pedido "+p.numero+" ("+p.fornecedor+")",description:"Previsão: "+fmtD(p.previsaoEntrega)+". Contatar fornecedor.",status:"aberta",pedidoId:p.id,obra:p.obra,assignedTo:Number(p.comprador),due:"",messages:[],createdBy:"Sistema",createdAt:nowTs()}));
    if(novos.length>0) setTarefas(ts=>[...novos.filter(n=>!ts.find(t=>t.pedidoId===n.pedidoId&&t.categoria==="atraso"&&t.status!=="resolvida")),...ts]);
  },[pedidos]);

  async function doLogin(){
    const u=users.find(x=>x.email?.toLowerCase()===loginEmail.toLowerCase()&&x.active);
    if(!u){setLoginErr("E-mail não encontrado.");return;}
    const h=await hashPass(loginPass);
    if(!(u.senhaHash?u.senhaHash===h:loginPass==="facten2025")){setLoginErr("Senha incorreta.");return;}
    setCu(u);setLoggedIn(true);setLoginErr("");
  }

  function handleAutoCreate(tipo,item){
    if(tipo==="obra"){ setObras(o=>{if(o.find(x=>x.code===item.code))return o;return[...o,item];});toast("🏗️ Obra "+item.code+" criada via PDF!"); }
    if(tipo==="fornecedor"){ setFornecedores(f=>{const cnpj=item.cnpj?.replace(/\D/g,"");if(cnpj&&f.find(x=>x.cnpj?.replace(/\D/g,"")===cnpj))return f;if(f.find(x=>x.nome.toLowerCase()===item.nome.toLowerCase()))return f;return[...f,item];});toast("🏢 Fornecedor '"+item.nome+"' criado via PDF!"); }
  }

  function savePedido(form){
    const obra=obras.find(o=>String(o.id)===String(form.obra));
    const alm=obra?users.find(u=>u.id===obra.almoxarife):null;
    const forn=fornecedores.find(f=>String(f.id)===String(form.fornecedorId));
    const p0={
      id:uid(), ...form,
      fornecedor:forn?.nome||form.fornecedor||"",
      status:"pendente",
      messages:[{id:uid(),userId:0,userName:"Sistema",avatar:"🤖",
        text:`🤖 Pedido **${form.numero}** criado. Obra: **${obra?obra.code+" — "+obra.name:"—"}** · Almoxarife: **${alm?.name||"—"}** · Fornecedor: **${forn?.nome||"—"}**`,
        type:"sistema",createdAt:nowTs()}],
      createdAt:nowTs(), createdBy:cu.name
    };
    setPedidos(p=>[p0,...p]);
    // criar tarefa de acompanhamento automática
    const taskAcomp=buildAcompanhamentoTask(p0,forn,obra,users.find(u=>String(u.id)===String(p0.comprador)));
    setTarefas(ts=>[taskAcomp,...ts]);
    toast("✅ Pedido "+form.numero+" criado + tarefa de acompanhamento!");
  }

  function updateStatus(id,status){
    setPedidos(p=>p.map(x=>{
      if(x.id!==id)return x;
      if(status==="aguardando"){
        const task={id:uid(),categoria:"boleto",title:"Boleto/NF pendente — Ped. "+x.numero+" ("+x.fornecedor+")",description:"Almoxarife informou material sem boleto ou nota fiscal.",status:"aberta",pedidoId:id,obra:x.obra,assignedTo:Number(x.comprador),due:x.previsaoEntrega||"",messages:[],createdBy:cu.name,createdAt:nowTs()};
        setTarefas(ts=>[task,...ts]);toast("🧾 Tarefa de boleto criada!");
      }
      return{...x,status};
    }));
    if(status!=="aguardando")toast("Status → "+STATUS[status]?.label);
  }

  function deletePedido(id){setPedidos(p=>p.filter(x=>x.id!==id));setTarefas(ts=>ts.filter(t=>t.pedidoId!==id));}
  function cancelPedido(id){setPedidos(p=>p.map(x=>x.id===id?{...x,status:"cancelado"}:x));addMsg(id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"❌ Pedido cancelado pelo comprador "+cu.name,type:"sistema",createdAt:nowTs()});}
  const addMsg=(id,m)=>setPedidos(p=>p.map(x=>x.id===id?{...x,messages:[...(x.messages||[]),m]}:x));
  const updateItens=(id,novos,ns)=>setPedidos(p=>p.map(x=>x.id===id?{...x,itens:novos,status:ns}:x));

  // notificações
  const notifs=[];
  pedidos.forEach(p=>{
    const obra=obras.find(o=>String(o.id)===String(p.obra));
    const pertAlmox=["almoxarife","aux_almoxarife"].includes(cu.role)&&obra?.almoxarife===cu.id;
    const pertComp=["comprador","coordenador"].includes(cu.role)&&String(p.comprador)===String(cu.id);
    if(isAtrasado(p)&&(pertComp||pertAlmox)) notifs.push({id:"atr"+p.id,icon:"⚠️",text:"Pedido "+p.numero+" atrasado",pedidoId:p.id,color:G.orange});
    if(p.status==="aguardando"&&pertComp) notifs.push({id:"bol"+p.id,icon:"🧾",text:"Boleto solicitado — Ped. "+p.numero,pedidoId:p.id,color:G.purple});
    if(p.status==="parcial"&&pertComp) notifs.push({id:"par"+p.id,icon:"📦",text:"Entrega parcial — Ped. "+p.numero,pedidoId:p.id,color:G.blue});
    if(p.status==="entregue"&&pertComp) notifs.push({id:"ent"+p.id,icon:"✅",text:"Pedido "+p.numero+" entregue!",pedidoId:p.id,color:G.green});
  });
  tarefas.filter(t=>t.status==="resolvida"&&String(t.assignedTo)===String(cu.id)).slice(0,3).forEach(t=>{
    notifs.push({id:"tsk"+t.id,icon:"🔔",text:"Tarefa concluída: "+t.title.slice(0,40),color:G.green});
  });

  const filteredP=pedidos.filter(p=>{
    const o=obras.find(x=>String(x.id)===String(p.obra));
    return(fStatus==="all"||p.status===fStatus)&&(fObra==="all"||String(p.obra)===fObra)&&(!search||[p.numero,p.fornecedor,o?.name,o?.code].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
  });

  // busca direta por número de pedido
  useEffect(()=>{
    if(search.length>=3){const exact=pedidos.find(p=>p.numero===search.trim());if(exact)setDetailP(exact);}
  },[search]);

  const isComp=["comprador","coordenador"].includes(cu.role);
  const NAV=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"pedidos",  icon:"📋",label:"Pedidos",   badge:pedidos.filter(p=>isAtrasado(p)).length||null,badgeColor:G.orange},
    {id:"tarefas",  icon:"✅",label:"Tarefas",   badge:tarefas.filter(t=>t.status==="aberta").length||null,badgeColor:G.red},
  ];

  if(!loggedIn)return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2E7D32 0%,#1A3A1A 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",padding:16}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@keyframes su{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"44px 40px",width:"100%",maxWidth:400,boxShadow:"0 32px 80px rgba(0,0,0,.32)",animation:"su .3s ease"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Logo size={52}/></div>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:24,fontWeight:800,color:G.text}}>FACTEN</div>
          <div style={{fontSize:11,color:G.muted,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase"}}>Logística de Obras</div>
        </div>
        <Fld label="E-mail"><Inp type="email" placeholder="seu@email.com.br" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></Fld>
        <Fld label="Senha"><Inp type="password" placeholder="Senha de acesso" value={loginPass} onChange={e=>setLoginPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></Fld>
        {loginErr&&<div style={{color:G.red,fontSize:13,marginBottom:10,textAlign:"center"}}>{loginErr}</div>}
        <button onClick={doLogin} style={{width:"100%",padding:"13px 0",borderRadius:10,border:"none",background:G.green,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",marginTop:4}}>Entrar</button>
        <div style={{textAlign:"center",fontSize:11,color:G.light,marginTop:14}}>Senha padrão: <strong>facten2025</strong></div>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"Inter,sans-serif",color:G.text,background:G.bg}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@keyframes su{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#DDE8DD;border-radius:4px}button:active{transform:scale(.97)}`}</style>

      {/* SIDEBAR */}
      <div style={{width:210,flexShrink:0,background:G.nav,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0}}>
        <div style={{padding:"22px 18px 18px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><Logo size={34}/><div><div style={{fontSize:15,fontWeight:800,color:"#fff"}}>FACTEN</div><div style={{fontSize:9,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Logística</div></div></div>
        </div>
        <nav style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
          {NAV.map(n=>{const active=page===n.id;return<button key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:9,border:"none",cursor:"pointer",textAlign:"left",width:"100%",background:active?"rgba(76,175,80,.25)":"none",color:active?"#fff":"rgba(255,255,255,.55)",fontWeight:active?700:500,fontSize:13}}>
            <span style={{fontSize:17,width:20,textAlign:"center"}}>{n.icon}</span>
            <span style={{flex:1}}>{n.label}</span>
            {n.badge>0&&<span style={{background:n.badgeColor||G.red,color:"#fff",borderRadius:20,fontSize:9,fontWeight:800,padding:"1px 6px"}}>{n.badge}</span>}
          </button>;})}
        </nav>
        <div style={{padding:"10px 8px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
          <button onClick={()=>setShowCfg(true)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:9,border:"none",cursor:"pointer",background:"none",color:"rgba(255,255,255,.55)",fontWeight:500,fontSize:13,textAlign:"left",width:"100%"}}>
            <span style={{fontSize:17,width:20,textAlign:"center"}}>⚙️</span>Configurações
          </button>
          <div style={{display:"flex",alignItems:"center",gap:9,padding:"9px 11px",cursor:"pointer"}} onClick={()=>setLoggedIn(false)}>
            <Av s={cu.avatar} size={28} color={RCOL[cu.role]||G.green}/>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cu.name.split(" ")[0]}</div><div style={{fontSize:9,color:"rgba(255,255,255,.4)"}}>{ROLES[cu.role]}</div></div>
            <span style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>→</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,overflowY:"auto",minWidth:0}}>
        {/* TOPBAR */}
        <div style={{background:G.surface,borderBottom:"1px solid "+G.border,padding:"0 24px",height:52,display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:50}}>
          <h1 style={{margin:0,fontSize:17,fontWeight:800,color:G.text}}>{page==="dashboard"?"Dashboard":page==="pedidos"?"Pedidos de Compra":"Tarefas"}</h1>
          <div style={{flex:1}}/>
          {page==="pedidos"&&<>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nº pedido ou fornecedor…" style={{padding:"0 10px",height:32,borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:12,width:200,outline:"none",fontFamily:"Inter,sans-serif"}}/>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{height:32,borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:12,padding:"0 8px",outline:"none",background:"#fff"}}>
              <option value="all">Todos os status</option>
              {Object.entries(STATUS).filter(([k])=>k!=="atrasado").map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={fObra} onChange={e=>setFObra(e.target.value)} style={{height:32,borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:12,padding:"0 8px",outline:"none",background:"#fff"}}>
              <option value="all">Todas as obras</option>
              {obras.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
            </select>
            {isComp&&<Btn onClick={()=>setShowPF(true)} size="sm">+ Novo Pedido</Btn>}
          </>}
          {/* Notificações */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setNotifOpen(n=>!n)} style={{background:"none",border:"none",cursor:"pointer",fontSize:19,padding:"4px 8px",position:"relative"}}>
              🔔{notifs.length>0&&<span style={{position:"absolute",top:0,right:0,background:G.red,color:"#fff",borderRadius:20,fontSize:8,fontWeight:800,padding:"1px 4px"}}>{notifs.length}</span>}
            </button>
            {notifOpen&&<div style={{position:"absolute",right:0,top:42,background:"#fff",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,.18)",width:310,zIndex:200,border:"1px solid "+G.border}}>
              <div style={{padding:"11px 14px",borderBottom:"1px solid "+G.border,fontWeight:700,fontSize:13,display:"flex",justifyContent:"space-between"}}>Notificações<button onClick={()=>setNotifOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:G.muted,fontSize:16}}>✕</button></div>
              {notifs.length===0&&<div style={{padding:"20px",textAlign:"center",color:G.light,fontSize:13}}>Tudo em dia!</div>}
              {notifs.map(n=><div key={n.id} onClick={()=>{if(n.pedidoId){const p=pedidos.find(x=>x.id===n.pedidoId);if(p){setDetailP(p);setPage("pedidos");}}setNotifOpen(false);}} style={{display:"flex",gap:10,padding:"9px 14px",borderBottom:"1px solid "+G.border,cursor:"pointer"}}>
                <span style={{fontSize:18}}>{n.icon}</span>
                <div style={{fontSize:12,color:G.text,lineHeight:1.5}}>{n.text}</div>
              </div>)}
            </div>}
          </div>
        </div>

        <div style={{padding:24}}>
          {page==="dashboard"&&<Dashboard pedidos={pedidos} tarefas={tarefas} users={users} obras={obras} fornecedores={fornecedores} cu={cu} onOpenPedido={p=>{setDetailP(p);setPage("pedidos");}} onOpenObra={o=>{setFObra(String(o.id));setPage("pedidos");}}/>}

          {page==="pedidos"&&(
            filteredP.length===0
              ?<EmptyState icon="📦" title="Nenhum pedido encontrado" subtitle={isComp?"Importe um PDF do Sienge ou crie manualmente.":"Aguardando pedidos dos compradores."}/>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {filteredP.map(p=><PedidoRow key={p.id} p={p} users={users} obras={obras} fornecedores={fornecedores} tarefas={tarefas} onClick={()=>setDetailP(p)}/>)}
              </div>
          )}

          {page==="tarefas"&&<TarefasPage tarefas={tarefas} setTarefas={setTarefas} pedidos={pedidos} users={users} obras={obras} cu={cu} toast={toast}/>}
        </div>
      </div>

      {/* MODALS */}
      <PedidoForm
        open={showPF} onClose={()=>setShowPF(false)}
        onSave={savePedido} users={users} obras={obras} fornecedores={fornecedores}
        cu={cu} onAutoCreate={handleAutoCreate}/>

      <PedidoDetail
        open={!!detailP} onClose={()=>setDetailP(null)}
        pedido={detailP?pedidos.find(p=>p.id===detailP.id)||detailP:null}
        users={users} obras={obras} fornecedores={fornecedores} cu={cu}
        onUpdateItens={updateItens} onAddMsg={addMsg}
        onBoleto={id=>updateStatus(id,"aguardando")}
        onDelete={deletePedido} onCancel={cancelPedido}
        tarefas={tarefas} setTarefas={setTarefas} toast={toast}/>

      <Settings
        open={showCfg} onClose={()=>setShowCfg(false)}
        users={users} obras={obras} fornecedores={fornecedores}
        setUsers={setUsers} setObras={setObras} setFornecedores={setFornecedores}
        toast={toast}/>

      <Toast msg={toastMsg} onDone={()=>setToastMsg("")}/>
    </div>
  );
}
