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

export default function PedidoDetail({open,onClose,pedido,users,obras,fornecedores,cu,onUpdateItens,onAddMsg,onBoleto,tarefas,setTarefas,toast}){
  const [tab,setTab]       = useState("insumos");
  const [filtroIt,setFiltroIt] = useState("todos");
  const [msgTxt,setMsgTxt] = useState("");
  const [aiLoad,setAiLoad] = useState(false);
  const [novaTarefa,setNovaTarefa] = useState(null); // {categoria}
  const [ntForm,setNtForm] = useState({title:"",description:"",due:""});
  const chatRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(()=>{if(open)setTab("insumos");},[open]);
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[pedido?.messages?.length,tab]);

  if(!pedido)return null;

  const atrasado  = isAtrasado(pedido);
  const cfg       = STATUS_CFG[atrasado?"atrasado":pedido.status]||STATUS_CFG.pendente;
  const obra      = obras.find(o=>String(o.id)===String(pedido.obra));
  const forn      = fornecedores.find(f=>String(f.id)===String(pedido.fornecedorId))||{nome:pedido.fornecedor||""};
  const alm       = obra?users.find(u=>u.id===obra.almoxarife):null;
  const comp      = users.find(u=>String(u.id)===String(pedido.comprador));
  const itens     = pedido.itens||[];
  const nTot      = itens.length;
  const nEnt      = itens.filter(i=>i.status==="entregue").length;
  const nPar      = itens.filter(i=>i.status==="parcial").length;
  const nPend     = nTot-nEnt-nPar;
  const pct       = nTot>0?Math.round(((nEnt+nPar*.5)/nTot)*100):0;
  const isAlmox   = ["almoxarife","aux_almoxarife","coordenador"].includes(cu.role);
  const isComp    = ["comprador","coordenador"].includes(cu.role);
  const myTarefas = tarefas.filter(t=>t.pedidoId===pedido.id);

  // ── ITENS ──────────────────────────────────────────────────────────────────
  function marcarItem(id,novoStatus,qtdEntregue){
    const novos=itens.map(it=>it.id===id?{...it,status:novoStatus,qtdEntregue:qtdEntregue??it.qtdEntregue,updatedBy:cu.name,updatedAt:nowTs()}:it);
    const ne=novos.filter(i=>i.status==="entregue").length;
    const ns=nTot>0?(ne===nTot?"entregue":novos.every(i=>i.status==="pendente")?"pendente":"parcial"):pedido.status;
    onUpdateItens(pedido.id,novos,ns);
    if(ns==="parcial"&&pedido.status!=="parcial"){
      onAddMsg(pedido.id,{id:uid(),userId:0,userName:"Sistema",avatar:"🤖",text:"⚠️ **Entrega parcial registrada** pelo almoxarife "+cu.name+". Itens pendentes: "+novos.filter(i=>i.status!=="entregue").map(i=>i.descricao).join(", "),type:"sistema",createdAt:nowTs()});
      criarTarefaAuto("acompanhamento","Entrega parcial — verificar saldo","Almoxarife "+cu.name+" informou entrega parcial. Verificar itens pendentes com o fornecedor "+forn.nome);
    }
    if(ns==="entregue"&&pedido.status!=="entregue"){
      onAddMsg(pedido.id,{id:uid(),userId:0,userName:"Sistema",avatar:"🤖",text:"✅ **Entrega total confirmada** pelo almoxarife "+cu.name+" em "+fmtDT(nowTs()),type:"sistema",createdAt:nowTs()});
    }
  }

  function setQtd(id,qtd){
    const it=itens.find(i=>i.id===id);if(!it)return;
    const q=Math.min(Math.max(0,Number(qtd)),it.quantidade);
    marcarItem(id,q<=0?"pendente":q>=it.quantidade?"entregue":"parcial",q);
  }

  function marcarTodosEntregues(){
    const novos=itens.map(it=>({...it,status:"entregue",qtdEntregue:it.quantidade,updatedBy:cu.name,updatedAt:nowTs()}));
    onUpdateItens(pedido.id,novos,"entregue");
    onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"✅ Todos os itens marcados como entregues",type:"sistema",createdAt:nowTs()});
    toast("✅ Entrega total confirmada!");
  }

  // ── CHAT / IA ──────────────────────────────────────────────────────────────
  async function sendMsg(){
    if(!msgTxt.trim())return;
    const txt=msgTxt.trim(); setMsgTxt("");
    onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:txt,type:"chat",createdAt:nowTs()});
    // se almoxarife pergunta e pedido dentro do prazo → IA responde
    if(isAlmox&&!isComp&&!atrasado){
      setAiLoad(true);
      try{
        const resp=await callIA([{role:"user",content:`Você é o comprador ${comp?.name||"Comprador"} respondendo ao almoxarife ${cu.name} sobre o pedido ${pedido.numero} (${forn.nome}). Previsão de entrega: ${fmtD(pedido.previsaoEntrega)}. A pergunta do almoxarife é: "${txt}". Responda de forma breve, profissional e informe a data de previsão.`}],400,"Você é assistente de compras da Amorim Coutinho Engenharia. Responda em nome do comprador, de forma concisa.");
        onAddMsg(pedido.id,{id:uid(),userId:0,userName:comp?.name||"Comprador (IA)",avatar:"🤖",text:"🤖 "+resp,type:"ia",createdAt:nowTs()});
      }catch{onAddMsg(pedido.id,{id:uid(),userId:0,userName:"Sistema",avatar:"🤖",text:"🤖 Não foi possível responder automaticamente.",type:"ia",createdAt:nowTs()});}
      setAiLoad(false);
    }
    // detectar palavras-chave
    const lo=txt.toLowerCase();
    if((lo.includes("boleto")||lo.includes("nota fiscal")||lo.includes("nf "))&&isAlmox) solicitarBoleto();
  }

  function solicitarBoleto(){
    onBoleto(pedido.id);
    criarTarefaAuto("boleto","Boleto/NF pendente — Pedido "+pedido.numero,"Almoxarife "+cu.name+" informou que o material chegou sem boleto ou nota fiscal. Verificar com "+forn.nome);
  }

  function criarTarefaAuto(categoria,title,description){
    const exists=tarefas.find(t=>t.pedidoId===pedido.id&&t.categoria===categoria&&t.status!=="resolvida"&&t.title===title);
    if(exists)return;
    const nova={id:uid(),categoria,title,description,status:"aberta",pedidoId:pedido.id,obra:pedido.obra,assignedTo:Number(pedido.comprador),due:pedido.previsaoEntrega||"",messages:[],createdBy:cu.name,createdAt:nowTs()};
    setTarefas(ts=>[nova,...ts]);
  }

  function salvarNovaTarefa(){
    if(!ntForm.title){alert("Título obrigatório.");return;}
    const nova={id:uid(),categoria:novaTarefa.categoria,title:ntForm.title,description:ntForm.description,status:"aberta",pedidoId:pedido.id,obra:pedido.obra,assignedTo:Number(pedido.comprador),due:ntForm.due||pedido.previsaoEntrega||"",messages:[],createdBy:cu.name,createdAt:nowTs()};
    setTarefas(ts=>[nova,...ts]);
    setNovaTarefa(null);setNtForm({title:"",description:"",due:""});
    toast("Tarefa criada!");
    onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"📌 Nova tarefa criada: "+ntForm.title,type:"sistema",createdAt:nowTs()});
  }

  function handleFile(e){
    Array.from(e.target.files).forEach(file=>{
      const r=new FileReader();
      r.onload=ev=>{onAddMsg(pedido.id,{id:uid(),userId:cu.id,userName:cu.name,avatar:cu.avatar,text:"📎 Arquivo: **"+file.name+"**",type:"anexo",anexo:{name:file.name,data:ev.target.result},createdAt:nowTs()});};
      r.readAsDataURL(file);
    });e.target.value="";
  }

  const tabS=(k)=>({padding:"7px 15px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:tab===k?G.green:G.alt,color:tab===k?"#fff":G.muted});
  const itFilt=itens.filter(it=>filtroIt==="todos"?true:filtroIt==="pendente"?it.status!=="entregue":it.status==="entregue");

  return(
    <Modal open={open} onClose={onClose} title={`Pedido ${pedido.numero} — ${forn.nome}`} width={920}>
      {/* STATUS BAR */}
      <div style={{background:cfg.bg,border:"1px solid "+cfg.color+"30",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{cfg.icon}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:cfg.color}}>{cfg.label}</div>
            <div style={{fontSize:11,color:G.muted}}>Criado por {pedido.createdBy} em {fmtD(pedido.createdAt)}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {nTot>0&&<div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:G.muted,marginBottom:3}}>{nEnt}/{nTot} entregues · {pct}%</div>
            <div style={{background:G.border,borderRadius:4,height:7,width:130,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:G.green,width:pct+"%",transition:"width .4s"}}/></div>
          </div>}
          {atrasado&&<Chip color={G.orange} bg="#FBE9E7">⚠️ Atrasado</Chip>}
          {pedido.status==="parcial"&&<Chip color={G.blue} bg="#E3F2FD">📦 Parcial</Chip>}
        </div>
      </div>

      {/* INFO GRID */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:"Obra",    v:obra?obra.code+" — "+obra.name:"—"},
          {l:"Almox.",  v:alm?.name||"—",              c:G.blue},
          {l:"Comprador",v:comp?.name||"—",            c:G.green},
          {l:"Fornecedor",v:forn.nome||"—"},
          {l:"Valor",   v:pedido.valor?"R$ "+pedido.valor:"—"},
          {l:"Prev. Entrega",v:fmtD(pedido.previsaoEntrega)},
          {l:"Tarefas abertas",v:myTarefas.filter(t=>t.status!=="resolvida").length+" tarefa(s)"},
          {l:"Observação",v:pedido.observacao||"—"},
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
        <button style={tabS("tarefas")} onClick={()=>setTab("tarefas")}>📋 Tarefas ({myTarefas.length})</button>
      </div>

      {/* ── TAB INSUMOS ── */}
      {tab==="insumos"&&(
        nTot===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:G.light}}><div style={{fontSize:36}}>📋</div><div style={{marginTop:8,fontSize:14}}>Nenhum insumo cadastrado</div></div>
          :<div>
            {/* controles */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:4}}>
                {[["todos",`Todos (${nTot})`],["pendente",`Pendentes (${nPend+nPar})`],["entregue",`Entregues (${nEnt})`]].map(([k,l])=>(
                  <button key={k} onClick={()=>setFiltroIt(k)} style={{padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filtroIt===k?G.green:G.alt,color:filtroIt===k?"#fff":G.muted}}>{l}</button>
                ))}
              </div>
              <div style={{flex:1}}/>
              {isAlmox&&<>
                <Btn size="sm" onClick={marcarTodosEntregues} variant="primary">✅ Todos entregues</Btn>
                <button onClick={()=>setFiltroIt("pendente")} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid "+G.purple,background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:G.purple}} title="Solicitar Boleto/NF" onClick={solicitarBoleto}>🧾 Sem Boleto/NF</button>
              </>}
            </div>

            {/* progresso */}
            <div style={{background:G.alt,borderRadius:10,padding:"9px 14px",marginBottom:10,display:"flex",gap:14,alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:G.muted,marginBottom:3}}><span>Progresso da entrega</span><span style={{fontWeight:700,color:G.greenDark}}>{pct}%{nEnt===nTot&&nTot>0?" ✅ ENTREGA TOTAL":""}</span></div>
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
                const ist=ISTAT[it.status]||ISTAT.pendente;
                return(
                  <div key={it.id} style={{display:"grid",gridTemplateColumns:"1fr 60px 80px 80px 160px",padding:"9px 12px",borderTop:"1px solid "+G.border,background:idx%2===0?"#fff":G.alt,alignItems:"center",gap:8}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:12}}>{it.descricao}</div>
                      {it.updatedBy&&<div style={{fontSize:10,color:G.light}}>Por {it.updatedBy} · {fmtD(it.updatedAt)}</div>}
                    </div>
                    <div style={{fontSize:12,color:G.muted}}>{it.unidade}</div>
                    <div style={{fontSize:13,fontWeight:700}}>{it.quantidade}</div>
                    <div>
                      {isAlmox
                        ?<input type="number" min="0" max={it.quantidade} value={it.qtdEntregue||0} onChange={e=>setQtd(it.id,e.target.value)} style={{...IB,width:68,padding:"4px 8px",fontSize:13,textAlign:"center"}}/>
                        :<span style={{fontSize:13}}>{it.qtdEntregue||0}</span>}
                    </div>
                    <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                      <Chip color={ist.color} bg={ist.bg}>{ist.icon} {ist.label}</Chip>
                      {isAlmox&&it.status!=="entregue"&&<button onClick={()=>marcarItem(it.id,"entregue",it.quantidade)} style={{padding:"2px 7px",borderRadius:5,border:"none",cursor:"pointer",background:G.green+"22",color:G.greenDark,fontSize:11,fontWeight:700}}>✅</button>}
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
            💬 Canal direto almoxarife ↔ comprador. {!atrasado&&isAlmox?"O assistente responderá perguntas enquanto o pedido estiver dentro do prazo.":""}
          </div>
          <div ref={chatRef} style={{background:G.alt,borderRadius:10,padding:12,minHeight:200,maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {!(pedido.messages?.length)&&<div style={{color:G.light,fontSize:13,textAlign:"center",marginTop:50}}>Sem mensagens ainda.</div>}
            {(pedido.messages||[]).map(m=>(
              <div key={m.id} style={{display:"flex",gap:8,flexDirection:cu.id===m.userId?"row-reverse":"row"}}>
                <div style={{fontSize:18}}>{typeof m.avatar==="string"&&m.avatar.length>2?m.avatar:<Av s={m.avatar||"?"} size={26} color={m.type==="ia"?G.greenDark:G.green}/>}</div>
                <div style={{maxWidth:"75%"}}>
                  <div style={{fontSize:10,color:G.muted,marginBottom:2,textAlign:cu.id===m.userId?"right":"left"}}><strong>{m.userName}</strong> · {fmtDT(m.createdAt)}</div>
                  <div style={{fontSize:13,background:m.type==="ia"?"#E8F5E9":m.type==="sistema"?"#FFF8E1":cu.id===m.userId?"#DCF8C6":"#fff",borderRadius:10,padding:"8px 11px",border:"1px solid "+(m.type==="ia"?"#A5D6A760":m.type==="sistema"?"#F4C43060":"#e0e0e0"),color:m.type==="ia"?G.greenDark:G.text,lineHeight:1.5}} dangerouslySetInnerHTML={{__html:(m.text||"").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>")}}/>
                  {m.type==="anexo"&&m.anexo&&<a href={m.anexo.data} download={m.anexo.name} style={{display:"block",fontSize:11,color:G.green,marginTop:4}}>⬇ {m.anexo.name}</a>}
                </div>
              </div>
            ))}
            {aiLoad&&<div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:18}}>🤖</span><span style={{fontSize:12,color:G.greenDark,fontStyle:"italic"}}>Digitando…</span></div>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={msgTxt} onChange={e=>setMsgTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMsg())} placeholder='Mensagem… diga "boleto", "NF" para criar tarefa automática' style={{...IB,flex:1,height:38,fontSize:12}}/>
            <Btn onClick={sendMsg}>Enviar</Btn>
            <button onClick={()=>fileRef.current?.click()} style={{padding:"0 12px",height:38,borderRadius:8,border:"1.5px solid #DDE8DD",background:"none",cursor:"pointer",fontSize:18}} title="Anexar arquivo">📎</button>
            <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={handleFile}/>
          </div>
        </div>
      )}

      {/* ── TAB TAREFAS ── */}
      {tab==="tarefas"&&(
        <div>
          {/* criar nova tarefa */}
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            {Object.entries(TCAT).map(([k,v])=>(
              <button key={k} onClick={()=>{setNovaTarefa({categoria:k});setNtForm({title:"",description:"",due:pedido.previsaoEntrega||""});}} style={{padding:"6px 13px",borderRadius:8,border:"1.5px solid "+v.color,background:v.bg,cursor:"pointer",fontSize:12,fontWeight:700,color:v.color}}>+ {v.icon} {v.label}</button>
            ))}
          </div>

          {/* form nova tarefa */}
          {novaTarefa&&(
            <div style={{background:TCAT[novaTarefa.categoria]?.bg,border:"1px solid "+TCAT[novaTarefa.categoria]?.color+"50",borderRadius:10,padding:14,marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:13,color:TCAT[novaTarefa.categoria]?.color,marginBottom:10}}>{TCAT[novaTarefa.categoria]?.icon} Nova Tarefa — {TCAT[novaTarefa.categoria]?.label}</div>
              <Fld label="Título"><Inp value={ntForm.title} onChange={e=>setNtForm(p=>({...p,title:e.target.value}))} placeholder="Descreva a tarefa…"/></Fld>
              <Fld label="Detalhes"><Txa rows={2} value={ntForm.description} onChange={e=>setNtForm(p=>({...p,description:e.target.value}))}/></Fld>
              <Fld label="Prazo"><Inp type="date" value={ntForm.due} onChange={e=>setNtForm(p=>({...p,due:e.target.value}))}/></Fld>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn variant="secondary" size="sm" onClick={()=>setNovaTarefa(null)}>Cancelar</Btn><Btn size="sm" onClick={salvarNovaTarefa}>Salvar Tarefa</Btn></div>
            </div>
          )}

          {/* lista por categoria */}
          {Object.entries(TCAT).map(([catKey,catCfg])=>{
            const cats=myTarefas.filter(t=>t.categoria===catKey);
            if(!cats.length)return null;
            return(
              <div key={catKey} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:catCfg.color,textTransform:"uppercase",marginBottom:6,letterSpacing:"0.06em"}}>{catCfg.icon} {catCfg.label} ({cats.length})</div>
                {cats.map(t=>(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,marginBottom:4,background:t.status==="resolvida"?"#fafafa":catCfg.bg,border:"1px solid "+catCfg.color+"30",opacity:t.status==="resolvida"?.7:1}}>
                    <span style={{fontSize:16}}>{t.status==="resolvida"?"✅":t.status==="andamento"?"🟡":"🔴"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                      {t.description&&<div style={{fontSize:11,color:G.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</div>}
                      <div style={{fontSize:10,color:G.light}}>Prazo: {fmtD(t.due)} · Criado por {t.createdBy}</div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      {t.status==="aberta"&&<button onClick={()=>setTarefas(ts=>ts.map(x=>x.id===t.id?{...x,status:"andamento"}:x))} style={{padding:"3px 8px",borderRadius:6,border:"1.5px solid "+G.gold,background:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:G.goldDark}}>▶ Iniciar</button>}
                      {t.status!=="resolvida"&&<button onClick={()=>{setTarefas(ts=>ts.map(x=>x.id===t.id?{...x,status:"resolvida"}:x));toast("✅ Tarefa concluída!");}} style={{padding:"3px 8px",borderRadius:6,border:"1.5px solid "+G.green,background:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:G.greenDark}}>✅ Concluir</button>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {myTarefas.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:G.light}}><div style={{fontSize:32}}>📋</div><div style={{fontSize:13,marginTop:8}}>Sem tarefas para este pedido</div></div>}
        </div>
      )}
    </Modal>
  );
}
