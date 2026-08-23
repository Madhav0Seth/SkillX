create table if not exists users (
  wallet_address text primary key,
  role text not null check (role in ('client', 'freelancer', 'both')),
  skills text[] not null default '{}',
  bio text not null default '',
  portfolio text not null default '',
  avatar_url text,
  name text,
  created_at timestamptz not null default now()
);

alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('client', 'freelancer', 'both'));

create table if not exists jobs (
  job_id bigint generated always as identity primary key,
  client_wallet text not null references users(wallet_address),
  freelancer_wallet text references users(wallet_address),
  title text not null,
  description text not null,
  job_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists milestones (
  milestone_id bigint generated always as identity primary key,
  job_id bigint not null references jobs(job_id) on delete cascade,
  name text not null,
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  amount numeric(12,2) not null check (amount >= 0),
  deadline timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  submission_id bigint generated always as identity primary key,
  milestone_id bigint not null references milestones(milestone_id) on delete cascade,
  submission_hash text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_role on users(role);
create index if not exists idx_jobs_client_wallet on jobs(client_wallet);
create index if not exists idx_jobs_freelancer_wallet on jobs(freelancer_wallet);
create index if not exists idx_milestones_job_id on milestones(job_id);
create index if not exists idx_submissions_milestone_id on submissions(milestone_id);

-- API mutations use these functions so related records change atomically.
create or replace function create_job_with_milestones(
  p_client_wallet text,
  p_freelancer_wallet text,
  p_title text,
  p_description text,
  p_job_hash text,
  p_milestones jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_job jobs;
  v_milestone milestones;
  v_created_milestones jsonb := '[]'::jsonb;
  v_item jsonb;
begin
  insert into jobs (client_wallet, freelancer_wallet, title, description, job_hash)
  values (p_client_wallet, p_freelancer_wallet, p_title, p_description, p_job_hash)
  returning * into v_job;

  for v_item in select value from jsonb_array_elements(p_milestones)
  loop
    insert into milestones (job_id, name, percentage, amount, deadline, status)
    values (
      v_job.job_id,
      v_item->>'name',
      (v_item->>'percentage')::numeric,
      (v_item->>'amount')::numeric,
      (v_item->>'deadline')::timestamptz,
      'pending'
    ) returning * into v_milestone;
    v_created_milestones := v_created_milestones || jsonb_build_array(to_jsonb(v_milestone));
  end loop;

  return jsonb_build_object('job', to_jsonb(v_job), 'milestones', v_created_milestones);
end;
$$;

create or replace function submit_milestone(
  p_milestone_id bigint,
  p_freelancer_wallet text,
  p_file_url text,
  p_submission_hash text
) returns jsonb
language plpgsql
as $$
declare
  v_milestone milestones;
  v_submission submissions;
begin
  select m.* into v_milestone from milestones m where m.milestone_id = p_milestone_id for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if not exists (select 1 from jobs where job_id = v_milestone.job_id and freelancer_wallet = p_freelancer_wallet) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if v_milestone.status <> 'pending' then return jsonb_build_object('error', 'invalid_status'); end if;
  if exists (
    select 1 from milestones
    where job_id = v_milestone.job_id and milestone_id < v_milestone.milestone_id and status <> 'approved'
  ) then return jsonb_build_object('error', 'previous_incomplete'); end if;

  insert into submissions (milestone_id, submission_hash, file_url)
  values (p_milestone_id, p_submission_hash, p_file_url) returning * into v_submission;
  update milestones set status = 'submitted' where milestone_id = p_milestone_id;
  return jsonb_build_object('submission', to_jsonb(v_submission));
end;
$$;

create or replace function approve_milestone(
  p_milestone_id bigint,
  p_client_wallet text
) returns jsonb
language plpgsql
as $$
declare
  v_milestone milestones;
begin
  select m.* into v_milestone from milestones m where m.milestone_id = p_milestone_id for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if not exists (select 1 from jobs where job_id = v_milestone.job_id and client_wallet = p_client_wallet) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if v_milestone.status = 'approved' then return jsonb_build_object('milestone', to_jsonb(v_milestone)); end if;
  if v_milestone.status <> 'submitted' then return jsonb_build_object('error', 'invalid_status'); end if;
  update milestones set status = 'approved' where milestone_id = p_milestone_id returning * into v_milestone;
  return jsonb_build_object('milestone', to_jsonb(v_milestone));
end;
$$;
