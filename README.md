D&D AI DM
项目简介
这是一个基于 Next.js、Supabase 和 OpenAI API 构建的沉浸式 D&D（龙与地下城）AI 地下城主（DM）应用。它允许用户创建自定义角色，并与一个由 AI 驱动的 DM 进行互动，体验一个动态且充满故事性的冒险。游戏会话状态（包括角色属性、物品、技能和故事进度）会实时更新并持久化。

主要功能
场景选择: 从预定义的 D&D 场景中选择你的冒险背景。

角色自定义:

为你的角色命名。

分配属性点（力量、敏捷等），并查看它们如何受角色自定义选择的影响。

选择初始技能，为你的冒险做好准备。

AI 地下城主:

与智能 DM 进行自然语言互动。

DM 根据你的行动、角色状态和游戏规则生成动态叙述。

DM 的叙述可以自动触发游戏状态更新（物品获取、属性变化、地点改变等）。

实时状态管理: 你的角色属性、物品清单、技能和故事进度会随着游戏进行实时更新。

用户认证: 基于 Supabase 的电子邮件/密码登录系统，提供安全的会话管理和登出功能。

响应式 UI: 界面适配不同设备，提供良好的用户体验。

技术栈
前端: Next.js (React), TypeScript, Tailwind CSS

后端 / 数据库 / 认证: Supabase (PostgreSQL, Auth)

AI 接口: OpenAI API (GPT-4o-mini 或其他兼容模型)

环境搭建
克隆仓库:

git clone <你的仓库URL>
cd <你的项目目录>

安装依赖:

yarn install

# 或者 npm install

Supabase 配置:

前往 Supabase 创建一个新项目。

在项目设置中找到 Project URL 和 anon public 的 Service Role Key。

数据库设置:

在 Supabase 控制台的 SQL Editor 中运行以下 SQL 脚本来创建 games 表（如果尚未创建）：

-- 创建 games 表
CREATE TABLE games (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES auth.users(id) NOT NULL,
scenario_id TEXT NOT NULL,
name TEXT NOT NULL,
state JSONB NOT NULL DEFAULT '{}'::jsonb, -- 存储游戏状态的JSONB字段
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
is_active BOOLEAN DEFAULT TRUE -- 用于标记当前活跃游戏
);

-- 为 updated_at 字段添加触发器，确保每次更新行时自动更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;

$$
language 'plpgsql';

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 启用行级安全（Row Level Security - RLS）
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- 为 users 和 authenticated 角色定义 RLS 策略
-- 允许认证用户读取自己的游戏记录
CREATE POLICY "Allow authenticated users to read their own games" ON games
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 允许认证用户插入游戏记录
CREATE POLICY "Allow authenticated users to insert games" ON games
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 允许认证用户更新自己的游戏记录
CREATE POLICY "Allow authenticated users to update their own games" ON games
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 如果需要删除功能，添加删除策略 (可选)
-- CREATE POLICY "Allow authenticated users to delete their own games" ON games
-- FOR DELETE TO authenticated
-- USING (auth.uid() = user_id);

环境变量: 在项目根目录创建 .env.local 文件，并添加以下内容：

NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名公共键
OPENAI_API_KEY=你的OpenAI API Key

运行项目
启动开发服务器:

yarn dev
# 或者 npm run dev

项目将在 http://localhost:3000 运行。

构建和启动生产环境:

yarn build
yarn start
# 或者 npm run build
# npm start

已知问题
开发模式下属性点计算异常: 在 yarn dev 开发模式下，由于 React 的严格模式 (Strict Mode) 会导致组件渲染和某些副作用逻辑运行两次，你可能会观察到在创建新游戏时，属性点的增减操作会消耗或返还两倍的剩余点数。这仅是开发环境下的表现，在生产构建 (yarn build 后运行) 中不会出现此问题。
$$
