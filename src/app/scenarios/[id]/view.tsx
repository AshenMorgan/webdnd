// app/scenarios/[scenarioId]/view.tsx
"use client"; // 客户端组件标记

import { useRouter } from "next/navigation";
import React from "react"; // 确保导入 React
import { DndScenario } from "@/app/types/types"; // 导入DndScenario类型

/**
 * 场景详情视图 (客户端组件)
 * 接收一个D&D场景对象，显示其名称和起始点，
 * 并提供一个按钮以导航到新游戏自定义页面。
 *
 * @param scenario 完整的 DndScenario 对象
 */
export default function ScenarioDetailView({
  scenario,
}: {
  scenario: DndScenario;
}) {
  const router = useRouter(); // 获取Next.js路由器实例

  /**
   * 处理“开始游戏”按钮点击事件。
   * 它将用户导航到新游戏自定义页面，而不是直接开始游戏会话。
   */
  async function handleStartCustomization() {
    // 导航到新游戏自定义页面
    router.push(`/game/new/${scenario.id}`);
  }

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 space-y-6 text-center">
      <h1 className="text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        {scenario["Dnd-Scenario"]}
      </h1>

      <div className="text-left bg-gray-700 p-6 rounded-lg border border-gray-600">
        <h2 className="text-2xl font-bold mb-3 text-teal-300">起始点</h2>
        <p className="text-gray-300 leading-relaxed text-lg">
          {scenario.startingPoint}
        </p>
      </div>

      <div className="text-left bg-gray-700 p-6 rounded-lg border border-gray-600">
        <h2 className="text-2xl font-bold mb-3 text-cyan-300">属性</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-1">
          {Object.entries(scenario.attributes).map(([attrName, attrDesc]) => (
            <li key={attrName}>
              <span className="font-semibold text-gray-200">{attrName}:</span>{" "}
              {attrDesc}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-left bg-gray-700 p-6 rounded-lg border border-gray-600">
        <h2 className="text-2xl font-bold mb-3 text-orange-300">核心技能</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-1">
          {Object.entries(scenario.baseSkills).map(([skillName, skillData]) => (
            <li key={skillName}>
              <span className="font-semibold text-gray-200">{skillName}:</span>{" "}
              {skillData.description} (检定属性: {skillData.attribute})
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center mt-8">
        <button
          onClick={handleStartCustomization}
          className="px-8 py-4 text-xl font-extrabold rounded-full shadow-xl transition transform
            bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 active:scale-95
            text-white uppercase tracking-wider"
        >
          开始自定义角色
        </button>
      </div>
    </div>
  );
}
