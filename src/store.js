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
