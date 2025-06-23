// app/game/new/[scenarioId]/page.tsx
// Server Component
import { notFound } from "next/navigation";
import GameInitView from "./view";
import { allScenarios } from "@/../data/scenarios";
import { DndScenario } from "@/app/types/types";

/**
 * 新游戏初始化页面 (服务器组件)
 * 负责根据URL参数中的scenarioId获取对应的D&D场景数据，
 * 然后将这些数据传递给客户端视图组件进行渲染。
 * 用户身份验证等逻辑已移至客户端组件。
 *
 * @param params 包含路由参数的对象，此处应为 { scenarioId: string }
 */
export default async function Page({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const scenarioId = (await params).scenarioId;

  // 从 allScenarios 数组中查找与当前 scenarioId 匹配的剧本
  const scenario: DndScenario | undefined = allScenarios.find(
    (s) => s.id === scenarioId
  );

  if (!scenario) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 font-inter">
      <GameInitView scenario={scenario} />
    </div>
  );
}
