import { supabaseAdmin } from '../../lib/supabase';
import * as XLSX from 'xlsx';

const STATUS_LABEL = {
  pending: 'Sem resposta',
  confirmed: 'Confirmado',
  declined: 'Não vai',
};

export default async function handler(req, res) {
  const { event_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id é obrigatório' });

  const { data: guests, error } = await supabaseAdmin
    .from('guests')
    .select('full_name, phone, confirmation_status, companions, notes, reminder_count')
    .eq('event_id', event_id)
    .order('full_name');
  if (error) return res.status(500).json({ error: error.message });

  const rows = guests.map((g) => ({
    'Nome Completo': g.full_name,
    'Telefone': g.phone,
    'Confirmação de Presença': STATUS_LABEL[g.confirmation_status] || g.confirmation_status,
    'Acompanhantes': g.companions || 0,
    'Observações': g.notes || '',
    'Lembretes enviados': g.reminder_count || 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 40 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Convidados');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=lista_convidados.xlsx');
  return res.send(buffer);
}
