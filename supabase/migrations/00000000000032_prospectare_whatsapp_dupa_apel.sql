-- ============================================================
-- Prospectare, migrarea 5: WhatsApp după un apel „Interesat”.
--
-- Excepția acceptată de la regula unui singur canal: după un apel cu
-- rezultatul „Interesat”, conversația cu firma poate continua pe WhatsApp.
-- Firma rămâne pe canalul Telefon (nu primește canalul WhatsApp și nu
-- consumă limita conturilor de WhatsApp); în activitate apare
-- „Continuare apel pe WhatsApp”, o singură dată pentru fiecare apel.
-- Doar cheia de service. Se rulează după 28–31. Se poate rula de mai multe ori.
-- ============================================================

create or replace function public.prospectare_continua_pe_whatsapp(p_lista bigint, p_autor text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.prospectare_liste_zi%rowtype;
  f public.prospectare_firme%rowtype;
  v_cheie text;
  v_nume text;
begin
  select * into l from public.prospectare_liste_zi where id = p_lista;
  if not found then
    raise exception 'Rândul din listă nu mai există.' using errcode = 'PR404';
  end if;
  if l.canal <> 'telefon' then
    raise exception 'Continuarea pe WhatsApp e doar pentru apelurile din lista de telefon.' using errcode = 'PR422';
  end if;
  if l.rezultat is distinct from 'interesat' then
    raise exception 'WhatsApp după apel se deschide doar după rezultatul „Interesat”.' using errcode = 'PR409';
  end if;

  select * into f from public.prospectare_firme where id = l.firma_id;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu mai primește niciun mesaj.', f.nr using errcode = 'PR410';
  end if;
  if f.canal is distinct from 'telefon' then
    raise exception 'Firma #% nu mai e pe canalul Telefon: continuarea pe WhatsApp nu se aplică.', f.nr using errcode = 'PR409';
  end if;
  if f.telefon is null or not f.este_mobil then
    raise exception 'Firma #% are număr fix: fără WhatsApp.', f.nr using errcode = 'PR422';
  end if;

  v_cheie := 'whatsapp_dupa_apel:' || l.id;
  if exists (select 1 from public.prospectare_activitate where cheie = v_cheie) then
    return jsonb_build_object('deja', true);
  end if;

  v_nume := case l.utilizator when 'stefan' then 'Ștefan' when 'vladut' then 'Vlăduț' else l.utilizator end;
  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  perform public.prospectare_noteaza(f.id, 'whatsapp', 'telefon',
    jsonb_build_object('continuare_apel', true, 'text', 'Continuare apel pe WhatsApp', 'lista', l.id), v_cheie);
  return jsonb_build_object('deja', false);
end;
$$;

revoke all on function public.prospectare_continua_pe_whatsapp(bigint, text) from public;
revoke all on function public.prospectare_continua_pe_whatsapp(bigint, text) from anon, authenticated;
grant execute on function public.prospectare_continua_pe_whatsapp(bigint, text) to service_role;

select 'continuarea pe WhatsApp doar pentru cheia de service' as verificare,
  not has_function_privilege('anon', 'public.prospectare_continua_pe_whatsapp(bigint, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.prospectare_continua_pe_whatsapp(bigint, text)', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_continua_pe_whatsapp(bigint, text)', 'execute') as ok;
