import { useState, useEffect, useCallback } from 'react'
import {
  db, fetchAll, upsertRow, deleteRow,
  pedidoToDb, pedidoFromDb,
  tarefaToDb, tarefaFromDb,
  obraToDb, obraFromDb,
  userToDb, userFromDb,
  eventToDb, eventFromDb,
  ataToDb, ataFromDb
} from './supabase.js'

export function useAppData() {
  const [users,   setUsersState]   = useState([])
  const [obras,   setObrasState]   = useState([])
  const [pedidos, setPedidosState] = useState([])
  const [tarefas, setTarefasState] = useState([])
  const [events,  setEventsState]  = useState([])
  const [atas,    setAtasState]    = useState([])
  const [loading, setLoading]      = useState(true)
  const [error,   setError]        = useState(null)

  // ── initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [u, o, p, t, ev, at] = await Promise.all([
          fetchAll('fl_users'),
          fetchAll('fl_obras'),
          db.from('fl_pedidos').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
          db.from('fl_tarefas').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
          db.from('fl_events').select('*').order('date').then(r => r.data || []),
          db.from('fl_atas').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
        ])
        setUsersState(u.map(userFromDb))
        setObrasState(o.map(obraFromDb))
        setPedidosState(p.map(pedidoFromDb))
        setTarefasState(t.map(tarefaFromDb))
        setEventsState(ev.map(eventFromDb))
        setAtasState(at.map(ataFromDb))
      } catch (e) {
        console.error('Load error:', e)
        setError(e.message)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const sub = db
      .channel('facten-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fl_pedidos' }, () => {
        db.from('fl_pedidos').select('*').order('created_at', { ascending: false })
          .then(r => setPedidosState((r.data || []).map(pedidoFromDb)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fl_tarefas' }, () => {
        db.from('fl_tarefas').select('*').order('created_at', { ascending: false })
          .then(r => setTarefasState((r.data || []).map(tarefaFromDb)))
      })
      .subscribe()
    return () => db.removeChannel(sub)
  }, [])

  // ── users ────────────────────────────────────────────────────────────────
  const saveUser = useCallback(async (editId, form) => {
    const row = userToDb({ ...form, id: editId || undefined })
    const saved = await upsertRow('fl_users', row)
    if (editId) setUsersState(u => u.map(x => x.id===editId ? userFromDb(saved) : x))
    else setUsersState(u => [...u, userFromDb(saved)])
  }, [])

  // ── obras ────────────────────────────────────────────────────────────────
  const saveObra = useCallback(async (editId, form) => {
    const row = obraToDb({ ...form, id: editId || undefined })
    const saved = await upsertRow('fl_obras', row)
    if (editId) setObrasState(o => o.map(x => x.id===editId ? obraFromDb(saved) : x))
    else setObrasState(o => [...o, obraFromDb(saved)])
  }, [])

  const toggleObra = useCallback(async (id) => {
    const obra = obras.find(o => o.id===id)
    if (!obra) return
    const updated = { ...obraToDb(obra), id, active: !obra.active }
    await upsertRow('fl_obras', updated)
    setObrasState(o => o.map(x => x.id===id ? { ...x, active: !x.active } : x))
  }, [obras])

  const toggleUser = useCallback(async (id) => {
    const user = users.find(u => u.id===id)
    if (!user) return
    const updated = { ...userToDb(user), id, active: !user.active }
    await upsertRow('fl_users', updated)
    setUsersState(u => u.map(x => x.id===id ? { ...x, active: !x.active } : x))
  }, [users])

  // ── pedidos ──────────────────────────────────────────────────────────────
  const savePedido = useCallback(async (form, editId, createdBy) => {
    const uid = editId || Math.random().toString(36).slice(2,10)
    const row = pedidoToDb({
      ...form,
      id: uid,
      status: editId ? form.status : 'pendente',
      messages: form.messages || [],
      anexos:   form.anexos   || [],
      createdBy,
    })
    await upsertRow('fl_pedidos', row)
    // realtime will update, but also update locally for instant feedback
    const fresh = pedidoFromDb({ ...row, created_at: new Date().toISOString() })
    if (editId) setPedidosState(p => p.map(x => x.id===editId ? fresh : x))
    else setPedidosState(p => [fresh, ...p])
    return uid
  }, [])

  const updatePedidoField = useCallback(async (id, fields) => {
    setPedidosState(p => p.map(x => x.id===id ? { ...x, ...fields } : x))
    // persist only changed fields to DB
    const dbFields = {}
    if ('status'   in fields) dbFields.status   = fields.status
    if ('itens'    in fields) dbFields.itens     = fields.itens
    if ('messages' in fields) dbFields.messages  = fields.messages
    if ('anexos'   in fields) dbFields.anexos    = fields.anexos
    if (Object.keys(dbFields).length) {
      await db.from('fl_pedidos').update(dbFields).eq('id', id)
    }
  }, [])

  // ── tarefas ──────────────────────────────────────────────────────────────
  const saveTarefa = useCallback(async (tarefa) => {
    const row = tarefaToDb(tarefa)
    await upsertRow('fl_tarefas', row)
    setTarefasState(t => {
      const exists = t.find(x => x.id===tarefa.id)
      return exists ? t.map(x => x.id===tarefa.id ? tarefaFromDb(row) : x) : [tarefaFromDb(row), ...t]
    })
  }, [])

  const updateTarefa = useCallback(async (id, fields) => {
    setTarefasState(t => t.map(x => x.id===id ? { ...x, ...fields } : x))
    const dbFields = {}
    if ('status'      in fields) dbFields.status      = fields.status
    if ('assignedTo'  in fields) dbFields.assigned_to = fields.assignedTo ? Number(fields.assignedTo) : null
    if ('comments'    in fields) dbFields.comments    = fields.comments
    if (Object.keys(dbFields).length) {
      await db.from('fl_tarefas').update(dbFields).eq('id', id)
    }
  }, [])

  const addComment = useCallback(async (id, comment) => {
    const tarefa = tarefas.find(t => t.id===id)
    if (!tarefa) return
    const updated = [...(tarefa.comments || []), comment]
    setTarefasState(t => t.map(x => x.id===id ? { ...x, comments: updated } : x))
    await db.from('fl_tarefas').update({ comments: updated }).eq('id', id)
  }, [tarefas])

  // ── events ───────────────────────────────────────────────────────────────
  const saveEvent = useCallback(async (ev) => {
    const row = eventToDb(ev)
    await upsertRow('fl_events', row)
    setEventsState(e => {
      const exists = e.find(x => x.id===ev.id)
      return exists ? e.map(x => x.id===ev.id ? eventFromDb(row) : x) : [...e, eventFromDb(row)]
    })
  }, [])

  const deleteEvent = useCallback(async (id) => {
    await deleteRow('fl_events', id)
    setEventsState(e => e.filter(x => x.id!==id))
  }, [])

  // ── atas ─────────────────────────────────────────────────────────────────
  const saveAta = useCallback(async (ata) => {
    const row = ataToDb(ata)
    await upsertRow('fl_atas', row)
    setAtasState(a => [ataFromDb({ ...row, created_at: new Date().toISOString() }), ...a])
  }, [])

  return {
    users, obras, pedidos, tarefas, events, atas,
    loading, error,
    saveUser, saveObra, toggleObra, toggleUser,
    savePedido, updatePedidoField,
    saveTarefa, updateTarefa, addComment,
    saveEvent, deleteEvent,
    saveAta,
    setUsersState, setObrasState, setPedidosState, setTarefasState,
  }
}
