import { supabaseAdmin } from '../../lib/supabase';
import { parseAndValidateGuests } from '../../lib/validateGuests';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const form = formidable({});
  const [fields, files] = await form.parse(req);
  const eventId = fields.event_id?.[0];
  const file = files.file?.[0];

  if (!eventId || !file) {
    return res.status(400).json({ error: 'event_id e file são obrigatórios' });
  }

  const buffer = fs.readFileSync(file.filepath);
  const { valid, errors } = parseAndValidateGuests(buffer);

  if (valid.length > 0) {
    const rows = valid.map((g) => ({ ...g, event_id: eventId, confirmation_status: 'pending' }));
    const { error } = await supabaseAdmin.from('guests').upsert(rows, {
      onConflict: 'event_id,phone',
      ignoreDuplicates: true,
    });
    if (error) return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    inserted: valid.length,
    errors_count: errors.length,
    errors,
  });
}
