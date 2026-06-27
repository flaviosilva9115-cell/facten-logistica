import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import { useState, useRef, useEffect } from "react";
import { G, TCAT, fmtD, fmtDT, uid, nowTs, callIA, isAtrasado } from "./constants.js";
import { Av, Chip, Btn, Modal, Inp, Txa, Fld, IB } from "./atoms.jsx";

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
function exportarHistorico(pedido, forn, obra, alm, comp) {
  const msgs = (pedido.messages || []).map(m =>
    `[${fmtDT(m.createdAt)}] ${m.userName}: ${m.text.replace(/<[^>]+>/g,"").replace(/\*\*/g,"")}`
  ).join("\n");

  const itens = (pedido.itens || []).map(it =>
    `  - ${it.descricao} | ${it.quantidade} ${it.unidade} | Entregue: ${it.qtdEntregue||0} | ${it.status}`
  ).join("\n");

  const txt = [
    "═══════════════════════════════════════════════════",
    `HISTÓRICO DO PEDIDO ${pedido.numero}`,
    "═══════════════════════════════════════════════════",
    `Fornecedor : ${forn?.nome || pedido.fornecedor || "—"}`,
    `Obra       : ${obra ? obra.code + " — " + obra.name : "—"}`,
    `Almoxarife : ${alm?.name || "—"}`,
    `Comprador  : ${comp?.name || "—"}`,
    `Valor      : ${pedido.valor ? "R$ " + pedido.valor : "—"}`,
    `Prev. Entr.: ${fmtD(pedido.previsaoEntrega)}`,
    `Status     : ${STATUS_CFG[pedido.status]?.label || pedido.status}`,
    `Criado em  : ${fmtDT(pedido.createdAt)} por ${pedido.createdBy}`,
    "",
    "── INSUMOS ─────────────────────────────────────────",
    itens || "  Nenhum insumo",
    "",
    "── MENSAGENS / HISTÓRICO ────────────────────────────",
    msgs || "  Nenhuma mensagem",
    "",
    `Exportado em: ${fmtDT(new Date().toISOString())}`,
    "═══════════════════════════════════════════════════",
  ].join("\n");

  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `Pedido_${pedido.numero}_historico.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── TAREFA BOLETO DETAIL ──────────────────────────────────────────────────────
function TarefaBoletoModal({open, onClose, tarefa, cu, onAnexo, onConcluir, toast}) {
  const fileRef = useRef(null);
  const [obs, setObs] = useState("");
  if(!tarefa) return null;
  const anexos = tarefa.anexos || [];

  function handleFile(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const r = new FileReader();
      r.onload = ev => {
        onAnexo(tarefa.id, { id: uid(), name: file.name, data: ev.target.result, by: cu.name, at: nowTs() });
      };
      r.readAsDataURL(file);
    });
    e.target.value = "";
    toast("📎 Arquivo(s) anexado(s)!");
  }

  return (
    <Modal open={open} onClose={onClose} title={"🧾 Boleto/NF — " + tarefa.title} width={560}
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        {anexos.length > 0 && <Btn onClick={() => { onConcluir(tarefa.id); onClose(); toast("✅ Boleto enviado! Tarefa concluída para o comprador."); }}>✅ Enviar & Concluir</Btn>}
      </>}>
      <div style={{background:"#F3E5F5",border:"1px solid #9C27B050",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#6A1B9A"}}>
        🧾 Anexe o(s) boleto(s) e/ou nota fiscal para liberar o pagamento. Após enviar, a tarefa será concluída para o comprador.
      </div>
      <Fld label="Observação (opcional)">
        <Txa rows={2} value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: NF 12345, boleto com vencimento 10/07..."/>
      </Fld>
      {/* anexos já enviados */}
      {anexos.length > 0 && (
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:6}}>Arquivos Anexados ({anexos.length})</div>
          {anexos.map(a => (
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:G.alt,borderRadius:8,marginBottom:4}}>
              <span style={{fontSize:16}}>📎</span>
              <a href={a.data} download={a.name} style={{fontSize:13,color:G.green,textDecoration:"none",fontWeight:600,flex:1}}>{a.name}</a>
              <span style={{fontSize:10,color:G.light}}>por {a.by}</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => fileRef.current?.click()} style={{width:"100%",padding:"12px",borderRadius:10,border:"2px dashed "+G.purple,background:"#F3E5F5",cursor:"pointer",fontSize:13,fontWeight:700,color:G.purple}}>
        + Anexar Boleto / Nota Fiscal
      </button>
      <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={handleFile}/>
    </Modal>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function PedidoDetail({open,onClose,pedido,users,obras,fornecedores,cu,onUpdateItens,onAddMsg,onBoleto,onDelete,onCancel,tarefas,setTarefas,toast}) {
  const [tab,setTab]           = useState("insumos");
  const [filtroIt,setFiltroIt] = useState("todos");
  const [msgTxt,setMsgTxt]     = useState("");
  const [aiLoad,setAiLoad]     = useState(false);
  const [aiSuggest,setAiSuggest] = useState("");
  const [showRespostas,setShowRespostas] = useState(false);
  const [showBoletoModal,setShowBoletoModal] = useState(null); // tarefa de boleto
  const [confirmAcao,setConfirmAcao] = useState(null); // "excluir"|"cancelar"
  const chatRef  = useRef(null);
  const fileRef  = useRef(null);

  useEffect(()=>{ if(open) { setTab("insumos"); setConfirmAcao(null); setAiSuggest(""); setShowRespostas(false); } },[open]);
  useEffect(()=>{ if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; },[pedido?.messages?.length,tab]);

  if(!pedido) return null;

  const atrasado  = isAtrasado(pedido);
  const cfg       = STATUS_CFG[atrasado?"atrasado":pedido.status] || STATUS_CFG.pendente;
  const obra      = obras.find(o=>String(o.id)===String(pedido.obra));
  const forn      = fornecedores.find(f=>String(f.id)===String(pedido.fornecedorId)) || {nome:pedido.fornecedor||""};
  const alm       = obra ? users.find(u=>u.id===obra.almoxarife) : null;
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
    marcarItem(id, q<=0?"pendente": q>=it.quantidade?"entregue":"parcial", q);
  }

  function marcarTodosEntregues() {
    const novos = itens.map(it=>({...it, status:"entregue", qtdEntregue:it.quantidade, updatedBy:cu.name, updatedAt:nowTs()}));
    onUpdateItens(pedido.id, novos, "entregue");
    onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
      text:`✅ **Entrega total** — todos os ${nTot} itens confirmados por ${cu.name}`,
      type:"sistema", createdAt:nowTs()});
    toast("✅ Entrega total confirmada!");
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

  function criarTarefaBoleto() {
    const exists = tarefas.find(t=>t.pedidoId===pedido.id&&t.categoria==="boleto"&&t.status!=="resolvida");
    if(exists) { toast("Já existe tarefa de boleto aberta para este pedido."); return; }
    const nova = {
      id:uid(), categoria:"boleto",
      title:`Boleto/NF pendente — Pedido ${pedido.numero} (${forn.nome})`,
      description:`Almoxarife ${cu.name} informou que o material chegou sem boleto ou nota fiscal.`,
      status:"aberta", pedidoId:pedido.id, obra:pedido.obra,
      assignedTo:Number(pedido.comprador), due:pedido.previsaoEntrega||"",
      anexos:[], messages:[], createdBy:cu.name, createdAt:nowTs()
    };
    setTarefas(ts=>[nova,...ts]);
    onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
      text:"🧾 Tarefa de **Boleto/NF** criada — comprador será notificado.",
      type:"sistema", createdAt:nowTs()});
    toast("🧾 Tarefa de boleto criada para o comprador!");
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
    setTarefas(ts => ts.map(t => t.id===tarefaId ? {...t, anexos:[...(t.anexos||[]), anexo], status:"andamento"} : t));
  }

  function concluirTarefaBoleto(tarefaId) {
    setTarefas(ts => ts.map(t => t.id===tarefaId ? {...t, status:"resolvida", resolvidaEm:nowTs(), resolvidaPor:cu.name} : t));
    onAddMsg(pedido.id, {id:uid(), userId:cu.id, userName:cu.name, avatar:cu.avatar,
      text:"🧾 **Boleto/NF enviado** pelo comprador. Tarefa concluída.",
      type:"sistema", createdAt:nowTs()});
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:"Obra",         v:obra?obra.code+" — "+obra.name:"—"},
          {l:"Almoxarife",   v:alm?.name||"—",   c:G.blue},
          {l:"Comprador",    v:comp?.name||"—",  c:G.green},
          {l:"Fornecedor",   v:forn.nome||"—"},
          {l:"Valor",        v:pedido.valor?"R$ "+pedido.valor:"—"},
          {l:"Prev. Entrega",v:fmtD(pedido.previsaoEntrega)},
          {l:"Tarefas",      v:myTarefas.filter(t=>t.status!=="resolvida").length+" abertas"},
          {l:"Observação",   v:pedido.observacao||"—"},
        ].map(row=>(
          <div key={row.l} style={{background:G.alt,borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:1}}>{row.l}</div>
            <div style={{fontSize:12,fontWeight:600,color:row.c||G.text,lineHeight:1.3}}>{row.v}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        <button style={tabS("insumos")} onClick={()=>setTab("insumos")}>📦 Insumos ({nEnt}/{nTot})</button>
        <button style={tabS("chat")}    onClick={()=>setTab("chat")}>💬 Chat {pedido.messages?.length>0&&"("+pedido.messages.length+")"}</button>
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
              <button onClick={criarTarefaBoleto} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid "+G.purple,background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:G.purple}}>🧾 Sem Boleto/NF</button>
            </>}
          </div>

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
            <div style={{display:"grid",gridTemplateColumns:"1fr 60px 80px 80px 160px",background:G.nav,padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",gap:8}}>
              <span>Insumo</span><span>Un.</span><span>Qtd.</span><span>Entregue</span><span>Status / Ação</span>
            </div>
            {itFilt.map((it,idx)=>{
              const ist = ISTAT[it.status]||ISTAT.pendente;
              return(
                <div key={it.id} style={{display:"grid",gridTemplateColumns:"1fr 60px 80px 80px 160px",padding:"9px 12px",borderTop:"1px solid "+G.border,background:idx%2===0?"#fff":G.alt,alignItems:"center",gap:8}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:12}}>{it.descricao}</div>
                    {it.updatedBy&&<div style={{fontSize:10,color:G.light}}>Por {it.updatedBy} · {fmtD(it.updatedAt)}</div>}
                  </div>
                  <div style={{fontSize:12,color:G.muted}}>{it.unidade}</div>
                  <div style={{fontSize:13,fontWeight:700}}>{it.quantidade}</div>
                  <div>
                    {isAlmox&&!isCancelado
                      ?<input type="number" min="0" max={it.quantidade} value={it.qtdEntregue||0} onChange={e=>setQtd(it.id,e.target.value)} style={{...IB,width:68,padding:"4px 8px",fontSize:13,textAlign:"center"}}/>
                      :<span style={{fontSize:13}}>{it.qtdEntregue||0}</span>}
                  </div>
                  <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                    <Chip color={ist.color} bg={ist.bg}>{ist.icon} {ist.label}</Chip>
                    {isAlmox&&!isCancelado&&it.status!=="entregue"&&<button onClick={()=>marcarItem(it.id,"entregue",it.quantidade)} style={{padding:"2px 7px",borderRadius:5,border:"none",cursor:"pointer",background:G.green+"22",color:G.greenDark,fontSize:11,fontWeight:700}}>✅</button>}
                    {isAlmox&&it.status==="entregue"&&<button onClick={()=>marcarItem(it.id,"pendente",0)} style={{padding:"2px 7px",borderRadius:5,border:"none",cursor:"pointer",background:G.gold+"22",color:G.goldDark,fontSize:11,fontWeight:700}}>↩</button>}
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
          <div style={{background:"#E3F2FD",border:"1px solid #90CAF9",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#1565C0"}}>
            💬 Canal direto almoxarife ↔ comprador.{!atrasado&&isAlmox?" A IA responde em nome do comprador quando o pedido está dentro do prazo.":""}
          </div>
          {/* mensagens */}
          <div ref={chatRef} style={{background:G.alt,borderRadius:10,padding:12,minHeight:180,maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {!(pedido.messages?.length)&&<div style={{color:G.light,fontSize:13,textAlign:"center",marginTop:50}}>Sem mensagens ainda.</div>}
            {(pedido.messages||[]).map(m=>(
              <div key={m.id} style={{display:"flex",gap:8,flexDirection:cu.id===m.userId?"row-reverse":"row"}}>
                <div style={{fontSize:18}}>{typeof m.avatar==="string"&&m.avatar.length>2?m.avatar:<Av s={m.avatar||"?"} size={26} color={m.type==="ia"?G.greenDark:G.green}/>}</div>
                <div style={{maxWidth:"76%"}}>
                  <div style={{fontSize:10,color:G.muted,marginBottom:2,textAlign:cu.id===m.userId?"right":"left"}}><strong>{m.userName}</strong> · {fmtDT(m.createdAt)}</div>
                  <div style={{fontSize:13,background:m.type==="ia"?"#E8F5E9":m.type==="sistema"?"#FFF8E1":cu.id===m.userId?"#DCF8C6":"#fff",borderRadius:10,padding:"8px 11px",border:"1px solid "+(m.type==="ia"?"#A5D6A760":m.type==="sistema"?"#F4C43060":"#e0e0e0"),color:m.type==="ia"?G.greenDark:G.text,lineHeight:1.5}} dangerouslySetInnerHTML={{__html:(m.text||"").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/
/g,"<br/>")}}/>
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
                        {/* comprador pode anexar boleto */}
                        {isBoleto&&isComp&&t.status!=="resolvida"&&(
                          <button onClick={()=>setShowBoletoModal(t)} style={{padding:"3px 9px",borderRadius:6,border:"1.5px solid "+G.purple,background:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:G.purple}}>
                            {temAnexo?"📎 Ver/Enviar":"📎 Anexar Boleto"}
                          </button>
                        )}
                        {/* almoxarife vê os boletos e encerra */}
                        {isBoleto&&isAlmox&&temAnexo&&t.status!=="resolvida"&&(
                          <button onClick={()=>{setTarefas(ts=>ts.map(x=>x.id===t.id?{...x,status:"resolvida"}:x));toast("✅ Tarefa de boleto encerrada!");}} style={{padding:"3px 9px",borderRadius:6,border:"1.5px solid "+G.green,background:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:G.greenDark}}>✅ Encerrar</button>
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

import { useState, useRef, useEffect } from "react";
import { G, extractPedidoPDF, fmtD, uid, callIA } from "./constants.js";
import { Inp, Sel, Txa, Fld, Btn, Modal, IB } from "./atoms.jsx";
import { findOrCreateFornecedor, findOrCreateObra } from "./store.js";

export default function PedidoForm({open,onClose,onSave,users,obras,fornecedores,onAutoCreate,cu}){
  const blank={numero:"",fornecedorId:"",obra:"",comprador:String(cu.id),valor:"",previsaoEntrega:"",observacao:"",itens:[]};
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

      const almox = obraFinal ? users.find(u=>u.id===obraFinal.almoxarife) : null;
      const itens = (parsed.itens||[]).map(it=>({
        id:uid(), descricao:it.descricao||"", unidade:it.unidade||"un",
        quantidade:Number(it.quantidade)||1, qtdEntregue:0,
        valorUnitario:String(it.valor_unitario||""), valorTotal:String(it.valor_total||""),
        status:"pendente"
      }));

      setF({
        numero:         parsed.numero||"",
        fornecedorId:   fornFinal?String(fornFinal.id):"",
        obra:           obraFinal?String(obraFinal.id):"",
        comprador:      String(cu.id),
        valor:          parsed.valor_total||"",
        previsaoEntrega:parsed.data_entrega||"",
        observacao:"", itens
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
        <Fld label="Nº Pedido" required><Inp placeholder="76895" value={f.numero} onChange={e=>set("numero",e.target.value)}/></Fld>
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
            {obras.filter(o=>o.active).map(o=>{const a=users.find(u=>u.id===o.almoxarife);return<option key={o.id} value={o.id}>{o.code} — {o.name}{a?" (Almox: "+a.name+")":""}</option>;})}
          </Sel>
        </Fld>
        <Fld label="Comprador" required>
          <Sel value={f.comprador} onChange={e=>set("comprador",e.target.value)}>
            {comps.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </Sel>
        </Fld>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Fld label="Valor Total (R$)"><Inp value={f.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00"/></Fld>
        <Fld label="Previsão de Entrega" required><Inp type="date" value={f.previsaoEntrega} onChange={e=>set("previsaoEntrega",e.target.value)}/></Fld>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 60px 80px 80px 24px",background:G.nav,padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",gap:6}}>
            <span>Descrição</span><span>Un.</span><span>Qtd.</span><span>Vl.Unit.</span><span></span>
          </div>
          {f.itens.map((it,i)=>(
            <div key={it.id} style={{display:"grid",gridTemplateColumns:"1fr 60px 80px 80px 24px",padding:"6px 12px",borderTop:"1px solid "+G.border,background:i%2===0?"#fff":G.alt,alignItems:"center",gap:6}}>
              <input value={it.descricao} onChange={e=>updItem(it.id,"descricao",e.target.value)} style={{...IB,padding:"4px 7px",fontSize:12}}/>
              <input value={it.unidade}   onChange={e=>updItem(it.id,"unidade",e.target.value)}   style={{...IB,padding:"4px 7px",fontSize:12}}/>
              <input type="number" value={it.quantidade} onChange={e=>updItem(it.id,"quantidade",Number(e.target.value))} style={{...IB,padding:"4px 7px",fontSize:12}}/>
              <input value={it.valorUnitario} onChange={e=>updItem(it.id,"valorUnitario",e.target.value)} style={{...IB,padding:"4px 7px",fontSize:12}}/>
              <button onClick={()=>removeItem(it.id)} style={{background:"none",border:"none",cursor:"pointer",color:G.light,fontSize:15,padding:0}}>✕</button>
            </div>
          ))}
        </div>}
      </div>
    </Modal>
  );
}

import { useState } from "react";
import { G, ROLES, RCOL, hashPass } from "./constants.js";
import { Av, Chip, Inp, Sel, Txa, Fld, Btn, Modal } from "./atoms.jsx";

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

export default function Settings({open,onClose,users,obras,fornecedores,setUsers,setObras,setFornecedores,toast}){
  const [tab,setTab]=useState("obras");

  // ── OBRAS ──
  const oBlank={code:"",name:"",city:"",state:"MA",almoxarife:"",active:true};
  const [oForm,setOForm]=useState(oBlank);const[oEdit,setOEdit]=useState(null);
  const setO=(k,v)=>setOForm(p=>({...p,[k]:v}));
  const almoxs=users.filter(u=>["almoxarife","aux_almoxarife"].includes(u.role)&&u.active);

  function saveObra(){
    if(!oForm.code||!oForm.name){alert("Código e nome obrigatórios.");return;}
    const dup=obras.find(o=>o.code===oForm.code&&o.id!==oEdit);
    if(dup){alert("Código "+oForm.code+" já existe.");return;}
    if(oEdit){setObras(o=>o.map(x=>x.id===oEdit?{...x,...oForm}:x));toast("Obra atualizada!");}
    else{setObras(o=>[...o,{...oForm,id:Date.now()}]);toast("Obra adicionada!");}
    setOEdit(null);setOForm(oBlank);
  }

  // ── FORNECEDORES ──
  const fBlank={nome:"",cnpj:"",contato:"",email:"",telefone:"",ativo:true};
  const [fForm,setFForm]=useState(fBlank);const[fEdit,setFEdit]=useState(null);
  const setFF=(k,v)=>setFForm(p=>({...p,[k]:v}));

  function saveForn(){
    if(!fForm.nome){alert("Nome obrigatório.");return;}
    if(fForm.cnpj){
      const cnpjNum=fForm.cnpj.replace(/\D/g,"");
      const dup=fornecedores.find(f=>f.cnpj?.replace(/\D/g,"")===cnpjNum&&f.id!==fEdit);
      if(dup){alert("CNPJ já cadastrado para: "+dup.nome);return;}
    }
    if(fEdit){setFornecedores(f=>f.map(x=>x.id===fEdit?{...x,...fForm}:x));toast("Fornecedor atualizado!");}
    else{setFornecedores(f=>[...f,{...fForm,id:Date.now()}]);toast("Fornecedor adicionado!");}
    setFEdit(null);setFForm(fBlank);
  }

  // ── USUÁRIOS ──
  const uBlank={name:"",email:"",role:"comprador",active:true,obras:[]};
  const [uForm,setUForm]=useState(uBlank);const[uEdit,setUEdit]=useState(null);
  const setU=(k,v)=>setUForm(p=>({...p,[k]:v}));

  function saveUser(){
    if(!uForm.name||!uForm.email){alert("Nome e e-mail obrigatórios.");return;}
    const dup=users.find(u=>u.email?.toLowerCase()===uForm.email.toLowerCase()&&u.id!==uEdit);
    if(dup){alert("E-mail já cadastrado.");return;}
    const av=uForm.name.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    if(uEdit){setUsers(u=>u.map(x=>x.id===uEdit?{...x,...uForm,avatar:av}:x));toast("Usuário atualizado!");}
    else{setUsers(u=>[...u,{...uForm,id:Date.now(),avatar:av,senhaHash:""}]);toast("Usuário adicionado!");}
    setUEdit(null);setUForm(uBlank);
  }

  const TB=(k,l)=><button onClick={()=>setTab(k)} style={{padding:"8px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===k?G.green:G.alt,color:tab===k?"#fff":G.muted}}>{l}</button>;
  const Card=({children,style:sx={}})=><div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,marginBottom:5,background:G.surface,border:"1px solid "+G.border,...sx}}>{children}</div>;

  return(
    <Modal open={open} onClose={onClose} title="⚙️ Configurações" width={980}>
      <div style={{display:"flex",gap:8,marginBottom:20}}>{TB("obras","🏗️ Obras")}{TB("fornecedores","🏢 Fornecedores")}{TB("users","👥 Usuários")}</div>

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
            <Btn onClick={saveObra} style={{flex:1}}>{oEdit?"Salvar":"Adicionar"}</Btn>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",maxHeight:500}}>
          {obras.length===0&&<div style={{color:G.light,textAlign:"center",padding:"40px 0",fontSize:14}}>Nenhuma obra. Adicione manualmente ou crie via PDF.</div>}
          {obras.map(o=>{
            const alm=users.find(u=>u.id===o.almoxarife);
            return<Card key={o.id} style={{opacity:o.active?1:.65,background:o.active?G.surface:"#f5f5f5"}}>
              <div style={{width:46,height:46,borderRadius:10,background:G.green+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:G.greenDark,flexShrink:0}}>{o.code}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14}}>{o.name}</div>
                <div style={{fontSize:12,color:G.muted}}>{o.city}{o.city&&","} {o.state} · Almox: {alm?.name||"—"}</div>
                {o.createdFrom==="pdf"&&<span style={{fontSize:10,color:G.blue}}>🤖 criado via PDF</span>}
              </div>
              <Btn size="sm" variant="secondary" onClick={()=>{setOEdit(o.id);setOForm({...o});}}>✏️</Btn>
              <button onClick={()=>setObras(os=>os.map(x=>x.id===o.id?{...x,active:!x.active}:x))} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+(o.active?G.gold:G.green),background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:o.active?G.goldDark:G.green}}>{o.active?"Pausar":"Ativar"}</button>
              <ConfirmDel label="Excluir" onConfirm={()=>{setObras(os=>os.filter(x=>x.id!==o.id));toast("Obra excluída!");}}/>
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
            <Btn onClick={saveForn} style={{flex:1}}>{fEdit?"Salvar":"Adicionar"}</Btn>
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
            <Btn onClick={saveUser} style={{flex:1}}>{uEdit?"Salvar":"Adicionar"}</Btn>
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
              <button onClick={()=>setUsers(us=>us.map(x=>x.id===u.id?{...x,active:!x.active}:x))} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+(u.active?G.red:G.green),background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:u.active?G.red:G.green}}>{u.active?"Desativar":"Ativar"}</button>
            </Card>
          ))}
        </div>
      </div>}
    </Modal>
  );
}

// ── STORE: localStorage with Supabase sync ─────────────────────────────────
import { ld, sv, USERS0, uid, nowTs } from "./constants.js";

// Keys
const K = {
  users:"fl5_users", obras:"fl5_obras", fornecedores:"fl5_fornecedores",
  pedidos:"fl5_pedidos", tarefas:"fl5_tarefas", events:"fl5_events", atas:"fl5_atas",
  li:"fl5_li", cu:"fl5_cu",
};

export function loadState(){
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

export function persist(key, value){
  sv(K[key], value);
}

// ── ANTI-DUPLICATE helpers ─────────────────────────────────────────────────
export function findOrCreateFornecedor(fornecedores, parsed){
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

export function findOrCreateObra(obras, parsed){
  const code = (parsed.codigo_obra||parsed.obra_code||"").toString().trim().replace(/\D.*$/,""); // digits only
  const name = (parsed.nome_obra||parsed.obra_name||"").trim();
  if(!code) return { obras, match:null, created:false };

  let match = obras.find(o=>o.code===code);
  if(match) return { obras, match, created:false };

  match = { id:Date.now()+2, code, name:name||"Obra "+code, city:"", state:"MA", almoxarife:null, active:true, createdAt:nowTs(), createdFrom:"pdf" };
  return { obras:[...obras, match], match, created:true };
}

// ── TASK AUTO-CREATE ────────────────────────────────────────────────────────
export function buildAcompanhamentoTask(pedido, forn, obra, comprador){
  const resumo = (pedido.itens||[]).slice(0,3).map(i=>i.descricao).join(", ")+(pedido.itens?.length>3?" e mais...":"");
  return {
    id: uid(),
    categoria: "acompanhamento",
    status: "aberta",
    pedidoId: pedido.id,
    obra: pedido.obra,
    assignedTo: Number(pedido.comprador),
    due: pedido.previsaoEntrega||"",
    title: `Pedido ${pedido.numero} — ${forn?.nome||pedido.fornecedor||""} — ${resumo}`,
    description: `Pedido criado em ${new Date().toLocaleDateString("pt-BR")}. Previsão de entrega: ${pedido.previsaoEntrega? new Date(pedido.previsaoEntrega).toLocaleDateString("pt-BR"):"Não definida"}. Acompanhe o status da entrega.`,
    messages: [],
    createdBy: pedido.createdBy||"",
    createdAt: nowTs(),
  };
}

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

import { useState, useEffect } from "react";
import { G } from "./constants.js";

export const IB={width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:13,color:"#1A2B1A",background:"#fff",outline:"none",fontFamily:"Inter,sans-serif",boxSizing:"border-box",transition:"border-color .15s"};

export function Av({s="?",size=32,color=G.green}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:size*.36,flexShrink:0,userSelect:"none"}}>{s}</div>;
}
export function Chip({color,bg,children,style:sx={}}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:bg,color,border:"1px solid "+color+"30",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",...sx}}>{children}</span>;
}
export function Toast({msg,onDone}){
  useEffect(()=>{if(!msg)return;const t=setTimeout(onDone,4500);return()=>clearTimeout(t);},[msg]);
  if(!msg)return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:G.greenDark,color:"#fff",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.22)",animation:"su .2s ease",maxWidth:460,textAlign:"center"}}>{msg}</div>;
}
export function Inp({style:sx,...p}){
  const[f,sf]=useState(false);
  return <input {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;
}
export function Sel({children,style:sx,...p}){
  return <select {...p} style={{...IB,paddingRight:28,...sx}}>{children}</select>;
}
export function Txa({style:sx,...p}){
  const[f,sf]=useState(false);
  return <textarea {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,minHeight:72,resize:"vertical",borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;
}
export function Fld({label,required,hint,children}){
  return <div style={{marginBottom:12}}>
    <label style={{display:"block",fontSize:11,fontWeight:700,color:G.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{required&&<span style={{color:G.red}}> *</span>}</label>
    {children}
    {hint&&<div style={{fontSize:10,color:G.light,marginTop:3}}>{hint}</div>}
  </div>;
}
export function Btn({children,variant="primary",onClick,disabled,style:sx={},size="md",title}){
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
export function Modal({open,onClose,title,width=700,children,footer}){
  useEffect(()=>{
    if(!open)return;
    const h=e=>e.key==="Escape"&&onClose();
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[open,onClose]);
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(20,40,20,.5)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:G.surface,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"94vh",display:"flex",flexDirection:"column",boxShadow:"0 28px 72px rgba(0,0,0,.28)",animation:"su .2s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:"1px solid "+G.border,flexShrink:0}}>
        <h2 style={{margin:0,fontSize:15,fontWeight:800,color:G.text}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:G.muted,lineHeight:1,padding:4}}>✕</button>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"18px 22px"}}>{children}</div>
      {footer&&<div style={{padding:"14px 22px",borderTop:"1px solid "+G.border,display:"flex",gap:8,justifyContent:"flex-end",flexShrink:0}}>{footer}</div>}
    </div>
  </div>;
}
export function Logo({size=36}){
  return <svg width={size} height={size} viewBox="0 0 52 52">
    <rect x="0"  y="0"  width="23" height="23" rx="5" fill={G.green}/>
    <rect x="29" y="0"  width="23" height="23" rx="5" fill={G.red}/>
    <rect x="0"  y="29" width="23" height="23" rx="5" fill={G.gold}/>
    <rect x="29" y="29" width="23" height="23" rx="5" fill="#222"/>
  </svg>;
}
export function Badge({n,color=G.red}){
  if(!n)return null;
  return <span style={{background:color,color:"#fff",borderRadius:20,fontSize:9,fontWeight:800,padding:"1px 5px",minWidth:16,textAlign:"center"}}>{n>99?"99+":n}</span>;
}
export function EmptyState({icon="📭",title,subtitle}){
  return <div style={{textAlign:"center",padding:"60px 20px",color:G.light}}>
    <div style={{fontSize:52,marginBottom:12}}>{icon}</div>
    <div style={{fontSize:16,fontWeight:700,color:G.muted,marginBottom:6}}>{title}</div>
    {subtitle&&<div style={{fontSize:13}}>{subtitle}</div>}
  </div>;
}
export function Section({title,right,children,style:sx={}}){
  return <div style={{marginBottom:20,...sx}}>
    {(title||right)&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      {title&&<div style={{fontSize:13,fontWeight:800,color:G.text,textTransform:"uppercase",letterSpacing:"0.05em"}}>{title}</div>}
      {right}
    </div>}
    {children}
  </div>;
}

// ── DESIGN TOKENS ────────────────────────────────────────────────────────────
export const G = {
  green:"#4CAF50", greenDark:"#2E7D32", greenLight:"#A5D6A7",
  red:"#E74C3C", gold:"#F4C430", goldDark:"#D4A017",
  purple:"#9C27B0", blue:"#2196F3", teal:"#00897B", orange:"#FF7043",
  bg:"#F4F6F4", surface:"#FFFFFF", alt:"#F0F5F0",
  border:"#DDE8DD", text:"#1A2B1A", muted:"#5A7A5A", light:"#9DB89D",
  nav:"#1B3A1B",
};

// ── PEDIDO STATUS ─────────────────────────────────────────────────────────────
export const STATUS = {
  pendente:   { label:"Pendente",              color:G.gold,   bg:"#FFF8E1", icon:"⏳" },
  entregue:   { label:"Entregue",              color:G.green,  bg:"#E8F5E9", icon:"✅" },
  parcial:    { label:"Parcial",               color:G.blue,   bg:"#E3F2FD", icon:"📦" },
  cancelado:  { label:"Cancelado",             color:G.red,    bg:"#FFEBEE", icon:"❌" },
  aguardando: { label:"Aguard. Boleto",        color:G.purple, bg:"#F3E5F5", icon:"🧾" },
  atrasado:   { label:"Atrasado",              color:G.orange, bg:"#FBE9E7", icon:"⚠️" },
};

// ── TAREFA STATUS ─────────────────────────────────────────────────────────────
export const TSTAT = {
  aberta:    { label:"Aberta",       color:G.red,    bg:"#FFEBEE", icon:"🔴" },
  andamento: { label:"Em Andamento", color:G.gold,   bg:"#FFF8E1", icon:"🟡" },
  resolvida: { label:"Resolvida",    color:G.green,  bg:"#E8F5E9", icon:"🟢" },
};

// ── TAREFA CATEGORIAS ─────────────────────────────────────────────────────────
export const TCAT = {
  acompanhamento: { label:"Acompanhamento", color:G.green,  bg:"#E8F5E9", icon:"📋", desc:"Acompanhamento do pedido e entregas" },
  boleto:         { label:"Boleto / NF",    color:G.purple, bg:"#F3E5F5", icon:"🧾", desc:"Boleto ou Nota Fiscal pendente" },
  pergunta:       { label:"Dúvida",         color:G.blue,   bg:"#E3F2FD", icon:"❓", desc:"Pergunta sobre o pedido ou material" },
  atraso:         { label:"Atraso",         color:G.orange, bg:"#FBE9E7", icon:"⚠️", desc:"Alerta de atraso na entrega" },
};

// ── PERFIS ────────────────────────────────────────────────────────────────────
export const ROLES = {
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

export const RCOL = {
  coordenador:G.greenDark, comprador:G.green, almoxarife:G.blue,
  aux_almoxarife:"#42A5F5", aprovador:G.gold, juridico:G.red,
  fiscal:G.orange, aux_engenharia:"#26A69A", coord_obras:"#7E57C2",
  gestor_obras:"#5C6BC0", diretor_eng:"#D81B60", diretor_plan:"#6D4C41",
  gerente_fin:"#00897B", coord_control:"#F4511E",
};

// ── SEED USERS ────────────────────────────────────────────────────────────────
export const USERS0 = [
  {id:1,name:"Flávio Silva",    email:"flavio@amorimcoutinho.com.br",   role:"coordenador",   avatar:"FS",active:true,obras:[],senhaHash:""},
  {id:2,name:"Francisco Cunha", email:"francisco@amorimcoutinho.com.br",role:"comprador",     avatar:"FC",active:true,obras:[],senhaHash:""},
  {id:3,name:"Felipe Vitorino", email:"felipe@amorimcoutinho.com.br",   role:"comprador",     avatar:"FV",active:true,obras:[],senhaHash:""},
  {id:4,name:"Cristiano Teixeira",email:"cristiano@amorimcoutinho.com.br",role:"aprovador",  avatar:"CT",active:true,obras:[],senhaHash:""},
  {id:5,name:"Graça Macedo",    email:"graca@amorimcoutinho.com.br",    role:"almoxarife",    avatar:"GM",active:true,obras:[],senhaHash:""},
  {id:6,name:"Caio Monteiro",   email:"caio@amorimcoutinho.com.br",     role:"almoxarife",    avatar:"CM",active:true,obras:[],senhaHash:""},
  {id:7,name:"Vicente Nascimento",email:"vicente@amorimcoutinho.com.br",role:"almoxarife",   avatar:"VN",active:true,obras:[],senhaHash:""},
  {id:8,name:"Nayara Couto",    email:"nayara@amorimcoutinho.com.br",   role:"juridico",      avatar:"NC",active:true,obras:[],senhaHash:""},
];

export const hashPass = async s => {
  const b = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256",b);
  return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("");
};

export const uid   = () => Math.random().toString(36).slice(2,10);
export const nowTs = () => new Date().toISOString();
export const fmtD  = iso => iso ? new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
export const fmtDT = iso => iso ? new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
export const isAtrasado = p => p.previsaoEntrega && new Date(p.previsaoEntrega)<new Date() && !["entregue","cancelado"].includes(p.status);
export const ld = (k,fb) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };
export const sv = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };

// ── IA CALL ───────────────────────────────────────────────────────────────────
export async function callIA(messages, maxTokens=1000, system="Assistente FACTEN.") {
  const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:maxTokens,system,messages})});
  const d = await r.json();
  if(d.error) throw new Error(d.error.message||JSON.stringify(d.error));
  return d.content?.[0]?.text || "";
}

// ── PDF EXTRACTOR ─────────────────────────────────────────────────────────────
export async function extractPedidoPDF(b64) {
  const system = `Você é extrator especializado de Pedidos de Compra Sienge da Amorim Coutinho Engenharia. REGRA ABSOLUTA: retorne SOMENTE JSON válido, sem texto antes ou depois, sem markdown, sem backticks, sem comentários.`;
  const prompt = `Extraia os dados deste Pedido de Compra Sienge e retorne EXATAMENTE este JSON:
{"numero":"","cnpj_fornecedor":"","nome_fornecedor":"","codigo_obra":"","nome_obra":"","valor_total":"","data_entrega":"YYYY-MM-DD","itens":[{"descricao":"","unidade":"","quantidade":1,"valor_unitario":"","valor_total":""}]}

INSTRUÇÕES CAMPO A CAMPO:
- numero: apenas dígitos após "Nº Pedido" ou "N° Pedido" (ex: "76895")
- cnpj_fornecedor: CNPJ do fornecedor (ex: "12.345.678/0001-90") ou ""
- nome_fornecedor: Razão Social completa do fornecedor na seção "Dados do Fornecedor"
- codigo_obra: SOMENTE o número antes do traço (ex: "265 - Residencial Talmir" → "265")
- nome_obra: nome após o traço (ex: "Residencial Talmir Rosa 2, 3 e 5")
- valor_total: valor numérico do TOTAL DO PEDIDO sem R$ e sem pontos de milhar (ex: "5708.50")
- data_entrega: YYYY-MM-DD da coluna "Data Previsão". Se não houver, use 1ª data de "Datas Vencimento"
- itens: TODOS os produtos da tabela — descricao, unidade (un/m2/m3/kg/sc/rl/pç), quantidade (número inteiro), valor_unitario e valor_total numéricos

Retorne APENAS o JSON. NADA MAIS.`;

  const resp = await callIA([{role:"user",content:[
    {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
    {type:"text",text:prompt}
  ]}], 4000, system);

  let json = resp.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  const m = json.match(/\{[\s\S]*\}/);
  if(!m) throw new Error("IA não retornou JSON. Recebido: "+resp.slice(0,300));
  return JSON.parse(m[0]);
}
