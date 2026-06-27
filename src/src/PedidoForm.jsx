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
