import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabaseClient';

// Garante que só usuários logados com o papel certo vejam a página.
// Aceita um papel ('owner') ou vários (['consultant', 'collaborator']).
//
// Colaboradores herdam plano e assinatura da empresa a que pertencem —
// por isso o perfil devolvido já vem com esses campos resolvidos.
export function useProtectedPage(requiredRole) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const allowedKey = allowed.join(',');

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/login'); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (!prof || !prof.active || !allowed.includes(prof.role)) {
        router.push('/login');
        return;
      }

      let resolved = { ...prof, account_id: prof.id, account_name: prof.full_name };

      if (prof.role === 'collaborator' && prof.parent_id) {
        const { data: parent } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', prof.parent_id)
          .single();

        if (!parent || !parent.active) { router.push('/login'); return; }

        resolved = {
          ...prof,
          account_id: parent.id,
          account_name: parent.full_name,
          plan: parent.plan,
          pattern_type: parent.pattern_type,
          subscription_status: parent.subscription_status,
          trial_ends_at: parent.trial_ends_at,
        };
      }

      setSession(data.session);
      setProfile(resolved);
      setLoading(false);
    }
    check();
  }, [allowedKey, router]);

  return { session, profile, loading };
}
