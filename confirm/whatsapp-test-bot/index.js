import 'dotenv/config';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const EVENT_ID = process.env.TEST_EVENT_ID;
const INVITE_IMAGE_URL = process.env.TEST_INVITE_IMAGE_URL;

function interpretReply(text) {
  const t = text.trim().toLowerCase();
  const yes = ['sim', 'confirmo', 'confirmado', 'aceito'];
  const no = ['não', 'nao', 'recuso', 'não poderei', 'não vou'];
  if (no.some((w) => t.includes(w))) return 'declined';
  if (yes.some((w) => t.includes(w))) return 'confirmed';
  return 'unclear';
}

async function sendPendingInvites(sock) {
  const { data: event } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
  if (!event) { console.log('Evento não encontrado — confira o TEST_EVENT_ID no .env'); return; }

  const { data: guests } = await supabase.from('guests').select('*').eq('event_id', EVENT_ID).eq('confirmation_status', 'pending');
  console.log(`Enviando convite de teste para ${guests.length} convidado(s)...`);

  for (const guest of guests) {
    const jid = `${guest.phone.replace('+', '')}@s.whatsapp.net`;
    const text = `Olá, ${guest.full_name}! Você foi convidado(a) para: ${event.event_name}. ` +
      `O evento acontecerá em ${new Date(event.event_date).toLocaleDateString('pt-BR')}. ` +
      `Para confirmar sua presença, responda apenas com SIM ou NÃO.`;
    try {
      await sock.sendMessage(jid, { text });
      console.log(`✓ Enviado para ${guest.full_name} (${guest.phone})`);
    } catch (err) {
      console.log(`✗ Falha ao enviar para ${guest.full_name}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function handleIncomingMessage(sock, msg) {
  if (msg.key.fromMe || !msg.message) return;
  const phone = `+${msg.key.remoteJid.split('@')[0]}`;
  const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
  if (!text) return;

  const { data: guest } = await supabase.from('guests').select('*').eq('phone', phone).eq('event_id', EVENT_ID).eq('confirmation_status', 'pending').maybeSingle();
  if (!guest) { console.log(`Mensagem recebida de número não cadastrado como pendente: ${phone}`); return; }

  const intent = interpretReply(text);
  console.log(`Resposta de ${guest.full_name}: "${text}" → interpretado como "${intent}"`);
  await supabase.from('messages_log').insert({ guest_id: guest.id, direction: 'inbound', message_type: 'reply', content: text });

  if (intent === 'unclear') { console.log('Resposta não reconhecida — não atualizei o status automaticamente.'); return; }
  await supabase.from('guests').update({ confirmation_status: intent }).eq('id', guest.id);

  if (intent === 'confirmed' && INVITE_IMAGE_URL) {
    await sock.sendMessage(msg.key.remoteJid, { image: { url: INVITE_IMAGE_URL }, caption: 'Que alegria! Seu convite digital está aqui 💌' });
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth-session');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) { console.log('Escaneie este QR Code no WhatsApp (Aparelhos conectados):'); qrcode.generate(qr, { small: true }); }
    if (connection === 'open') { console.log('Conectado! Iniciando envio dos convites de teste...'); await sendPendingInvites(sock); console.log('Convites enviados. Aguardando respostas dos convidados...'); }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão encerrada.', shouldReconnect ? 'Tentando reconectar...' : 'Deslogado.');
      if (shouldReconnect) start();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) await handleIncomingMessage(sock, msg);
  });
}

start();
