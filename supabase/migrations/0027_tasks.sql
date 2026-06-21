create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in ('bot','landing','ig','contenido','ads','kalyo','manual')),
  status text not null default 'todo' check (status in ('todo','in_progress','done','blocked')),
  priority int not null default 3 check (priority between 1 and 4),
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index tasks_status_idx on tasks(status);
create index tasks_due_date_idx on tasks(due_date);

create or replace function tasks_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function tasks_set_updated_at();
