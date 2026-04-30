create table if not exists users (
  wallet_address text primary key,
  role text not null check (role in ('client', 'freelancer', 'both')),
  skills text[] not null default '{}',
  bio text not null default '',
  portfolio text not null default '',
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
