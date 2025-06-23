// app/page.tsx
// Server Component
import HomeView from "./view"; // 导入客户端视图组件

/**
 * 首页页面 (服务器组件)
 * 负责在服务器端获取用户的游戏存档列表。
 * @returns HomeView 组件，并传入获取到的存档数据和用户信息。
 */
export default async function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 font-inter">
      <HomeView />
    </div>
  );
}
