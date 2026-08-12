// Gera e baixa um CSV no navegador, sem precisar de round-trip no servidor.
// Usa ";" como separador (padrão do Excel em pt-BR) e BOM pra acentuação
// não quebrar ao abrir no Excel.
export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const s = String(value ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(';'),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(';')),
  ];
  const csv = String.fromCharCode(0xfeff) + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
