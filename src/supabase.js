import { createClient } from '@supabase/supabase-js'

const URL  = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const db = createClient(URL, ANON)

// ── helpers ──────────────────────────────────────────────────────────────────
export async function fetchAll(table) {
  const { data, error } = await db.from(table).select('*').order('id')
  if (error) throw error
  return data || []
}

export async function upsertRow(table, row) {
  const { data, error } = await db.from(table).upsert(row).select()
  if (error) throw error
  return data?.[0]
}

export async function deleteRow(table, id) {
  const { error } = await db.from(table).delete().eq('id', id)
  if (error) throw error
}

// ── pedidos: map JS camelCase <-> DB snake_case ───────────────────────────────
export function pedidoToDb(p) {
  return {
    id:               p.id,
    numero:           p.numero,
    fornecedor:       p.fornecedor,
    obra:             p.obra ? Number(p.obra) : null,
    comprador:        p.comprador ? Number(p.comprador) : null,
    valor:            p.valor || null,
    previsao_entrega: p.previsaoEntrega || null,
    observacao:       p.observacao || null,
    status:           p.status || 'pendente',
    itens:            p.itens || [],
    messages:         p.messages || [],
    anexos:           p.anexos || [],
    created_by:       p.createdBy || null,
  }
}

export function pedidoFromDb(r) {
  return {
    id:              r.id,
    numero:          r.numero,
    fornecedor:      r.fornecedor,
    obra:            r.obra ? String(r.obra) : '',
    comprador:       r.comprador ? String(r.comprador) : '',
    valor:           r.valor || '',
    previsaoEntrega: r.previsao_entrega || '',
    observacao:      r.observacao || '',
    status:          r.status,
    itens:           r.itens || [],
    messages:        r.messages || [],
    anexos:          r.anexos || [],
    createdBy:       r.created_by || '',
    createdAt:       r.created_at,
  }
}

export function tarefaToDb(t) {
  return {
    id:          t.id,
    title:       t.title,
    description: t.description || null,
    type:        t.type || 'manual',
    status:      t.status || 'aberta',
    pedido_id:   t.pedidoId || null,
    obra:        t.obra ? Number(t.obra) : null,
    assigned_to: t.assignedTo ? Number(t.assignedTo) : null,
    due:         t.due || null,
    comments:    t.comments || [],
    created_by:  t.createdBy || null,
  }
}

export function tarefaFromDb(r) {
  return {
    id:          r.id,
    title:       r.title,
    description: r.description || '',
    type:        r.type,
    status:      r.status,
    pedidoId:    r.pedido_id || null,
    obra:        r.obra ? String(r.obra) : '',
    assignedTo:  r.assigned_to ? Number(r.assigned_to) : null,
    due:         r.due || '',
    comments:    r.comments || [],
    createdBy:   r.created_by || '',
    createdAt:   r.created_at,
  }
}

export function obraToDb(o) {
  return {
    id:         o.id || undefined,
    code:       o.code,
    name:       o.name,
    city:       o.city || null,
    state:      o.state || 'MA',
    almoxarife: o.almoxarife ? Number(o.almoxarife) : null,
    active:     o.active !== false,
  }
}

export function obraFromDb(r) {
  return {
    id:         r.id,
    code:       r.code,
    name:       r.name,
    city:       r.city || '',
    state:      r.state || 'MA',
    almoxarife: r.almoxarife ? Number(r.almoxarife) : null,
    active:     r.active,
  }
}

export function userToDb(u) {
  return {
    id:     u.id || undefined,
    name:   u.name,
    email:  u.email || null,
    role:   u.role,
    avatar: u.avatar || u.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase(),
    active: u.active !== false,
  }
}

export function userFromDb(r) {
  return {
    id:     r.id,
    name:   r.name,
    email:  r.email || '',
    role:   r.role,
    avatar: r.avatar || '',
    active: r.active,
  }
}

export function eventToDb(e) {
  return {
    id:    e.id,
    title: e.title,
    date:  e.date,
    time:  e.time || null,
    type:  e.type || 'outro',
    obra:  e.obra ? Number(e.obra) : null,
    descricao: e.desc || null,
    user_id: e.userId ? Number(e.userId) : null,
  }
}

export function eventFromDb(r) {
  return {
    id:     r.id,
    title:  r.title,
    date:   r.date,
    time:   r.time || '',
    type:   r.type,
    obra:   r.obra ? String(r.obra) : '',
    desc:   r.descricao || '',
    userId: r.user_id,
    createdAt: r.created_at,
  }
}

export function ataToDb(a) {
  return {
    id:            a.id,
    title:         a.title,
    date:          a.date,
    obra:          a.obra ? Number(a.obra) : null,
    participantes: a.participantes || null,
    pauta:         a.pauta || null,
    deliberacoes:  a.deliberacoes || null,
    prox_reuniao:  a.proxReuniao || null,
    content:       a.content || null,
    created_by:    a.createdBy || null,
  }
}

export function ataFromDb(r) {
  return {
    id:            r.id,
    title:         r.title,
    date:          r.date,
    obra:          r.obra ? String(r.obra) : '',
    participantes: r.participantes || '',
    pauta:         r.pauta || '',
    deliberacoes:  r.deliberacoes || '',
    proxReuniao:   r.prox_reuniao || '',
    content:       r.content || '',
    createdBy:     r.created_by || '',
    createdAt:     r.created_at,
  }
}
