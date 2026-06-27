import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE CLIENT ───────────────────────────────────────────────────────────
const SB_URL  = import.meta.env.VITE_SUPABASE_URL  || "";
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const sb = SB_URL ? createClient(SB_URL, SB_ANON) : null;

// ── DB HELPERS ────────────────────────────────────────────────────────────────
async function dbGet(table, fallback=[]) {
  if(!sb) return fallback;
  try {
    const { data, error } = await sb.from(table).select("*").order("id");
    if(error) throw error;
    return data || fallback;
  } catch(e) {
    console.warn("Supabase dbGet error:", table, e.message);
    return fallback;
  }
}
async function dbUpsert(table, row) {
  if(!sb) return null;
  try {
    const { data, error } = await sb.from(table).upsert(row, {onConflict:"id"}).select();
    if(error){
      console.error("Supabase upsert error:", table, JSON.stringify(error));
      throw new Error(error.message || JSON.stringify(error));
    }
    return data?.[0];
  } catch(e) {
    console.error("Supabase dbUpsert failed:", table, e.message);
    throw e; // propagate so callers can show error
  }
}
async function dbDelete(table, id) {
  if(!sb) return;
  try {
    const { error } = await sb.from(table).delete().eq("id", id);
    if(error) throw error;
  } catch(e) {
    console.warn("Supabase dbDelete error:", table, e.message);
  }
}

// ── ROW MAPPERS ───────────────────────────────────────────────────────────────
const userToDb = u => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  avatar: u.avatar, active: u.active, obras: u.obras||[],
  senha_hash: u.senhaHash||null, primeiro_acesso: u.primeiroAcesso!==false
});
const userFromDb = r => ({
  id: r.id, name: r.name, email: r.email||"", role: r.role,
  avatar: r.avatar||"", active: r.active, obras: r.obras||[],
  senhaHash: r.senha_hash||"", primeiroAcesso: r.primeiro_acesso!==false
});
const obraToDb = o => ({
  id: o.id, code: o.code, name: o.name, city: o.city||null,
  state: o.state||"MA", almoxarife: o.almoxarife||null,
  active: o.active!==false, created_from: o.createdFrom||null
});
const obraFromDb = r => ({
  id: r.id, code: r.code, name: r.name, city: r.city||"",
  state: r.state||"MA", almoxarife: r.almoxarife||null,
  active: r.active, createdFrom: r.created_from||null
});
const fornToDb = f => ({
  id: f.id, nome: f.nome, cnpj: f.cnpj||null, contato: f.contato||null,
  email: f.email||null, telefone: f.telefone||null, ativo: f.ativo!==false,
  created_from: f.createdFrom||null
});
const fornFromDb = r => ({
  id: r.id, nome: r.nome, cnpj: r.cnpj||"", contato: r.contato||"",
  email: r.email||"", telefone: r.telefone||"", ativo: r.ativo!==false,
  createdFrom: r.created_from||null
});

// ══ constants ══
// ── DESIGN TOKENS ────────────────────────────────────────────────────────────
const G = {
  green:"#4CAF50", greenDark:"#2E7D32", greenLight:"#A5D6A7",
  red:"#E74C3C", gold:"#F4C430", goldDark:"#D4A017",
  purple:"#9C27B0", blue:"#2196F3", teal:"#00897B", orange:"#FF7043",
  bg:"#F4F6F4", surface:"#FFFFFF", alt:"#F0F5F0",
  border:"#DDE8DD", text:"#1A2B1A", muted:"#5A7A5A", light:"#9DB89D",
  nav:"#1B3A1B",
};

// ── PEDIDO STATUS ─────────────────────────────────────────────────────────────
const STATUS = {
  pendente:   { label:"Pendente",              color:G.gold,   bg:"#FFF8E1", icon:"⏳" },
  entregue:   { label:"Entregue",              color:G.green,  bg:"#E8F5E9", icon:"✅" },
  parcial:    { label:"Parcial",               color:G.blue,   bg:"#E3F2FD", icon:"📦" },
  cancelado:  { label:"Cancelado",             color:G.red,    bg:"#FFEBEE", icon:"❌" },
  aguardando: { label:"Aguard. Boleto",        color:G.purple, bg:"#F3E5F5", icon:"🧾" },
  atrasado:   { label:"Atrasado",              color:G.orange, bg:"#FBE9E7", icon:"⚠️" },
};

// ── TAREFA STATUS ─────────────────────────────────────────────────────────────
const TSTAT = {
  aberta:    { label:"Aberta",       color:G.red,    bg:"#FFEBEE", icon:"🔴" },
  andamento: { label:"Em Andamento", color:G.gold,   bg:"#FFF8E1", icon:"🟡" },
  resolvida: { label:"Resolvida",    color:G.green,  bg:"#E8F5E9", icon:"🟢" },
};

// ── TAREFA CATEGORIAS ─────────────────────────────────────────────────────────
const TCAT = {
  acompanhamento: { label:"Acompanhamento", color:G.green,  bg:"#E8F5E9", icon:"📋", desc:"Acompanhamento do pedido e entregas" },
  boleto:         { label:"Boleto / NF",    color:G.purple, bg:"#F3E5F5", icon:"🧾", desc:"Boleto ou Nota Fiscal pendente" },
  pergunta:       { label:"Dúvida",         color:G.blue,   bg:"#E3F2FD", icon:"❓", desc:"Pergunta sobre o pedido ou material" },
  atraso:         { label:"Atraso",         color:G.orange, bg:"#FBE9E7", icon:"⚠️", desc:"Alerta de atraso na entrega" },
};

// ── PERFIS ────────────────────────────────────────────────────────────────────
const ROLES = {
  coordenador:   "Coordenador de Suprimentos",
  comprador:     "Comprador",
  almoxarife:    "Almoxarife",
  aux_almoxarife:"Aux. Almoxarife",
  aprovador:     "Aprovador",
  juridico:      "Jurídico",
  fiscal:        "Fiscal",
  aux_engenharia:"Aux. Engenharia",
  coord_obras:   "Coord. de Obras",
  gestor_obras:  "Gestor de Obras",
  diretor_eng:   "Diretor de Engenharia",
  diretor_plan:  "Diretor de Planejamento",
  gerente_fin:   "Gerente Financeiro",
  coord_control: "Coord. de Controladoria",
};

const RCOL = {
  coordenador:G.greenDark, comprador:G.green, almoxarife:G.blue,
  aux_almoxarife:"#42A5F5", aprovador:G.gold, juridico:G.red,
  fiscal:G.orange, aux_engenharia:"#26A69A", coord_obras:"#7E57C2",
  gestor_obras:"#5C6BC0", diretor_eng:"#D81B60", diretor_plan:"#6D4C41",
  gerente_fin:"#00897B", coord_control:"#F4511E",
};

// ── SEED USERS ────────────────────────────────────────────────────────────────
// ── VERSÃO DOS DADOS ─────────────────────────────────────────────────────────
// ⚠️  ATUALIZE este número toda vez que mudar USERS0, OBRAS0 ou qualquer seed
// Isso força todos os navegadores a descartar o localStorage antigo e pegar os dados novos
const DATA_VERSION = "v2";

const USERS0 = [
  // ─────────────────────────────────────────────────────────────────────────
  // E-mails reais — atualizados em 27/06/2026
  // Senha inicial de todos: facten2025
  // No primeiro acesso o sistema obrigará troca de senha pessoal
  // ─────────────────────────────────────────────────────────────────────────
  {id:1, name:"Flávio Silva",       email:"flavio.silva@amorimcoutinho.com.br",       role:"coordenador", avatar:"FS", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
  {id:2, name:"Francisco Cunha",    email:"francisco.cunha@amorimcoutinho.com.br",    role:"comprador",   avatar:"FC", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
  {id:3, name:"Felipe Vitorino",    email:"felipe.vitorino@amorimcoutinho.com.br",    role:"comprador",   avatar:"FV", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
  {id:4, name:"Cristiano Teixeira", email:"cristiano.teixeira@amorimcoutinho.com.br", role:"aprovador",   avatar:"CT", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
  {id:5, name:"Graça Macedo",       email:"gracamacedo@amorimcoutinho.com.br",        role:"almoxarife",  avatar:"GM", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
  {id:6, name:"Caio Monteiro",      email:"caio.monteiro@amorimcoutinho.com.br",      role:"almoxarife",  avatar:"CM", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
  {id:7, name:"Vicente Nascimento", email:"vicente.ferreira@amorimcoutinho.com.br",   role:"almoxarife",  avatar:"VN", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
  {id:8, name:"Nayara Couto",       email:"nayara@amorimcoutinho.com.br",             role:"juridico",    avatar:"NC", active:true, obras:[], senhaHash:"", primeiroAcesso:true},
];

const hashPass = async s => {
  const b = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256",b);
  return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("");
};

const uid   = () => Math.random().toString(36).slice(2,10);
const nowTs = () => new Date().toISOString();
const fmtD  = iso => iso ? new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
const fmtDT = iso => iso ? new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
const isAtrasado = p => p.previsaoEntrega && new Date(p.previsaoEntrega)<new Date() && !["entregue","cancelado"].includes(p.status);
const ld = (k,fb) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };
const sv = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };

// ── RESET DE VERSÃO ───────────────────────────────────────────────────────────
// Se DATA_VERSION mudou desde o último acesso, limpa tudo e recarrega com dados novos
(function checkVersion(){
  try{
    const stored = localStorage.getItem("fl5_data_version");
    if(stored !== DATA_VERSION){
      // Guarda pedidos e tarefas se existirem (não perde dados operacionais)
      const pedidos  = localStorage.getItem("fl5_pedidos");
      const tarefas  = localStorage.getItem("fl5_tarefas");
      const events   = localStorage.getItem("fl5_events");
      const atas     = localStorage.getItem("fl5_atas");
      const forn     = localStorage.getItem("fl5_forn");
      // Limpa tudo
      Object.keys(localStorage).filter(k=>k.startsWith("fl5_")).forEach(k=>localStorage.removeItem(k));
      // Restaura dados operacionais
      if(pedidos) localStorage.setItem("fl5_pedidos", pedidos);
      if(tarefas) localStorage.setItem("fl5_tarefas", tarefas);
      if(events)  localStorage.setItem("fl5_events",  events);
      if(atas)    localStorage.setItem("fl5_atas",     atas);
      if(forn)    localStorage.setItem("fl5_forn",     forn);
      // Grava nova versão
      localStorage.setItem("fl5_data_version", DATA_VERSION);
    }
  }catch{}
})();

// ── IA CALL ───────────────────────────────────────────────────────────────────
async function callIA(messages, maxTokens=1000, system="Assistente FACTEN.") {
  const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:maxTokens,system,messages})});
  const d = await r.json();
  if(d.error) throw new Error(d.error.message||JSON.stringify(d.error));
  return d.content?.[0]?.text || "";
}

// ── PDF EXTRACTOR ─────────────────────────────────────────────────────────────
async function extractPedidoPDF(b64) {
  const system = `Você é extrator especializado de Pedidos de Compra Sienge da Amorim Coutinho Engenharia. REGRA ABSOLUTA: retorne SOMENTE JSON válido, sem texto antes ou depois, sem markdown, sem backticks, sem comentários.`;
  const prompt = `Extraia os dados deste Pedido de Compra Sienge e retorne EXATAMENTE este JSON preenchido:
{
  "numero": "",
  "data_pedido": "YYYY-MM-DD",
  "cnpj_fornecedor": "",
  "nome_fornecedor": "",
  "codigo_obra": "",
  "nome_obra": "",
  "local_entrega": "",
  "cond_pagamento": "",
  "datas_vencimento": ["YYYY-MM-DD"],
  "tipo_frete": "",
  "valor_frete": "0.00",
  "total_mercadorias": "0.00",
  "desconto_total": "0.00",
  "valor_total": "0.00",
  "data_entrega": "YYYY-MM-DD",
  "observacoes": "",
  "itens": [
    {
      "codigo": "",
      "descricao": "",
      "norma": "",
      "unidade": "",
      "quantidade": 1,
      "valor_unitario": "0.00",
      "desconto_rs": "0.00",
      "perc_desconto": "0.00",
      "perc_ipi": "0.00",
      "perc_acrescimo": "0.00",
      "valor_final": "0.00",
      "data_previsao": "YYYY-MM-DD"
    }
  ]
}

INSTRUÇÕES:
- numero: dígitos após "Nº Pedido" (ex: "76801")
- data_pedido: data do pedido formato YYYY-MM-DD
- cnpj_fornecedor: CNPJ na seção "Dados do Fornecedor"
- nome_fornecedor: Razão Social completa do fornecedor (sem o código numérico inicial)
- codigo_obra: SOMENTE o número antes do traço em "Dados da Obra" (ex: "245")
- nome_obra: nome após o traço (ex: "BE LIFE CLUB - 3")
- local_entrega: campo "Local Entrega"
- cond_pagamento: campo "Cond. Pagamento" (ex: "BOLETO 28 DIAS")
- datas_vencimento: lista de todas as datas em "Datas Vencimento" no formato YYYY-MM-DD
- tipo_frete: campo "Frete" (ex: "FOB" ou "CIF")
- valor_frete: valor numérico do Frete (sem R$, ponto como decimal)
- total_mercadorias: "Total das mercadorias" numérico
- desconto_total: "Desconto" numérico
- valor_total: "TOTAL DO PEDIDO" numérico
- data_entrega: Data Previsão do 1º item (YYYY-MM-DD). Se vazia use 1ª data de vencimento
- observacoes: texto completo das Observações
- itens: TODOS os itens da tabela. Para cada item:
  - codigo: código antes do traço na coluna Insumo (ex: "1458")
  - descricao: nome completo do insumo após o traço
  - norma: coluna Norma (pode ser vazia)
  - unidade: unidade de medida
  - quantidade: número
  - valor_unitario: Preço Unit. numérico
  - desconto_rs: Desc(R$) numérico
  - perc_desconto: % Desc numérico
  - perc_ipi: % IPI numérico
  - perc_acrescimo: % Acr numérico
  - valor_final: Preço Final numérico (valor total do item)
  - data_previsao: Data Previsão do item YYYY-MM-DD

Retorne APENAS o JSON. NADA MAIS.`;

  const resp = await callIA([{role:"user",content:[
    {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
    {type:"text",text:prompt}
  ]}], 5000, system);

  let json = resp.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  const m = json.match(/\{[\s\S]*\}/);
  if(!m) throw new Error("IA não retornou JSON. Recebido: "+resp.slice(0,300));
  return JSON.parse(m[0]);
}


// ══ store ══
// ── STORE: localStorage with Supabase sync ─────────────────────────────────

// Keys
const K = {
  users:"fl5_users", obras:"fl5_obras", fornecedores:"fl5_fornecedores",
  pedidos:"fl5_pedidos", tarefas:"fl5_tarefas", events:"fl5_events", atas:"fl5_atas",
  li:"fl5_li", cu:"fl5_cu",
};

function loadState(){
  return {
    users:        ld(K.users,        USERS0),
    obras:        ld(K.obras,        []),
    fornecedores: ld(K.fornecedores, []),
    pedidos:      ld(K.pedidos,      []),
    tarefas:      ld(K.tarefas,      []),
    events:       ld(K.events,       []),
    atas:         ld(K.atas,         []),
    loggedIn:     ld(K.li,           false),
    cu:           ld(K.cu,           USERS0[0]),
  };
}

function persist(key, value){
  sv(K[key], value);
}

// ── ANTI-DUPLICATE helpers ─────────────────────────────────────────────────
function findOrCreateFornecedor(fornecedores, parsed){
  const cnpj = (parsed.cnpj_fornecedor||"").trim();
  const nome = (parsed.nome_fornecedor||parsed.fornecedor||"").trim();
  if(!nome) return { fornecedores, match:null, created:false };

  let match = fornecedores.find(f=>
    (cnpj && f.cnpj && f.cnpj.replace(/\D/g,"")===cnpj.replace(/\D/g,"")) ||
    f.nome.toLowerCase().trim()===nome.toLowerCase()
  );

  if(match) return { fornecedores, match, created:false };

  match = { id:Date.now(), nome, cnpj, contato:"", email:"", telefone:"", ativo:true, createdAt:nowTs(), createdFrom:"pdf" };
  return { fornecedores:[...fornecedores, match], match, created:true };
}

function findOrCreateObra(obras, parsed){
  const code = (parsed.codigo_obra||parsed.obra_code||"").toString().trim().replace(/\D.*$/,""); // digits only
  const name = (parsed.nome_obra||parsed.obra_name||"").trim();
  if(!code) return { obras, match:null, created:false };

  let match = obras.find(o=>o.code===code);
  if(match) return { obras, match, created:false };

  match = { id:Date.now()+2, code, name:name||"Obra "+code, city:"", state:"MA", almoxarife:null, active:true, createdAt:nowTs(), createdFrom:"pdf" };
  return { obras:[...obras, match], match, created:true };
}

// ── TASK AUTO-CREATE ────────────────────────────────────────────────────────
function buildAcompanhamentoTask(pedido, forn, obra, comprador){
  const resumo = (pedido.itens||[]).slice(0,3).map(i=>i.descricao).join(", ")+(pedido.itens?.length>3?" e mais...":"");
  return {
    id: uid(),
    categoria: "acompanhamento",
    status: "aberta",
    pedidoId: pedido.id,
    obra: pedido.obra,
    assignedTo: Number(pedido.comprador),
    due: pedido.previsaoEntrega||"",
    // Title WITHOUT "parcial" — used to identify the initial task
    title: `Acompanhamento — Pedido ${pedido.numero} — ${forn?.nome||pedido.fornecedor||""} — ${resumo}`,
    description: `Pedido criado em ${new Date().toLocaleDateString("pt-BR")}. Previsão de entrega: ${pedido.previsaoEntrega? new Date(pedido.previsaoEntrega).toLocaleDateString("pt-BR"):"Não definida"}. Aguardando entrega pelo almoxarife.`,
    anexos: [],
    messages: [],
    createdBy: pedido.createdBy||"",
    createdAt: nowTs(),
  };
}


// ══ atoms ══

const IB={width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:13,color:"#1A2B1A",background:"#fff",outline:"none",fontFamily:"Inter,sans-serif",boxSizing:"border-box",transition:"border-color .15s"};

function Av({s="?",size=32,color=G.green}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:size*.36,flexShrink:0,userSelect:"none"}}>{s}</div>;
}
function Chip({color,bg,children,style:sx={}}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:bg,color,border:"1px solid "+color+"30",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",...sx}}>{children}</span>;
}
function Toast({msg,onDone}){
  useEffect(()=>{if(!msg)return;const t=setTimeout(onDone,4500);return()=>clearTimeout(t);},[msg]);
  if(!msg)return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:G.greenDark,color:"#fff",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.22)",animation:"su .2s ease",maxWidth:460,textAlign:"center"}}>{msg}</div>;
}
function Inp({style:sx,...p}){
  const[f,sf]=useState(false);
  return <input {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;
}
function Sel({children,style:sx,...p}){
  return <select {...p} style={{...IB,paddingRight:28,...sx}}>{children}</select>;
}
function Txa({style:sx,...p}){
  const[f,sf]=useState(false);
  return <textarea {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,minHeight:72,resize:"vertical",borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;
}
function Fld({label,required,hint,children}){
  return <div style={{marginBottom:12}}>
    <label style={{display:"block",fontSize:11,fontWeight:700,color:G.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{required&&<span style={{color:G.red}}> *</span>}</label>
    {children}
    {hint&&<div style={{fontSize:10,color:G.light,marginTop:3}}>{hint}</div>}
  </div>;
}
function Btn({children,variant="primary",onClick,disabled,style:sx={},size="md",title}){
  const pad={sm:"5px 11px",md:"9px 18px",lg:"12px 28px"}[size];
  const vars={
    primary:{background:G.green,color:"#fff",border:"none"},
    secondary:{background:"none",color:G.muted,border:"1.5px solid #DDE8DD"},
    danger:{background:G.red,color:"#fff",border:"none"},
    ghost:{background:"none",color:G.greenDark,border:"1.5px solid "+G.green},
    warn:{background:G.orange,color:"#fff",border:"none"},
  };
  return <button title={title} onClick={onClick} disabled={disabled} style={{padding:pad,borderRadius:8,fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1,transition:"opacity .15s,transform .1s",...vars[variant],...sx}}>{children}</button>;
}
function Modal({open,onClose,title,width=700,children,footer}){
  const[fs,setFs]=useState(false);
  useEffect(()=>{
    if(!open){setFs(false);return;}
    const h=e=>{if(e.key==="Escape"){if(fs)setFs(false);else onClose();}};
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[open,onClose,fs]);
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(20,40,20,.5)",backdropFilter:"blur(3px)",display:"flex",alignItems:fs?"stretch":"center",justifyContent:fs?"stretch":"center",padding:fs?0:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:G.surface,borderRadius:fs?0:16,width:"100%",maxWidth:fs?"100%":width,maxHeight:fs?"100vh":"94vh",display:"flex",flexDirection:"column",boxShadow:"0 28px 72px rgba(0,0,0,.28)",animation:"su .2s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:"1px solid "+G.border,flexShrink:0}}>
        <h2 style={{margin:0,fontSize:15,fontWeight:800,color:G.text}}>{title}</h2>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setFs(f=>!f)} title={fs?"Restaurar":"Maximizar"} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:G.muted,padding:"2px 6px",lineHeight:1,borderRadius:4,border:"1px solid "+G.border}}>{fs?"⊡":"⊞"}</button>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:G.muted,lineHeight:1,padding:4}}>✕</button>
        </div>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"18px 22px"}}>{children}</div>
      {footer&&<div style={{padding:"14px 22px",borderTop:"1px solid "+G.border,display:"flex",gap:8,justifyContent:"flex-end",flexShrink:0}}>{footer}</div>}
    </div>
  </div>;
}
function Logo({size=36}){
  return <svg width={size} height={size} viewBox="0 0 52 52">
    <rect x="0"  y="0"  width="23" height="23" rx="5" fill={G.green}/>
    <rect x="29" y="0"  width="23" height="23" rx="5" fill={G.red}/>
    <rect x="0"  y="29" width="23" height="23" rx="5" fill={G.gold}/>
    <rect x="29" y="29" width="23" height="23" rx="5" fill="#222"/>
  </svg>;
}
function Badge({n,color=G.red}){
  if(!n)return null;
  return <span style={{background:color,color:"#fff",borderRadius:20,fontSize:9,fontWeight:800,padding:"1px 5px",minWidth:16,textAlign:"center"}}>{n>99?"99+":n}</span>;
}
function EmptyState({icon="📭",title,subtitle}){
  return <div style={{textAlign:"center",padding:"60px 20px",color:G.light}}>
    <div style={{fontSize:52,marginBottom:12}}>{icon}</div>
    <div style={{fontSize:16,fontWeight:700,color:G.muted,marginBottom:6}}>{title}</div>
    {subtitle&&<div style={{fontSize:13}}>{subtitle}</div>}
  </div>;
}
function Section({title,right,children,style:sx={}}){
  return <div style={{marginBottom:20,...sx}}>
    {(title||right)&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      {title&&<div style={{fontSize:13,fontWeight:800,color:G.text,textTransform:"uppercase",letterSpacing:"0.05em"}}>{title}</div>}
      {right}
    </div>}
    {children}
  </div>;
}


// ══ PedidoForm ══

function PedidoForm({open,onClose,onSave,users,obras,fornecedores,onAutoCreate,cu}){
  const blank={
    numero:"", fornecedorId:"", obra:"", comprador:String(cu.id),
    valor:"", totalMercadorias:"", desconto:"", valorFrete:"",
    tipoFrete:"", condPagamento:"", datasVencimento:[],
    previsaoEntrega:"", localEntrega:"", observacao:"", itens:[]
  };
  const [mode,setMode]       = useState("pdf");
  const [f,setF]             = useState(blank);
  const [pdfLoad,setPdfLoad] = useState(false);
  const [pdfName,setPdfName] = useState("");
  const [preview,setPreview] = useState(null);
  const [itensTxt,setItensTxt]= useState("");
  const [errMsg,setErrMsg]   = useState("");
  const fileRef = useRef(null);

  useEffect(()=>{if(open){setF({...blank,comprador:String(cu.id)});setPdfName("");setPreview(null);setItensTxt("");setErrMsg("");setMode("pdf");}},[open]);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const comps=users.filter(u=>["comprador","coordenador"].includes(u.role)&&u.active);

  async function handlePDF(e){
    const file=e.target.files?.[0];if(!file)return;
    setPdfName(file.name);setPdfLoad(true);setPreview(null);setErrMsg("");
    const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=ev=>res(ev.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
    try{
      const parsed = await extractPedidoPDF(b64);

      // Anti-duplicate: obra e fornecedor
      const oResult = findOrCreateObra(obras, parsed);
      const fResult = findOrCreateFornecedor(fornecedores, parsed);
      if(oResult.created) onAutoCreate("obra", oResult.match);
      if(fResult.created) onAutoCreate("fornecedor", fResult.match);
      const obraFinal = oResult.match;
      const fornFinal = fResult.match;

      const almox = obraFinal ? users.find(u=>String(u.id)===String(obraFinal.almoxarife)) : null;
      const itens = (parsed.itens||[]).map(it=>({
        id:uid(),
        codigo:         String(it.codigo||""),
        descricao:      it.descricao||"",
        norma:          it.norma||"",
        unidade:        it.unidade||"un",
        quantidade:     Number(it.quantidade)||1,
        qtdEntregue:    0,
        valorUnitario:  String(it.valor_unitario||""),
        descontoRs:     String(it.desconto_rs||"0"),
        percDesconto:   String(it.perc_desconto||"0"),
        percIpi:        String(it.perc_ipi||"0"),
        percAcrescimo:  String(it.perc_acrescimo||"0"),
        valorFinal:     String(it.valor_final||it.valor_total||""),
        dataPrevisao:   it.data_previsao||parsed.data_entrega||"",
        status:         "pendente"
      }));

      setF({
        numero:           parsed.numero||"",
        fornecedorId:     fornFinal?String(fornFinal.id):"",
        obra:             obraFinal?String(obraFinal.id):"",
        comprador:        String(cu.id),
        valor:            parsed.valor_total||"",
        totalMercadorias: parsed.total_mercadorias||"",
        desconto:         parsed.desconto_total||"",
        valorFrete:       parsed.valor_frete||"",
        tipoFrete:        (parsed.tipo_frete||"").toUpperCase(),
        condPagamento:    parsed.cond_pagamento||"",
        datasVencimento:  parsed.datas_vencimento||[],
        previsaoEntrega:  parsed.data_entrega||"",
        localEntrega:     parsed.local_entrega||"",
        observacao:       parsed.observacoes||"",
        itens
      });
      setPreview({obraFinal,almox,fornFinal,parsed,itens,obraCreated:oResult.created,fornCreated:fResult.created});
    }catch(err){
      setErrMsg("Erro ao processar PDF: "+err.message+" — Verifique se o PDF não está protegido ou use o modo manual.");
    }
    setPdfLoad(false);e.target.value="";
  }

  function addItensManuais(){
    const novos=itensTxt.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{
      const parts=l.split("—").map(s=>s.trim());
      const [desc,resto]=parts;
      const [qtdS,unidade]=(resto||"").split(" ");
      return{id:uid(),descricao:desc||l,unidade:unidade||"un",quantidade:parseInt(qtdS)||1,qtdEntregue:0,valorUnitario:"",valorTotal:"",status:"pendente"};
    });
    setF(p=>({...p,itens:[...p.itens,...novos]}));setItensTxt("");
  }
  function removeItem(id){setF(p=>({...p,itens:p.itens.filter(x=>x.id!==id)}));}
  function updItem(id,k,v){setF(p=>({...p,itens:p.itens.map(x=>x.id===id?{...x,[k]:v}:x)}));}

  function submit(){
    if(!f.numero){alert("Informe o Nº do Pedido.");return;}
    if(!f.obra){alert("Selecione a Obra.");return;}
    const forn=fornecedores.find(x=>String(x.id)===String(f.fornecedorId));
    onSave({...f,fornecedor:forn?.nome||""});
    onClose();
  }

  const tbBtn=(m,l,i)=><button onClick={()=>setMode(m)} style={{padding:"8px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:mode===m?G.green:G.alt,color:mode===m?"#fff":G.muted}}>{i} {l}</button>;

  return(
    <Modal open={open} onClose={onClose} title="Novo Pedido de Compra" width={820} footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={submit} disabled={pdfLoad}>💾 Criar Pedido</Btn></>}>
      <div style={{display:"flex",gap:8,marginBottom:20}}>{tbBtn("pdf","Importar PDF Sienge","📄")}{tbBtn("manual","Manual","✏️")}</div>

      {mode==="pdf"&&<div>
        <div onClick={()=>fileRef.current?.click()} style={{border:"2px dashed "+(pdfName?G.green:G.border),borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:pdfName?"#E8F5E9":G.alt,marginBottom:16}}>
          {pdfLoad
            ?<div><div style={{fontSize:36,marginBottom:8}}>🤖</div><div style={{fontWeight:700,color:G.green,fontSize:15}}>IA processando o PDF…</div><div style={{fontSize:12,color:G.muted,marginTop:4}}>Extraindo pedido, obra, fornecedor e insumos</div></div>
            :pdfName
              ?<div><div style={{fontSize:36,marginBottom:6}}>✅</div><div style={{fontWeight:700,color:G.greenDark}}>{pdfName}</div><div style={{fontSize:12,color:G.muted}}>Clique para trocar</div></div>
              :<div><div style={{fontSize:44,marginBottom:8}}>📄</div><div style={{fontWeight:700,color:G.muted,fontSize:15}}>Clique para selecionar o PDF do Sienge</div><div style={{fontSize:12,color:G.light,marginTop:4}}>A IA preenche tudo. Obra e fornecedor criados automaticamente sem duplicidade.</div></div>}
          <input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={handlePDF}/>
        </div>
        {errMsg&&<div style={{background:"#FFEBEE",border:"1px solid #E74C3C40",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:G.red}}>❌ {errMsg}</div>}
        {preview&&<div style={{background:"#E8F5E9",border:"1px solid #A5D6A7",borderRadius:10,padding:14,marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:13,color:G.greenDark,marginBottom:10}}>✅ PDF processado com sucesso!</div>
          {(preview.obraCreated||preview.fornCreated)&&<div style={{background:"#E3F2FD",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#1565C0"}}>
            🤖 Criado automaticamente:{preview.obraCreated?" Obra "+preview.obraFinal?.code+" — "+preview.obraFinal?.name:""}
            {preview.fornCreated?" · Fornecedor "+preview.fornFinal?.nome:""}
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[["Pedido",f.numero],["Fornecedor",preview.fornFinal?.nome||"—"],["Obra",preview.obraFinal?preview.obraFinal.code+" — "+preview.obraFinal.name:"—"],["Almoxarife",preview.almox?.name||"Não vinculado"],["Valor",f.valor?"R$ "+f.valor:"—"],["Insumos",f.itens.length+" itens"]].map(([l,v])=>(
              <div key={l} style={{background:"#fff",borderRadius:8,padding:"8px 10px"}}>
                <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase"}}>{l}</div>
                <div style={{fontSize:12,fontWeight:600,color:G.text,marginTop:2}}>{v||"—"}</div>
              </div>
            ))}
          </div>
        </div>}
      </div>}

      {/* campos do formulário */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Fld label="Nº Pedido" required><Inp placeholder="76801" value={f.numero} onChange={e=>set("numero",e.target.value)}/></Fld>
        <Fld label="Fornecedor">
          <Sel value={f.fornecedorId} onChange={e=>set("fornecedorId",e.target.value)}>
            <option value="">Selecionar…</option>
            {fornecedores.filter(x=>x.ativo!==false).map(x=><option key={x.id} value={x.id}>{x.nome}{x.cnpj?" — "+x.cnpj:""}</option>)}
          </Sel>
        </Fld>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Fld label="Obra" required>
          <Sel value={f.obra} onChange={e=>set("obra",e.target.value)}>
            <option value="">Selecionar obra…</option>
            {obras.filter(o=>o.active).map(o=>{const a=users.find(u=>String(u.id)===String(o.almoxarife));return<option key={o.id} value={o.id}>{o.code} — {o.name}{a?" (Almox: "+a.name+")":""}</option>;})}
          </Sel>
        </Fld>
        <Fld label="Comprador" required>
          <Sel value={f.comprador} onChange={e=>set("comprador",e.target.value)}>
            {comps.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </Sel>
        </Fld>
      </div>
      <Fld label="Local de Entrega"><Inp value={f.localEntrega||""} onChange={e=>set("localEntrega",e.target.value)} placeholder="Endereço de entrega na obra"/></Fld>

      {/* Valores e Pagamento */}
      <div style={{background:"#F0F5F0",borderRadius:10,padding:"12px 14px",marginBottom:12,border:"1px solid #DDE8DD"}}>
        <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:10,letterSpacing:"0.06em"}}>💰 Valores e Pagamento</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0 12px"}}>
          <Fld label="Total Mercadorias (R$)"><Inp value={f.totalMercadorias||""} onChange={e=>set("totalMercadorias",e.target.value)} placeholder="0,00"/></Fld>
          <Fld label="Desconto (R$)"><Inp value={f.desconto||""} onChange={e=>set("desconto",e.target.value)} placeholder="0,00"/></Fld>
          <Fld label="TOTAL DO PEDIDO (R$)"><Inp value={f.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00" style={{fontWeight:700,background:"#E8F5E9",borderColor:"#4CAF50"}}/></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
          <Fld label="Tipo de Frete">
            <Sel value={f.tipoFrete||""} onChange={e=>set("tipoFrete",e.target.value)}>
              <option value="">—</option>
              <option value="FOB">FOB — por conta do comprador</option>
              <option value="CIF">CIF — por conta do vendedor</option>
            </Sel>
          </Fld>
          <Fld label={f.tipoFrete==="FOB"?"⚠️ Valor Frete FOB (R$)":"Valor Frete (R$)"}>
            <Inp value={f.valorFrete||""} onChange={e=>set("valorFrete",e.target.value)} placeholder="0,00"
              style={{borderColor:f.tipoFrete==="FOB"&&f.valorFrete?"#FF7043":"#DDE8DD",background:f.tipoFrete==="FOB"&&f.valorFrete?"#FBE9E7":"#fff"}}/>
          </Fld>
          <Fld label="Previsão de Entrega" required><Inp type="date" value={f.previsaoEntrega} onChange={e=>set("previsaoEntrega",e.target.value)}/></Fld>
        </div>
        {f.tipoFrete==="FOB"&&<div style={{background:"#FBE9E7",border:"1px solid #FF704330",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#E64A19",marginBottom:10,fontWeight:600}}>
          ⚠️ Frete FOB: o almoxarife deverá confirmar o recebimento do <strong>CT-e / Conhecimento de Frete</strong> no ato da entrega.
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Fld label="Condição de Pagamento"><Inp value={f.condPagamento||""} onChange={e=>set("condPagamento",e.target.value)} placeholder="ex: BOLETO 28 DIAS"/></Fld>
          <Fld label="Data(s) de Vencimento">
            <Inp value={(f.datasVencimento||[]).join(", ")} onChange={e=>set("datasVencimento",e.target.value.split(",").map(s=>s.trim()).filter(Boolean))} placeholder="YYYY-MM-DD, YYYY-MM-DD"/>
          </Fld>
        </div>
      </div>
      <Fld label="Observações"><Txa rows={2} value={f.observacao} onChange={e=>set("observacao",e.target.value)}/></Fld>

      {/* insumos */}
      <div style={{marginTop:4}}>
        <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:8}}>Insumos ({f.itens.length})</div>
        <div style={{background:G.alt,borderRadius:10,padding:12,marginBottom:10}}>
          <div style={{fontSize:12,color:G.muted,marginBottom:6}}>Adicionar manualmente (formato: "Nome do insumo — 50 kg"):</div>
          <Txa rows={2} value={itensTxt} onChange={e=>setItensTxt(e.target.value)} placeholder={"Cimento CP2 — 100 sc\nAreia média — 5 m3"}/>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}><Btn size="sm" variant="ghost" onClick={addItensManuais}>+ Adicionar</Btn></div>
        </div>
        {f.itens.length>0&&<div style={{border:"1px solid "+G.border,borderRadius:10,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"60px 1fr 55px 70px 70px 60px 60px 70px 24px",background:G.nav,padding:"8px 12px",fontSize:9,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",gap:4}}>
            <span>Código</span><span>Descrição</span><span>Un.</span><span>Qtd.</span><span>Vl.Unit.</span><span>%IPI</span><span>%Desc</span><span>Vl.Final</span><span></span>
          </div>
          {f.itens.map((it,i)=>(
            <div key={it.id} style={{display:"grid",gridTemplateColumns:"60px 1fr 55px 70px 70px 60px 60px 70px 24px",padding:"5px 12px",borderTop:"1px solid "+G.border,background:i%2===0?"#fff":G.alt,alignItems:"center",gap:4}}>
              <input value={it.codigo||""} onChange={e=>updItem(it.id,"codigo",e.target.value)} style={{...IB,padding:"3px 6px",fontSize:11}}/>
              <input value={it.descricao} onChange={e=>updItem(it.id,"descricao",e.target.value)} style={{...IB,padding:"3px 6px",fontSize:11}}/>
              <input value={it.unidade}   onChange={e=>updItem(it.id,"unidade",e.target.value)}   style={{...IB,padding:"3px 6px",fontSize:11}}/>
              <input type="number" value={it.quantidade} onChange={e=>updItem(it.id,"quantidade",Number(e.target.value))} style={{...IB,padding:"3px 6px",fontSize:11}}/>
              <input value={it.valorUnitario} onChange={e=>updItem(it.id,"valorUnitario",e.target.value)} style={{...IB,padding:"3px 6px",fontSize:11}}/>
              <input value={it.percIpi||"0"} onChange={e=>updItem(it.id,"percIpi",e.target.value)} style={{...IB,padding:"3px 6px",fontSize:11}}/>
              <input value={it.percDesconto||"0"} onChange={e=>updItem(it.id,"percDesconto",e.target.value)} style={{...IB,padding:"3px 6px",fontSize:11}}/>
              <input value={it.valorFinal||""} onChange={e=>updItem(it.id,"valorFinal",e.target.value)} style={{...IB,padding:"3px 6px",fontSize:11,fontWeight:700,background:"#E8F5E9"}}/>
              <button onClick={()=>removeItem(it.id)} style={{background:"none",border:"none",cursor:"pointer",color:G.light,fontSize:15,padding:0}}>✕</button>
            </div>
          ))}
        </div>}
      </div>
    </Modal>
  );
}


// ══ PedidoDetail ══

const STATUS_CFG = {
  pendente:   { label:"Pendente",   color:"#F4C430", bg:"#FFF8E1", icon:"⏳" },
  entregue:   { label:"Entregue",   color:"#4CAF50", bg:"#E8F5E9", icon:"✅" },
  parcial:    { label:"Parcial",    color:"#2196F3", bg:"#E3F2FD", icon:"📦" },
  cancelado:  { label:"Cancelado",  color:"#E74C3C", bg:"#FFEBEE", icon:"❌" },
  aguardando: { label:"Ag. Boleto", color:"#9C27B0", bg:"#F3E5F5", icon:"🧾" },
  atrasado:   { label:"Atrasado",   color:"#FF7043", bg:"#FBE9E7", icon:"⚠️" },
};
const ISTAT = {
  pendente: { label:"Pendente", color:"#F4C430", bg:"#FFF8E1", icon:"⏳" },
  parcial:  { label:"Parcial",  color:"#2196F3", bg:"#E3F2FD", icon:"📦" },
  entregue: { label:"Entregue", color:"#4CAF50", bg:"#E8F5E9", icon:"✅" },
};

// ── RESPOSTAS PRONTAS ─────────────────────────────────────────────────────────
const RESPOSTAS_PRONTAS = [
  "O material está previsto para chegar na data informada no pedido.",
  "Já estamos acompanhando o fornecedor, aguarde mais informações em breve.",
  "O boleto/NF será enviado em breve. Verifique sua caixa de entrada.",
  "Entregamos o que estava disponível. O saldo será entregue na próxima semana.",
  "Por favor, confirme o recebimento do material na nota fiscal.",
  "Entre em contato com o fornecedor diretamente pelo telefone cadastrado.",
  "O pedido está em trânsito, estimativa de chegada conforme data prevista.",
];

// ── EXPORTAR HISTÓRICO ────────────────────────────────────────────────────────
async function exportarHistorico(pedido, forn, obra, alm, comp) {
  // Gera PDF usando HTML + window.print (sem dependência externa)
  const STATUS_LABELS = {pendente:"Pendente",entregue:"Entregue",parcial:"Parcial",cancelado:"Cancelado",aguardando:"Ag. Boleto"};
  const itensRows = (pedido.itens||[]).map(it=>`
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${it.descricao}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.unidade}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.quantidade}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.qtdEntregue||0}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;color:${it.status==="entregue"?"#2E7D32":it.status==="parcial"?"#1565C0":"#E65100"}">${it.status}</td>
    </tr>`).join("");
  const msgsRows = (pedido.messages||[]).map(m=>`
    <tr>
      <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#666;white-space:nowrap">${fmtDT(m.createdAt)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#333;font-weight:600">${m.userName}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">${(m.text||"").replace(/<[^>]+>/g,"").replace(/\*\*/g,"")}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido ${pedido.numero}</title>
  <style>body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#1A2B1A}h1{color:#2E7D32;border-bottom:3px solid #4CAF50;padding-bottom:8px}h2{color:#2E7D32;font-size:14px;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:11px}.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px}.info-card{background:#F4F6F4;padding:8px 12px;border-radius:6px}.info-label{font-size:9px;font-weight:700;color:#5A7A5A;text-transform:uppercase}.info-val{font-size:12px;font-weight:600;margin-top:2px}th{background:#1B3A1B;color:#fff;padding:6px 8px;text-align:left;font-size:10px}td{padding:5px 8px;border-bottom:1px solid #eee}.total-row{background:#E8F5E9;font-weight:700}.fob-badge{background:#FBE9E7;color:#E64A19;padding:2px 8px;border-radius:4px;font-weight:700}.footer{margin-top:20px;font-size:10px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:10px}@media print{body{padding:10px}}</style></head>
  <body>
  <h1>📋 Pedido de Compra ${pedido.numero}</h1>
  <div class="info-grid">
    <div class="info-card"><div class="info-label">Fornecedor</div><div class="info-val">${forn?.nome||pedido.fornecedor||"—"}</div></div>
    <div class="info-card"><div class="info-label">Obra</div><div class="info-val">${obra?obra.code+" — "+obra.name:"—"}</div></div>
    <div class="info-card"><div class="info-label">Almoxarife</div><div class="info-val">${alm?.name||"—"}</div></div>
    <div class="info-card"><div class="info-label">Comprador</div><div class="info-val">${comp?.name||"—"}</div></div>
    <div class="info-card"><div class="info-label">Prev. Entrega</div><div class="info-val">${fmtD(pedido.previsaoEntrega)}</div></div>
    <div class="info-card"><div class="info-label">Status</div><div class="info-val">${STATUS_LABELS[pedido.status]||pedido.status}</div></div>
    <div class="info-card"><div class="info-label">Cond. Pagamento</div><div class="info-val">${pedido.condPagamento||"—"}</div></div>
    <div class="info-card"><div class="info-label">Vencimentos</div><div class="info-val">${(pedido.datasVencimento||[]).join(", ")||"—"}</div></div>
    <div class="info-card"><div class="info-label">Tipo Frete</div><div class="info-val">${pedido.tipoFrete?`<span class="fob-badge">${pedido.tipoFrete}</span>`:"—"} — R$ ${pedido.valorFrete||"0,00"}</div></div>
  </div>
  <h2>💰 Resumo Financeiro</h2>
  <table><tr><th>Total Mercadorias</th><th>Desconto</th><th>Frete</th><th>TOTAL DO PEDIDO</th></tr>
  <tr class="total-row"><td>R$ ${pedido.totalMercadorias||"—"}</td><td>R$ ${pedido.desconto||"0,00"}</td><td>R$ ${pedido.valorFrete||"0,00"} (${pedido.tipoFrete||"—"})</td><td style="font-size:14px">R$ ${pedido.valor||"—"}</td></tr></table>
  ${pedido.localEntrega?`<p style="font-size:11px;color:#666">📍 Entrega: ${pedido.localEntrega}</p>`:""}
  ${(pedido.itens||[]).length>0?`<h2>📦 Insumos</h2><table><thead><tr><th>Descrição</th><th>Un.</th><th>Qtd.</th><th>Entregue</th><th>Status</th></tr></thead><tbody>${itensRows}</tbody></table>`:""}
  ${(pedido.messages||[]).length>0?`<h2>💬 Histórico de Mensagens</h2><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Mensagem</th></tr></thead><tbody>${msgsRows}</tbody></table>`:""}
  <div class="footer">Exportado em ${fmtDT(new Date().toISOString())} — FACTEN Logística / Amorim Coutinho Engenharia</div>
  </body></html>`;
  const w = window.open("","_blank","width=900,height=700");
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),500);
}

// ── TAREFA BOLETO DETAIL ──────────────────────────────────────────────────────
function TarefaBoletoModal({open, onClose, tarefa, cu, onAnexo, onConcluir, toast}) {
  const fileRef = useRef(null);
  const [obs, setObs]           = useState("");
  const [pendentes, setPendentes] = useState([]); // arquivos selecionados aguardando confirmação
  const [confirmando, setConfirmando] = useState(false); // tela de confirmação
  if(!tarefa) return null;
  const anexos = tarefa.anexos || [];

  function handleFile(e) {
    const files = Array.from(e.target.files);
    const readers = [];
    files.forEach(file => {
      readers.push(new Promise(res => {
        const r = new FileReader();
        r.onload = ev => res({id:uid(), name:file.name, data:ev.target.result, by:cu.name, at:nowTs()});
        r.readAsDataURL(file);
      }));
    });
    Promise.all(readers).then(novos => {
      setPendentes(prev=>[...prev,...novos]);
      setConfirmando(true); // abre tela de confirmação
    });
    e.target.value = "";
  }

  function removerPendente(id){ setPendentes(p=>p.filter(x=>x.id!==id)); }

  function confirmarEnvio(){
    pendentes.forEach(a => onAnexo(tarefa.id, a));
    setPendentes([]);
    setConfirmando(false);
    toast("📎 "+pendentes.length+" arquivo(s) adicionado(s)!");
  }

  function cancelarSelecao(){ setPendentes([]); setConfirmando(false); }

  return (
    <Modal open={open} onClose={()=>{cancelarSelecao();onClose();}} title={"🧾 Boleto/NF — " + tarefa.title} width={580}
      footer={confirmando ? <>
        <Btn variant="secondary" onClick={cancelarSelecao}>← Cancelar Seleção</Btn>
        <Btn onClick={confirmarEnvio} style={{background:G.purple}}>
          ✅ Confirmar e Adicionar {pendentes.length} arquivo{pendentes.length>1?"s":""}
        </Btn>
      </> : <>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        {anexos.length > 0
          ? <Btn onClick={() => { onConcluir(tarefa.id); onClose(); }} style={{background:G.purple}}>
              📤 Enviar ao Almoxarife ({anexos.length} arquivo{anexos.length>1?"s":""})
            </Btn>
          : <span style={{fontSize:12,color:G.red,fontWeight:600}}>⚠️ Anexe pelo menos 1 boleto/NF</span>}
      </>}>

      {/* TELA DE CONFIRMAÇÃO */}
      {confirmando ? (
        <div>
          <div style={{background:"#FFF8E1",border:"1px solid #F4C430",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:14,color:"#5D4037",marginBottom:6}}>
              📋 Confirme os arquivos selecionados
            </div>
            <div style={{fontSize:12,color:"#6D4C41"}}>
              Revise os arquivos abaixo antes de adicionar. Você pode remover algum se necessário.
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
            {pendentes.map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:G.alt,borderRadius:10,border:"1px solid "+G.border}}>
                <span style={{fontSize:20}}>📎</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{a.name}</div>
                  <div style={{fontSize:10,color:G.muted}}>Selecionado por {a.by}</div>
                </div>
                <button onClick={()=>removerPendente(a.id)} style={{background:"none",border:"1.5px solid "+G.red,borderRadius:6,cursor:"pointer",color:G.red,fontSize:11,fontWeight:700,padding:"3px 8px"}}>✕ Remover</button>
              </div>
            ))}
          </div>
          {pendentes.length===0&&<div style={{textAlign:"center",color:G.light,padding:"20px 0",fontSize:13}}>Nenhum arquivo. Volte e selecione novamente.</div>}
        </div>
      ) : (
        <div>
          <div style={{background:"#F3E5F5",border:"1px solid #9C27B050",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#6A1B9A"}}>
            <div style={{fontWeight:700,marginBottom:4}}>🔄 Ciclo do Boleto/NF:</div>
            <div>1️⃣ <strong>Você</strong> — Seleciona e confirma os arquivos</div>
            <div>2️⃣ <strong>Almoxarife</strong> — Baixa e confirma o recebimento</div>
            <div>3️⃣ Ciclo encerrado ✅</div>
          </div>
          <Fld label="Observação (opcional)">
            <Txa rows={2} value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: NF 12345, boleto com vencimento 10/07..."/>
          </Fld>
          {anexos.length > 0 && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:6}}>
                Já Enviados ({anexos.length})
              </div>
              {anexos.map(a => (
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"#E8F5E9",borderRadius:8,marginBottom:4,border:"1px solid #A5D6A7"}}>
                  <span style={{fontSize:16}}>✅</span>
                  <a href={a.data} download={a.name} style={{fontSize:12,color:G.greenDark,textDecoration:"none",fontWeight:600,flex:1}}>⬇ {a.name}</a>
                  <span style={{fontSize:10,color:G.muted}}>por {a.by}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} style={{width:"100%",padding:"14px",borderRadius:10,border:"2px dashed "+G.purple,background:"#F9F0FF",cursor:"pointer",fontSize:13,fontWeight:700,color:G.purple}}>
            📎 Selecionar Boleto(s) / Nota(s) Fiscal
            <div style={{fontSize:10,fontWeight:400,marginTop:4,color:"#9C27B080"}}>
              Você poderá revisar antes de confirmar • PDF, JPG, PNG
            </div>
          </button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={handleFile}/>
        </div>
      )}
    </Modal>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
function PedidoDetail({open,onClose,pedido,users,obras,fornecedores,cu,onUpdateItens,onAddMsg,onBoleto,onDelete,onCancel,tarefas,setTarefas,toast}) {
  const [tab,setTab]           = useState("insumos");
  const [filtroIt,setFiltroIt] = useState("todos");
  const [msgTxt,setMsgTxt]     = useState("");
  const [aiLoad,setAiLoad]     = useState(false);
  const [aiSuggest,setAiSuggest] = useState("");
  const [showRespostas,setShowRespostas] = useState(false);
  const [showBoletoModal,setShowBoletoModal] = useState(null);
  const [confirmAcao,setConfirmAcao] = useState(null);
  const [itensEdit,setItensEdit] = useState({}); // {id: qtd} — edições pendentes de confirmação
  const [nfNumero,setNfNumero]   = useState(""); // número da NF para tarefa boleto
  const chatRef  = useRef(null);
  const fileRef  = useRef(null);

  useEffect(()=>{
    if(open){
      // Almoxarife começa na aba de insumos; comprador começa em insumos também
      setTab("insumos");
      setConfirmAcao(null);
      setAiSuggest("");
      setShowRespostas(false);
    }
  },[open]);
  useEffect(()=>{ if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; },[pedido?.messages?.length,tab]);

  if(!pedido) return null;

  const atrasado  = isAtrasado(pedido);
  const cfg       = STATUS_CFG[atrasado?"atrasado":pedido.status] || STATUS_CFG.pendente;
  const obra      = obras.find(o=>String(o.id)===String(pedido.obra));
  const forn      = fornecedores.find(f=>String(f.id)===String(pedido.fornecedorId)) || {nome:pedido.fornecedor||""};
  const alm       = obra ? users.find(u=>String(u.id)===String(obra.almoxarife)) : null;
  const comp      = users.find(u=>String(u.id)===String(pedido.comprador));
  const itens     = pedido.itens || [];
  const nTot      = itens.length;
  const nEnt      = itens.filter(i=>i.status==="entregue").length;
  const nPar      = itens.filter(i=>i.status==="parcial").length;
  const nPend     = nTot - nEnt - nPar;
  const pct       = nTot>0 ? Math.round(((nEnt+nPar*.5)/nTot)*100) : 0;
  const isAlmox   = ["almoxarife","aux_almoxarife","coordenador"].includes(cu.role);
  const isComp    = ["comprador","coordenador"].includes(cu.role);
  const myTarefas = tarefas.filter(t=>t.pedidoId===pedido.id);
  const isCancelado = pedido.status === "cancelado";

  // ── ITENS ──────────────────────────────────────────────────────────────────
  function marcarItem(id, novoStatus, qtdEntregue) {
    const novos = itens.map(it => it.id===id ? {...it, status:novoStatus, qtdEntregue:qtdEntregue??it.qtdEntregue, updatedBy:cu.name, updatedAt:nowTs()} : it);
    const ne    = novos.filter(i=>i.status==="entregue").length;
    const ns    = nTot>0 ? (ne===nTot ? "entregue" : novos.every(i=>i.status==="pendente") ? "pendente" : "parcial") : pedido.status;
    onUpdateItens(pedido.id, novos, ns);
    // apenas gera registro no pedido, SEM criar tarefa
    if(ns==="parcial" && pedido.status!=="parcial") {
      const pendentes = novos.filter(i=>i.status!=="entregue").map(i=>i.descricao).join(", ");
      onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
        text:`📦 **Entrega parcial** registrada por ${cu.name}. Itens ainda pendentes: ${pendentes}`,
        type:"sistema", createdAt:nowTs()});
      toast("📦 Entrega parcial salva no pedido!");
    }
    if(ns==="entregue" && pedido.status!=="entregue") {
      onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
        text:`✅ **Entrega total** confirmada por ${cu.name} em ${fmtDT(nowTs())}`,
        type:"sistema", createdAt:nowTs()});
      toast("✅ Entrega total confirmada!");
    }
  }

  function setQtd(id, qtd) {
    const it = itens.find(i=>i.id===id); if(!it) return;
    const q  = Math.min(Math.max(0, Number(qtd)), it.quantidade);
    setItensEdit(prev=>({...prev,[id]:q}));
  }

  function confirmarEntregas() {
    const pendentes = Object.entries(itensEdit);
    if(pendentes.length===0){toast("Nenhuma alteração para confirmar.");return;}
    // FOB: require CT-e confirmation
    if(pedido.tipoFrete==="FOB" && !pedido.cteConfirmado){
      toast("⚠️ Frete FOB: confirme o recebimento do CT-e antes de registrar a entrega.");
      return;
    }

    // Apply edits
    let novos = [...itens];
    pendentes.forEach(([id,q])=>{
      novos = novos.map(it=>it.id===id?{...it,qtdEntregue:Number(q),status:Number(q)<=0?"pendente":Number(q)>=it.quantidade?"entregue":"parcial",updatedBy:cu.name,updatedAt:nowTs()}:it);
    });
    const ne  = novos.filter(i=>i.status==="entregue").length;
    const ns  = novos.length>0?(ne===novos.length?"entregue":novos.every(i=>i.status==="pendente")?"pendente":"parcial"):pedido.status;
    const prevStatus = pedido.status;

    onUpdateItens(pedido.id, novos, ns);

    // ── Tarefa inicial de acompanhamento (criada ao criar pedido)
    // Identificada como a tarefa com titulo sem "parcial"
    const tarefaInicial = tarefas.find(t=>
      t.pedidoId===pedido.id &&
      t.categoria==="acompanhamento" &&
      !t.title.toLowerCase().includes("parcial")
    );

    // 3b — Entrega PARCIAL: finaliza tarefa inicial (robô) e cria nova tarefa parcial
    if(ns==="parcial" && prevStatus!=="parcial"){
      const pendList = novos.filter(i=>i.status!=="entregue").map(i=>`${i.descricao} (${i.qtdEntregue}/${i.quantidade} ${i.unidade})`).join(", ");

      onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,
        text:`📦 **Entrega parcial** confirmada por ${cu.name}. Itens pendentes: ${pendList}`,
        type:"sistema",createdAt:nowTs()});

      // Robô finaliza tarefa inicial
      if(tarefaInicial && tarefaInicial.status!=="resolvida"){
        setTarefas(ts=>ts.map(t=>t.id===tarefaInicial.id?{...t,
          status:"resolvida",
          resolvidaEm:nowTs(),
          resolvidaPor:"Sistema (entrega parcial confirmada)"
        }:t));
      }

      // Cria UMA nova tarefa de parcial (evita duplicar)
      const jaTemParcial = tarefas.find(t=>t.pedidoId===pedido.id&&t.categoria==="acompanhamento"&&t.title.toLowerCase().includes("parcial")&&t.status!=="resolvida");
      if(!jaTemParcial){
        setTarefas(ts=>[{
          id:uid(), categoria:"acompanhamento",
          title:`Entrega parcial — Pedido ${pedido.numero} (${forn.nome})`,
          description:`Almoxarife ${cu.name} confirmou entrega parcial em ${fmtDT(nowTs())}. Saldo pendente: ${pendList}`,
          status:"aberta", pedidoId:pedido.id, obra:pedido.obra,
          assignedTo:Number(pedido.comprador), due:pedido.previsaoEntrega||"",
          anexos:[], messages:[], createdBy:"Sistema", createdAt:nowTs()
        },...ts]);
      }
    }

    // 3c — Entrega TOTAL: robô finaliza TODAS as tarefas de acompanhamento abertas
    if(ns==="entregue" && prevStatus!=="entregue"){
      onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,
        text:`✅ **Entrega total** confirmada por ${cu.name} em ${fmtDT(nowTs())}. Todos os ${novos.length} itens recebidos.`,
        type:"sistema",createdAt:nowTs()});

      // Robô fecha todas as tarefas de acompanhamento abertas deste pedido
      setTarefas(ts=>ts.map(t=>{
        if(t.pedidoId===pedido.id && t.categoria==="acompanhamento" && t.status!=="resolvida"){
          return{...t,status:"resolvida",resolvidaEm:nowTs(),resolvidaPor:"Sistema (entrega total confirmada)"};
        }
        return t;
      }));
    }

    // 3d — Reabertura: se status voltou de entregue para parcial/pendente,
    // reativa a última tarefa de acompanhamento resolvida pelo sistema
    if((ns==="parcial"||ns==="pendente") && prevStatus==="entregue"){
      const ultimaFechada = [...tarefas]
        .filter(t=>t.pedidoId===pedido.id && t.categoria==="acompanhamento" && t.status==="resolvida" && t.resolvidaPor?.includes("Sistema"))
        .sort((a,b)=>new Date(b.resolvidaEm||0)-new Date(a.resolvidaEm||0))[0];

      if(ultimaFechada){
        setTarefas(ts=>ts.map(t=>t.id===ultimaFechada.id?{...t,
          status:"aberta",
          resolvidaEm:null,
          resolvidaPor:null,
          description:t.description+`
[Reaberta em ${fmtDT(nowTs())} — pedido voltou para ${ns}]`
        }:t));
        onAddMsg(pedido.id,{id:uid(),userId:0,userName:"Sistema",avatar:"🤖",
          text:`⚠️ Pedido reaberto — status voltou para **${ns}**. Tarefa de acompanhamento reativada.`,
          type:"sistema",createdAt:nowTs()});
        toast("⚠️ Pedido reaberto — tarefa de acompanhamento reativada!");
      }
    }

    setItensEdit({});
    toast(ns==="entregue"?"✅ Entrega total confirmada!":ns==="parcial"?"📦 Entrega parcial confirmada!":ns==="pendente"?"↩ Itens revertidos para pendente.":"Atualizado.");
  }

  function marcarTodosEntregues() {
    // Set all items as entregue in pending state, then confirm
    const edits = {};
    itens.forEach(it=>{ edits[it.id]=it.quantidade; });
    setItensEdit(edits);
    toast("✅ Todos marcados — clique em Confirmar para salvar.");
  }

  // ── CHAT ───────────────────────────────────────────────────────────────────
  async function sendMsg(textoForcado) {
    const txt = (textoForcado || msgTxt).trim();
    if(!txt) return;
    setMsgTxt("");
    setAiSuggest("");
    setShowRespostas(false);
    onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar, text:txt, type:"chat", createdAt:nowTs()});
    // IA responde pelo comprador ao almoxarife quando dentro do prazo
    if(isAlmox && !isComp && !atrasado) {
      setAiLoad(true);
      try {
        const resp = await callIA([{role:"user", content:
          `Você é o comprador ${comp?.name||"Comprador"} respondendo ao almoxarife ${cu.name} sobre o pedido ${pedido.numero} (${forn.nome}). Previsão de entrega: ${fmtD(pedido.previsaoEntrega)}. Pergunta: "${txt}". Responda de forma breve e profissional.`
        }], 300, "Assistente de compras da Amorim Coutinho. Responda de forma concisa em português.");
        onAddMsg(pedido.id, {id:uid(), userId:0, userName:(comp?.name||"Comprador")+" (IA)", avatar:"🤖", text:"🤖 "+resp, type:"ia", createdAt:nowTs()});
      } catch {
        onAddMsg(pedido.id, {id:uid(), userId:0, userName:"Sistema", avatar:"🤖", text:"🤖 Sem resposta automática disponível.", type:"ia", createdAt:nowTs()});
      }
      setAiLoad(false);
    }
    // detectar boleto/NF
    const lo = txt.toLowerCase();
    if((lo.includes("boleto")||lo.includes("nota fiscal")||lo.includes(" nf "))&&isAlmox) {
      criarTarefaBoleto();
    }
  }

  async function sugerirTextoIA() {
    if(!msgTxt.trim()) { toast("Digite algo primeiro para sugerir correção."); return; }
    setAiLoad(true);
    try {
      const resp = await callIA([{role:"user", content:
        `Melhore ou corrija este texto para comunicação profissional entre almoxarife e comprador em obra de construção: "${msgTxt}". Retorne APENAS o texto corrigido, sem explicações.`
      }], 200, "Corrija textos para comunicação profissional em português. Retorne apenas o texto corrigido.");
      setAiSuggest(resp.trim());
    } catch { toast("Erro ao sugerir texto."); }
    setAiLoad(false);
  }

  function criarTarefaBoleto(nfNum) {
    if(!nfNum||!nfNum.trim()){toast("Informe o número da NF antes de criar a tarefa.");return;}
    const exists = tarefas.find(t=>t.pedidoId===pedido.id&&t.categoria==="boleto"&&t.status!=="resolvida");
    if(exists) { toast("Já existe tarefa de boleto aberta para este pedido."); return; }
    const nova = {
      id:uid(), categoria:"boleto",
      title:`Boleto/NF pendente — NF ${nfNum.trim()} — Pedido ${pedido.numero} (${forn.nome})`,
      description:`Almoxarife ${cu.name} informou que a NF ${nfNum.trim()} chegou sem boleto/CT-e. Pedido ${pedido.numero}, Fornecedor: ${forn.nome}. O comprador deve anexar o boleto para que o almoxarife possa confirmar o recebimento.`,
      status:"aberta",
      pedidoId:pedido.id, obra:pedido.obra,
      assignedTo:Number(pedido.comprador), // começa com comprador
      criadoPorAlmox:cu.id,               // almoxarife que criou
      criadoPorAlmoxNome:cu.name,
      due:pedido.previsaoEntrega||"",
      anexos:[], messages:[], createdBy:cu.name, createdAt:nowTs()
    };
    setTarefas(ts=>[nova,...ts]);
    onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
      text:`🧾 Material recebido sem boleto. **NF ${nfNum.trim()}** — Tarefa criada para o comprador.`,
      type:"sistema", createdAt:nowTs()});
    setNfNumero("");
    toast("🧾 Tarefa de boleto/NF criada!");
  }

  function handleFile(e) {
    Array.from(e.target.files).forEach(file => {
      const r = new FileReader();
      r.onload = ev => {
        onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
          text:`📎 Arquivo: **${file.name}**`, type:"anexo",
          anexo:{name:file.name, data:ev.target.result}, createdAt:nowTs()});
      };
      r.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function onAnexoTarefa(tarefaId, anexo) {
    // Quando comprador anexa boleto:
    // 1. Adiciona o anexo
    // 2. Muda status para "andamento" (volta para almoxarife)
    // 3. Muda assignedTo para o almoxarife da obra
    const tarefa = tarefas.find(t=>t.id===tarefaId);
    const obra = obras.find(o=>String(o.id)===String(pedido.obra));
    const almoxId = obra?.almoxarife || tarefa?.assignedTo;
    setTarefas(ts => ts.map(t => t.id===tarefaId ? {
      ...t,
      anexos: [...(t.anexos||[]), anexo],
      status: "andamento",
      assignedTo: almoxId, // volta para almoxarife
      boletoEnviadoPor: cu.name,
      boletoEnviadoEm: nowTs(),
    } : t));
    onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
      text:`🧾 **Boleto/NF anexado** por ${cu.name}: **${anexo.name}**. Aguardando confirmação do almoxarife.`,
      type:"sistema", createdAt:nowTs()});
    toast("📎 Boleto enviado! Aguardando confirmação do almoxarife.");
  }

  function concluirTarefaBoleto(tarefaId) {
    // Comprador clicou "Enviar & Concluir" no modal
    // Tarefa vai para "andamento" e é reatribuída ao almoxarife
    // (o onAnexoTarefa já faz isso ao adicionar cada arquivo)
    // Aqui apenas garantimos o estado correto
    const tarefa = tarefas.find(t=>t.id===tarefaId);
    const obra = obras.find(o=>String(o.id)===String(pedido.obra));
    const almoxId = obra?.almoxarife || tarefa?.assignedTo;
    setTarefas(ts => ts.map(t => t.id===tarefaId ? {
      ...t,
      status: "andamento",
      assignedTo: almoxId,
      boletoEnviadoPor: cu.name,
      boletoEnviadoEm: nowTs(),
    } : t));
    // Tarefa NÃO some para o comprador — fica como "Enviado, aguardando almoxarife"
  }

  // ── EXCLUIR / CANCELAR ──────────────────────────────────────────────────────
  function confirmarAcao() {
    if(confirmAcao==="excluir") {
      onDelete(pedido.id);
      onClose();
      toast("🗑️ Pedido excluído.");
    } else if(confirmAcao==="cancelar") {
      onCancel(pedido.id);
      setConfirmAcao(null);
      toast("❌ Pedido cancelado.");
    }
  }

  const tabS = k => ({padding:"7px 15px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:tab===k?G.green:G.alt,color:tab===k?"#fff":G.muted});
  const itFilt = itens.filter(it => filtroIt==="todos" ? true : filtroIt==="pendente" ? it.status!=="entregue" : it.status==="entregue");

  return (<>
    <Modal open={open} onClose={onClose} title={`Pedido ${pedido.numero} — ${forn.nome}`} width={940}>
      {/* STATUS BAR */}
      <div style={{background:cfg.bg,border:"1px solid "+cfg.color+"30",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{cfg.icon}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:cfg.color}}>{cfg.label}</div>
            <div style={{fontSize:11,color:G.muted}}>Criado por {pedido.createdBy} em {fmtD(pedido.createdAt)}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {nTot>0&&<div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:G.muted,marginBottom:3}}>{nEnt}/{nTot} entregues · {pct}%</div>
            <div style={{background:G.border,borderRadius:4,height:7,width:120,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:G.green,width:pct+"%",transition:"width .4s"}}/></div>
          </div>}
          {atrasado&&<Chip color={G.orange} bg="#FBE9E7">⚠️ Atrasado</Chip>}
          {/* Botão exportar histórico */}
          <button onClick={()=>exportarHistorico(pedido,forn,obra,alm,comp)} title="Exportar histórico do pedido" style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid "+G.border,background:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:G.muted}}>📥 Histórico</button>
          {/* Cancelar / Excluir — só comprador e não cancelado */}
          {isComp && !isCancelado && <button onClick={()=>setConfirmAcao("cancelar")} style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid "+G.orange,background:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:G.orange}}>❌ Cancelar</button>}
          {isComp && <button onClick={()=>setConfirmAcao("excluir")} style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid "+G.red,background:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:G.red}}>🗑️ Excluir</button>}
        </div>
      </div>

      {/* CONFIRM AÇÃO */}
      {confirmAcao&&<div style={{background:"#FFEBEE",border:"1px solid "+G.red+"50",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div style={{fontSize:13,fontWeight:700,color:G.red}}>
          {confirmAcao==="excluir"?"🗑️ Confirma a EXCLUSÃO PERMANENTE deste pedido?":"❌ Confirma o CANCELAMENTO deste pedido?"}
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="secondary" size="sm" onClick={()=>setConfirmAcao(null)}>Não</Btn>
          <Btn variant="danger"    size="sm" onClick={confirmarAcao}>Sim, confirmar</Btn>
        </div>
      </div>}

      {/* INFO GRID */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
        {[
          {l:"Obra",       v:obra?obra.code+" — "+obra.name:"—"},
          {l:"Almoxarife", v:alm?.name||"—", c:G.blue},
          {l:"Comprador",  v:comp?.name||"—", c:G.green},
          {l:"Fornecedor", v:forn.nome||"—"},
        ].map(row=>(
          <div key={row.l} style={{background:G.alt,borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:1}}>{row.l}</div>
            <div style={{fontSize:12,fontWeight:600,color:row.c||G.text,lineHeight:1.3}}>{row.v}</div>
          </div>
        ))}
      </div>

      {/* FINANCEIRO */}
      <div style={{background:"#F0F5F0",borderRadius:10,padding:"10px 14px",marginBottom:10,border:"1px solid #DDE8DD"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>Total Mercadorias</div>
            <div style={{fontSize:13,fontWeight:700}}>{pedido.totalMercadorias?"R$ "+pedido.totalMercadorias:"—"}</div>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>
              Frete {pedido.tipoFrete&&<span style={{background:pedido.tipoFrete==="FOB"?"#FBE9E7":"#E8F5E9",color:pedido.tipoFrete==="FOB"?G.orange:G.green,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:800,marginLeft:4}}>{pedido.tipoFrete}</span>}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:pedido.tipoFrete==="FOB"?G.orange:G.text}}>{pedido.valorFrete?"R$ "+pedido.valorFrete:"—"}</div>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>TOTAL DO PEDIDO</div>
            <div style={{fontSize:15,fontWeight:800,color:G.greenDark}}>{pedido.valor?"R$ "+pedido.valor:"—"}</div>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>Pagamento</div>
            <div style={{fontSize:12,fontWeight:600}}>{pedido.condPagamento||"—"}</div>
            {(pedido.datasVencimento||[]).length>0&&<div style={{fontSize:10,color:G.muted,marginTop:2}}>Venc: {(pedido.datasVencimento||[]).map(fmtD).join(", ")}</div>}
          </div>
        </div>
        {pedido.desconto&&pedido.desconto!=="0"&&pedido.desconto!=="0.00"&&<div style={{fontSize:11,color:G.muted,marginTop:6}}>Desconto: R$ {pedido.desconto}</div>}
      </div>

      {/* FOB ALERT */}
      {pedido.tipoFrete==="FOB"&&<div style={{background:"#FBE9E7",border:"1px solid #FF704330",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#E64A19",fontWeight:600}}>
        ⚠️ Frete <strong>FOB</strong> — almoxarife deve confirmar recebimento do <strong>CT-e / Conhecimento de Frete</strong> na entrega.
      </div>}
      {pedido.localEntrega&&<div style={{background:G.alt,borderRadius:8,padding:"6px 12px",marginBottom:8,fontSize:11,color:G.muted}}>
        📍 {pedido.localEntrega}
      </div>}
      {pedido.observacao&&<div style={{background:"#FFFDE7",border:"1px solid #F4C43040",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12}}>📝 {pedido.observacao}</div>}

      {/* TABS */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        <button style={tabS("insumos")} onClick={()=>setTab("insumos")}>📦 Insumos ({nEnt}/{nTot})</button>
        <button style={tabS("chat")} onClick={()=>setTab("chat")}>
          💬 {isAlmox&&!isComp?"Conversar com Comprador":"Chat"}
          {(pedido.messages||[]).filter(m=>m.type==="chat").length>0&&
            <span style={{marginLeft:4,background:G.blue,color:"#fff",borderRadius:10,fontSize:9,padding:"1px 5px",fontWeight:800}}>
              {(pedido.messages||[]).filter(m=>m.type==="chat").length}
            </span>}
        </button>
        <button style={tabS("tarefas")} onClick={()=>setTab("tarefas")}>📋 Tarefas ({myTarefas.filter(t=>t.status!=="resolvida").length} abertas)</button>
      </div>

      {/* ── TAB INSUMOS ── */}
      {tab==="insumos"&&(nTot===0
        ?<div style={{textAlign:"center",padding:"40px 0",color:G.light}}><div style={{fontSize:36}}>📋</div><div style={{marginTop:8,fontSize:14}}>Nenhum insumo cadastrado</div></div>
        :<div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:4}}>
              {[["todos",`Todos (${nTot})`],["pendente",`Pendentes (${nPend+nPar})`],["entregue",`Entregues (${nEnt})`]].map(([k,l])=>(
                <button key={k} onClick={()=>setFiltroIt(k)} style={{padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filtroIt===k?G.green:G.alt,color:filtroIt===k?"#fff":G.muted}}>{l}</button>
              ))}
            </div>
            <div style={{flex:1}}/>
            {isAlmox&&!isCancelado&&<>
              <Btn size="sm" onClick={marcarTodosEntregues}>✅ Todos entregues</Btn>
              {Object.keys(itensEdit).length>0&&<button onClick={confirmarEntregas} style={{padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",background:G.purple,color:"#fff",fontSize:11,fontWeight:700,animation:"pulse 1s infinite"}}>💾 Confirmar ({Object.keys(itensEdit).length})</button>}
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                <input value={nfNumero} onChange={e=>setNfNumero(e.target.value)} placeholder="Nº da NF" style={{width:90,padding:"5px 8px",borderRadius:8,border:"1.5px solid "+G.purple,fontSize:11,outline:"none",fontFamily:"Inter,sans-serif"}}/>
                <button onClick={()=>criarTarefaBoleto(nfNumero)} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid "+G.purple,background:nfNumero.trim()?"#F3E5F5":"none",cursor:"pointer",fontSize:11,fontWeight:700,color:G.purple}}>🧾 Sem Boleto/NF</button>
              </div>
            </>}
          </div>

          {/* FOB CT-e confirmation */}
          {pedido.tipoFrete==="FOB"&&isAlmox&&!isCancelado&&<div style={{background:"#FBE9E7",border:"1px solid "+G.orange+"40",borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
            <input type="checkbox" id="cte_check" checked={!!pedido.cteConfirmado}
              onChange={e=>{onUpdateItens(pedido.id,itens,pedido.status,{cteConfirmado:e.target.checked});
                if(e.target.checked){onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"📋 CT-e / Conhecimento de Frete **confirmado** pelo almoxarife "+cu.name,type:"sistema",createdAt:nowTs()});}
              }} style={{width:18,height:18,cursor:"pointer"}}/>
            <label htmlFor="cte_check" style={{fontSize:13,fontWeight:700,color:"#E64A19",cursor:"pointer"}}>
              ⚠️ Confirmar recebimento do <strong>CT-e / Conhecimento de Frete</strong> (obrigatório — Frete FOB)
            </label>
            {pedido.cteConfirmado&&<span style={{fontSize:12,color:G.green,fontWeight:700,marginLeft:"auto"}}>✅ CT-e confirmado</span>}
          </div>}

          {/* progresso */}
          <div style={{background:G.alt,borderRadius:10,padding:"9px 14px",marginBottom:10,display:"flex",gap:14,alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:G.muted,marginBottom:3}}>
                <span>Progresso da entrega</span>
                <span style={{fontWeight:700,color:G.greenDark}}>{pct}%{nEnt===nTot&&nTot>0?" ✅ ENTREGA TOTAL":""}</span>
              </div>
              <div style={{background:"#fff",borderRadius:6,height:10,overflow:"hidden"}}><div style={{height:"100%",borderRadius:6,background:`linear-gradient(90deg,${G.green},${G.greenDark})`,width:pct+"%",transition:"width .4s"}}/></div>
            </div>
            {[["✅",nEnt,G.green],["📦",nPar,G.blue],["⏳",nPend,G.gold]].map(([ic,n,col])=>(
              <div key={ic} style={{textAlign:"center",minWidth:36}}><div style={{fontSize:16}}>{ic}</div><div style={{fontSize:15,fontWeight:800,color:col}}>{n}</div></div>
            ))}
          </div>

          {/* tabela */}
          <div style={{border:"1px solid "+G.border,borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"50px 1fr 50px 60px 70px 55px 55px 75px 80px 140px",background:G.nav,padding:"7px 10px",fontSize:9,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",gap:5}}>
              <span>Cód.</span><span>Insumo</span><span>Un.</span><span>Qtd.</span><span>Vl.Unit.</span><span>%IPI</span><span>%Desc</span><span>Vl.Final</span><span>Entregue</span><span>Status / Ação</span>
            </div>
            {itFilt.map((it,idx)=>{
              const ist = ISTAT[it.status]||ISTAT.pendente;
              return(
                <div key={it.id} style={{display:"grid",gridTemplateColumns:"50px 1fr 50px 60px 70px 55px 55px 75px 80px 140px",padding:"8px 10px",borderTop:"1px solid "+G.border,background:idx%2===0?"#fff":G.alt,alignItems:"center",gap:5}}>
                  <div style={{fontSize:10,color:G.muted,fontFamily:"monospace"}}>{it.codigo||"—"}</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:12}}>{it.descricao}</div>
                    {it.norma&&<div style={{fontSize:9,color:G.light}}>Norma: {it.norma}</div>}
                    {it.updatedBy&&<div style={{fontSize:9,color:G.light}}>Por {it.updatedBy} · {fmtD(it.updatedAt)}</div>}
                    {it.dataPrevisao&&<div style={{fontSize:9,color:G.muted}}>Prev: {fmtD(it.dataPrevisao)}</div>}
                  </div>
                  <div style={{fontSize:11,color:G.muted,textAlign:"center"}}>{it.unidade}</div>
                  <div style={{fontSize:12,fontWeight:700,textAlign:"center"}}>{it.quantidade}</div>
                  <div style={{fontSize:11,textAlign:"right"}}>R$ {it.valorUnitario||"—"}</div>
                  <div style={{fontSize:11,textAlign:"center",color:it.percIpi&&it.percIpi!=="0"?G.orange:G.muted}}>{it.percIpi||"0"}%</div>
                  <div style={{fontSize:11,textAlign:"center",color:it.percDesconto&&it.percDesconto!=="0"?G.blue:G.muted}}>{it.percDesconto||"0"}%</div>
                  <div style={{fontSize:12,fontWeight:700,textAlign:"right",color:G.greenDark}}>R$ {it.valorFinal||it.valorUnitario||"—"}</div>
                  <div>
                    {isAlmox&&!isCancelado
                      ?<input type="number" min="0" max={it.quantidade}
                          value={itensEdit[it.id]!==undefined?itensEdit[it.id]:it.qtdEntregue||0}
                          onChange={e=>setQtd(it.id,e.target.value)}
                          style={{...IB,width:68,padding:"4px 8px",fontSize:12,textAlign:"center",
                            borderColor:itensEdit[it.id]!==undefined?G.purple:"#DDE8DD",
                            background:itensEdit[it.id]!==undefined?"#F3E5F5":"#fff"}}/>
                      :<span style={{fontSize:12}}>{it.qtdEntregue||0}</span>}
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    <Chip color={ist.color} bg={ist.bg} style={{fontSize:10}}>{ist.icon} {ist.label}</Chip>
                    {isAlmox&&!isCancelado&&it.status!=="entregue"&&<button onClick={()=>setItensEdit(prev=>({...prev,[it.id]:it.quantidade}))} style={{padding:"2px 6px",borderRadius:5,border:"none",cursor:"pointer",background:G.green+"22",color:G.greenDark,fontSize:11,fontWeight:700}}>✅</button>}
                    {isAlmox&&it.status==="entregue"&&<button onClick={()=>setItensEdit(prev=>({...prev,[it.id]:0}))} style={{padding:"2px 6px",borderRadius:5,border:"none",cursor:"pointer",background:G.gold+"22",color:G.goldDark,fontSize:11,fontWeight:700}}>↩</button>}
                    {itensEdit[it.id]!==undefined&&<span style={{fontSize:9,color:G.purple,fontWeight:700}}>•</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB CHAT ── */}
      {tab==="chat"&&(
        <div>
          <div style={{background:"#E3F2FD",border:"1px solid #90CAF9",borderRadius:8,padding:"10px 14px",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:"#1565C0",marginBottom:4}}>
              💬 Canal direto — {isAlmox&&!isComp?"Almoxarife → Comprador":"Comprador → Almoxarife"}
            </div>
            <div style={{fontSize:11,color:"#1976D2",lineHeight:1.5}}>
              {isAlmox&&!isComp
                ? "Use este canal para enviar mensagens ao comprador sobre este pedido. Perguntas sobre prazo, boleto ou status são respondidas automaticamente quando o pedido está dentro do prazo."
                : "Mensagens do almoxarife sobre este pedido. Responda aqui ou use as tarefas na aba ao lado."}
            </div>
          </div>
          {/* Almoxarife com chat vazio: botão destacado para iniciar */}
          {isAlmox&&!isComp&&!(pedido.messages||[]).filter(m=>m.type==="chat"||m.type==="sistema").length&&(
            <div style={{background:"#F3E5F5",border:"1px solid #CE93D8",borderRadius:10,padding:"16px 20px",textAlign:"center",marginBottom:10}}>
              <div style={{fontSize:20,marginBottom:6}}>💬</div>
              <div style={{fontSize:13,fontWeight:700,color:G.purple,marginBottom:4}}>Iniciar conversa com o comprador</div>
              <div style={{fontSize:11,color:G.muted,marginBottom:12}}>Tire dúvidas sobre prazo de entrega, boleto, status do pedido e mais.</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                {["Quando o material chega?","Pode me enviar o boleto?","Qual o status da entrega?","Houve algum problema com o material."].map(sugestao=>(
                  <button key={sugestao} onClick={()=>setMsgTxt(sugestao)}
                    style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid "+G.purple,background:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,color:G.purple}}>
                    {sugestao}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* mensagens */}
          <div ref={chatRef} style={{background:G.alt,borderRadius:10,padding:12,minHeight:180,maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {!(pedido.messages?.length)&&<div style={{color:G.light,fontSize:13,textAlign:"center",marginTop:50}}>Sem mensagens ainda.</div>}
            {(pedido.messages||[]).map(m=>(
              <div key={m.id} style={{display:"flex",gap:8,flexDirection:cu.id===m.userId?"row-reverse":"row"}}>
                <div style={{fontSize:18}}>{typeof m.avatar==="string"&&m.avatar.length>2?m.avatar:<Av s={m.avatar||"?"} size={26} color={m.type==="ia"?G.greenDark:G.green}/>}</div>
                <div style={{maxWidth:"76%"}}>
                  <div style={{fontSize:10,color:G.muted,marginBottom:2,textAlign:cu.id===m.userId?"right":"left"}}><strong>{m.userName}</strong> · {fmtDT(m.createdAt)}</div>
                  <div style={{fontSize:13,background:m.type==="ia"?"#E8F5E9":m.type==="sistema"?"#FFF8E1":cu.id===m.userId?"#DCF8C6":"#fff",borderRadius:10,padding:"8px 11px",border:"1px solid "+(m.type==="ia"?"#A5D6A760":m.type==="sistema"?"#F4C43060":"#e0e0e0"),color:m.type==="ia"?G.greenDark:G.text,lineHeight:1.5}} dangerouslySetInnerHTML={{__html:(m.text||"").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>")}}/>
                  {m.type==="anexo"&&m.anexo&&<a href={m.anexo.data} download={m.anexo.name} style={{display:"block",fontSize:11,color:G.green,marginTop:4}}>⬇ {m.anexo.name}</a>}
                </div>
              </div>
            ))}
            {aiLoad&&<div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:18}}>🤖</span><span style={{fontSize:12,color:G.greenDark,fontStyle:"italic"}}>Digitando…</span></div>}
          </div>

          {/* sugestão IA */}
          {aiSuggest&&<div style={{background:"#E8F5E9",border:"1px solid #A5D6A7",borderRadius:8,padding:"9px 12px",marginBottom:8,fontSize:13}}>
            <div style={{fontSize:10,fontWeight:700,color:G.greenDark,marginBottom:4}}>🤖 SUGESTÃO DA IA</div>
            <div style={{color:G.text,marginBottom:6}}>{aiSuggest}</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{setMsgTxt(aiSuggest);setAiSuggest("");}} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+G.green,background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:G.greenDark}}>Usar este texto</button>
              <button onClick={()=>setAiSuggest("")} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+G.border,background:"none",cursor:"pointer",fontSize:11,color:G.muted}}>Descartar</button>
            </div>
          </div>}

          {/* respostas prontas */}
          {showRespostas&&<div style={{background:G.alt,borderRadius:8,padding:10,marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:8}}>Respostas Prontas</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {RESPOSTAS_PRONTAS.map((r,i)=>(
                <button key={i} onClick={()=>{setMsgTxt(r);setShowRespostas(false);}} style={{padding:"7px 10px",borderRadius:7,border:"1px solid "+G.border,background:"#fff",cursor:"pointer",fontSize:12,textAlign:"left",color:G.text}}>
                  {r}
                </button>
              ))}
            </div>
          </div>}

          {/* input */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200,display:"flex",gap:6}}>
              <input value={msgTxt} onChange={e=>setMsgTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMsg())} placeholder="Mensagem…" style={{...IB,flex:1,height:38,fontSize:12}}/>
              <Btn onClick={()=>sendMsg()} size="sm">Enviar</Btn>
            </div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>{setShowRespostas(s=>!s);setAiSuggest("");}} title="Respostas prontas" style={{padding:"0 10px",height:38,borderRadius:8,border:"1.5px solid "+G.border,background:showRespostas?G.alt:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:G.muted}}>📝 Prontas</button>
              <button onClick={sugerirTextoIA} disabled={aiLoad} title="IA sugere melhoria do texto" style={{padding:"0 10px",height:38,borderRadius:8,border:"1.5px solid "+G.green,background:G.alt,cursor:"pointer",fontSize:12,fontWeight:700,color:G.greenDark,whiteSpace:"nowrap"}}>🤖 Melhorar</button>
              <button onClick={()=>fileRef.current?.click()} title="Anexar arquivo" style={{padding:"0 10px",height:38,borderRadius:8,border:"1.5px solid "+G.border,background:"none",cursor:"pointer",fontSize:18}}>📎</button>
              <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={handleFile}/>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB TAREFAS ── */}
      {tab==="tarefas"&&(
        <div>
          {Object.entries(TCAT).map(([catKey,catCfg])=>{
            const cats = myTarefas.filter(t=>t.categoria===catKey);
            if(!cats.length) return null;
            return(
              <div key={catKey} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:catCfg.color,textTransform:"uppercase",marginBottom:6}}>{catCfg.icon} {catCfg.label} ({cats.length})</div>
                {cats.map(t=>{
                  const isBoleto = catKey==="boleto";
                  const temAnexo = (t.anexos||[]).length>0;
                  return(
                    <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,marginBottom:5,background:t.status==="resolvida"?"#fafafa":catCfg.bg,border:"1px solid "+catCfg.color+"30",opacity:t.status==="resolvida"?.7:1}}>
                      <span style={{fontSize:16,marginTop:1}}>{t.status==="resolvida"?"✅":t.status==="andamento"?"🟡":"🔴"}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700}}>{t.title}</div>
                        {t.description&&<div style={{fontSize:11,color:G.muted,marginTop:2}}>{t.description}</div>}
                        <div style={{fontSize:10,color:G.light,marginTop:3}}>Prazo: {fmtD(t.due)} · Por {t.createdBy}</div>
                        {isBoleto&&temAnexo&&(
                          <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>
                            {(t.anexos||[]).map(a=>(
                              <a key={a.id} href={a.data} download={a.name} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#fff",border:"1px solid "+G.border,borderRadius:6,fontSize:11,color:G.green,textDecoration:"none",fontWeight:600}}>📎 {a.name}</a>
                            ))}
                          </div>
                        )}
                        {isBoleto&&t.status==="resolvida"&&<div style={{fontSize:11,color:G.greenDark,marginTop:4,fontWeight:700}}>✅ Boleto/NF enviado — tarefa concluída para o comprador</div>}
                      </div>
                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                        {/* CICLO DO BOLETO:
                            aberta    → comprador anexa
                            andamento → almoxarife confirma
                            resolvida → fechado
                        */}
                        {isBoleto&&t.status==="aberta"&&isComp&&(
                          <button onClick={()=>setShowBoletoModal(t)} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+G.purple,background:"#F3E5F5",cursor:"pointer",fontSize:10,fontWeight:700,color:G.purple}}>📎 Anexar Boleto/NF</button>
                        )}
                        {isBoleto&&t.status==="aberta"&&isAlmox&&(
                          <span style={{fontSize:10,color:G.muted,fontStyle:"italic"}}>⏳ Aguardando comprador…</span>
                        )}
                        {isBoleto&&t.status==="andamento"&&isAlmox&&temAnexo&&(
                          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
                            <div style={{background:"#E3F2FD",border:"1px solid #90CAF9",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#1565C0",fontWeight:600,maxWidth:320}}>
                              📥 O comprador já anexou o(s) boleto(s) no pedido de compra. Baixe os arquivos abaixo e encerre a tarefa.
                            </div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                              {(t.anexos||[]).map(a=>(
                                <a key={a.id} href={a.data} download={a.name} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",background:"#fff",border:"1px solid "+G.border,borderRadius:6,fontSize:10,color:G.green,textDecoration:"none",fontWeight:700}}>
                                  ⬇ {a.name}
                                </a>
                              ))}
                            </div>
                            <button onClick={()=>{
                              setTarefas(ts=>ts.map(x=>x.id===t.id?{...x,status:"resolvida",resolvidaEm:nowTs(),resolvidaPor:cu.name}:x));
                              onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,
                                text:"✅ Boleto/NF **confirmado e baixado** pelo almoxarife "+cu.name+". Ciclo de boleto encerrado.",type:"sistema",createdAt:nowTs()});
                              toast("✅ Boleto confirmado — ciclo encerrado!");
                            }} style={{padding:"5px 12px",borderRadius:6,border:"none",cursor:"pointer",background:G.green,color:"#fff",fontSize:11,fontWeight:700}}>
                              ✅ Baixei os arquivos — Encerrar Tarefa
                            </button>
                          </div>
                        )}
                        {isBoleto&&t.status==="andamento"&&isComp&&(
                          <span style={{fontSize:10,color:G.green,fontWeight:600}}>📤 Enviado — aguardando almoxarife</span>
                        )}
                        {isBoleto&&t.status==="resolvida"&&(
                          <span style={{fontSize:10,color:G.green,fontWeight:700}}>✅ Ciclo encerrado</span>
                        )}
                        {!isBoleto&&t.status!=="resolvida"&&(
                          <button onClick={()=>{setTarefas(ts=>ts.map(x=>x.id===t.id?{...x,status:"resolvida"}:x));toast("✅ Concluída!");}} style={{padding:"3px 9px",borderRadius:6,border:"1.5px solid "+G.green,background:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:G.greenDark}}>✅ Concluir</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {myTarefas.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:G.light}}><div style={{fontSize:32}}>📋</div><div style={{fontSize:13,marginTop:8}}>Sem tarefas para este pedido</div></div>}
        </div>
      )}
    </Modal>

    {/* Modal boleto */}
    <TarefaBoletoModal open={!!showBoletoModal} onClose={()=>setShowBoletoModal(null)} tarefa={showBoletoModal} cu={cu} onAnexo={onAnexoTarefa} onConcluir={concluirTarefaBoleto} toast={toast}/>
  </>);
}


// ══ Settings ══

function ConfirmDel({label,onConfirm}){
  const[ask,setAsk]=useState(false);
  return ask
    ?<div style={{display:"flex",gap:4}}><button onClick={onConfirm} style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",background:G.red,color:"#fff",fontSize:11,fontWeight:700}}>Confirmar</button><button onClick={()=>setAsk(false)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"none",cursor:"pointer",fontSize:11,color:G.muted}}>Cancelar</button></div>
    :<button onClick={()=>setAsk(true)} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+G.border,background:"none",cursor:"pointer",fontSize:11,color:G.muted}}>🗑️</button>;
}

function ResetSenha({userId,users,onSave}){
  const[open,setOpen]=useState(false);
  const[nova,setNova]=useState("");const[conf,setConf]=useState("");const[err,setErr]=useState("");
  const u=users.find(x=>x.id===userId);
  async function salvar(){if(nova.length<6){setErr("Mínimo 6 caracteres.");return;}if(nova!==conf){setErr("Senhas não coincidem.");return;}onSave(userId,await hashPass(nova));setNova("");setConf("");setErr("");setOpen(false);}
  return<>
    <button onClick={()=>setOpen(true)} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+G.gold,background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:G.goldDark}}>🔑</button>
    <Modal open={open} onClose={()=>setOpen(false)} title={"Redefinir Senha — "+(u?.name||"")} width={380} footer={<><Btn variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Btn><Btn onClick={salvar}>Salvar</Btn></>}>
      <Fld label="Nova Senha (mín. 6 caracteres)"><Inp type="password" value={nova} onChange={e=>setNova(e.target.value)}/></Fld>
      <Fld label="Confirmar Senha"><Inp type="password" value={conf} onChange={e=>setConf(e.target.value)}/></Fld>
      {err&&<div style={{color:G.red,fontSize:13}}>{err}</div>}
    </Modal>
  </>;
}

function Settings({open,onClose,users,obras,fornecedores,setUsers,setObras,setFornecedores,saveUser,removeUser,saveObra,removeObra,saveForn,removeForn,toast}){
  // Always use the DB-aware functions passed from App
  const doSaveUser   = saveUser;
  const doRemoveUser = removeUser;
  const doSaveObra   = saveObra;
  const doRemoveObra = removeObra;
  const doSaveForn   = saveForn;
  const doRemoveForn = removeForn;
  const [tab,setTab]=useState("obras");

  // ── OBRAS ──
  const oBlank={code:"",name:"",city:"",state:"MA",almoxarife:"",active:true};
  const [oForm,setOForm]=useState(oBlank);const[oEdit,setOEdit]=useState(null);
  const setO=(k,v)=>setOForm(p=>({...p,[k]:v}));
  const almoxs=users.filter(u=>["almoxarife","aux_almoxarife"].includes(u.role)&&u.active);

  async function handleSalvarObra(){
    if(!oForm.code||!oForm.name){toast("⚠️ Código e nome obrigatórios.");return;}
    // Duplicidade absoluta: código único
    const dup=obras.find(o=>o.code.trim()===oForm.code.trim()&&o.id!==oEdit);
    if(dup){toast("❌ Já existe a obra "+dup.code+" — "+dup.name+". Código não pode ser repetido.");return;}
    const newId = oEdit ? Number(oEdit) : (obras.length>0 ? Math.max(...obras.map(x=>Number(x.id)||0))+1 : 1);
    const saved = {...oForm, id:newId};
    toast(oEdit?"💾 Atualizando obra…":"💾 Criando obra…");
    try { await doSaveObra(saved); setOEdit(null); setOForm(oBlank); }
    catch(e){ toast("❌ Erro ao salvar obra: "+e.message); }
  }

  // ── FORNECEDORES ──
  const fBlank={nome:"",cnpj:"",contato:"",email:"",telefone:"",ativo:true};
  const [fForm,setFForm]=useState(fBlank);const[fEdit,setFEdit]=useState(null);
  const setFF=(k,v)=>setFForm(p=>({...p,[k]:v}));

  async function handleSalvarForn(){
    if(!fForm.nome){toast("⚠️ Nome obrigatório.");return;}
    // Duplicidade por CNPJ
    if(fForm.cnpj){
      const cnpjNum=fForm.cnpj.replace(/\D/g,"");
      const dup=fornecedores.find(f=>f.cnpj?.replace(/\D/g,"")===cnpjNum&&f.id!==fEdit);
      if(dup){toast("❌ CNPJ já cadastrado para: "+dup.nome+". Não é permitido duplicar.");return;}
    }
    // Duplicidade por nome
    const dupNome=fornecedores.find(f=>f.nome.toLowerCase().trim()===fForm.nome.toLowerCase().trim()&&f.id!==fEdit);
    if(dupNome){toast("❌ Fornecedor '"+fForm.nome+"' já cadastrado. Não é permitido duplicar.");return;}
    const newId = fEdit ? Number(fEdit) : (fornecedores.length>0 ? Math.max(...fornecedores.map(x=>Number(x.id)||0))+1 : 1);
    const saved = {...fForm, id:newId};
    toast(fEdit?"💾 Atualizando fornecedor…":"💾 Criando fornecedor…");
    try { await doSaveForn(saved); setFEdit(null); setFForm(fBlank); }
    catch(e){ toast("❌ Erro ao salvar fornecedor: "+e.message); }
  }

  // ── USUÁRIOS ──
  const uBlank={name:"",email:"",role:"comprador",active:true,obras:[]};
  const [uForm,setUForm]=useState(uBlank);const[uEdit,setUEdit]=useState(null);
  const setU=(k,v)=>setUForm(p=>({...p,[k]:v}));

  async function handleSalvarUser(){
    if(!uForm.name||!uForm.email){toast("⚠️ Nome e e-mail obrigatórios.");return;}
    // Duplicidade absoluta por e-mail
    const dup=users.find(u=>u.email?.toLowerCase()===uForm.email.toLowerCase()&&u.id!==uEdit);
    if(dup){toast("❌ E-mail '"+uForm.email+"' já cadastrado para "+dup.name+". Não é permitido duplicar.");return;}
    const av=uForm.name.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    const newId = uEdit ? Number(uEdit) : (users.length>0 ? Math.max(...users.map(x=>Number(x.id)||0))+1 : 1);
    const saved = {
      id: newId, name: uForm.name, email: uForm.email.toLowerCase().trim(),
      role: uForm.role, obras: uForm.obras||[], active: uForm.active!==false,
      avatar: av, senhaHash: uEdit?(uForm.senhaHash||""):"",
      primeiroAcesso: uEdit?(uForm.primeiroAcesso!==false):true
    };
    toast(uEdit?"💾 Salvando alterações…":"💾 Criando usuário…");
    try {
      await doSaveUser(saved);
      setUEdit(null);
      setUForm(uBlank);
    } catch(e) {
      toast("❌ Erro ao criar usuário: "+e.message);
    }
  }

  const TB=(k,l)=><button onClick={()=>setTab(k)} style={{padding:"8px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===k?G.green:G.alt,color:tab===k?"#fff":G.muted}}>{l}</button>;
  const Card=({children,style:sx={}})=><div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,marginBottom:5,background:G.surface,border:"1px solid "+G.border,...sx}}>{children}</div>;

  return(
    <Modal open={open} onClose={onClose} title="⚙️ Configurações" width={980}>
      <div style={{display:"flex",gap:8,marginBottom:20}}>{TB("obras","🏗️ Obras")}{TB("fornecedores","🏢 Fornecedores")}{TB("users","👥 Usuários")}</div>
      <div style={{background:"#E8F5E9",border:"1px solid #A5D6A7",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:G.greenDark,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <span>🔐 Área restrita ao Coordenador de Suprimentos. Alterações impactam todo o sistema.</span>
        <div style={{background:"#FFF8E1",border:"1px solid #F4C430",borderRadius:8,padding:"8px 14px"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#5D4037",marginBottom:2}}>🔑 Senha provisória de todos os usuários</div>
          <div style={{fontSize:16,fontWeight:800,color:"#E65100",letterSpacing:"0.1em",fontFamily:"monospace"}}>facten2025</div>
          <div style={{fontSize:10,color:"#8D6E63",marginTop:2}}>No 1º acesso o sistema obriga criação de senha pessoal.</div>
        </div>
      </div>

      {/* ── OBRAS ── */}
      {tab==="obras"&&<div style={{display:"flex",gap:16}}>
        <div style={{width:290,flexShrink:0,background:G.alt,borderRadius:12,padding:16}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:14}}>{oEdit?"Editar Obra":"Nova Obra"}</div>
          <Fld label="Código Sienge" required hint="Apenas o número (ex: 265)"><Inp placeholder="265" value={oForm.code} onChange={e=>setO("code",e.target.value)}/></Fld>
          <Fld label="Nome da Obra" required><Inp placeholder="Residencial Talmir Rosa" value={oForm.name} onChange={e=>setO("name",e.target.value)}/></Fld>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"0 8px"}}>
            <Fld label="Cidade"><Inp value={oForm.city} onChange={e=>setO("city",e.target.value)}/></Fld>
            <Fld label="UF"><Inp value={oForm.state} maxLength={2} onChange={e=>setO("state",e.target.value.toUpperCase())}/></Fld>
          </div>
          <Fld label="Almoxarife Responsável">
            <select value={oForm.almoxarife||""} onChange={e=>setO("almoxarife",Number(e.target.value))} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:13,background:"#fff",outline:"none"}}>
              <option value="">Selecionar…</option>
              {almoxs.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Fld>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><input type="checkbox" id="oact" checked={oForm.active} onChange={e=>setO("active",e.target.checked)}/><label htmlFor="oact" style={{fontSize:13}}>Obra ativa</label></div>
          <div style={{display:"flex",gap:8}}>
            {oEdit&&<Btn variant="secondary" size="sm" onClick={()=>{setOEdit(null);setOForm(oBlank);}}>Cancelar</Btn>}
            <Btn onClick={handleSalvarObra} style={{flex:1}}>{oEdit?"Salvar":"Adicionar"}</Btn>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",maxHeight:500}}>
          {obras.length===0&&<div style={{color:G.light,textAlign:"center",padding:"40px 0",fontSize:14}}>Nenhuma obra. Adicione manualmente ou crie via PDF.</div>}
          {obras.map(o=>{
            const alm=users.find(u=>String(u.id)===String(o.almoxarife));
            return<Card key={o.id} style={{opacity:o.active?1:.65,background:o.active?G.surface:"#f5f5f5"}}>
              <div style={{width:46,height:46,borderRadius:10,background:G.green+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:G.greenDark,flexShrink:0}}>{o.code}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14}}>{o.name}</div>
                <div style={{fontSize:12,color:G.muted}}>{o.city}{o.city&&","} {o.state} · Almox: {alm?.name||"—"}</div>
                {o.createdFrom==="pdf"&&<span style={{fontSize:10,color:G.blue}}>🤖 criado via PDF</span>}
              </div>
              <Btn size="sm" variant="secondary" onClick={()=>{setOEdit(o.id);setOForm({...o});}}>✏️</Btn>
              <button onClick={()=>setObras(os=>os.map(x=>x.id===o.id?{...x,active:!x.active}:x))} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+(o.active?G.gold:G.green),background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:o.active?G.goldDark:G.green}}>{o.active?"Pausar":"Ativar"}</button>
              <ConfirmDel label="Excluir" onConfirm={()=>{doRemoveObra(o.id);toast("Obra excluída!");}}/>
            </Card>;
          })}
        </div>
      </div>}

      {/* ── FORNECEDORES ── */}
      {tab==="fornecedores"&&<div style={{display:"flex",gap:16}}>
        <div style={{width:290,flexShrink:0,background:G.alt,borderRadius:12,padding:16}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:14}}>{fEdit?"Editar Fornecedor":"Novo Fornecedor"}</div>
          <Fld label="Nome / Razão Social" required><Inp value={fForm.nome} onChange={e=>setFF("nome",e.target.value)} placeholder="Nome da empresa"/></Fld>
          <Fld label="CNPJ"><Inp value={fForm.cnpj} onChange={e=>setFF("cnpj",e.target.value)} placeholder="00.000.000/0001-00"/></Fld>
          <Fld label="Contato / Vendedor"><Inp value={fForm.contato} onChange={e=>setFF("contato",e.target.value)}/></Fld>
          <Fld label="E-mail"><Inp type="email" value={fForm.email} onChange={e=>setFF("email",e.target.value)}/></Fld>
          <Fld label="Telefone"><Inp value={fForm.telefone} onChange={e=>setFF("telefone",e.target.value)}/></Fld>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><input type="checkbox" id="fact" checked={fForm.ativo} onChange={e=>setFF("ativo",e.target.checked)}/><label htmlFor="fact" style={{fontSize:13}}>Ativo</label></div>
          <div style={{display:"flex",gap:8}}>
            {fEdit&&<Btn variant="secondary" size="sm" onClick={()=>{setFEdit(null);setFForm(fBlank);}}>Cancelar</Btn>}
            <Btn onClick={handleSalvarForn} style={{flex:1}}>{fEdit?"Salvar":"Adicionar"}</Btn>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",maxHeight:500}}>
          {fornecedores.length===0&&<div style={{color:G.light,textAlign:"center",padding:"40px 0",fontSize:14}}>Nenhum fornecedor. A IA cria automaticamente ao importar PDFs.</div>}
          {fornecedores.map(f=><Card key={f.id} style={{opacity:f.ativo!==false?1:.65,background:f.ativo!==false?G.surface:"#f5f5f5"}}>
            <div style={{width:42,height:42,borderRadius:10,background:G.blue+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏢</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14}}>{f.nome}</div>
              <div style={{fontSize:12,color:G.muted}}>{f.cnpj||"Sem CNPJ"}{f.contato?" · "+f.contato:""}</div>
              {f.email&&<div style={{fontSize:11,color:G.light}}>{f.email}</div>}
              {f.createdFrom==="pdf"&&<span style={{fontSize:10,color:G.blue}}>🤖 criado via PDF</span>}
            </div>
            <Btn size="sm" variant="secondary" onClick={()=>{setFEdit(f.id);setFForm({...f});}}>✏️</Btn>
            <ConfirmDel label="Excluir" onConfirm={()=>{setFornecedores(fs=>fs.filter(x=>x.id!==f.id));toast("Fornecedor excluído!");}}/>
          </Card>)}
        </div>
      </div>}

      {/* ── USUÁRIOS ── */}
      {tab==="users"&&<div style={{display:"flex",gap:16}}>
        <div style={{width:290,flexShrink:0,background:G.alt,borderRadius:12,padding:16}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:14}}>{uEdit?"Editar Usuário":"Novo Usuário"}</div>
          <Fld label="Nome" required><Inp value={uForm.name} onChange={e=>setU("name",e.target.value)}/></Fld>
          <Fld label="E-mail (usado no login)" required><Inp type="email" value={uForm.email} onChange={e=>setU("email",e.target.value)}/></Fld>
          <Fld label="Perfil">
            <select value={uForm.role} onChange={e=>setU("role",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:13,background:"#fff",outline:"none"}}>
              {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </Fld>
          {["almoxarife","aux_almoxarife"].includes(uForm.role)&&<Fld label="Obras vinculadas">
            <div style={{background:"#fff",borderRadius:8,padding:"8px 10px",maxHeight:120,overflowY:"auto"}}>
              {obras.filter(o=>o.active).map(o=>(
                <label key={o.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",fontSize:12}}>
                  <input type="checkbox" checked={(uForm.obras||[]).includes(o.id)} onChange={()=>{const cur=uForm.obras||[];setU("obras",cur.includes(o.id)?cur.filter(x=>x!==o.id):[...cur,o.id]);}}/>
                  {o.code} — {o.name}
                </label>
              ))}
            </div>
          </Fld>}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><input type="checkbox" id="uact" checked={uForm.active} onChange={e=>setU("active",e.target.checked)}/><label htmlFor="uact" style={{fontSize:13}}>Ativo</label></div>
          <div style={{display:"flex",gap:8}}>
            {uEdit&&<Btn variant="secondary" size="sm" onClick={()=>{setUEdit(null);setUForm(uBlank);}}>Cancelar</Btn>}
            <Btn onClick={handleSalvarUser} style={{flex:1}}>{uEdit?"Salvar":"Adicionar"}</Btn>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",maxHeight:500}}>
          {users.map(u=>(
            <Card key={u.id} style={{opacity:u.active?1:.65,background:u.active?G.surface:"#f5f5f5"}}>
              <Av s={u.avatar} size={38} color={RCOL[u.role]||G.green}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14}}>{u.name}</div>
                <div style={{fontSize:12,color:G.muted}}>{u.email||"—"}</div>
                {["almoxarife","aux_almoxarife"].includes(u.role)&&(u.obras||[]).length>0&&<div style={{fontSize:11,color:G.blue}}>Obras: {(u.obras||[]).map(id=>{const o=obras.find(x=>x.id===id);return o?o.code:null;}).filter(Boolean).join(", ")}</div>}
              </div>
              <Chip color={RCOL[u.role]||G.green} bg={(RCOL[u.role]||G.green)+"18"}>{ROLES[u.role]}</Chip>
              <Btn size="sm" variant="secondary" onClick={()=>{setUEdit(u.id);setUForm({...u,obras:u.obras||[]});}}>✏️</Btn>
              <ResetSenha userId={u.id} users={users} onSave={(id,hash)=>{setUsers(us=>us.map(x=>x.id===id?{...x,senhaHash:hash}:x));toast("Senha redefinida!");}}/>
              <button onClick={()=>doSaveUser({...u,active:!u.active}).then(()=>toast(u.active?"Usuário desativado!":"Usuário ativado!")).catch(e=>toast("⚠️ Erro: "+e.message))} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+(u.active?G.red:G.green),background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:u.active?G.red:G.green}}>{u.active?"Desativar":"Ativar"}</button>
            </Card>
          ))}
        </div>
      </div>}
    </Modal>
  );
}


// ══ App ══

// ── PERSIST KEYS ─────────────────────────────────────────────────────────────


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
  const alm=obra?users.find(u=>String(u.id)===String(obra.almoxarife)):null;
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

  const isAlmoxU = ["almoxarife","aux_almoxarife"].includes(cu.role);
  const isCompU  = ["comprador"].includes(cu.role);
  const isCoordU = cu.role==="coordenador";

  const filtered=tarefas.filter(t=>{
    // Filtro por papel:
    // Almoxarife → só vê tarefas atribuídas a ele (geradas pelo fluxo boleto/parcial)
    // Comprador  → vê tarefas atribuídas a ele
    // Coordenador → vê tudo
    if(isAlmoxU && String(t.assignedTo)!==String(cu.id)) return false;
    if(isCompU  && String(t.assignedTo)!==String(cu.id)) return false;
    // filtros de categoria e status
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
    const t = tarefas.find(x=>x.id===id);
    if(t?.categoria==="boleto"){
      // Boleto tarefa has its own cycle — cannot be manually resolved from TarefasPage
      // unless almoxarife AND there are attachments AND status is andamento
      if(status==="resolvida"){
        const temAnexo = (t.anexos||[]).length>0;
        const isAlmoxU = ["almoxarife","aux_almoxarife","coordenador"].includes(cu.role);
        if(!temAnexo){
          toast("⚠️ Tarefa de boleto: o comprador ainda não anexou o boleto.");
          return;
        }
        if(!isAlmoxU){
          toast("⚠️ Só o almoxarife pode confirmar o recebimento do boleto.");
          return;
        }
        if(t.status!=="andamento"){
          toast("⚠️ O comprador ainda não enviou o boleto.");
          return;
        }
      }
    }
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
          {Object.entries(TSTAT).map(([k,v])=>{
            const isBlocked = k==="resolvida" && tDetail.categoria==="boleto" && !(tDetail.anexos||[]).length;
            return <button key={k} onClick={()=>{if(!isBlocked){quickStatus(tDetail.id,k);setSelTarefa(st=>({...st,status:k}));}else toast("⚠️ Anexe o boleto antes de concluir.");}}
              title={isBlocked?"Anexe o boleto primeiro":v.label}
              style={{padding:"7px 16px",borderRadius:20,fontSize:12,fontWeight:700,cursor:isBlocked?"not-allowed":"pointer",opacity:isBlocked?.4:1,border:"2px solid "+(tDetail.status===k?v.color:"#DDE8DD"),background:tDetail.status===k?v.bg:"none",color:tDetail.status===k?v.color:G.muted}}>{v.icon} {v.label}</button>;
          })}
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
// ── PAINEL DE ACOMPANHAMENTO ──────────────────────────────────────────────────
function PainelAcompanhamento({open, onClose, pedidos, tarefas, users, obras, onOpenPedido}) {
  const [filtro, setFiltro] = useState("todos");
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const em7dias = new Date(hoje); em7dias.setDate(hoje.getDate()+7);

  // Coleta todos os eventos de entrega de todos os pedidos
  const eventos = [];
  pedidos.filter(p=>!["cancelado"].includes(p.status)).forEach(p=>{
    const obra = obras.find(o=>String(o.id)===String(p.obra));
    const comp = users.find(u=>String(u.id)===String(p.comprador));
    const itens = p.itens||[];

    // Agrupar itens por data de previsão → múltiplas entregas
    const porData = {};
    itens.forEach(it=>{
      const dt = it.dataPrevisao||p.previsaoEntrega||"";
      if(!porData[dt]) porData[dt]=[];
      porData[dt].push(it);
    });

    // Se só tem uma data, é entrega única
    const datas = Object.keys(porData).filter(Boolean).sort();
    datas.forEach((dt, idx)=>{
      const itensDaData = porData[dt];
      const entregues   = itensDaData.filter(i=>i.status==="entregue").length;
      const total       = itensDaData.length;
      const dtObj       = new Date(dt+"T00:00:00");
      const diffDias    = Math.round((dtObj-hoje)/(1000*60*60*24));
      let situacao;
      if(entregues===total)              situacao="entregue";
      else if(diffDias<0)                situacao="vencido";
      else if(diffDias<=7)               situacao="urgente";
      else                               situacao="futuro";

      eventos.push({
        id:        p.id+"_"+dt,
        pedidoId:  p.id,
        pedido:    p,
        obra,
        comp,
        data:      dt,
        dtObj,
        diffDias,
        situacao,
        label:     datas.length>1 ? (idx===0?"1ª Entrega":idx===1?"2ª Entrega":idx===2?"3ª Entrega":(idx+1)+"ª Entrega") : "Entrega",
        itens:     itensDaData,
        entregues, total,
        pct:       total>0?Math.round((entregues/total)*100):0,
      });
    });

    // Se pedido não tem itens com data, usa previsaoEntrega do pedido
    if(datas.length===0 && p.previsaoEntrega){
      const dt    = p.previsaoEntrega;
      const dtObj = new Date(dt+"T00:00:00");
      const diffDias = Math.round((dtObj-hoje)/(1000*60*60*24));
      let situacao = p.status==="entregue"?"entregue":diffDias<0?"vencido":diffDias<=7?"urgente":"futuro";
      eventos.push({
        id:p.id+"_geral", pedidoId:p.id, pedido:p, obra, comp,
        data:dt, dtObj, diffDias, situacao, label:"Entrega",
        itens:[], entregues:0, total:0, pct:p.status==="entregue"?100:0,
      });
    }
  });

  eventos.sort((a,b)=>a.dtObj-b.dtObj);

  const filtrados = eventos.filter(e=>{
    if(filtro==="vencidos") return e.situacao==="vencido";
    if(filtro==="urgentes") return e.situacao==="urgente";
    if(filtro==="futuros")  return e.situacao==="futuro";
    if(filtro==="entregues")return e.situacao==="entregue";
    return true;
  });

  const counts = {
    vencidos:  eventos.filter(e=>e.situacao==="vencido").length,
    urgentes:  eventos.filter(e=>e.situacao==="urgente").length,
    futuros:   eventos.filter(e=>e.situacao==="futuro").length,
    entregues: eventos.filter(e=>e.situacao==="entregue").length,
  };

  const SITUACAO = {
    vencido:  {label:"Vencido",   color:G.red,    bg:"#FFEBEE", icon:"🔴"},
    urgente:  {label:"≤ 7 dias",  color:G.orange, bg:"#FBE9E7", icon:"⚠️"},
    futuro:   {label:"Futuro",    color:G.blue,   bg:"#E3F2FD", icon:"📅"},
    entregue: {label:"Entregue",  color:G.green,  bg:"#E8F5E9", icon:"✅"},
  };

  const filterBtn=(k,l,n,ic)=>(
    <button onClick={()=>setFiltro(k)} style={{
      padding:"8px 14px",borderRadius:10,border:"2px solid "+(filtro===k?SITUACAO[k]?.color||G.green:G.border),
      background:filtro===k?(SITUACAO[k]?.bg||"#E8F5E9"):"#fff",
      cursor:"pointer",fontSize:12,fontWeight:700,
      color:filtro===k?(SITUACAO[k]?.color||G.greenDark):G.muted,
      display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:80
    }}>
      <span style={{fontSize:18}}>{ic}</span>
      <span style={{fontSize:16,fontWeight:800}}>{n}</span>
      <span style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</span>
    </button>
  );

  return(
    <Modal open={open} onClose={onClose} title="📊 Painel de Acompanhamento de Entregas" width={900}>
      {/* FILTROS */}
      <div style={{display:"flex",gap:10,marginBottom:20,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={()=>setFiltro("todos")} style={{padding:"8px 20px",borderRadius:10,border:"2px solid "+(filtro==="todos"?G.green:G.border),background:filtro==="todos"?"#E8F5E9":"#fff",cursor:"pointer",fontSize:12,fontWeight:700,color:filtro==="todos"?G.greenDark:G.muted}}>
          📋 Todos ({eventos.length})
        </button>
        {filterBtn("vencidos", "Vencidos",   counts.vencidos,  "🔴")}
        {filterBtn("urgentes", "≤ 7 dias",   counts.urgentes,  "⚠️")}
        {filterBtn("futuros",  "Futuros",    counts.futuros,   "📅")}
        {filterBtn("entregues","Entregues",  counts.entregues, "✅")}
      </div>

      {/* ALERTA 7 DIAS */}
      {counts.urgentes>0&&filtro!=="entregues"&&(
        <div style={{background:"#FBE9E7",border:"1px solid "+G.orange+"50",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>⚠️</span>
          <div>
            <div style={{fontWeight:700,color:G.orange,fontSize:13}}>{counts.urgentes} entrega{counts.urgentes>1?"s":""} nos próximos 7 dias!</div>
            <div style={{fontSize:11,color:G.muted}}>Verifique com os fornecedores e confirme as entregas.</div>
          </div>
        </div>
      )}

      {/* LISTA */}
      {filtrados.length===0
        ?<div style={{textAlign:"center",padding:"50px 0",color:G.light}}><div style={{fontSize:40}}>📭</div><div style={{fontSize:14,marginTop:8}}>Nenhuma entrega nesta categoria</div></div>
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtrados.map(ev=>{
            const sit = SITUACAO[ev.situacao]||SITUACAO.futuro;
            return(
              <div key={ev.id} onClick={()=>{onOpenPedido(ev.pedido);onClose();}}
                style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,
                  background:sit.bg,border:"1.5px solid "+sit.color+"40",cursor:"pointer",
                  borderLeft:"4px solid "+sit.color}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,.1)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>

                {/* Data */}
                <div style={{textAlign:"center",minWidth:60,flexShrink:0}}>
                  <div style={{fontSize:22}}>{sit.icon}</div>
                  <div style={{fontSize:11,fontWeight:800,color:sit.color}}>
                    {ev.diffDias===0?"Hoje":ev.diffDias===1?"Amanhã":ev.diffDias===-1?"Ontem":
                      ev.diffDias<0?Math.abs(ev.diffDias)+"d atrás":"+"+ev.diffDias+"d"}
                  </div>
                  <div style={{fontSize:10,color:G.muted}}>{fmtD(ev.data)}</div>
                </div>

                {/* Info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,fontSize:13}}>Ped. {ev.pedido.numero}</span>
                    <span style={{fontSize:12,color:G.muted}}>— {ev.pedido.fornecedor}</span>
                    <span style={{background:sit.color+"20",color:sit.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{ev.label}</span>
                  </div>
                  <div style={{fontSize:11,color:G.muted,marginBottom:4}}>
                    {ev.obra&&<span>🏗️ {ev.obra.code} — {ev.obra.name} </span>}
                    {ev.comp&&<span>· 🛒 {ev.comp.name}</span>}
                  </div>
                  {ev.itens.length>0&&(
                    <div style={{fontSize:10,color:G.muted,marginBottom:4}}>
                      📦 {ev.itens.slice(0,3).map(i=>i.descricao).join(", ")}{ev.itens.length>3&&" +mais"}
                    </div>
                  )}
                  {ev.total>0&&(
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{background:"#ffffff80",borderRadius:4,height:5,flex:1,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:4,background:sit.color,width:ev.pct+"%",transition:"width .4s"}}/>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:sit.color}}>{ev.entregues}/{ev.total} itens</span>
                    </div>
                  )}
                </div>

                <div style={{fontSize:11,color:G.muted,flexShrink:0}}>→</div>
              </div>
            );
          })}
        </div>}
    </Modal>
  );
}

export default function App(){
  const [users,        setUsers]        = useState(USERS0);      // loaded from Supabase
  const [obras,        setObras]        = useState([]);           // loaded from Supabase
  const [fornecedores, setFornecedores] = useState([]);           // loaded from Supabase
  const [pedidos,      setPedidos]      = useState(()=>ld(K.pedidos, []));
  const [tarefas,      setTarefas]      = useState(()=>ld(K.tarefas, []));
  const [events,       setEvents]       = useState(()=>ld(K.events,  []));
  const [atas,         setAtas]         = useState(()=>ld(K.atas,    []));
  const [dbLoading,    setDbLoading]    = useState(true);
  const [dbError,      setDbError]      = useState("");

  const [loggedIn,setLoggedIn] = useState(()=>ld(K.li, false));
  const [cu,setCu]             = useState(()=>ld(K.cu, USERS0[0]));
  const [loginEmail,setLoginEmail] = useState("");
  const [loginPass, setLoginPass]  = useState("");
  const [loginErr,  setLoginErr]   = useState("");
  const [showTrocaSenha,setShowTrocaSenha] = useState(false);
  const [trocaNova,setTrocaNova]   = useState("");
  const [trocaConf,setTrocaConf]   = useState("");
  const [trocaErr,setTrocaErr]     = useState("");

  const [page,    setPage]    = useState("dashboard");
  const [toastMsg,setToastMsg]= useState("");
  const [search,  setSearch]  = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fObra,   setFObra]   = useState("all");
  const [fCat,    setFCat]    = useState("all");
  const [showPF,  setShowPF]  = useState(false);
  const [detailP, setDetailP] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [notifOpen,setNotifOpen]   = useState(false);
  const [painelOpen,setPainelOpen] = useState(false);
  const [notifsLidas,setNotifsLidas] = useState(()=>ld("fl5_notifs_lidas",[]));

  // Pedidos/tarefas/events/atas → localStorage (fast)
  useEffect(()=>sv(K.pedidos,  pedidos),  [pedidos]);
  useEffect(()=>sv(K.tarefas,  tarefas),  [tarefas]);
  useEffect(()=>sv(K.events,   events),   [events]);
  useEffect(()=>sv(K.atas,     atas),     [atas]);
  useEffect(()=>sv(K.li,       loggedIn), [loggedIn]);
  useEffect(()=>sv("fl5_notifs_lidas", notifsLidas), [notifsLidas]);
  useEffect(()=>sv(K.cu,       cu),       [cu]);

  // ── LOAD FROM SUPABASE on mount ────────────────────────────────────────
  useEffect(()=>{
    async function loadFromDb(){
      setDbLoading(true);
      try{
        const [dbU,dbO,dbF] = await Promise.all([dbGet("usuarios"),dbGet("obras"),dbGet("fornecedores")]);
        if(dbU.length>0){
          // Sync: update existing users with new emails from USERS0 (preserva senhaHash)
          const merged = USERS0.map(seed=>{
            const existing = dbU.find(d=>d.id===seed.id);
            if(existing){
              // Keep existing password but update email/name if changed in seed
              return userFromDb({...existing, name:seed.name, email:seed.email, role:seed.role, avatar:seed.avatar});
            }
            return seed;
          });
          // Also include any users added via Settings (not in USERS0)
          const extraUsers = dbU.filter(d=>!USERS0.find(s=>s.id===d.id)).map(userFromDb);
          setUsers([...merged, ...extraUsers]);
          // Sync updated users back to DB
          await Promise.all(merged.map(u=>dbUpsert("usuarios",userToDb(u))));
        } else {
          // Primeiro deploy: seed com USERS0
          await Promise.all(USERS0.map(u=>dbUpsert("usuarios",userToDb(u))));
          setUsers(USERS0);
        }
        setObras(dbO.map(obraFromDb));
        setFornecedores(dbF.map(fornFromDb));
      }catch(e){
        console.warn("DB load failed, using local:", e.message);
        setDbError("Modo offline — dados locais");
        setUsers(ld(K.users, USERS0));
        setObras(ld(K.obras, []));
        setFornecedores(ld(K.fornecedores, []));
      }
      setDbLoading(false);
    }
    loadFromDb();
  },[]);

  const toast = m => setToastMsg(m);

  // auto-criar tarefas de atraso
  useEffect(()=>{
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const em7  = new Date(hoje); em7.setDate(hoje.getDate()+7);

    // Alerta 7 dias: verifica cada item com data de previsão
    pedidos.filter(p=>!["cancelado","entregue"].includes(p.status)).forEach(p=>{
      (p.itens||[]).forEach(it=>{
        const dt = it.dataPrevisao||p.previsaoEntrega;
        if(!dt) return;
        const dtObj = new Date(dt+"T00:00:00");
        if(dtObj>hoje && dtObj<=em7 && it.status!=="entregue"){
          const key = "alerta7_"+p.id+"_"+(it.id||dt);
          const jaExiste = tarefas.find(t=>t.id===key);
          if(!jaExiste){
            setTarefas(ts=>[...ts,{
              id:key, categoria:"acompanhamento",
              title:"⚠️ Entrega em "+Math.round((dtObj-hoje)/(864e5))+"d — Ped. "+p.numero+" ("+p.fornecedor+")",
              description:"Item: "+it.descricao+". Previsão: "+fmtD(dt)+". Confirme com o fornecedor.",
              status:"aberta", pedidoId:p.id, obra:p.obra,
              assignedTo:Number(p.comprador), due:dt,
              anexos:[], messages:[], createdBy:"Sistema", createdAt:nowTs()
            }]);
          }
        }
      });
    });

    const novos=pedidos.filter(p=>isAtrasado(p)&&!tarefas.find(t=>t.pedidoId===p.id&&t.categoria==="atraso"&&t.status!=="resolvida")).map(p=>({id:uid(),categoria:"atraso",title:"Entrega atrasada — Pedido "+p.numero+" ("+p.fornecedor+")",description:"Previsão: "+fmtD(p.previsaoEntrega)+". Contatar fornecedor.",status:"aberta",pedidoId:p.id,obra:p.obra,assignedTo:Number(p.comprador),due:"",messages:[],createdBy:"Sistema",createdAt:nowTs()}));
    if(novos.length>0) setTarefas(ts=>[...novos.filter(n=>!ts.find(t=>t.pedidoId===n.pedidoId&&t.categoria==="atraso"&&t.status!=="resolvida")),...ts]);
  },[pedidos]);

  async function doLogin(){
    const u=users.find(x=>x.email?.toLowerCase()===loginEmail.toLowerCase()&&x.active);
    if(!u){setLoginErr("E-mail não encontrado.");return;}
    const h=await hashPass(loginPass);
    const senhaOk = u.senhaHash ? u.senhaHash===h : loginPass==="facten2025";
    if(!senhaOk){setLoginErr("Senha incorreta.");return;}
    setCu(u);
    // Se primeiro acesso (sem senha definida ou flag primeiroAcesso) → obriga troca
    if(u.primeiroAcesso || !u.senhaHash){
      setShowTrocaSenha(true);
    } else {
      setLoggedIn(true);
    }
    setLoginErr("");
  }

  async function salvarNovaSenha(){
    if(trocaNova.length<6){setTrocaErr("Mínimo 6 caracteres.");return;}
    if(trocaNova===loginPass||trocaNova==="facten2025"){setTrocaErr("Escolha uma senha diferente da senha padrão.");return;}
    if(trocaNova!==trocaConf){setTrocaErr("Senhas não coincidem.");return;}
    const h=await hashPass(trocaNova);
    const updated={...cu, senhaHash:h, primeiroAcesso:false};
    setUsers(u=>u.map(x=>x.id===cu.id?updated:x));
    dbUpsert("usuarios", userToDb(updated)); // sync to DB
    setCu(updated);
    setLoggedIn(true);
    setShowTrocaSenha(false);
    setTrocaNova("");setTrocaConf("");setTrocaErr("");
    setLoginPass("");
  }

  function handleAutoCreate(tipo,item){
    if(tipo==="obra"){
      // Não duplicar por código
      const exists = obras.find(x=>x.code===String(item.code).trim());
      if(!exists){
        setObras(o=>[...o,item]);
        dbUpsert("obras", obraToDb(item));
        toast("🏗️ Obra "+item.code+" criada automaticamente via PDF!");
      }
    }
    if(tipo==="fornecedor"){
      // Não duplicar por CNPJ nem por nome
      const cnpj=(item.cnpj||"").replace(/\D/g,"");
      const existeCnpj = cnpj && fornecedores.find(x=>(x.cnpj||"").replace(/\D/g,"")===cnpj);
      const existeNome = fornecedores.find(x=>x.nome.toLowerCase().trim()===item.nome.toLowerCase().trim());
      if(!existeCnpj && !existeNome){
        setFornecedores(f=>[...f,item]);
        dbUpsert("fornecedores", fornToDb(item));
        toast("🏢 Fornecedor '"+item.nome+"' criado automaticamente via PDF!");
      }
    }
  }

  function savePedido(form){
    // Duplicidade absoluta por número de pedido
    const dupPedido = pedidos.find(p=>p.numero===String(form.numero).trim());
    if(dupPedido){toast("❌ Pedido "+form.numero+" já existe. Não é permitido duplicar.");return;}

    const obra=obras.find(o=>String(o.id)===String(form.obra));
    const alm=obra?users.find(u=>String(u.id)===String(obra.almoxarife)):null;
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

  // ── DB-AWARE SETTERS ──────────────────────────────────────────────────────
  // IDs: use sequential small int to avoid bigint overflow in Supabase
  function nextId(list){ return list.length>0 ? Math.max(...list.map(x=>Number(x.id)||0))+1 : 1; }

  async function saveUser(u){
    const row = {...u, id: Number(u.id)};
    // Update local state immediately (optimistic)
    setUsers(us=>us.find(x=>Number(x.id)===row.id)?us.map(x=>Number(x.id)===row.id?row:x):[...us,row]);
    // Sync to Supabase
    const result = await dbUpsert("usuarios", userToDb(row));
    if(result){
      toast("✅ "+(u.id&&users.find(x=>Number(x.id)===Number(u.id))?"Usuário atualizado!":"Usuário criado!"));
    } else {
      toast("⚠️ Salvo localmente — sem conexão com banco.");
    }
  }
  async function removeUser(id){
    setUsers(us=>us.filter(x=>x.id!==id));
    await dbDelete("usuarios", Number(id));
  }
  async function saveObra(o){
    const row = {...o, id: Number(o.id)};
    setObras(os=>os.find(x=>x.id===row.id)?os.map(x=>x.id===row.id?row:x):[...os,row]);
    const result = await dbUpsert("obras", obraToDb(row));
    if(!result) toast("⚠️ Obra salva localmente — verifique conexão.");
    else toast("✅ Obra salva no banco!");
  }
  async function removeObra(id){
    setObras(os=>os.filter(x=>x.id!==id));
    await dbDelete("obras", Number(id));
  }
  async function saveForn(f){
    const row = {...f, id: Number(f.id)};
    setFornecedores(fs=>fs.find(x=>x.id===row.id)?fs.map(x=>x.id===row.id?row:x):[...fs,row]);
    const result = await dbUpsert("fornecedores", fornToDb(row));
    if(!result) toast("⚠️ Fornecedor salvo localmente — verifique conexão.");
    else toast("✅ Fornecedor salvo no banco!");
  }
  async function removeForn(id){
    setFornecedores(fs=>fs.filter(x=>x.id!==id));
    await dbDelete("fornecedores", Number(id));
  }

  function deletePedido(id){setPedidos(p=>p.filter(x=>x.id!==id));setTarefas(ts=>ts.filter(t=>t.pedidoId!==id));}
  function cancelPedido(id){setPedidos(p=>p.map(x=>x.id===id?{...x,status:"cancelado"}:x));addMsg(id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"❌ Pedido cancelado pelo comprador "+cu.name,type:"sistema",createdAt:nowTs()});}
  const addMsg=(id,m)=>setPedidos(p=>p.map(x=>x.id===id?{...x,messages:[...(x.messages||[]),m]}:x));
  const updateItens=(id,novos,ns,extra={})=>setPedidos(p=>p.map(x=>x.id===id?{...x,itens:novos,status:ns,...extra}:x));

  // notificações
  const notifs=[];
  pedidos.forEach(p=>{
    const obra=obras.find(o=>String(o.id)===String(p.obra));
    const pertAlmox=["almoxarife","aux_almoxarife"].includes(cu.role)&&String(obra?.almoxarife)===String(cu.id);
    const pertComp=["comprador","coordenador"].includes(cu.role)&&String(p.comprador)===String(cu.id);
    if(isAtrasado(p)&&(pertComp||pertAlmox)) notifs.push({id:"atr"+p.id,icon:"⚠️",text:"Pedido "+p.numero+" atrasado",pedidoId:p.id,color:G.orange});
    if(p.status==="aguardando"&&pertComp) notifs.push({id:"bol"+p.id,icon:"🧾",text:"Boleto solicitado — Ped. "+p.numero,pedidoId:p.id,color:G.purple});
    if(p.status==="parcial"&&pertComp) notifs.push({id:"par"+p.id,icon:"📦",text:"Entrega parcial — Ped. "+p.numero,pedidoId:p.id,color:G.blue});
    if(p.status==="entregue"&&pertComp) notifs.push({id:"ent"+p.id,icon:"✅",text:"Pedido "+p.numero+" entregue!",pedidoId:p.id,color:G.green});
    // Almoxarife recebe notificação quando comprador responde no chat
    if(pertAlmox){
      const msgs = (p.messages||[]).filter(m=>m.type==="chat"&&String(m.userId)!==String(cu.id));
      if(msgs.length>0){
        const ultima = msgs[msgs.length-1];
        notifs.push({id:"chat"+p.id,icon:"💬",text:"Comprador respondeu no Pedido "+p.numero+": "+ultima.text.slice(0,40),pedidoId:p.id,color:G.blue});
      }
    }
    // Comprador recebe notificação quando almoxarife inicia conversa
    if(pertComp){
      const msgs = (p.messages||[]).filter(m=>m.type==="chat"&&String(m.userId)!==String(cu.id));
      if(msgs.length>0){
        const ultima = msgs[msgs.length-1];
        notifs.push({id:"almchat"+p.id,icon:"💬",text:"Almoxarife enviou mensagem no Pedido "+p.numero,pedidoId:p.id,color:G.teal});
      }
    }
  });
  // Tarefas atribuídas ao usuário atual que foram resolvidas
  tarefas.filter(t=>t.status==="resolvida"&&String(t.assignedTo)===String(cu.id)).slice(0,3).forEach(t=>{
    notifs.push({id:"tsk"+t.id,icon:"🔔",text:"Tarefa concluída: "+t.title.slice(0,40),color:G.green});
  });
  // Tarefas de boleto em andamento — almoxarife deve baixar o boleto
  tarefas.filter(t=>t.categoria==="boleto"&&t.status==="andamento"&&String(t.assignedTo)===String(cu.id)).forEach(t=>{
    notifs.push({id:"bolk"+t.id,icon:"📥",text:"Boleto disponível para baixar — "+t.title.slice(0,40),pedidoId:t.pedidoId,color:G.purple});
  });

  const isAlmoxCu = ["almoxarife","aux_almoxarife"].includes(cu.role);

  const filteredP=pedidos.filter(p=>{
    const o=obras.find(x=>String(x.id)===String(p.obra));
    // Almoxarife vê pedidos das obras onde ele é o almoxarife responsável
    // Usa String() nos dois lados para evitar mismatch de tipo
    if(isAlmoxCu){
      const obraDoAlmox = obras.find(ob=>
        String(ob.id)===String(p.obra) &&
        String(ob.almoxarife)===String(cu.id)
      );
      if(!obraDoAlmox) return false;
    }
    return(fStatus==="all"||p.status===fStatus)&&(fObra==="all"||String(p.obra)===fObra)&&(!search||[p.numero,p.fornecedor,o?.name,o?.code].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
  });

  // busca direta por número de pedido
  useEffect(()=>{
    if(search.length>=3){const exact=pedidos.find(p=>p.numero===search.trim());if(exact)setDetailP(exact);}
  },[search]);

  const isComp=["comprador","coordenador"].includes(cu.role);
  // Badge de tarefas: só mostra as do usuário atual
  const minhasTarefasAbertas = tarefas.filter(t=>
    String(t.assignedTo)===String(cu.id) && t.status==="aberta"
  ).length;

  const NAV=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"pedidos",  icon:"📋",label:"Pedidos",   badge:pedidos.filter(p=>isAtrasado(p)).length||null,badgeColor:G.orange},
    {id:"tarefas",  icon:"✅",label:"Tarefas",   badge:minhasTarefasAbertas||null,badgeColor:G.red},
  ];

  // ── TELA DE TROCA DE SENHA (primeiro acesso) ──
  if(dbLoading)return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2E7D32 0%,#1A3A1A 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",flexDirection:"column",gap:16}}>
      <div style={{fontSize:52,animation:"spin 1s linear infinite"}}>⟳</div>
      <div style={{color:"#fff",fontSize:16,fontWeight:700}}>Carregando dados…</div>
      {dbError&&<div style={{color:"#FFD54F",fontSize:13}}>{dbError}</div>}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(showTrocaSenha)return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2E7D32 0%,#1A3A1A 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",padding:16}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@keyframes su{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"44px 40px",width:"100%",maxWidth:420,boxShadow:"0 32px 80px rgba(0,0,0,.32)",animation:"su .3s ease"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:8}}>🔐</div>
          <div style={{fontSize:20,fontWeight:800,color:G.text}}>Bem-vindo, {cu.name.split(" ")[0]}!</div>
          <div style={{fontSize:13,color:G.muted,marginTop:6}}>Este é seu primeiro acesso. Defina uma senha pessoal para continuar.</div>
        </div>
        <div style={{background:"#FFF8E1",border:"1px solid #F4C430",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:"#5D4037"}}>
          ⚠️ A senha padrão <strong>facten2025</strong> não pode ser usada. Escolha uma senha segura com pelo menos 6 caracteres.
        </div>
        <Fld label="Nova Senha (mínimo 6 caracteres)">
          <Inp type="password" placeholder="Digite sua nova senha" value={trocaNova} onChange={e=>setTrocaNova(e.target.value)} onKeyDown={e=>e.key==="Enter"&&salvarNovaSenha()}/>
        </Fld>
        <Fld label="Confirmar Nova Senha">
          <Inp type="password" placeholder="Repita a senha" value={trocaConf} onChange={e=>setTrocaConf(e.target.value)} onKeyDown={e=>e.key==="Enter"&&salvarNovaSenha()}/>
        </Fld>
        {trocaErr&&<div style={{color:G.red,fontSize:13,marginBottom:10,textAlign:"center"}}>{trocaErr}</div>}
        <button onClick={salvarNovaSenha} style={{width:"100%",padding:"13px 0",borderRadius:10,border:"none",background:G.green,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",marginTop:4}}>Salvar Senha e Entrar</button>
        <button onClick={()=>{setShowTrocaSenha(false);setLoggedIn(false);}} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",background:"none",color:G.muted,fontSize:13,cursor:"pointer",marginTop:8}}>← Voltar ao login</button>
      </div>
    </div>
  );

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
        {/* Senha provisória removida da tela pública — visível apenas em Configurações */}
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"Inter,sans-serif",color:G.text,background:G.bg}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@keyframes su{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#DDE8DD;border-radius:4px}button:active{transform:scale(.97)}`}</style>

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
          {["coordenador"].includes(cu.role)&&(
            <button onClick={()=>setShowCfg(true)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:9,border:"none",cursor:"pointer",background:"none",color:"rgba(255,255,255,.55)",fontWeight:500,fontSize:13,textAlign:"left",width:"100%"}}>
              <span style={{fontSize:17,width:20,textAlign:"center"}}>⚙️</span>Configurações
            </button>
          )}
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
            <button onClick={()=>setPainelOpen(true)} title="Painel de Acompanhamento" style={{background:"none",border:"none",cursor:"pointer",fontSize:19,padding:"4px 8px",position:"relative"}}>📊</button>
            <button onClick={()=>setNotifOpen(n=>!n)} style={{background:"none",border:"none",cursor:"pointer",fontSize:19,padding:"4px 8px",position:"relative"}}>
              🔔{notifs.filter(n=>!notifsLidas.includes(n.id)).length>0&&<span style={{position:"absolute",top:0,right:0,background:G.red,color:"#fff",borderRadius:20,fontSize:8,fontWeight:800,padding:"1px 4px"}}>{notifs.filter(n=>!notifsLidas.includes(n.id)).length}</span>}
            </button>
            {notifOpen&&<div style={{position:"absolute",right:0,top:42,background:"#fff",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,.18)",width:340,zIndex:200,border:"1px solid "+G.border,maxHeight:420,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"11px 16px",borderBottom:"1px solid "+G.border,fontWeight:700,fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                <span>Notificações {notifs.filter(n=>!notifsLidas.includes(n.id)).length>0&&<span style={{background:G.red,color:"#fff",borderRadius:20,fontSize:9,fontWeight:800,padding:"1px 6px",marginLeft:4}}>{notifs.filter(n=>!notifsLidas.includes(n.id)).length} novas</span>}</span>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {notifsLidas.length<notifs.length&&<button onClick={()=>setNotifsLidas(notifs.map(n=>n.id))} style={{fontSize:10,color:G.muted,background:"none",border:"none",cursor:"pointer"}}>Marcar todas lidas</button>}
                  <button onClick={()=>setNotifOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:G.muted,fontSize:16}}>✕</button>
                </div>
              </div>
              <div style={{overflowY:"auto",flex:1}}>
                {notifs.length===0&&<div style={{padding:"24px",textAlign:"center",color:G.light,fontSize:13}}>Tudo em dia! ✅</div>}
                {[...notifs].sort((a,b)=>{const aL=notifsLidas.includes(a.id),bL=notifsLidas.includes(b.id);return aL===bL?0:aL?1:-1;}).map(n=>{
                  const lida=notifsLidas.includes(n.id);
                  return<div key={n.id} onClick={()=>{
                    setNotifsLidas(prev=>[...new Set([...prev,n.id])]);
                    if(n.pedidoId){const p=pedidos.find(x=>x.id===n.pedidoId);if(p){setDetailP(p);setPage("pedidos");}}
                    setNotifOpen(false);
                  }} style={{display:"flex",gap:10,padding:"10px 16px",borderBottom:"1px solid "+G.border,cursor:"pointer",background:lida?"#fafafa":"#FFF8E1",transition:"background .2s"}}>
                    <span style={{fontSize:18,opacity:lida?.5:1}}>{n.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:lida?G.muted:G.text,lineHeight:1.5,fontWeight:lida?400:600}}>{n.text}</div>
                      {!lida&&<div style={{fontSize:10,color:G.gold,fontWeight:700,marginTop:2}}>● Não lida</div>}
                    </div>
                  </div>;
                })}
              </div>
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
        saveUser={saveUser} removeUser={removeUser}
        saveObra={saveObra} removeObra={removeObra}
        saveForn={saveForn} removeForn={removeForn}
        toast={toast}/>

      <Toast msg={toastMsg} onDone={()=>setToastMsg("")}/>
    </div>
  );
}
