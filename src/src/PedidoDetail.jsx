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
