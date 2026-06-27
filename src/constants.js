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
