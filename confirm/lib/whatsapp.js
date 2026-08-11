// Wrapper genérico para o provedor de WhatsApp Business API (BSP).
// Ajuste o corpo da requisição conforme a documentação do provedor
// escolhido (360dialog, Gupshup, Twilio etc.) — a estrutura abaixo
// segue o formato mais comum de envio de template.

const BSP_API_URL = process.env.WHATSAPP_BSP_API_URL;
const BSP_API_KEY = process.env.WHATSAPP_BSP_API_KEY;

export async function sendTemplateMessage(to, templateName, params = []) {
  const res = await fetch(`${BSP_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BSP_API_KEY}`,
    },
    body: JSON.stringify({
      to,
      type: 'template',
      template: {
        name: templateName, // precisa ser um template aprovado pela Meta
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: params.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao enviar WhatsApp para ${to}: ${errText}`);
  }
  return res.json();
}

export async function sendImageMessage(to, imageUrl, caption = '') {
  const res = await fetch(`${BSP_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BSP_API_KEY}`,
    },
    body: JSON.stringify({
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao enviar imagem para ${to}: ${errText}`);
  }
  return res.json();
}

// Interpreta a resposta livre do convidado como sim / não / indefinido.
// Checa as negativas primeiro: frases como "não vou poder ir" contêm
// "vou", que também aparece em respostas afirmativas — a negação
// precisa vencer esse tipo de ambiguidade.
export function interpretReply(text) {
  const t = text.trim().toLowerCase();
  const yes = ['sim', 'confirmo', 'confirmado', 'aceito'];
  const no = ['não', 'nao', 'recuso', 'infelizmente não', 'não poderei', 'não vou'];
  if (no.some((w) => t.includes(w))) return 'declined';
  if (yes.some((w) => t.includes(w))) return 'confirmed';
  return 'unclear';
}

// Tenta descobrir quantos acompanhantes o convidado mencionou.
// Ex: "sim, vou levar 2 pessoas" → 2; "sim, com minha esposa" → 1.
// Retorna null quando não há indício nenhum, para não sobrescrever
// um valor que a consultora já tenha ajustado à mão.
export function extractCompanions(text) {
  const t = text.trim().toLowerCase();

  const numeric = t.match(/(\d+)\s*(acompanhante|pessoa|convidado|amigo)/);
  if (numeric) return Math.min(Number(numeric[1]), 20);

  const wordNumbers = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5 };
  const written = t.match(/(um|uma|dois|duas|tr[êe]s|quatro|cinco)\s*(acompanhante|pessoa|convidado)/);
  if (written) return wordNumbers[written[1]] ?? null;

  // Menções a uma pessoa específica valem como 1 acompanhante
  if (/(minha|meu)\s+(esposa|marido|namorad[ao]|filh[ao]|companheir[ao])/.test(t)) return 1;
  if (/\+\s*1/.test(t)) return 1;

  return null;
}
