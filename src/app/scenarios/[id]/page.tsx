// app/scenarios/[scenarioId]/page.tsx
// Server Component

import { notFound } from "next/navigation"; // 用于处理未找到场景的情况
import ScenarioDetailView from "./view"; // 导入客户端视图组件
import { allScenarios } from "@/../data/scenarios"; // 从集中管理的数据中导入所有场景
import { DndScenario } from "@/app/types/types"; // 导入DndScenario类型

/**
 * 场景详情页面 (服务器组件)
 * 负责根据URL参数中的scenarioId获取对应的D&D场景数据，
 * 并将该数据传递给客户端视图组件进行渲染。
 *
 * @param params 包含路由参数的对象，此处应为 { id: string }
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>; // Next.js App Router 会直接提供解构后的参数
}) {
  const scenarioId = (await params).id;

  // 从 allScenarios 数组中查找与当前 scenarioId 匹配的剧本
  const scenario: DndScenario | undefined = allScenarios.find(
    (s) => s.id === scenarioId
  );

  // 如果未找到剧本，则返回404页面
  if (!scenario) {
    notFound();
  }

  // 渲染客户端视图组件，并传入完整的剧本数据
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 font-inter">
      <ScenarioDetailView scenario={scenario} />
    </div>
  );
}
