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
