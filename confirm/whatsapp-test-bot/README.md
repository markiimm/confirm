# Bot de teste — WhatsApp gratuito (Baileys)

**Isso é só para você testar o fluxo funcionando, sem gastar nada.**
Não use isso com clientes reais ou em produção — método não oficial,
risco de banimento do número. Use um chip de teste separado.

## Como rodar
```
cd whatsapp-test-bot
npm install
cp .env.example .env
```
Preencha o `.env` com as chaves do Supabase e o `TEST_EVENT_ID`.
```
npm start
```
Escaneie o QR Code com WhatsApp → Aparelhos conectados.

## Migrando para produção
Troque essa parte pela API oficial (360dialog, Gupshup) usando
`lib/whatsapp.js`, que já está pronta no projeto principal.
