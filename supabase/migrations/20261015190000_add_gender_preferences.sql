-- EmiMatch: identidad de género y preferencias de descubrimiento.
-- Se mantiene nullable para que los perfiles existentes sigan funcionando sin cambios.
alter table public.profiles
  add column if not exists gender_identity text;

alter table public.profiles
  add column if not exists preferred_genders text[];

comment on column public.profiles.gender_identity is
  'Identidad de género elegida por el usuario para personalizar su experiencia en EmiMatch.';

comment on column public.profiles.preferred_genders is
  'Grupos de género que el usuario desea conocer: women, men, nonbinary, other.';
