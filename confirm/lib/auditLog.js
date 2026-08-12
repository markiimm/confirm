import { supabaseAdmin } from './supabase';

// Registra uma ação administrativa do dono. Nunca deve derrubar a rota
// que chamou — é só rastro, não uma etapa crítica da operação.
export async function logAction(actorId, action, targetId = null, details = null) {
  try {
    await supabaseAdmin.from('audit_log').insert({ actor_id: actorId, action, target_id: targetId, details });
  } catch {
    // intencional: log nunca deve quebrar a operação principal
  }
}
