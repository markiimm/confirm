// Wrapper para a API do Asaas — usada para o período de teste grátis e
// a cobrança recorrente depois que o trial acaba. Docs: docs.asaas.com

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

async function asaasFetch(path, options = {}) {
  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: ASAAS_API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro Asaas (${path}): ${errText}`);
  }
  return res.json();
}

// Cria o cliente no Asaas (uma vez por consultora/empresa)
export async function createAsaasCustomer({ name, email, cpfCnpj, phone }) {
  return asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({ name, email, cpfCnpj, phone }),
  });
}

// Cria a assinatura recorrente. billingType 'UNDEFINED' deixa o cliente
// escolher entre cartão, Pix ou boleto na tela de pagamento do Asaas.
export async function createAsaasSubscription({ customerId, value, nextDueDate, cycle = 'MONTHLY', description }) {
  return asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'UNDEFINED',
      value,
      nextDueDate,
      cycle,
      description,
    }),
  });
}

// Altera o valor de uma assinatura existente (troca de plano)
export async function updateAsaasSubscription(subscriptionId, { value }) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, {
    method: 'POST',
    body: JSON.stringify({ value, updatePendingPayments: true }),
  });
}

// Cancela a assinatura recorrente
export async function cancelAsaasSubscription(subscriptionId) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

// Preços por plano, usados ao criar a assinatura
export const PLAN_PRICES = {
  normal: 49.9,
  pro: 99.9,
};

export const PLAN_LABELS = {
  normal: 'Normal',
  pro: 'PRO',
};
