import ScenarioListView from "./view";
import { allScenarios } from "@/../data/scenarios";

export default function Page() {
  // 从 allScenarios 数组中提取每个场景的 ID 和 Dnd-Scenario 名称
  // Dnd-Scenario 名称将作为 'title' 传递给视图组件
  const scenariosForList = allScenarios.map((s) => ({
    id: s.id,
    title: s["Dnd-Scenario"],
  }));

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 font-inter">
      <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-600">
        选择一个场景！
      </h1>
      <ScenarioListView scenarios={scenariosForList} />
    </div>
  );
}
