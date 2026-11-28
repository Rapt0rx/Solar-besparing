CREATE OR REPLACE FUNCTION public.solar_save_entry(p_kind text, p_recorded_at timestamp with time zone, p_reading numeric, p_units numeric DEFAULT NULL::numeric, p_paid numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare u uuid := auth.uid(); mt text; m public.solar_meter_readings%rowtype; pur public.solar_purchases%rowtype;
begin
 if u is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('electricity','water','topup') or p_recorded_at is null or not isfinite(p_recorded_at) or p_recorded_at > now()+interval '1 minute' or p_recorded_at < '2000-01-01'::timestamptz or p_reading is null or not (p_reading between 0 and 999999999999) or p_reading <> round(p_reading,6) then raise exception 'Invalid reading, type or timestamp'; end if;
 if p_kind='topup' then
  if p_units is null or not (p_units > 0 and p_units <= 9999999999) or p_units<>round(p_units,4) or p_paid is null or not(p_paid between 0 and 999999999999) or p_paid<>round(p_paid,2) then raise exception 'Invalid purchase units or amount'; end if;
 elsif p_units is not null or p_paid is not null then raise exception 'Purchase fields are only valid for top-ups'; end if;
 mt:=case when p_kind='water' then 'water' else 'electricity' end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
 insert into public.solar_meter_readings(owner_id,meter_type,recorded_at,reading,unit,meter_name,source)
 values(u,mt,p_recorded_at,p_reading,case when mt='water' then 'raw' else 'kWh' end,case when mt='water' then 'Main Water' else 'Vaalpark huis' end,'manual') on conflict do nothing;
 select * into m from public.solar_meter_readings where owner_id=u and meter_type=mt and recorded_at=p_recorded_at;
 if not found or m.reading<>p_reading or m.source<>'manual' then raise exception 'Conflicting or imported reading at this timestamp'; end if;
 if p_kind='topup' then
  insert into public.solar_purchases(owner_id,recorded_at,units_kwh,paid_zar,estimated_units,source) values(u,p_recorded_at,p_units,p_paid,false,'manual') on conflict do nothing;
  select * into pur from public.solar_purchases where owner_id=u and recorded_at=p_recorded_at;
  if not found or pur.units_kwh<>p_units or pur.paid_zar is distinct from p_paid or pur.estimated_units or pur.source<>'manual' then raise exception 'Conflicting purchase at this timestamp'; end if;
 elsif mt='electricity' and exists(select 1 from public.solar_purchases where owner_id=u and recorded_at=p_recorded_at) then
  raise exception 'A purchase already exists at this timestamp';
 end if;
 return jsonb_build_object('saved',true,'kind',p_kind,'recorded_at',p_recorded_at);
end $function$;
REVOKE ALL ON FUNCTION public.solar_save_entry(text,timestamptz,numeric,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solar_save_entry(text,timestamptz,numeric,numeric,numeric) TO authenticated;
