import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

// ── TOKENS ───────────────────────────────────────────────────────────────────
const G = {
  green:"#4CAF50", greenDark:"#2E7D32", greenLight:"#A5D6A7",
  red:"#E74C3C", gold:"#F4C430", goldDark:"#D4A017",
  purple:"#9C27B0", blue:"#2196F3", orange:"#FF7043",
  bg:"#F4F6F4", surface:"#FFFFFF", alt:"#F0F5F0",
  border:"#DDE8DD", text:"#1A2B1A", muted:"#5A7A5A", light:"#9DB89D",
  nav:"#1B3A1B",
};

const STATUS = {
  pendente:   { label:"Pendente",              color:G.gold,   bg:"#FFF8E1", icon:"⏳" },
  entregue:   { label:"Entregue",              color:G.green,  bg:"#E8F5E9", icon:"✅" },
  parcial:    { label:"Entregue Parcialmente", color:G.blue,   bg:"#E3F2FD", icon:"📦" },
  cancelado:  { label:"Cancelado",             color:G.red,    bg:"#FFEBEE", icon:"❌" },
  aguardando: { label:"Aguard. Boleto",        color:G.purple, bg:"#F3E5F5", icon:"🧾" },
  atrasado:   { label:"Atrasado",              color:G.orange, bg:"#FBE9E7", icon:"⚠️" },
};

const TSTAT = {
  aberta:    { label:"Aberta",        color:G.red,   bg:"#FFEBEE", icon:"🔴" },
  andamento: { label:"Em Andamento",  color:G.gold,  bg:"#FFF8E1", icon:"🟡" },
  resolvida: { label:"Resolvida",     color:G.green, bg:"#E8F5E9", icon:"🟢" },
};

const TTYPE = {
  boleto:  { label:"Boleto Pendente",    color:G.purple, icon:"🧾" },
  parcial: { label:"Entrega Parcial",    color:G.blue,   icon:"📦" },
  atraso:  { label:"Atraso na Entrega",  color:G.orange, icon:"⚠️" },
  manual:  { label:"Tarefa Manual",      color:G.muted,  icon:"📌" },
};

const ROLES = {
  coordenador:"Coordenador de Suprimentos", comprador:"Comprador",
  almoxarife:"Almoxarife", aux_almoxarife:"Auxiliar de Almoxarife",
  aprovador:"Aprovador", juridico:"Jurídico", fiscal:"Fiscal",
  aux_engenharia:"Auxiliar de Engenharia", coord_obras:"Coordenador de Obras",
  gestor_obras:"Gestor de Obras", diretor_eng:"Diretor de Engenharia",
  diretor_plan:"Diretor de Planejamento", gerente_fin:"Gerente Financeiro",
  coord_control:"Coordenador de Controladoria",
};

const RCOL = {
  coordenador:G.greenDark, comprador:G.green, almoxarife:G.blue,
  aux_almoxarife:"#42A5F5", aprovador:G.gold, juridico:G.red,
  fiscal:G.orange, aux_engenharia:"#26A69A", coord_obras:"#7E57C2",
  gestor_obras:"#5C6BC0", diretor_eng:"#D81B60", diretor_plan:"#6D4C41",
  gerente_fin:"#00897B", coord_control:"#F4511E",
};

const USERS0 = [
  {id:1,name:"Flávio Silva",email:"flavio@amorimcoutinho.com.br",role:"coordenador",avatar:"FS",active:true,obras:[]},
  {id:2,name:"Francisco Cunha",email:"francisco@amorimcoutinho.com.br",role:"comprador",avatar:"FC",active:true,obras:[]},
  {id:3,name:"Felipe Vitorino",email:"felipe@amorimcoutinho.com.br",role:"comprador",avatar:"FV",active:true,obras:[]},
  {id:4,name:"Cristiano Teixeira",email:"cristiano@amorimcoutinho.com.br",role:"aprovador",avatar:"CT",active:true,obras:[]},
  {id:5,name:"Graça Macedo",email:"graca@amorimcoutinho.com.br",role:"almoxarife",avatar:"GM",active:true,obras:[1,3,7,10]},
  {id:6,name:"Caio Monteiro",email:"caio@amorimcoutinho.com.br",role:"almoxarife",avatar:"CM",active:true,obras:[2,5,8]},
  {id:7,name:"Vicente Nascimento",email:"vicente@amorimcoutinho.com.br",role:"almoxarife",avatar:"VN",active:true,obras:[4,6,9]},
  {id:8,name:"Nayara Couto",email:"nayara@amorimcoutinho.com.br",role:"juridico",avatar:"NC",active:true,obras:[]},
];

const OBRAS0 = [
  {id:1,code:"235",name:"Residencial Maracanã",city:"São Luís",state:"MA",almoxarife:5,active:true},
  {id:2,code:"245",name:"Residencial Primavera",city:"Imperatriz",state:"MA",almoxarife:6,active:true},
  {id:3,code:"252",name:"Residencial Açaí",city:"Timon",state:"MA",almoxarife:5,active:true},
  {id:4,code:"259",name:"Residencial Babaçu",city:"Caxias",state:"MA",almoxarife:7,active:true},
  {id:5,code:"265",name:"Talmir Rosa 2, 3 e 5",city:"Caxias",state:"MA",almoxarife:6,active:true},
  {id:6,code:"268",name:"Residencial Maragogi",city:"São Luís",state:"MA",almoxarife:7,active:true},
  {id:7,code:"269",name:"Residencial Buriti",city:"Bacabal",state:"MA",almoxarife:5,active:true},
  {id:8,code:"274",name:"Residencial Miriti",city:"São Luís",state:"MA",almoxarife:6,active:true},
  {id:9,code:"280",name:"Residencial Upaon",city:"São Luís",state:"MA",almoxarife:7,active:true},
  {id:10,code:"281",name:"Residencial Cupuaçu",city:"São Luís",state:"MA",almoxarife:5,active:true},
];

// ── UTILS ────────────────────────────────────────────────────────────────────
const uid   = () => Math.random().toString(36).slice(2,10);
const now   = () => new Date().toISOString();
const fmtD  = iso => iso ? new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
const fmtDT = iso => iso ? new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
const ld    = (k,fb) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };
const sv    = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };
const isAtrasado = p => p.previsaoEntrega && new Date(p.previsaoEntrega)<new Date() && !["entregue","cancelado"].includes(p.status);
const hashPass = async s => { const b=new TextEncoder().encode(s);const h=await crypto.subtle.digest("SHA-256",b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join(""); };

// ── ATOMS ────────────────────────────────────────────────────────────────────
function Av({s="?",size=32,color=G.green}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:size*.36,flexShrink:0,userSelect:"none"}}>{s}</div>;
}
function Chip({color,bg,children,style:sx={}}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:bg,color,border:"1px solid "+color+"30",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",...sx}}>{children}</span>;
}
function Toast({msg,onDone}){
  useEffect(()=>{if(!msg)return;const t=setTimeout(onDone,4000);return()=>clearTimeout(t);},[msg]);
  if(!msg)return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:G.greenDark,color:"#fff",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.22)",animation:"su .2s ease",maxWidth:400,textAlign:"center"}}>{msg}</div>;
}
const IB={width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:13,color:"#1A2B1A",background:"#fff",outline:"none",fontFamily:"Inter,sans-serif",boxSizing:"border-box",transition:"border-color .15s"};
function Inp({style:sx,...p}){const[f,sf]=useState(false);return<input {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;}
function Sel({children,style:sx,...p}){return<select {...p} style={{...IB,paddingRight:28,...sx}}>{children}</select>;}
function Txa({style:sx,...p}){const[f,sf]=useState(false);return<textarea {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,minHeight:72,resize:"vertical",borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;}
function Fld({label,required,children}){return<div style={{marginBottom:13}}><label style={{display:"block",fontSize:11,fontWeight:700,color:G.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{required&&<span style={{color:G.red}}> *</span>}</label>{children}</div>;}
function Btn({children,variant="primary",onClick,disabled,style:sx={},size="md"}){
  const pad={sm:"5px 12px",md:"9px 20px",lg:"12px 28px"}[size];
  const vars={primary:{background:G.green,color:"#fff",border:"none"},secondary:{background:"none",color:G.muted,border:"1.5px solid #DDE8DD"},danger:{background:G.red,color:"#fff",border:"none"},ghost:{background:"none",color:G.greenDark,border:"1.5px solid "+G.green}};
  return<button onClick={onClick} disabled={disabled} style={{padding:pad,borderRadius:8,fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1,transition:"opacity .15s",...vars[variant],...sx}}>{children}</button>;
}

// ── MODAL ────────────────────────────────────────────────────────────────────
function Modal({open,onClose,title,width=680,children}){
  useEffect(()=>{if(!open)return;const h=e=>e.key==="Escape"&&onClose();document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h);},[open,onClose]);
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(20,40,20,.5)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:G.surface,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"93vh",display:"flex",flexDirection:"column",boxShadow:"0 28px 72px rgba(0,0,0,.24)",animation:"su .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid "+G.border}}>
          <h2 style={{margin:0,fontSize:16,fontWeight:800,color:G.text}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:G.muted,lineHeight:1,padding:4}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"20px 24px"}}>{children}</div>
      </div>
    </div>
  );
}

function Logo({size=36}){
  return<svg width={size} height={size} viewBox="0 0 52 52"><rect x="0" y="0" width="23" height="23" rx="5" fill={G.green}/><rect x="29" y="0" width="23" height="23" rx="5" fill={G.red}/><rect x="0" y="29" width="23" height="23" rx="5" fill={G.gold}/><rect x="29" y="29" width="23" height="23" rx="5" fill="#222"/></svg>;
}

// ── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────
function buildNotifs(pedidos, tarefas, currentUser, obras) {
  const notifs = [];
  const isAlmox = ["almoxarife","aux_almoxarife"].includes(currentUser.role);
  const isComp  = ["comprador","coordenador"].includes(currentUser.role);

  pedidos.forEach(p => {
    const obra = obras.find(o=>String(o.id)===String(p.obra));
    const userObras = currentUser.obras || [];
    const pertenceAlmox = isAlmox && (obra && obra.almoxarife===currentUser.id);

    if (isAtrasado(p) && (isComp || pertenceAlmox)) {
      notifs.push({id:"atr_"+p.id,type:"atraso",icon:"⚠️",color:G.orange,text:"Pedido "+p.numero+" ("+p.fornecedor+") está atrasado",pedidoId:p.id});
    }
    if (p.status==="parcial" && (isComp || pertenceAlmox)) {
      notifs.push({id:"par_"+p.id,type:"parcial",icon:"📦",color:G.blue,text:"Pedido "+p.numero+" entregue parcialmente — itens pendentes",pedidoId:p.id});
    }
    if (p.status==="aguardando" && isComp && String(p.comprador)===String(currentUser.id)) {
      notifs.push({id:"bol_"+p.id,type:"boleto",icon:"🧾",color:G.purple,text:"Almoxarife solicitou boleto/NF do Pedido "+p.numero,pedidoId:p.id});
    }
    if (p.status==="entregue" && isComp && String(p.comprador)===String(currentUser.id)) {
      notifs.push({id:"ent_"+p.id,type:"entregue",icon:"✅",color:G.green,text:"Pedido "+p.numero+" confirmado entregue pelo almoxarife",pedidoId:p.id});
    }
  });

  tarefas.forEach(t => {
    if (t.status==="resolvida" && String(t.assignedTo)===String(currentUser.id)) {
      notifs.push({id:"tsk_"+t.id,type:"tarefa",icon:"🟢",color:G.green,text:"Tarefa concluída: "+t.title+" — verifique o retorno",tarefaId:t.id});
    }
    if (t.status==="andamento" && String(t.assignedTo)===String(currentUser.id)) {
      notifs.push({id:"tsk2_"+t.id,type:"tarefa",icon:"🟡",color:G.gold,text:"Tarefa em andamento: "+t.title,tarefaId:t.id});
    }
  });

  return notifs;
}

// ── RESET SENHA MODAL ─────────────────────────────────────────────────────────
function ResetSenhaModal({open,onClose,userId,users,onSave}){
  const [nova,setNova]=useState("");
  const [conf,setConf]=useState("");
  const [err,setErr]=useState("");
  const u=users.find(x=>x.id===userId);
  async function salvar(){
    if(!nova||nova.length<6){setErr("Mínima 6 caracteres.");return;}
    if(nova!==conf){setErr("Senhas não coincidem.");return;}
    const h=await hashPass(nova);
    onSave(userId,h);
    setNova("");setConf("");setErr("");
    onClose();
  }
  if(!u)return null;
  return(
    <Modal open={open} onClose={onClose} title={"Redefinir Senha — "+u.name} width={420}>
      <Fld label="Nova Senha"><Inp type="password" placeholder="Mínimo 6 caracteres" value={nova} onChange={e=>setNova(e.target.value)}/></Fld>
      <Fld label="Confirmar Senha"><Inp type="password" placeholder="Repita a senha" value={conf} onChange={e=>setConf(e.target.value)}/></Fld>
      {err&&<div style={{color:G.red,fontSize:13,marginBottom:10}}>{err}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={salvar}>Salvar Nova Senha</Btn>
      </div>
    </Modal>
  );
}

// ── PEDIDO FORM (PDF + manual) ────────────────────────────────────────────────
function PedidoForm({open,onClose,onSave,users,obras,cu}){
  const blank={numero:"",fornecedor:"",obra:"",comprador:String(cu.id),valor:"",previsaoEntrega:"",observacao:"",itens:[]};
  const [mode,setMode]=useState("pdf");
  const [f,setF]=useState(blank);
  const [pdfLoad,setPdfLoad]=useState(false);
  const [pdfName,setPdfName]=useState("");
  const [preview,setPreview]=useState(null);
  const [itensTxt,setItensTxt]=useState("");
  const [debugRaw,setDebugRaw]=useState("");
  const fileRef=useRef(null);

  useEffect(()=>{if(open){setF({...blank,comprador:String(cu.id)});setMode("pdf");setPdfName("");setPreview(null);setItensTxt("");}}, [open]);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const comps=users.filter(u=>["comprador","coordenador"].includes(u.role)&&u.active);

  async function handlePDF(e){
    const file=e.target.files?.[0]; if(!file)return;
    setPdfName(file.name); setPdfLoad(true); setPreview(null);
    const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=ev=>res(ev.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
    try{
      const resp=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-6",max_tokens:2000,
        system:"Você é um extrator de dados de documentos PDF. Leia o documento com atenção e retorne SOMENTE um objeto JSON válido, sem nenhum texto antes ou depois, sem markdown, sem explicações.",
        messages:[{role:"user",content:[
          {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
          {type:"text",text:`Leia este Pedido de Compra e extraia os dados abaixo. Retorne APENAS o JSON, sem texto adicional.

Campos a extrair:
- "numero": o valor após "Nº Pedido" ou "N° Pedido" (ex: "76895")
- "fornecedor": o Nome completo do fornecedor na seção "Dados do Fornecedor"
- "obra_code": APENAS o número da obra, ex: se aparecer "265 - RESIDENCIAL TALMIR ROSA" retorne "265"
- "obra_name": o nome completo da obra após o número
- "valor_total": o valor numérico do "TOTAL DO PEDIDO" sem R$ e sem pontos, use vírgula como decimal
- "data_entrega": a data de "Data Previsão" de entrega no formato YYYY-MM-DD. Se não houver, use a primeira data de "Datas Vencimento"
- "itens": array com TODOS os produtos/insumos da tabela, cada um com:
  - "descricao": nome do insumo/produto
  - "unidade": unidade de medida (rl, un, m2, kg, sc, m3, etc)
  - "quantidade": número (ex: 50)
  - "valor_unitario": preço unitário numérico
  - "valor_total": preço total do item numérico

Formato exato de retorno:
{"numero":"76895","fornecedor":"NOME DO FORNECEDOR","obra_code":"265","obra_name":"NOME DA OBRA","valor_total":"5708.50","data_entrega":"2026-06-25","itens":[{"descricao":"Nome do insumo","unidade":"rl","quantidade":50,"valor_unitario":"114.17","valor_total":"5708.50"}]}`}
        ]}]
      })});
      const data=await resp.json();
      const raw=data.content?.[0]?.text||"{}";
      console.log("IA response raw:", raw);
      setDebugRaw(raw);
      let parsed;
      try { parsed=JSON.parse(raw.replace(/```json|```/g,"").trim()); }
      catch(parseErr) {
        // try to extract JSON from response
        const jsonMatch=raw.match(/\{[\s\S]*\}/);
        if(jsonMatch) parsed=JSON.parse(jsonMatch[0]);
        else throw new Error("IA não retornou JSON válido: "+raw.slice(0,200));
      }
      const obraMatch=obras.find(o=>{
        const code=(parsed.obra_code||"").toString().trim();
        const name=(parsed.obra_name||"").toLowerCase();
        return o.code===code||o.code===code.split("-")[0].trim()||(name&&o.name.toLowerCase().includes(name.slice(0,8)))||(name&&name.includes(o.code));
      });
      const almox=obraMatch?users.find(u=>u.id===obraMatch.almoxarife):null;
      const itens=(parsed.itens||[]).map(it=>({id:uid(),descricao:it.descricao||"",unidade:it.unidade||"un",quantidade:Number(it.quantidade)||1,qtdEntregue:0,valorUnitario:String(it.valor_unitario||""),valorTotal:String(it.valor_total||""),status:"pendente"}));
      setF({numero:parsed.numero||"",fornecedor:parsed.fornecedor||"",obra:obraMatch?String(obraMatch.id):"",comprador:String(cu.id),valor:parsed.valor_total||"",previsaoEntrega:parsed.data_entrega||"",observacao:"",itens});
      setPreview({obraMatch,almox,parsed,itens});
    }catch(err){alert("Erro ao ler PDF: "+err.message);}
    setPdfLoad(false); e.target.value="";
  }

  function addItensManuais(){
    const novos=itensTxt.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>({id:uid(),descricao:l,unidade:"un",quantidade:1,qtdEntregue:0,valorUnitario:"",valorTotal:"",status:"pendente"}));
    setF(p=>({...p,itens:[...p.itens,...novos]})); setItensTxt("");
  }
  function removeItem(id){setF(p=>({...p,itens:p.itens.filter(x=>x.id!==id)}));}
  function updItem(id,k,v){setF(p=>({...p,itens:p.itens.map(x=>x.id===id?{...x,[k]:v}:x)}));}

  function submit(){
    if(!f.numero||!f.fornecedor){alert("Preencha Nº Pedido e Fornecedor.");return;}
    if(!f.obra){alert("Selecione a Obra.");return;}
    if(!f.comprador){alert("Selecione o Comprador.");return;}
    onSave(f); onClose();
  }

  const tabBtn=(m,label,icon)=>(
    <button onClick={()=>setMode(m)} style={{padding:"8px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:mode===m?G.green:G.alt,color:mode===m?"#fff":G.muted}}>{icon} {label}</button>
  );

  return(
    <Modal open={open} onClose={onClose} title="Novo Pedido de Compra" width={760}>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {tabBtn("pdf","Importar PDF do Sienge","📄")}
        {tabBtn("manual","Inserir Manualmente","✏️")}
      </div>

      {mode==="pdf"&&(
        <div>
          <div onClick={()=>fileRef.current?.click()} style={{border:"2px dashed "+(pdfName?G.green:G.border),borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:pdfName?"#E8F5E9":G.alt,marginBottom:16}}>
            {pdfLoad?(
              <div><div style={{fontSize:32,marginBottom:8}}>🤖</div><div style={{fontWeight:700,color:G.green,fontSize:14}}>IA lendo o PDF…</div><div style={{fontSize:12,color:G.muted,marginTop:4}}>Extraindo pedido, obra, fornecedor e insumos</div></div>
            ):pdfName?(
              <div><div style={{fontSize:32,marginBottom:8}}>✅</div><div style={{fontWeight:700,color:G.greenDark,fontSize:14}}>{pdfName}</div><div style={{fontSize:12,color:G.muted,marginTop:4}}>Clique para substituir</div></div>
            ):(
              <div><div style={{fontSize:40,marginBottom:8}}>📄</div><div style={{fontWeight:700,color:G.muted,fontSize:14}}>Clique para selecionar o PDF do Sienge</div><div style={{fontSize:12,color:G.light,marginTop:4}}>A IA preenche tudo automaticamente</div></div>
            )}
            <input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={handlePDF}/>
          </div>

          {preview&&(
            <div style={{background:"#E8F5E9",border:"1px solid "+G.greenLight,borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:13,color:G.greenDark,marginBottom:8}}>✅ Dados extraídos com sucesso</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8}}>
                {[["Pedido",f.numero],["Fornecedor",f.fornecedor],["Obra",preview.obraMatch?preview.obraMatch.code+" — "+preview.obraMatch.name:(preview.parsed.obra_code||"Não identificada")],["Almoxarife",preview.almox?.name||"—"],["Valor Total",f.valor?"R$ "+f.valor:"—"],["Itens",f.itens.length+" insumos"]].map(([l,v])=>(
                  <div key={l} style={{background:"#fff",borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase"}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:600,color:G.text,marginTop:2}}>{v||"—"}</div>
                  </div>
                ))}
              </div>
              {!preview.obraMatch&&<div style={{background:"#FFF8E1",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#5D4037"}}>⚠️ Obra não identificada automaticamente — selecione abaixo.</div>}
            </div>
          )}
          {debugRaw&&!preview&&(
            <div style={{background:"#FFF8E1",border:"1px solid "+G.gold+"60",borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:12,color:G.goldDark,marginBottom:6}}>⚠️ Resposta bruta da IA (para diagnóstico):</div>
              <pre style={{fontSize:11,color:G.text,whiteSpace:"pre-wrap",wordBreak:"break-all",maxHeight:200,overflowY:"auto",background:"#fff",padding:8,borderRadius:6}}>{debugRaw.slice(0,1000)}</pre>
            </div>
          )}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Fld label="Nº Pedido" required><Inp placeholder="76895" value={f.numero} onChange={e=>set("numero",e.target.value)}/></Fld>
        <Fld label="Fornecedor" required><Inp placeholder="Nome do fornecedor" value={f.fornecedor} onChange={e=>set("fornecedor",e.target.value)}/></Fld>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Fld label="Obra" required>
          <Sel value={f.obra} onChange={e=>set("obra",e.target.value)}>
            <option value="">Selecionar obra…</option>
            {obras.filter(o=>o.active).map(o=>{
              const alm=users.find(u=>u.id===o.almoxarife);
              return<option key={o.id} value={o.id}>{o.code} — {o.name} ({alm?.name||"sem almox."})</option>;
            })}
          </Sel>
        </Fld>
        <Fld label="Comprador Responsável" required>
          <Sel value={f.comprador} onChange={e=>set("comprador",e.target.value)}>
            {comps.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </Sel>
        </Fld>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Fld label="Valor Total (R$)"><Inp placeholder="0,00" value={f.valor} onChange={e=>set("valor",e.target.value)}/></Fld>
        <Fld label="Previsão de Entrega"><Inp type="date" value={f.previsaoEntrega} onChange={e=>set("previsaoEntrega",e.target.value)}/></Fld>
      </div>
      <Fld label="Observações"><Txa rows={2} value={f.observacao} onChange={e=>set("observacao",e.target.value)}/></Fld>

      <div style={{marginTop:4}}>
        <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:8}}>Insumos ({f.itens.length})</div>
        <div style={{background:G.alt,borderRadius:10,padding:12,marginBottom:10}}>
          <div style={{fontSize:12,color:G.muted,marginBottom:6}}>Adicionar itens manualmente (um por linha):</div>
          <Txa rows={2} value={itensTxt} onChange={e=>setItensTxt(e.target.value)} placeholder={"Cimento CP2 — 100 sacos\nAreia média — 5 m³"}/>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}><Btn size="sm" variant="ghost" onClick={addItensManuais}>+ Adicionar</Btn></div>
        </div>
        {f.itens.length>0&&(
          <div style={{border:"1px solid "+G.border,borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 70px 80px 80px 28px",background:G.nav,padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",gap:6}}>
              <span>Descrição</span><span>Un.</span><span>Qtd.</span><span>Vl.Unit.</span><span></span>
            </div>
            {f.itens.map((it,i)=>(
              <div key={it.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 80px 80px 28px",padding:"7px 12px",borderTop:"1px solid "+G.border,background:i%2===0?"#fff":G.alt,alignItems:"center",gap:6}}>
                <input value={it.descricao} onChange={e=>updItem(it.id,"descricao",e.target.value)} style={{...IB,padding:"4px 8px",fontSize:12}}/>
                <input value={it.unidade} onChange={e=>updItem(it.id,"unidade",e.target.value)} style={{...IB,padding:"4px 8px",fontSize:12}}/>
                <input type="number" value={it.quantidade} onChange={e=>updItem(it.id,"quantidade",Number(e.target.value))} style={{...IB,padding:"4px 8px",fontSize:12}}/>
                <input value={it.valorUnitario} onChange={e=>updItem(it.id,"valorUnitario",e.target.value)} style={{...IB,padding:"4px 8px",fontSize:12}}/>
                <button onClick={()=>removeItem(it.id)} style={{background:"none",border:"none",cursor:"pointer",color:G.light,fontSize:16,padding:0}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={submit} disabled={pdfLoad}>Criar Pedido</Btn>
      </div>
    </Modal>
  );
}

// ── PEDIDO DETAIL ─────────────────────────────────────────────────────────────
function PedidoDetail({open,onClose,pedido,users,obras,cu,onStatus,onMsg,onAnexo,onBoleto,onUpdateItens,onEdit}){
  const [tab,setTab]=useState("itens");
  const [msg,setMsg]=useState("");
  const [aiLoad,setAiLoad]=useState(false);
  const [filtro,setFiltro]=useState("todos");
  const chatRef=useRef(null);
  const fileRef=useRef(null);
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[pedido?.messages?.length]);
  useEffect(()=>{if(open)setTab("itens");},[open]);
  if(!pedido)return null;

  const obra=obras.find(o=>String(o.id)===String(pedido.obra));
  const alm=obra?users.find(u=>u.id===obra.almoxarife):null;
  const comp=users.find(u=>String(u.id)===String(pedido.comprador));
  const cfg=STATUS[isAtrasado(pedido)?"atrasado":pedido.status]||STATUS.pendente;
  const isAlmox=["almoxarife","aux_almoxarife","coordenador"].includes(cu.role);
  const isComp=["comprador","coordenador"].includes(cu.role);
  const itens=pedido.itens||[];
  const nTotal=itens.length,nEnt=itens.filter(i=>i.status==="entregue").length,nPar=itens.filter(i=>i.status==="parcial").length,nPend=itens.filter(i=>i.status==="pendente").length;
  const pct=nTotal>0?Math.round(((nEnt+nPar*0.5)/nTotal)*100):0;

  const ISTAT={pendente:{label:"Pendente",color:G.gold,bg:"#FFF8E1",icon:"⏳"},parcial:{label:"Parcial",color:G.blue,bg:"#E3F2FD",icon:"📦"},entregue:{label:"Entregue",color:G.green,bg:"#E8F5E9",icon:"✅"}};

  function marcarItem(id,novoStatus,qtdEntregue){
    const novos=itens.map(it=>it.id===id?{...it,status:novoStatus,qtdEntregue:qtdEntregue??it.qtdEntregue,updatedBy:cu.name,updatedAt:now()}:it);
    const ne=novos.filter(i=>i.status==="entregue").length,np=novos.filter(i=>i.status==="pendente").length;
    const ns=nTotal>0?(ne===nTotal?"entregue":np===nTotal?"pendente":"parcial"):pedido.status;
    onUpdateItens(pedido.id,novos,ns);
    onMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:(novoStatus==="entregue"?"✅ Entregue: ":"📦 Parcial: ")+itens.find(i=>i.id===id)?.descricao+(novoStatus==="parcial"?" ("+qtdEntregue+" "+itens.find(i=>i.id===id)?.unidade+")":""),type:"sistema",createdAt:now()});
  }

  function marcarTodos(ns){
    const novos=itens.map(it=>({...it,status:ns,qtdEntregue:ns==="entregue"?it.quantidade:0,updatedBy:cu.name,updatedAt:now()}));
    onUpdateItens(pedido.id,novos,ns==="entregue"?"entregue":"pendente");
    onMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:ns==="entregue"?"✅ Todos os itens marcados como entregues":"⏳ Todos os itens revertidos para pendente",type:"sistema",createdAt:now()});
  }

  function setQtdParcial(id,qtd){
    const it=itens.find(i=>i.id===id); if(!it)return;
    const q=Math.min(Number(qtd),it.quantidade);
    marcarItem(id,q<=0?"pendente":q>=it.quantidade?"entregue":"parcial",q);
  }

  async function send(){
    if(!msg.trim())return;
    const txt=msg.trim();setMsg("");
    onMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:txt,type:"chat",createdAt:now()});
    const lo=txt.toLowerCase();
    if(lo.includes("boleto")||lo.includes("nota fiscal")){onBoleto(pedido.id);onMsg(pedido.id,{id:uid(),userId:0,userName:"IA FACTEN",avatar:"IA",text:"🤖 Solicitação de boleto/NF registrada.",type:"ia",createdAt:now()});}
    else if(lo.includes("cancelad")){onStatus(pedido.id,"cancelado");onMsg(pedido.id,{id:uid(),userId:0,userName:"IA FACTEN",avatar:"IA",text:"🤖 Pedido marcado como Cancelado.",type:"ia",createdAt:now()});}
  }

  async function askAI(){
    setAiLoad(true);
    const pendList=itens.filter(i=>i.status!=="entregue").map(i=>i.descricao).join(", ");
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,system:"Assistente de logística FACTEN – Amorim Coutinho. Objetivo, português.",messages:[{role:"user",content:"Pedido "+pedido.numero+" | "+pedido.fornecedor+" | Obra: "+(obra?.name||"")+" | Status: "+cfg.label+" | "+nEnt+"/"+nTotal+" entregues\nPendentes: "+pendList+"\nSugira próximos passos em 3 linhas."}]})});
      const d=await r.json();
      onMsg(pedido.id,{id:uid(),userId:0,userName:"IA FACTEN",avatar:"IA",text:"🤖 "+(d.content?.[0]?.text||"Sem resposta."),type:"ia",createdAt:now()});
    }catch{onMsg(pedido.id,{id:uid(),userId:0,userName:"IA FACTEN",avatar:"IA",text:"🤖 Erro de conexão.",type:"ia",createdAt:now()});}
    setAiLoad(false);
  }

  function handleFile(e){
    Array.from(e.target.files).forEach(file=>{
      const r=new FileReader();
      r.onload=ev=>{onAnexo(pedido.id,{id:uid(),name:file.name,data:ev.target.result,by:cu.name,createdAt:now()});onMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"📎 Arquivo: **"+file.name+"**",type:"anexo",createdAt:now()});};
      r.readAsDataURL(file);
    });e.target.value="";
  }

  const tabBtnS=(k)=>({padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:tab===k?G.green:G.alt,color:tab===k?"#fff":G.muted});
  const itensFiltrados=itens.filter(it=>filtro==="todos"?true:filtro==="pendente"?(it.status==="pendente"||it.status==="parcial"):it.status==="entregue");

  return(
    <Modal open={open} onClose={onClose} title={"Pedido "+pedido.numero+" — "+pedido.fornecedor} width={880}>
      {/* header strip */}
      <div style={{background:cfg.bg,border:"1px solid "+cfg.color+"30",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{cfg.icon}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:cfg.color}}>{cfg.label}</div>
            <div style={{fontSize:11,color:G.muted}}>Criado em {fmtD(pedido.createdAt)} por {pedido.createdBy}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {nTotal>0&&<div style={{textAlign:"right"}}><div style={{fontSize:11,color:G.muted,marginBottom:2}}>{nEnt}/{nTotal} entregues</div><div style={{background:G.border,borderRadius:4,height:6,width:120,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:G.green,width:pct+"%"}}/></div></div>}
          {isAtrasado(pedido)&&<Chip color={G.orange} bg="#FBE9E7">⚠️ Atrasado</Chip>}
          {isComp&&<Btn variant="ghost" size="sm" onClick={()=>onEdit(pedido)}>✏️ Editar</Btn>}
        </div>
      </div>

      {/* info grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
        {[{label:"Obra",value:obra?obra.code+" — "+obra.name:"—"},{label:"Almoxarife",value:alm?.name||"—",color:G.blue},{label:"Comprador",value:comp?.name||"—",color:G.green},{label:"Valor",value:pedido.valor?"R$ "+pedido.valor:"—"},{label:"Prev. Entrega",value:fmtD(pedido.previsaoEntrega)},{label:"Observações",value:pedido.observacao||"—"}].map(row=>(
          <div key={row.label} style={{background:G.alt,borderRadius:8,padding:"8px 12px"}}>
            <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>{row.label}</div>
            <div style={{fontSize:12,fontWeight:600,color:row.color||G.text}}>{row.value}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        <button style={tabBtnS("itens")} onClick={()=>setTab("itens")}>📦 Insumos {nTotal>0&&"("+nEnt+"/"+nTotal+")"}</button>
        <button style={tabBtnS("chat")} onClick={()=>setTab("chat")}>💬 Chat {pedido.messages?.length>0&&"("+pedido.messages.length+")"}</button>
        {pedido.anexos?.length>0&&<button style={tabBtnS("anexos")} onClick={()=>setTab("anexos")}>📎 Anexos ({pedido.anexos.length})</button>}
      </div>

      {/* TAB ITENS */}
      {tab==="itens"&&(
        <div>
          {nTotal===0?<div style={{textAlign:"center",padding:"40px 0",color:G.light}}><div style={{fontSize:36}}>📋</div><div style={{fontSize:14,fontWeight:600,marginTop:8}}>Nenhum insumo cadastrado</div></div>:(
            <>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:6}}>
                  {[["todos","Todos",nTotal],["pendente","Pendentes",nPend+nPar],["entregue","Entregues",nEnt]].map(([k,l,n])=>(
                    <button key={k} onClick={()=>setFiltro(k)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filtro===k?G.green:G.alt,color:filtro===k?"#fff":G.muted}}>{l} ({n})</button>
                  ))}
                </div>
                <div style={{flex:1}}/>
                {isAlmox&&<div style={{display:"flex",gap:6}}>
                  <button onClick={()=>marcarTodos("entregue")} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",background:G.green,color:"#fff",fontSize:12,fontWeight:700}}>✅ Marcar todos entregues</button>
                  <button onClick={()=>marcarTodos("pendente")} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid "+G.border,cursor:"pointer",background:"none",color:G.muted,fontSize:12,fontWeight:700}}>↩ Reverter todos</button>
                  <button onClick={()=>{onBoleto(pedido.id);onMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"🧾 Almoxarife solicitou boleto/NF.",type:"sistema",createdAt:now()});}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid "+G.purple,cursor:"pointer",background:"none",color:G.purple,fontSize:12,fontWeight:700}}>🧾 Solicitar Boleto</button>
                </div>}
              </div>

              {/* progresso */}
              <div style={{background:G.alt,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:16,alignItems:"center"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:G.muted,marginBottom:4}}><span>Progresso</span><span style={{fontWeight:700,color:G.greenDark}}>{pct}%</span></div>
                  <div style={{background:"#fff",borderRadius:6,height:10,overflow:"hidden"}}><div style={{height:"100%",borderRadius:6,background:"linear-gradient(90deg,"+G.green+","+G.greenDark+")",width:pct+"%",transition:"width .4s"}}/></div>
                </div>
                {[["✅",nEnt,G.green,"Entregues"],["📦",nPar,G.blue,"Parciais"],["⏳",nPend,G.gold,"Pendentes"]].map(([ic,n,col,lb])=>(
                  <div key={lb} style={{textAlign:"center"}}><div style={{fontSize:18}}>{ic}</div><div style={{fontSize:16,fontWeight:800,color:col}}>{n}</div><div style={{fontSize:9,color:G.muted,textTransform:"uppercase"}}>{lb}</div></div>
                ))}
              </div>

              {/* table */}
              <div style={{border:"1px solid "+G.border,borderRadius:10,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 60px 80px 80px 160px",background:G.nav,padding:"9px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",gap:8}}>
                  <span>Insumo</span><span>Un.</span><span>Total</span><span>Entregue</span><span>Status / Ação</span>
                </div>
                {itensFiltrados.map((it,idx)=>{
                  const ist=ISTAT[it.status]||ISTAT.pendente;
                  return(
                    <div key={it.id} style={{display:"grid",gridTemplateColumns:"1fr 60px 80px 80px 160px",padding:"10px 14px",borderTop:"1px solid "+G.border,background:idx%2===0?"#fff":G.alt,alignItems:"center",gap:8}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{it.descricao}</div>
                        {it.updatedBy&&<div style={{fontSize:10,color:G.light}}>Por {it.updatedBy} · {fmtD(it.updatedAt)}</div>}
                      </div>
                      <div style={{fontSize:13,color:G.muted}}>{it.unidade}</div>
                      <div style={{fontSize:13,fontWeight:600}}>{it.quantidade}</div>
                      <div>
                        {isAlmox?(
                          <input type="number" min="0" max={it.quantidade} value={it.qtdEntregue||0} onChange={e=>setQtdParcial(it.id,e.target.value)} style={{...IB,width:70,padding:"4px 8px",fontSize:13,textAlign:"center"}}/>
                        ):<span style={{fontSize:13}}>{it.qtdEntregue||0}</span>}
                      </div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                        <Chip color={ist.color} bg={ist.bg}>{ist.icon} {ist.label}</Chip>
                        {isAlmox&&it.status!=="entregue"&&<button onClick={()=>marcarItem(it.id,"entregue",it.quantidade)} style={{padding:"3px 8px",borderRadius:6,border:"none",cursor:"pointer",background:G.green+"22",color:G.greenDark,fontSize:11,fontWeight:700}}>✅</button>}
                        {isAlmox&&it.status==="entregue"&&<button onClick={()=>marcarItem(it.id,"pendente",0)} style={{padding:"3px 8px",borderRadius:6,border:"none",cursor:"pointer",background:G.gold+"22",color:G.goldDark,fontSize:11,fontWeight:700}}>↩</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CHAT */}
      {tab==="chat"&&(
        <div>
          <div ref={chatRef} style={{background:G.alt,borderRadius:10,padding:12,minHeight:180,maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {!(pedido.messages?.length)&&<div style={{color:G.light,fontSize:13,textAlign:"center",marginTop:40}}>Sem mensagens ainda.</div>}
            {(pedido.messages||[]).map(m=>(
              <div key={m.id} style={{display:"flex",gap:8}}>
                <Av s={m.avatar} size={26} color={m.type==="ia"?G.greenDark:m.type==="sistema"?G.gold:G.green}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:G.muted,marginBottom:2}}><strong style={{color:m.type==="ia"?G.greenDark:G.text}}>{m.userName}</strong> · {fmtDT(m.createdAt)}</div>
                  <div style={{fontSize:13,background:m.type==="ia"?"#E8F5E9":m.type==="sistema"?"#FFF8E1":"#fff",borderRadius:8,padding:"7px 10px",border:"1px solid "+(m.type==="ia"?"#A5D6A760":"#e0e0e0"),color:m.type==="ia"?G.greenDark:G.text,lineHeight:1.55}} dangerouslySetInnerHTML={{__html:m.text.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}}/>
                </div>
              </div>
            ))}
            {aiLoad&&<div style={{display:"flex",gap:8,alignItems:"center"}}><Av s="IA" size={26} color={G.greenDark}/><span style={{fontSize:12,color:G.greenDark,fontStyle:"italic"}}>IA digitando…</span></div>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())} placeholder='Mensagem, "boleto", "cancelado"…' style={{...IB,flex:1,height:38,fontSize:13}}/>
            <Btn onClick={send}>Enviar</Btn>
            <button onClick={()=>fileRef.current?.click()} style={{padding:"0 12px",height:38,borderRadius:8,border:"1.5px solid #DDE8DD",background:"none",cursor:"pointer",fontSize:18}}>📎</button>
            <button onClick={askAI} disabled={aiLoad} style={{padding:"0 12px",height:38,borderRadius:8,border:"1.5px solid "+G.green,background:G.alt,cursor:"pointer",fontSize:12,fontWeight:700,color:G.greenDark,whiteSpace:"nowrap"}}>🤖 IA</button>
            <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={handleFile}/>
          </div>
        </div>
      )}

      {/* TAB ANEXOS */}
      {tab==="anexos"&&(
        <div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {(pedido.anexos||[]).map(a=><a key={a.id} href={a.data} download={a.name} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",background:G.alt,border:"1px solid "+G.border,borderRadius:10,fontSize:13,color:G.green,textDecoration:"none",fontWeight:600}}>📎 {a.name}</a>)}
          </div>
          <button onClick={()=>fileRef.current?.click()} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid "+G.green,background:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:G.green}}>+ Adicionar Anexo</button>
          <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={handleFile}/>
        </div>
      )}
    </Modal>
  );
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({open,onClose,users,obras,setUsers,setObras,toast}){
  const [tab,setTab]=useState("obras");
  const [showReset,setShowReset]=useState(null);
  const oBlank={code:"",name:"",city:"",state:"MA",almoxarife:"",active:true};
  const [oForm,setOForm]=useState(oBlank);
  const [oEdit,setOEdit]=useState(null);
  const setO=(k,v)=>setOForm(p=>({...p,[k]:v}));
  const almoxs=users.filter(u=>u.role==="almoxarife"&&u.active);

  function saveObra(){
    if(!oForm.code||!oForm.name){alert("Código e nome obrigatórios.");return;}
    if(oEdit){setObras(o=>o.map(x=>x.id===oEdit?{...x,...oForm}:x));toast("Obra atualizada!");}
    else{setObras(o=>[...o,{...oForm,id:Date.now()}]);toast("Obra adicionada!");}
    setOEdit(null);setOForm(oBlank);
    // sync almoxarife obras list
    if(oForm.almoxarife){
      setUsers(u=>u.map(x=>x.id===Number(oForm.almoxarife)?{...x,obras:[...(x.obras||[]).filter(o=>o!==oEdit),oEdit||Date.now()]}:x));
    }
  }
  function toggleObra(id){setObras(o=>o.map(x=>x.id===id?{...x,active:!x.active}:x));toast("Atualizado!");}

  const uBlank={name:"",email:"",role:"comprador",active:true,obras:[]};
  const [uForm,setUForm]=useState(uBlank);
  const [uEdit,setUEdit]=useState(null);
  const setU=(k,v)=>setUForm(p=>({...p,[k]:v}));

  function saveUser(){
    if(!uForm.name||!uForm.email){alert("Nome e e-mail obrigatórios.");return;}
    const av=uForm.name.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    if(uEdit){setUsers(u=>u.map(x=>x.id===uEdit?{...x,...uForm,avatar:av}:x));toast("Usuário atualizado!");}
    else{setUsers(u=>[...u,{...uForm,id:Date.now(),avatar:av,senhaHash:""}]);toast("Usuário adicionado! Defina a senha.");}
    setUEdit(null);setUForm(uBlank);
  }
  function toggleUser(id){setUsers(u=>u.map(x=>x.id===id?{...x,active:!x.active}:x));toast("Atualizado!");}
  function handleResetSave(id,hash){setUsers(u=>u.map(x=>x.id===id?{...x,senhaHash:hash}:x));toast("Senha redefinida com sucesso!");}

  // obras do almoxarife
  function toggleObraAlmox(userId,obraId){
    setUsers(u=>u.map(x=>{
      if(x.id!==userId)return x;
      const obras=x.obras||[];
      return{...x,obras:obras.includes(obraId)?obras.filter(o=>o!==obraId):[...obras,obraId]};
    }));
    // sync obra.almoxarife
    const user=users.find(x=>x.id===userId);
    if(user){
      const obraIds=user.obras||[];
      if(!obraIds.includes(obraId)){
        setObras(o=>o.map(x=>x.id===obraId?{...x,almoxarife:userId}:x));
      }
    }
    toast("Vínculo atualizado!");
  }

  const tabBtnStyle=(k)=>({padding:"8px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===k?G.green:G.alt,color:tab===k?"#fff":G.muted});

  return(
    <Modal open={open} onClose={onClose} title="⚙️ Configurações" width={940}>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button style={tabBtnStyle("obras")} onClick={()=>setTab("obras")}>🏗️ Obras</button>
        <button style={tabBtnStyle("users")} onClick={()=>setTab("users")}>👥 Usuários</button>
      </div>

      {tab==="obras"&&(
        <div style={{display:"flex",gap:16}}>
          <div style={{width:280,flexShrink:0,background:G.alt,borderRadius:12,padding:16}}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:14}}>{oEdit?"Editar Obra":"Nova Obra"}</div>
            <Fld label="Código" required><Inp placeholder="265" value={oForm.code} onChange={e=>setO("code",e.target.value)}/></Fld>
            <Fld label="Nome" required><Inp placeholder="Residencial…" value={oForm.name} onChange={e=>setO("name",e.target.value)}/></Fld>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"0 8px"}}>
              <Fld label="Cidade"><Inp value={oForm.city} onChange={e=>setO("city",e.target.value)}/></Fld>
              <Fld label="UF"><Inp value={oForm.state} maxLength={2} onChange={e=>setO("state",e.target.value.toUpperCase())}/></Fld>
            </div>
            <Fld label="Almoxarife Principal">
              <Sel value={oForm.almoxarife} onChange={e=>setO("almoxarife",Number(e.target.value))}>
                <option value="">Selecionar…</option>
                {almoxs.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </Sel>
            </Fld>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <input type="checkbox" id="oa" checked={oForm.active} onChange={e=>setO("active",e.target.checked)}/>
              <label htmlFor="oa" style={{fontSize:13}}>Ativa</label>
            </div>
            <div style={{display:"flex",gap:8}}>
              {oEdit&&<Btn variant="secondary" onClick={()=>{setOEdit(null);setOForm(oBlank);}}>Cancelar</Btn>}
              <Btn onClick={saveObra} style={{flex:1}}>{oEdit?"Salvar":"Adicionar"}</Btn>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",maxHeight:480}}>
            {obras.map(o=>{
              const alm=users.find(u=>u.id===o.almoxarife);
              return(
                <div key={o.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,marginBottom:6,background:o.active?G.surface:"#f5f5f5",border:"1px solid "+G.border,opacity:o.active?1:.65}}>
                  <div style={{width:44,height:44,borderRadius:10,background:G.green+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:G.greenDark}}>{o.code}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14}}>{o.name}</div>
                    <div style={{fontSize:12,color:G.muted}}>{o.city}, {o.state} · Almox: {alm?.name||"—"}</div>
                  </div>
                  <Btn size="sm" variant="secondary" onClick={()=>{setOEdit(o.id);setOForm({...o});}}>Editar</Btn>
                  <button onClick={()=>toggleObra(o.id)} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid "+(o.active?G.red:G.green),background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:o.active?G.red:G.green}}>{o.active?"Desativar":"Ativar"}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="users"&&(
        <div style={{display:"flex",gap:16}}>
          <div style={{width:290,flexShrink:0,background:G.alt,borderRadius:12,padding:16}}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:14}}>{uEdit?"Editar Usuário":"Novo Usuário"}</div>
            <Fld label="Nome" required><Inp value={uForm.name} onChange={e=>setU("name",e.target.value)}/></Fld>
            <Fld label="E-mail (usado no acesso)" required><Inp type="email" value={uForm.email} onChange={e=>setU("email",e.target.value)}/></Fld>
            <Fld label="Perfil">
              <Sel value={uForm.role} onChange={e=>setU("role",e.target.value)}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </Sel>
            </Fld>
            {["almoxarife","aux_almoxarife"].includes(uForm.role)&&(
              <Fld label="Obras vinculadas">
                <div style={{background:"#fff",borderRadius:8,padding:"8px 10px",maxHeight:120,overflowY:"auto"}}>
                  {obras.filter(o=>o.active).map(o=>(
                    <label key={o.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",fontSize:12}}>
                      <input type="checkbox" checked={(uForm.obras||[]).includes(o.id)} onChange={()=>{const cur=uForm.obras||[];setU("obras",cur.includes(o.id)?cur.filter(x=>x!==o.id):[...cur,o.id]);}}/>
                      {o.code} — {o.name}
                    </label>
                  ))}
                </div>
              </Fld>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <input type="checkbox" id="ua" checked={uForm.active} onChange={e=>setU("active",e.target.checked)}/>
              <label htmlFor="ua" style={{fontSize:13}}>Ativo</label>
            </div>
            <div style={{display:"flex",gap:8}}>
              {uEdit&&<Btn variant="secondary" onClick={()=>{setUEdit(null);setUForm(uBlank);}}>Cancelar</Btn>}
              <Btn onClick={saveUser} style={{flex:1}}>{uEdit?"Salvar":"Adicionar"}</Btn>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",maxHeight:480}}>
            {users.map(u=>(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,marginBottom:6,background:u.active?G.surface:"#f5f5f5",border:"1px solid "+G.border,opacity:u.active?1:.65}}>
                <Av s={u.avatar} size={38} color={RCOL[u.role]||G.green}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14}}>{u.name}</div>
                  <div style={{fontSize:12,color:G.muted}}>{u.email||"—"}</div>
                  {["almoxarife","aux_almoxarife"].includes(u.role)&&(u.obras||[]).length>0&&(
                    <div style={{fontSize:11,color:G.blue,marginTop:2}}>Obras: {(u.obras||[]).map(id=>{const o=obras.find(x=>x.id===id);return o?o.code:null;}).filter(Boolean).join(", ")}</div>
                  )}
                </div>
                <Chip color={RCOL[u.role]||G.green} bg={(RCOL[u.role]||G.green)+"18"}>{ROLES[u.role]}</Chip>
                <Btn size="sm" variant="secondary" onClick={()=>{setUEdit(u.id);setUForm({...u,obras:u.obras||[]});}}>Editar</Btn>
                <button onClick={()=>setShowReset(u.id)} style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid "+G.gold,background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:G.goldDark}}>🔑 Senha</button>
                <button onClick={()=>toggleUser(u.id)} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid "+(u.active?G.red:G.green),background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:u.active?G.red:G.green}}>{u.active?"Desativar":"Ativar"}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ResetSenhaModal open={!!showReset} onClose={()=>setShowReset(null)} userId={showReset} users={users} onSave={(id,hash)=>{handleResetSave(id,hash);setShowReset(null);}}/>
    </Modal>
  );
}

// ── AGENDA ────────────────────────────────────────────────────────────────────
function Agenda({open,onClose,events,obras,cu,onSave,onDelete}){
  const blank={title:"",date:"",time:"",obra:"",desc:"",type:"entrega"};
  const [f,setF]=useState(blank);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const today=new Date().toISOString().slice(0,10);
  const upcoming=events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const past=events.filter(e=>e.date<today).sort((a,b)=>b.date.localeCompare(a.date));
  function save(){if(!f.title||!f.date){alert("Título e data obrigatórios.");return;}onSave(f);setF(blank);}
  const icons={entrega:"🚚",reuniao:"🤝",vencimento:"📅",outro:"📌"};
  return(
    <Modal open={open} onClose={onClose} title="📅 Agenda de Obras" width={820}>
      <div style={{display:"flex",gap:16}}>
        <div style={{width:280,flexShrink:0,background:G.alt,borderRadius:12,padding:16}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:14}}>Novo Evento</div>
          <Fld label="Tipo"><Sel value={f.type} onChange={e=>set("type",e.target.value)}><option value="entrega">🚚 Entrega</option><option value="reuniao">🤝 Reunião</option><option value="vencimento">📅 Vencimento</option><option value="outro">📌 Outro</option></Sel></Fld>
          <Fld label="Título" required><Inp value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Descreva o evento"/></Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 8px"}}>
            <Fld label="Data" required><Inp type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></Fld>
            <Fld label="Hora"><Inp type="time" value={f.time} onChange={e=>set("time",e.target.value)}/></Fld>
          </div>
          <Fld label="Obra"><Sel value={f.obra} onChange={e=>set("obra",e.target.value)}><option value="">Geral</option>{obras.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}</Sel></Fld>
          <Fld label="Detalhes"><Txa rows={2} value={f.desc} onChange={e=>set("desc",e.target.value)}/></Fld>
          <Btn onClick={save} style={{width:"100%"}}>Salvar Evento</Btn>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {upcoming.length>0&&<><div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:8}}>Próximos</div>
          {upcoming.map(ev=>{const o=obras.find(x=>String(x.id)===String(ev.obra));return(
            <div key={ev.id} style={{display:"flex",gap:12,padding:"12px 14px",borderRadius:10,marginBottom:6,background:G.surface,border:"1px solid "+G.border}}>
              <div style={{fontSize:24}}>{icons[ev.type]||"📌"}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{ev.title}</div><div style={{fontSize:12,color:G.muted}}>{fmtD(ev.date)}{ev.time?" às "+ev.time:""} · {o?"Obra "+o.code:"Geral"}</div>{ev.desc&&<div style={{fontSize:12,color:G.muted,marginTop:2}}>{ev.desc}</div>}</div>
              <button onClick={()=>onDelete(ev.id)} style={{background:"none",border:"none",cursor:"pointer",color:G.light,fontSize:18}}>✕</button>
            </div>
          );})}
          </>}
          {past.slice(0,4).map(ev=>{const o=obras.find(x=>String(x.id)===String(ev.obra));return(<div key={ev.id} style={{display:"flex",gap:12,padding:"10px 14px",borderRadius:10,marginBottom:4,background:"#fafafa",border:"1px solid #eee",opacity:.7}}><div style={{fontSize:20}}>{icons[ev.type]||"📌"}</div><div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:G.muted}}>{ev.title}</div><div style={{fontSize:11,color:G.light}}>{fmtD(ev.date)} · {o?"Obra "+o.code:"Geral"}</div></div></div>);})}
          {events.length===0&&<div style={{color:G.light,textAlign:"center",marginTop:60,fontSize:14}}>Sem eventos cadastrados.</div>}
        </div>
      </div>
    </Modal>
  );
}

// ── ATAS ──────────────────────────────────────────────────────────────────────
function Atas({open,onClose,atas,obras,cu,onSave}){
  const [view,setView]=useState("list");
  const [f,setF]=useState({title:"",obra:"",date:new Date().toISOString().slice(0,10),participantes:"",pauta:"",deliberacoes:"",proxReuniao:""});
  const [gen,setGen]=useState("");const [genLoad,setGenLoad]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  async function generate(){
    setGenLoad(true);
    try{const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:"Assistente FACTEN – Amorim Coutinho. Gere atas formais em português.",messages:[{role:"user",content:"Ata formal:\nTítulo: "+f.title+"\nData: "+f.date+"\nParticipantes: "+f.participantes+"\nPauta: "+f.pauta+"\nDeliberações: "+f.deliberacoes+"\nPróxima reunião: "+f.proxReuniao}]})});
    const d=await r.json();setGen(d.content?.[0]?.text||"Erro.");}catch{setGen("Erro de conexão.");}
    setGenLoad(false);
  }
  function saveAta(){if(!f.title||!f.date){alert("Título e data obrigatórios.");return;}onSave({...f,content:gen,createdBy:cu.name,id:uid(),createdAt:now()});setView("list");setF({title:"",obra:"",date:new Date().toISOString().slice(0,10),participantes:"",pauta:"",deliberacoes:"",proxReuniao:""});setGen("");}
  return(
    <Modal open={open} onClose={onClose} title="📄 Atas de Reunião" width={820}>
      {view==="list"?(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}><Btn onClick={()=>setView("new")}>+ Nova Ata</Btn></div>
          {atas.length===0&&<div style={{color:G.light,textAlign:"center",marginTop:60}}>Nenhuma ata registrada.</div>}
          {atas.map(a=>{const o=obras.find(x=>String(x.id)===String(a.obra));return(<div key={a.id} style={{padding:"14px 16px",borderRadius:10,marginBottom:8,background:G.surface,border:"1px solid "+G.border}}><div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{a.title}</div><div style={{fontSize:12,color:G.muted}}>{fmtD(a.date)} · {o?"Obra "+o.code+" — "+o.name:"Geral"} · {a.createdBy}</div>{a.content&&<div style={{marginTop:8,fontSize:12,color:G.muted,whiteSpace:"pre-line",maxHeight:64,overflow:"hidden"}}>{a.content.slice(0,200)}…</div>}</div>);})}
        </div>
      ):(
        <div>
          <button onClick={()=>setView("list")} style={{background:"none",border:"none",cursor:"pointer",color:G.muted,fontSize:13,marginBottom:16,padding:0}}>← Voltar</button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Fld label="Título" required><Inp value={f.title} onChange={e=>set("title",e.target.value)}/></Fld>
            <Fld label="Data" required><Inp type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></Fld>
          </div>
          <Fld label="Obra"><Sel value={f.obra} onChange={e=>set("obra",e.target.value)}><option value="">Geral</option>{obras.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}</Sel></Fld>
          <Fld label="Participantes"><Txa rows={2} value={f.participantes} onChange={e=>set("participantes",e.target.value)}/></Fld>
          <Fld label="Pauta"><Txa rows={2} value={f.pauta} onChange={e=>set("pauta",e.target.value)}/></Fld>
          <Fld label="Deliberações"><Txa rows={2} value={f.deliberacoes} onChange={e=>set("deliberacoes",e.target.value)}/></Fld>
          <Fld label="Próxima Reunião"><Inp type="date" value={f.proxReuniao} onChange={e=>set("proxReuniao",e.target.value)}/></Fld>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <Btn variant="ghost" onClick={generate} disabled={genLoad} style={{flex:1}}>{genLoad?"🤖 Gerando…":"🤖 Gerar com IA"}</Btn>
            <Btn onClick={saveAta} style={{flex:1}}>Salvar Ata</Btn>
          </div>
          {gen&&<div style={{background:G.alt,borderRadius:10,padding:16,fontSize:13,whiteSpace:"pre-line",lineHeight:1.7,maxHeight:280,overflowY:"auto",border:"1px solid "+G.border}}>{gen}</div>}
        </div>
      )}
    </Modal>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({pedidos,tarefas,users,obras,onOpenPedido}){
  const atrasados=pedidos.filter(isAtrasado);
  const byStatus=Object.entries(STATUS).filter(([k])=>k!=="atrasado").map(([k,v])=>({name:v.label.split(" ")[0],value:pedidos.filter(p=>p.status===k).length,color:v.color}));
  const byObra=obras.filter(o=>o.active).map(o=>({name:o.code,Entregues:pedidos.filter(p=>String(p.obra)===String(o.id)&&p.status==="entregue").length,Pendentes:pedidos.filter(p=>String(p.obra)===String(o.id)&&p.status==="pendente").length,total:pedidos.filter(p=>String(p.obra)===String(o.id)).length})).filter(o=>o.total>0).sort((a,b)=>b.total-a.total).slice(0,8);
  const byComp=users.filter(u=>u.role==="comprador"&&u.active).map(u=>({name:u.name.split(" ")[0],total:pedidos.filter(p=>String(p.comprador)===String(u.id)).length,entregue:pedidos.filter(p=>String(p.comprador)===String(u.id)&&p.status==="entregue").length}));
  const weekData=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const ds=d.toISOString().slice(0,10);return{day:d.toLocaleDateString("pt-BR",{weekday:"short"}),Criados:pedidos.filter(p=>p.createdAt?.slice(0,10)===ds).length,Entregues:pedidos.filter(p=>p.createdAt?.slice(0,10)===ds&&p.status==="entregue").length};});
  const cards=[
    {label:"Total Pedidos",value:pedidos.length,color:G.greenDark,icon:"📋",bg:"#E8F5E9"},
    {label:"Pendentes",value:pedidos.filter(p=>p.status==="pendente").length,color:G.gold,icon:"⏳",bg:"#FFF8E1"},
    {label:"Atrasados",value:atrasados.length,color:G.orange,icon:"⚠️",bg:"#FBE9E7"},
    {label:"Aguard. Boleto",value:pedidos.filter(p=>p.status==="aguardando").length,color:G.purple,icon:"🧾",bg:"#F3E5F5"},
    {label:"Entregues",value:pedidos.filter(p=>p.status==="entregue").length,color:G.green,icon:"✅",bg:"#E8F5E9"},
    {label:"Tarefas Abertas",value:tarefas.filter(t=>t.status==="aberta").length,color:G.red,icon:"🔴",bg:"#FFEBEE"},
  ];
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:12,marginBottom:24}}>
        {cards.map(c=><div key={c.label} style={{background:c.bg,borderRadius:14,padding:"18px 16px",border:"1px solid "+c.color+"25"}}><div style={{fontSize:26,marginBottom:6}}>{c.icon}</div><div style={{fontSize:30,fontWeight:800,color:c.color,lineHeight:1}}>{c.value}</div><div style={{fontSize:11,color:G.muted,fontWeight:600,marginTop:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>{c.label}</div></div>)}
      </div>
      {atrasados.length>0&&(
        <div style={{background:"#FBE9E7",border:"1px solid "+G.orange+"40",borderRadius:12,padding:"12px 16px",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:13,color:G.orange,marginBottom:8}}>⚠️ {atrasados.length} pedido{atrasados.length>1?"s":""} com entrega atrasada</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {atrasados.map(p=><button key={p.id} onClick={()=>onOpenPedido(p)} style={{padding:"5px 12px",borderRadius:8,border:"1px solid "+G.orange+"60",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:G.orange}}>Ped. {p.numero} — {p.fornecedor}</button>)}
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={{background:G.surface,borderRadius:14,padding:20,border:"1px solid "+G.border}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:16}}>Pedidos por Status</div>
          <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name,value})=>value>0?name+"("+value+")":""} labelLine={false} fontSize={11}>{byStatus.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
        </div>
        <div style={{background:G.surface,borderRadius:14,padding:20,border:"1px solid "+G.border}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:16}}>Atividade — 7 dias</div>
          <ResponsiveContainer width="100%" height={200}><LineChart data={weekData}><CartesianGrid strokeDasharray="3 3" stroke={G.border}/><XAxis dataKey="day" tick={{fontSize:11}} stroke={G.light}/><YAxis tick={{fontSize:11}} stroke={G.light}/><Tooltip/><Legend wrapperStyle={{fontSize:11}}/><Line type="monotone" dataKey="Criados" stroke={G.green} strokeWidth={2} dot={{r:3}}/><Line type="monotone" dataKey="Entregues" stroke={G.blue} strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <div style={{background:G.surface,borderRadius:14,padding:20,border:"1px solid "+G.border}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:16}}>Pedidos por Obra</div>
          <ResponsiveContainer width="100%" height={200}><BarChart data={byObra} barSize={18}><CartesianGrid strokeDasharray="3 3" stroke={G.border}/><XAxis dataKey="name" tick={{fontSize:11}} stroke={G.light}/><YAxis tick={{fontSize:11}} stroke={G.light}/><Tooltip/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="Entregues" fill={G.green} radius={[4,4,0,0]}/><Bar dataKey="Pendentes" fill={G.gold} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
        </div>
        <div style={{background:G.surface,borderRadius:14,padding:20,border:"1px solid "+G.border}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:16}}>Compradores</div>
          {byComp.length===0&&<div style={{color:G.light,fontSize:13,textAlign:"center",marginTop:40}}>Sem dados.</div>}
          {byComp.map(c=><div key={c.name} style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,marginBottom:4}}><span>{c.name}</span><span style={{color:G.muted}}>{c.total} ped.</span></div><div style={{background:G.border,borderRadius:4,height:8,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:G.green,width:(c.total>0?(c.entregue/c.total)*100:0)+"%"}}/></div><div style={{fontSize:10,color:G.muted,marginTop:2}}>{c.entregue} entregues ({c.total>0?Math.round((c.entregue/c.total)*100):0}%)</div></div>)}
        </div>
      </div>
    </div>
  );
}

// ── TASKS VIEW ────────────────────────────────────────────────────────────────
function TasksView({tarefas,pedidos,users,obras,cu,setTarefas,toast}){
  const [filter,setFilter]=useState("all");
  const [detail,setDetail]=useState(null);
  const [showNew,setShowNew]=useState(false);
  const [nf,setNf]=useState({title:"",description:"",type:"manual",assignedTo:"",due:"",obra:""});
  const setNfF=(k,v)=>setNf(p=>({...p,[k]:v}));

  const filtered=tarefas.filter(t=>filter==="all"||t.status===filter).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  function createTask(){
    if(!nf.title){alert("Título obrigatório.");return;}
    setTarefas(ts=>[{...nf,id:uid(),status:"aberta",comments:[],createdAt:now(),createdBy:cu.name},...ts]);
    setNf({title:"",description:"",type:"manual",assignedTo:"",due:"",obra:""});
    setShowNew(false); toast("Tarefa criada!");
  }

  function updateTask(id,upd){
    setTarefas(ts=>ts.map(t=>{
      if(t.id!==id)return t;
      const updated={...t,...upd};
      // alert on status change
      if(upd.status&&upd.status!==t.status){
        const resp=users.find(u=>u.id===updated.assignedTo);
        if(upd.status==="resolvida") toast("✅ Tarefa concluída! Alertando "+resp?.name+" para checar retorno do comprador.");
        else if(upd.status==="andamento") toast("🟡 Tarefa em andamento — "+resp?.name+" notificado.");
      }
      return updated;
    }));
    setDetail(d=>d&&d.id===id?{...d,...upd}:d);
  }

  function addComment(id,comment){setTarefas(ts=>ts.map(t=>t.id===id?{...t,comments:[...(t.comments||[]),comment]}:t));}

  const filterBtnStyle=(k)=>({padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:filter===k?G.green:G.alt,color:filter===k?"#fff":G.muted});

  const taskDetail=detail?tarefas.find(t=>t.id===detail.id)||detail:null;

  return(
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:6}}>
          {[["all","Todas"],["aberta","Abertas"],["andamento","Em Andamento"],["resolvida","Resolvidas"]].map(([k,l])=>(
            <button key={k} style={filterBtnStyle(k)} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <Btn onClick={()=>setShowNew(true)}>+ Nova Tarefa</Btn>
      </div>

      {showNew&&(
        <div style={{background:G.surface,border:"1px solid "+G.border,borderRadius:14,padding:20,marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>Nova Tarefa Manual</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Fld label="Título" required><Inp value={nf.title} onChange={e=>setNfF("title",e.target.value)}/></Fld>
            <Fld label="Tipo"><Sel value={nf.type} onChange={e=>setNfF("type",e.target.value)}>{Object.entries(TTYPE).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</Sel></Fld>
          </div>
          <Fld label="Descrição"><Txa rows={2} value={nf.description} onChange={e=>setNfF("description",e.target.value)}/></Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
            <Fld label="Responsável"><Sel value={nf.assignedTo} onChange={e=>setNfF("assignedTo",Number(e.target.value))}><option value="">Selecionar…</option>{users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</Sel></Fld>
            <Fld label="Prazo"><Inp type="date" value={nf.due} onChange={e=>setNfF("due",e.target.value)}/></Fld>
            <Fld label="Obra"><Sel value={nf.obra} onChange={e=>setNfF("obra",e.target.value)}><option value="">—</option>{obras.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.code}</option>)}</Sel></Fld>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="secondary" onClick={()=>setShowNew(false)}>Cancelar</Btn>
            <Btn onClick={createTask}>Criar Tarefa</Btn>
          </div>
        </div>
      )}

      {filtered.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:G.light}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div style={{fontSize:15,fontWeight:600}}>Nenhuma tarefa nesta categoria</div></div>}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(t=>{
          const ts=TSTAT[t.status]||TSTAT.aberta;
          const tt=TTYPE[t.type]||TTYPE.manual;
          const resp=users.find(u=>u.id===t.assignedTo);
          const obra=obras.find(o=>String(o.id)===String(t.obra));
          const ped=pedidos.find(p=>p.id===t.pedidoId);
          const overdue=t.due&&new Date(t.due)<new Date()&&t.status!=="resolvida";
          return(
            <div key={t.id} onClick={()=>setDetail(t)} style={{background:G.surface,border:"1.5px solid "+(overdue?G.orange+"60":G.border),borderLeft:"4px solid "+ts.color,borderRadius:12,padding:"13px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontSize:24,width:36,textAlign:"center"}}>{tt.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,fontSize:14}}>{t.title}</span>
                  <Chip color={ts.color} bg={ts.bg}>{ts.icon} {ts.label}</Chip>
                  {overdue&&<Chip color={G.orange} bg="#FBE9E7">⚠️ Atrasada</Chip>}
                  {t.status==="resolvida"&&<Chip color={G.green} bg="#E8F5E9">🔔 Verifique retorno</Chip>}
                </div>
                <div style={{display:"flex",gap:12,fontSize:12,color:G.muted,flexWrap:"wrap"}}>
                  {resp&&<span>👤 {resp.name}</span>}
                  {obra&&<span>🏗️ {obra.code}</span>}
                  {ped&&<span>📋 Pedido {ped.numero}</span>}
                  {t.due&&<span>📅 {fmtD(t.due)}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {t.status!=="resolvida"&&<button onClick={e=>{e.stopPropagation();updateTask(t.id,{status:t.status==="aberta"?"andamento":"resolvida"});}} style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid "+ts.color,background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:ts.color}}>{t.status==="aberta"?"▶ Iniciar":"✅ Concluir"}</button>}
                {t.comments?.length>0&&<span style={{fontSize:11,color:G.muted,alignSelf:"center"}}>💬{t.comments.length}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal */}
      {taskDetail&&(
        <Modal open={!!detail} onClose={()=>setDetail(null)} title={"Tarefa — "+taskDetail.title} width={660}>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <Chip color={(TTYPE[taskDetail.type]||TTYPE.manual).color} bg={(TTYPE[taskDetail.type]||TTYPE.manual).color+"18"}>{(TTYPE[taskDetail.type]||TTYPE.manual).icon} {(TTYPE[taskDetail.type]||TTYPE.manual).label}</Chip>
            <Chip color={(TSTAT[taskDetail.status]||TSTAT.aberta).color} bg={(TSTAT[taskDetail.status]||TSTAT.aberta).bg}>{(TSTAT[taskDetail.status]||TSTAT.aberta).icon} {(TSTAT[taskDetail.status]||TSTAT.aberta).label}</Chip>
          </div>
          {taskDetail.description&&<div style={{background:G.alt,borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:13,lineHeight:1.6}}>{taskDetail.description}</div>}
          {taskDetail.status==="resolvida"&&<div style={{background:"#E8F5E9",border:"1px solid "+G.greenLight,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:G.greenDark}}>🔔 Tarefa concluída — verifique o retorno do comprador e confirme o fechamento.</div>}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:8}}>Atualizar Status</div>
            <div style={{display:"flex",gap:8}}>
              {Object.entries(TSTAT).map(([k,v])=>(
                <button key={k} onClick={()=>updateTask(taskDetail.id,{status:k})} style={{padding:"7px 16px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"2px solid "+(taskDetail.status===k?v.color:"#DDE8DD"),background:taskDetail.status===k?v.bg:"none",color:taskDetail.status===k?v.color:G.muted}}>{v.icon} {v.label}</button>
              ))}
            </div>
          </div>
          <Fld label="Responsável">
            <Sel value={taskDetail.assignedTo||""} onChange={e=>updateTask(taskDetail.id,{assignedTo:Number(e.target.value)})}>
              {users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.name} — {ROLES[u.role]}</option>)}
            </Sel>
          </Fld>
          <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:8}}>Comentários</div>
          <div style={{background:G.alt,borderRadius:10,padding:10,minHeight:70,maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {!(taskDetail.comments?.length)&&<div style={{color:G.light,fontSize:12,textAlign:"center",marginTop:16}}>Sem comentários.</div>}
            {(taskDetail.comments||[]).map(c=><div key={c.id} style={{display:"flex",gap:8}}><Av s={c.avatar} size={24} color={G.green}/><div><div style={{fontSize:10,color:G.muted}}><strong>{c.userName}</strong> · {fmtDT(c.createdAt)}</div><div style={{fontSize:13,marginTop:2}}>{c.text}</div></div></div>)}
          </div>
          <ComentarioInput onSend={text=>addComment(taskDetail.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text,createdAt:now()})}/>
        </Modal>
      )}
    </div>
  );
}

function ComentarioInput({onSend}){
  const [v,setV]=useState("");
  function send(){if(!v.trim())return;onSend(v.trim());setV("");}
  return<div style={{display:"flex",gap:8}}><input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),send())} placeholder="Comentário…" style={{...IB,flex:1,height:36,fontSize:13}}/><Btn onClick={send} size="sm">Enviar</Btn></div>;
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [users,  setUsers]  = useState(()=>ld("fl3_users",  USERS0));
  const [obras,  setObras]  = useState(()=>ld("fl3_obras",  OBRAS0));
  const [pedidos,setPedidos]= useState(()=>ld("fl3_pedidos",[]));
  const [tarefas,setTarefas]= useState(()=>ld("fl3_tarefas",[]));
  const [events, setEvents] = useState(()=>ld("fl3_events", []));
  const [atas,   setAtas]   = useState(()=>ld("fl3_atas",   []));

  const [loggedIn,setLoggedIn]=useState(()=>ld("fl3_li",false));
  const [cu,setCu]=useState(()=>ld("fl3_cu",USERS0[0]));
  const [loginEmail,setLoginEmail]=useState("");
  const [loginPass,setLoginPass]=useState("");
  const [loginErr,setLoginErr]=useState("");

  const [page,setPage]=useState("dashboard");
  const [toastMsg,setToastMsg]=useState("");
  const [search,setSearch]=useState("");
  const [fStatus,setFStatus]=useState("all");
  const [fObra,setFObra]=useState("all");

  const [showPF,setShowPF]=useState(false);
  const [detailP,setDetailP]=useState(null);
  const [editPId,setEditPId]=useState(null);
  const [showCfg,setShowCfg]=useState(false);
  const [showAg,setShowAg]=useState(false);
  const [showAt,setShowAt]=useState(false);
  const [notifOpen,setNotifOpen]=useState(false);

  useEffect(()=>{ sv("fl3_users",users); },[users]);
  useEffect(()=>{ sv("fl3_obras",obras); },[obras]);
  useEffect(()=>{ sv("fl3_pedidos",pedidos); },[pedidos]);
  useEffect(()=>{ sv("fl3_tarefas",tarefas); },[tarefas]);
  useEffect(()=>{ sv("fl3_events",events); },[events]);
  useEffect(()=>{ sv("fl3_atas",atas); },[atas]);
  useEffect(()=>{ sv("fl3_li",loggedIn); },[loggedIn]);
  useEffect(()=>{ sv("fl3_cu",cu); },[cu]);

  const toast=m=>setToastMsg(m);

  // auto check atrasados
  useEffect(()=>{
    const atrasados=pedidos.filter(p=>isAtrasado(p)&&!tarefas.find(t=>t.pedidoId===p.id&&t.type==="atraso"));
    if(atrasados.length>0){
      const novas=atrasados.map(p=>({id:uid(),title:"Entrega atrasada — Pedido "+p.numero+" ("+p.fornecedor+")",description:"Pedido "+p.numero+" com previsão "+fmtD(p.previsaoEntrega)+" não foi marcado como entregue.",type:"atraso",status:"aberta",pedidoId:p.id,obra:p.obra,assignedTo:Number(p.comprador),due:"",comments:[],createdAt:now(),createdBy:"Sistema"}));
      setTarefas(ts=>[...novas,...ts]);
    }
  },[pedidos]);

  async function doLogin(){
    const u=users.find(x=>x.email?.toLowerCase()===loginEmail.toLowerCase()&&x.active);
    if(!u){setLoginErr("E-mail não encontrado.");return;}
    const senhaHash=await hashPass(loginPass);
    const senhaOk=u.senhaHash?u.senhaHash===senhaHash:loginPass==="facten2025";
    if(!senhaOk){setLoginErr("Senha incorreta.");return;}
    setCu(u);setLoggedIn(true);setLoginErr("");
  }

  function savePedido(form){
    const obra=obras.find(o=>String(o.id)===String(form.obra));
    const alm=obra?users.find(u=>u.id===obra.almoxarife):null;
    const p0={id:uid(),...form,status:"pendente",messages:[{id:uid(),userId:0,userName:"IA FACTEN",avatar:"IA",text:"🤖 Pedido **"+form.numero+"** criado — Obra **"+(obra?obra.code+" — "+obra.name:"—")+"**. Almoxarife responsável: **"+(alm?.name||"—")+"**",type:"ia",createdAt:now()}],anexos:[],createdAt:now(),createdBy:cu.name};
    setPedidos(p=>[p0,...p]);
    toast("Pedido "+form.numero+" criado e vinculado à "+obra?.name+"!");
  }

  function updateStatus(id,status){
    setPedidos(p=>p.map(x=>{
      if(x.id!==id)return x;
      if(status==="aguardando"){
        const task={id:uid(),title:"Boleto pendente — Pedido "+x.numero+" ("+x.fornecedor+")",description:"Almoxarife solicitou boleto/NF. Pedido "+x.numero+", fornecedor "+x.fornecedor,type:"boleto",status:"aberta",pedidoId:id,obra:x.obra,assignedTo:Number(x.comprador),due:"",comments:[],createdAt:now(),createdBy:"Sistema"};
        setTarefas(ts=>[task,...ts]);
        toast("🧾 Tarefa de boleto criada para o comprador!");
      }
      if(status==="parcial"){
        const task={id:uid(),title:"Entrega parcial — Pedido "+x.numero+" ("+x.fornecedor+")",description:"Pedido "+x.numero+" entregue parcialmente. Verificar saldo pendente com "+x.fornecedor,type:"parcial",status:"aberta",pedidoId:id,obra:x.obra,assignedTo:Number(x.comprador),due:"",comments:[],createdAt:now(),createdBy:"Sistema"};
        setTarefas(ts=>[task,...ts]);
        toast("📦 Tarefa de acompanhamento criada!");
      }
      return{...x,status};
    }));
    if(status!=="aguardando"&&status!=="parcial") toast("Status → "+STATUS[status]?.label);
  }

  const addMsg   =(id,m)=>setPedidos(p=>p.map(x=>x.id===id?{...x,messages:[...(x.messages||[]),m]}:x));
  const addAnexo =(id,a)=>setPedidos(p=>p.map(x=>x.id===id?{...x,anexos:[...(x.anexos||[]),a]}:x));
  const reqBoleto=(id)=>updateStatus(id,"aguardando");
  const updateItens=(id,novos,ns)=>setPedidos(p=>p.map(x=>x.id===id?{...x,itens:novos,status:ns}:x));

  const notifs=buildNotifs(pedidos,tarefas,cu,obras);

  // search by numero opens detail
  const filteredP=pedidos.filter(p=>{
    const o=obras.find(x=>String(x.id)===String(p.obra));
    return(fStatus==="all"||p.status===fStatus)&&(fObra==="all"||String(p.obra)===fObra)&&(!search||[p.numero,p.fornecedor,p.descricao,o?.name,o?.code].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
  });

  // auto open pedido when exact numero typed
  useEffect(()=>{
    if(search.length>=4){const exact=pedidos.find(p=>p.numero===search.trim());if(exact)setDetailP(exact);}
  },[search]);

  const isComp=["comprador","coordenador"].includes(cu.role);

  const NAV=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"pedidos",icon:"📋",label:"Pedidos"},
    {id:"tarefas",icon:"✅",label:"Tarefas",badge:tarefas.filter(t=>t.status==="aberta").length||null},
  ];

  // LOGIN
  if(!loggedIn){
    return(
      <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2E7D32 0%,#1A3A1A 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",padding:16}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@keyframes su{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        <div style={{background:"#fff",borderRadius:20,padding:"44px 40px",width:"100%",maxWidth:400,boxShadow:"0 32px 80px rgba(0,0,0,.32)",animation:"su .3s ease"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Logo size={52}/></div>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:24,fontWeight:800,color:G.text,letterSpacing:"-0.5px"}}>FACTEN</div>
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
  }

  // MAIN
  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"Inter,sans-serif",color:G.text,background:G.bg}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@keyframes su{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#DDE8DD;border-radius:4px}button:active{transform:scale(.98)}`}</style>

      {/* SIDEBAR */}
      <div style={{width:220,flexShrink:0,background:G.nav,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0}}>
        <div style={{padding:"24px 20px 20px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Logo size={36}/>
            <div><div style={{fontSize:16,fontWeight:800,color:"#fff",letterSpacing:"-0.3px"}}>FACTEN</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>Logística</div></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:2}}>
          {NAV.map(n=>{
            const active=page===n.id;
            return<button key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",textAlign:"left",width:"100%",background:active?"rgba(76,175,80,.25)":"none",color:active?"#fff":"rgba(255,255,255,.55)",fontWeight:active?700:500,fontSize:13}}><span style={{fontSize:18,width:22,textAlign:"center"}}>{n.icon}</span>{n.label}{n.badge>0&&<span style={{marginLeft:"auto",background:G.red,color:"#fff",borderRadius:20,fontSize:10,fontWeight:800,padding:"1px 7px"}}>{n.badge}</span>}</button>;
          })}
          <div style={{height:1,background:"rgba(255,255,255,.08)",margin:"8px 4px"}}/>
          {[["📅","Agenda",()=>setShowAg(true)],["📄","Atas",()=>setShowAt(true)]].map(([ic,lb,fn])=>(
            <button key={lb} onClick={fn} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"none",color:"rgba(255,255,255,.55)",fontWeight:500,fontSize:13,textAlign:"left",width:"100%"}}><span style={{fontSize:18,width:22,textAlign:"center"}}>{ic}</span>{lb}</button>
          ))}
        </nav>
        <div style={{padding:"12px 10px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
          <button onClick={()=>setShowCfg(true)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"none",color:"rgba(255,255,255,.55)",fontWeight:500,fontSize:13,textAlign:"left",width:"100%"}}><span style={{fontSize:18,width:22,textAlign:"center"}}>⚙️</span>Configurações</button>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}} onClick={()=>setLoggedIn(false)}>
            <Av s={cu.avatar} size={30} color={RCOL[cu.role]||G.green}/>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cu.name.split(" ")[0]}</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{ROLES[cu.role]}</div></div>
            <span style={{fontSize:14,color:"rgba(255,255,255,.3)"}}>→</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,overflowY:"auto",minWidth:0}}>
        {/* Top bar */}
        <div style={{background:G.surface,borderBottom:"1px solid "+G.border,padding:"0 28px",height:56,display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:50}}>
          <h1 style={{margin:0,fontSize:18,fontWeight:800,color:G.text}}>
            {page==="dashboard"&&"Dashboard"}
            {page==="pedidos"&&"Pedidos de Compra"}
            {page==="tarefas"&&"Tarefas"}
          </h1>
          <div style={{flex:1}}/>

          {page==="pedidos"&&(
            <>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar ou digitar Nº pedido…" style={{...IB,width:230,height:34,fontSize:12}}/>
              <Sel value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{width:170,height:34,fontSize:12}}>
                <option value="all">Todos os status</option>
                {Object.entries(STATUS).filter(([k])=>k!=="atrasado").map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </Sel>
              <Sel value={fObra} onChange={e=>setFObra(e.target.value)} style={{width:180,height:34,fontSize:12}}>
                <option value="all">Todas as obras</option>
                {obras.filter(o=>o.active).map(o=><option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
              </Sel>
              {isComp&&<Btn onClick={()=>setShowPF(true)}>+ Novo Pedido</Btn>}
            </>
          )}

          {/* Notificações */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setNotifOpen(n=>!n)} style={{position:"relative",background:"none",border:"none",cursor:"pointer",fontSize:20,padding:"4px 8px"}}>
              🔔
              {notifs.length>0&&<span style={{position:"absolute",top:0,right:0,background:G.red,color:"#fff",borderRadius:20,fontSize:9,fontWeight:800,padding:"1px 5px",minWidth:16,textAlign:"center"}}>{notifs.length}</span>}
            </button>
            {notifOpen&&(
              <div style={{position:"absolute",right:0,top:44,background:"#fff",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,.18)",width:340,zIndex:200,border:"1px solid "+G.border}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid "+G.border,fontWeight:700,fontSize:13,display:"flex",justifyContent:"space-between"}}>
                  Notificações <button onClick={()=>setNotifOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:G.muted}}>✕</button>
                </div>
                {notifs.length===0&&<div style={{padding:"24px",textAlign:"center",color:G.light,fontSize:13}}>Nenhuma notificação</div>}
                {notifs.map(n=>(
                  <div key={n.id} onClick={()=>{if(n.pedidoId){const p=pedidos.find(x=>x.id===n.pedidoId);if(p){setDetailP(p);setPage("pedidos");}}setNotifOpen(false);}} style={{display:"flex",gap:10,padding:"10px 16px",borderBottom:"1px solid "+G.border,cursor:n.pedidoId?"pointer":"default",background:"#fafafa"}}>
                    <span style={{fontSize:20}}>{n.icon}</span>
                    <div style={{fontSize:12,color:G.text,lineHeight:1.5}}>{n.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{padding:28}}>
          {page==="dashboard"&&<Dashboard pedidos={pedidos} tarefas={tarefas} users={users} obras={obras} onOpenPedido={p=>{setDetailP(p);setPage("pedidos");}}/>}

          {page==="pedidos"&&(
            filteredP.length===0?(
              <div style={{textAlign:"center",padding:"80px 0",color:G.light}}>
                <div style={{fontSize:52,marginBottom:12}}>📦</div>
                <div style={{fontSize:17,fontWeight:700,marginBottom:6}}>Nenhum pedido encontrado</div>
                <div style={{fontSize:13}}>{isComp?"Crie um novo pedido ou ajuste os filtros.":"Aguarde os compradores criarem pedidos."}</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {filteredP.map(p=>{
                  const obra=obras.find(o=>String(o.id)===String(p.obra));
                  const alm=obra?users.find(u=>u.id===obra.almoxarife):null;
                  const comp=users.find(u=>String(u.id)===String(p.comprador));
                  const atrasado=isAtrasado(p);
                  const cfg=STATUS[atrasado?"atrasado":p.status]||STATUS.pendente;
                  const tvCount=tarefas.filter(t=>t.pedidoId===p.id&&t.status!=="resolvida").length;
                  const itens=p.itens||[];
                  const nEnt=itens.filter(i=>i.status==="entregue").length;
                  const nTotal=itens.length;
                  return(
                    <div key={p.id} onClick={()=>setDetailP(p)} style={{background:G.surface,border:"1.5px solid "+(atrasado?G.orange+"60":G.border),borderLeft:"4px solid "+cfg.color,borderRadius:12,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
                      <div style={{width:54,height:54,borderRadius:12,background:cfg.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <div style={{fontSize:10,color:cfg.color,fontWeight:700,textTransform:"uppercase"}}>Ped.</div>
                        <div style={{fontSize:16,fontWeight:800,color:cfg.color}}>{p.numero}</div>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                          <span style={{fontWeight:800,fontSize:15}}>{p.fornecedor}</span>
                          <Chip color={cfg.color} bg={cfg.bg}>{cfg.icon} {cfg.label}</Chip>
                          {atrasado&&<Chip color={G.orange} bg="#FBE9E7">⚠️ Atrasado</Chip>}
                          {p.status==="parcial"&&<Chip color={G.blue} bg="#E3F2FD">📦 Parcial</Chip>}
                          {tvCount>0&&<Chip color={G.red} bg="#FFEBEE">⚠️ {tvCount} tarefa{tvCount>1?"s":""}</Chip>}
                          {nTotal>0&&<Chip color={G.muted} bg={G.alt}>📦 {nEnt}/{nTotal} itens</Chip>}
                        </div>
                        <div style={{fontSize:13,color:G.muted,marginBottom:4}}>{itens.length>0?itens.slice(0,2).map(i=>i.descricao).join(", ")+(itens.length>2?" +mais…":""):"Sem insumos cadastrados"}</div>
                        <div style={{display:"flex",gap:14,fontSize:12,color:G.light,flexWrap:"wrap"}}>
                          {obra&&<span>🏗️ {obra.code} — {obra.name}</span>}
                          {alm&&<span>📦 {alm.name}</span>}
                          {comp&&<span>🛒 {comp.name}</span>}
                          {p.previsaoEntrega&&<span>📅 {fmtD(p.previsaoEntrega)}</span>}
                          {p.valor&&<span>💰 R$ {p.valor}</span>}
                        </div>
                        {/* mini progress */}
                        {nTotal>0&&<div style={{marginTop:6}}><div style={{background:G.border,borderRadius:4,height:4,width:200,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:G.green,width:Math.round((nEnt/nTotal)*100)+"%"}}/></div></div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                        {p.messages?.length>0&&<span style={{fontSize:11,color:G.muted}}>💬 {p.messages.length}</span>}
                        {p.anexos?.length>0&&<span style={{fontSize:11,color:G.muted}}>📎 {p.anexos.length}</span>}
                        <span style={{fontSize:11,color:G.light}}>{fmtD(p.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {page==="tarefas"&&<TasksView tarefas={tarefas} pedidos={pedidos} users={users} obras={obras} cu={cu} setTarefas={setTarefas} toast={toast}/>}
        </div>
      </div>

      {/* MODALS */}
      <PedidoForm open={showPF} onClose={()=>setShowPF(false)} onSave={savePedido} users={users} obras={obras} cu={cu}/>
      <PedidoDetail
        open={!!detailP} onClose={()=>setDetailP(null)}
        pedido={detailP?pedidos.find(p=>p.id===detailP.id)||detailP:null}
        users={users} obras={obras} cu={cu}
        onStatus={updateStatus} onMsg={addMsg} onAnexo={addAnexo} onBoleto={reqBoleto}
        onUpdateItens={updateItens} onEdit={p=>{setEditPId(p.id);setDetailP(null);}}/>
      <Settings open={showCfg} onClose={()=>setShowCfg(false)} users={users} obras={obras} setUsers={setUsers} setObras={setObras} toast={toast}/>
      <Agenda open={showAg} onClose={()=>setShowAg(false)} events={events} obras={obras} cu={cu} onSave={ev=>setEvents(e=>[...e,{...ev,id:uid()}])} onDelete={id=>setEvents(e=>e.filter(x=>x.id!==id))}/>
      <Atas open={showAt} onClose={()=>setShowAt(false)} atas={atas} obras={obras} cu={cu} onSave={a=>setAtas(as=>[a,...as])}/>

      <Toast msg={toastMsg} onDone={()=>setToastMsg("")}/>
    </div>
  );
}
