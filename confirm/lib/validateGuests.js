import * as XLSX from 'xlsx';

// Normaliza um telefone brasileiro para o formato E.164 (ex: +5511999998888)
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `+${withCountry}`;
}

export function parseAndValidateGuests(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const valid = [];
  const errors = [];
  const seenPhones = new Set();

  rows.forEach((row, index) => {
    const line = index + 2; // +2 porque a linha 1 é o cabeçalho
    const name = String(row['Nome Completo'] || row['nome'] || '').trim();
    const rawPhone = row['Número de Telefone'] || row['telefone'] || '';
    const phone = normalizePhone(rawPhone);

    if (!name) {
      errors.push({ line, reason: 'Nome em branco' });
      return;
    }
    if (!phone) {
      errors.push({ line, reason: `Telefone inválido: "${rawPhone}"` });
      return;
    }
    if (seenPhones.has(phone)) {
      errors.push({ line, reason: `Telefone duplicado: ${phone}` });
      return;
    }

    seenPhones.add(phone);
    valid.push({ full_name: name, phone });
  });

  return { valid, errors };
}
