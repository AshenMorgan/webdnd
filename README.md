# D&D AI Dungeon Master

这是一个基于 **Next.js + Supabase + OpenAI** 的 D&D（龙与地下城）AI DM 项目，支持用户创建角色并与 AI 地下城主互动，体验动态的文字冒险。

## 技术栈

- **前端**: Next.js (App Router), TypeScript, Tailwind CSS
- **后端 / 数据库 / 认证**: Supabase（PostgreSQL + Auth）
- **AI 接口**: OpenAI API

## 功能概览

- **场景选择**：从预设的冒险模板中选择
- **角色创建**：分配属性点，选择技能
- **AI DM**：由 GPT 驱动的自然语言叙事与状态更新
- **游戏状态持久化**：角色状态、故事进度实时同步并存储
- **账户系统**：支持注册、登录、登出

## 快速开始

### 克隆项目

```bash
git clone
cd <your-project-folder>
yarn install
# 或者
npm install
```

### 配置环境变量

在项目根目录创建 `.env.local` 文件，写入以下内容：

```env
NEXT_PUBLIC_SUPABASE_URL=https://kxcvemimitzictvkwqbr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Y3ZlbWltaXR6aWN0dmt3cWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzNDYzMjUsImV4cCI6MjA2NTkyMjMyNX0.1f2Xqy1goc2bjv_55OYC9a9B5oD8w8J3pmHqz30u9R0
OPENAI_API_KEY=<你的OpenAI API Key>
```

### 或者使用您自己的 Supabase 数据表

登录 Supabase 控制台，在 SQL Editor 中执行以下语句：

```sql
create table public.games (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  scenario_id text not null,
  state jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  name text null,
  is_active boolean not null default true,
  constraint games_pkey primary key (id),
  constraint games_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_games_updated_at
before update on games
for each row execute procedure update_updated_at_column();

alter table games enable row level security;

create policy "Allow authenticated users to read their own games"
  on games for select to authenticated
  using (auth.uid() = user_id);

create policy "Allow authenticated users to insert games"
  on games for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Allow authenticated users to update their own games"
  on games for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

并在环境变量中写入您自己的NEXT_PUBLIC_SUPABASE_URL和NEXT_PUBLIC_SUPABASE_ANON_KEY

### 启动开发服务器

```bash
yarn dev
# 或者
npm run dev
```

### 注意

> **开发环境中属性点计算可能异常**  
> 由于 React 严格模式会导致组件渲染两次，开发模式下可能会出现属性点错误计算问题。该问题不会影响生产环境（yarn build && yarn start）。

访问 http://localhost:3000

### 构建生产环境

```bash
yarn build && yarn start
# 或者
npm run build && npm start
```
