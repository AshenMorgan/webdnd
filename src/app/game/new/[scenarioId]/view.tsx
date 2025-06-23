// app/game/new/[scenarioId]/view.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";

// 导入 Supabase 浏览器客户端和类型
import { DndScenario, GameState, PlayerSkill } from "@/app/types/types"; // 导入DndScenario和GameState类型, 以及 PlayerSkill
import { supabase } from "@/lib/supabase/client"; // 客户端Supabase
import { calculateFinalAttributes } from "@/lib/utils"; // 从工具函数中导入

// 定义初始属性值和分配点数
const BASE_ATTRIBUTE_VALUE = 5; // 每个属性的初始基础值
const TOTAL_BONUS_POINTS = 10; // 玩家可以分配的总点数
const MAX_STARTING_SKILLS = 2; // 玩家可以选的初始技能数量

/**
 * 游戏初始化视图 (客户端组件)
 * 允许用户选择属性点、自定义选项和初始技能并创建新的游戏记录。
 *
 * @param scenario 完整的 DndScenario 对象，由服务器组件传入
 */
export default function GameInitView({ scenario }: { scenario: DndScenario }) {
  const router = useRouter(); // 获取Next.js路由器实例

  // 状态管理
  const [user, setUser] = useState<User | null>(null); // 当前登录用户
  const [baseAttributeValues, setBaseAttributeValues] = useState<{
    [key: string]: number;
  }>({}); // 玩家分配的属性点
  const [remainingPoints, setRemainingPoints] =
    useState<number>(TOTAL_BONUS_POINTS); // 剩余可分配点数
  const [selectedCustomizations, setSelectedCustomizations] = useState<{
    [key: string]: string;
  }>({}); // 选定的自定义选项
  const [selectedSkills, setSelectedSkills] = useState<PlayerSkill[]>([]); // 玩家选择的初始技能
  const [gameName, setGameName] = useState<string>(""); // 游戏名称
  const [creatingGame, setCreatingGame] = useState<boolean>(false); // 创建游戏加载状态
  const [error, setError] = useState<string | null>(null); // 错误信息
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // 成功信息

  // 监听认证状态变化并获取用户
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        // 如果用户登出，重定向到登录页面
        router.push("/login?redirected_from=/game/new/" + scenario.id);
      }
    });

    // 首次加载时尝试获取用户
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) {
        router.push("/login?redirected_from=/game/new/" + scenario.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, scenario.id]); // 依赖 router 和 scenario.id

  // 初始化属性点和自定义选项
  useEffect(() => {
    const initialAttrs: { [key: string]: number } = {};
    for (const attrName in scenario.attributes) {
      initialAttrs[attrName] = BASE_ATTRIBUTE_VALUE;
    }
    setBaseAttributeValues(initialAttrs);
    setRemainingPoints(TOTAL_BONUS_POINTS);

    // 初始化自定义选项为每个类别的第一个选项
    const initialCustoms: { [key: string]: string } = {};
    for (const categoryKey in scenario.playerCustomizations) {
      const category = scenario.playerCustomizations[categoryKey];
      const firstOptionKey = Object.keys(category.content)[0];
      if (firstOptionKey) {
        initialCustoms[categoryKey] = firstOptionKey;
      }
    }
    setSelectedCustomizations(initialCustoms);
    setSelectedSkills([]); // 确保技能在剧本变化时重置
  }, [scenario]); // 依赖于 scenario 变化时重新初始化

  // 处理属性点分配
  const handleAttributeChange = (attribute: string, change: number) => {
    setBaseAttributeValues((prev) => {
      const currentValue = prev[attribute] || BASE_ATTRIBUTE_VALUE;
      const newValue = currentValue + change;

      if (change > 0 && remainingPoints <= 0) {
        setError("没有剩余点数可分配了！");
        return prev;
      }
      if (change < 0 && newValue < BASE_ATTRIBUTE_VALUE) {
        setError(`属性不能低于基础值 ${BASE_ATTRIBUTE_VALUE}！`);
        return prev;
      }
      setError(null); // 清除错误信息

      setRemainingPoints((prevPoints) => prevPoints - change);
      return { ...prev, [attribute]: newValue };
    });
  };

  // 处理自定义选项选择
  const handleCustomizationChange = (
    categoryKey: string,
    optionKey: string
  ) => {
    setSelectedCustomizations((prev) => ({
      ...prev,
      [categoryKey]: optionKey,
    }));
  };

  // 处理技能选择/取消选择
  const handleSkillToggle = (skillName: string) => {
    setSelectedSkills((prevSkills) => {
      const isSelected = prevSkills.some(
        (skill) => skill.skillName === skillName
      );
      if (isSelected) {
        // 如果已选中，则取消选择
        return prevSkills.filter((skill) => skill.skillName !== skillName);
      } else {
        // 如果未选中且未达到上限，则添加
        if (prevSkills.length < MAX_STARTING_SKILLS) {
          const skillDetails = scenario.baseSkills[skillName];
          if (skillDetails) {
            setError(null); // 清除错误信息
            return [
              ...prevSkills,
              { skillName, description: skillDetails.description, level: 1 },
            ]; // 默认等级1
          }
        } else {
          setError(`最多只能选择 ${MAX_STARTING_SKILLS} 个初始技能！`);
        }
        return prevSkills;
      }
    });
  };

  // 处理游戏创建
  const handleStartGame = async () => {
    if (!user) {
      setError("用户未登录。请刷新页面或尝试重新登录。");
      return;
    }
    if (!gameName.trim()) {
      setError("角色名称不能为空。"); // 将“游戏名称”改为“角色名称”更符合语境
      return;
    }
    if (remainingPoints !== 0) {
      setError(
        `您还有 ${remainingPoints} 点未分配或分配过多。请将所有点数分配完毕。`
      );
      return;
    }
    if (selectedSkills.length === 0) {
      setError("请选择至少一个初始技能。"); // 确保选择技能
      return;
    }

    setCreatingGame(true);
    setError(null);
    setSuccessMessage(null);

    // 构建初始 DM 描述
    let initialDmText = `欢迎来到你的新冒险，${gameName.trim()}！\n\n`;
    initialDmText += `你的故事将从 "${scenario.startingPoint}" 开始。\n\n`;
    initialDmText += `你的角色属性如下：\n`;
    for (const attrName in baseAttributeValues) {
      initialDmText += `- ${attrName}: ${baseAttributeValues[attrName]}\n`;
    }

    initialDmText += `\n你选择的自定义背景和专长：\n`;
    for (const categoryKey in selectedCustomizations) {
      const optionKey = selectedCustomizations[categoryKey];
      const category = scenario.playerCustomizations[categoryKey];
      if (category && category.content[optionKey]) {
        const option = category.content[optionKey];
        initialDmText += `- ${category.description}：${optionKey} - ${option.description}\n`;
        if (Object.keys(option.attributeBonus).length > 0) {
          initialDmText += `  (属性加成：${Object.entries(option.attributeBonus)
            .map(([attr, bonus]) => `${attr} +${bonus}`)
            .join(", ")})\n`;
        }
      }
    }

    if (selectedSkills.length > 0) {
      initialDmText += `\n你掌握的初始技能：\n`;
      selectedSkills.forEach((skill) => {
        const skillDetails = scenario.baseSkills[skill.skillName];
        initialDmText += `- ${skill.skillName}: ${skillDetails?.description || ""} (关联属性: ${skillDetails?.attribute || "未知"})\n`;
      });
    }

    initialDmText += `\n准备好开始你的旅程了吗？`;

    // 构建要保存到 Supabase 的 state 对象
    const gameState: GameState = {
      scenarioId: scenario.id,
      scenarioName: scenario["Dnd-Scenario"],
      baseAttributes: baseAttributeValues, // 使用新的名称 baseAttributeValues
      selectedCustomizations: selectedCustomizations,
      dialogueHistory: [
        {
          role: "dm",
          text: initialDmText, // 使用详细的初始 DM 文本
          timestamp: new Date().toISOString(), // 使用 ISO 字符串格式的时间戳
        },
      ], // 初始化对话历史，包含起始点
      currentLocation: scenario.startingPoint, // 初始位置设置为剧本的起始点
      playerCharacterName: gameName.trim(),
      inventory: [], // 初始化库存为空数组
      playerSkills: selectedSkills, // 将选择的技能保存到游戏状态
      gameProgression: {}, // 初始化游戏进度为空对象
    };

    try {
      const { data, error: dbError } = await supabase
        .from("games")
        .insert([
          {
            user_id: user.id,
            scenario_id: scenario.id,
            name: gameName.trim(), // `games` 表有一个独立的 `name` 字段
            state: gameState, // 将 gameState 作为 jsonb 存储
          },
        ])
        .select(); // 使用 select() 来获取插入的数据，包括生成的ID

      if (dbError) {
        console.error("Error inserting game:", dbError);
        setError(`创建游戏失败: ${dbError.message}`);
      } else {
        setSuccessMessage("游戏创建成功！");
        // 重定向到新的游戏会话页面
        if (data && data.length > 0) {
          router.push(`/game/${data[0].id}`); // 重定向到 /game/[sessionId]
        } else {
          router.push("/dashboard"); // 如果没有返回数据，则重定向到仪表板
        }
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError(`发生意外错误: ${err.message || String(err)}`);
    } finally {
      setCreatingGame(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 font-inter">
      <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        自定义你的新游戏
      </h1>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded-lg mb-4 max-w-lg w-full text-center">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-600 text-white p-3 rounded-lg mb-4 max-w-lg w-full text-center">
          {successMessage}
        </div>
      )}

      {/* 如果用户未加载或未登录，显示加载或提示信息 */}
      {!user && (
        <div className="text-center text-gray-400 text-xl">
          加载用户中... 或您需要登录才能创建游戏。
          <button
            onClick={() => router.push("/login")}
            className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition duration-300"
          >
            前往登录
          </button>
        </div>
      )}

      {user && ( // 只有当用户加载完成后才显示自定义选项
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-700 space-y-8">
          {/* 当前剧本信息 */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-teal-300">
              你正在创建基于 "{scenario["Dnd-Scenario"]}" 的游戏
            </h2>
            <p className="text-gray-400 mt-2">
              起始点: {scenario.startingPoint}
            </p>
          </div>

          {/* 游戏名称 */}
          <div className="mb-6">
            <label
              htmlFor="gameName"
              className="block text-xl font-semibold mb-3 text-gray-300"
            >
              为你的角色命名:
            </label>
            <input
              type="text"
              id="gameName"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 transition"
              placeholder="例如：Joe Biden"
            />
          </div>

          {/* 属性分配 */}
          <div className="mb-8 p-6 bg-gray-700 rounded-lg border border-gray-600">
            <h3 className="text-2xl font-bold mb-4 text-orange-300">
              分配属性点 ({remainingPoints} / {TOTAL_BONUS_POINTS} 点剩余)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(scenario.attributes).map(
                ([attrName, attrDesc]) => (
                  <div
                    key={attrName}
                    className="flex flex-col bg-gray-800 p-4 rounded-lg shadow-inner"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-semibold text-gray-200">
                        {attrName}:
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAttributeChange(attrName, -1)}
                          disabled={
                            baseAttributeValues[attrName] <=
                              BASE_ATTRIBUTE_VALUE || creatingGame
                          }
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-full text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          -
                        </button>
                        <span className="text-2xl font-bold text-teal-400 w-10 text-center">
                          {baseAttributeValues[attrName] ||
                            BASE_ATTRIBUTE_VALUE}{" "}
                        </span>
                        <button
                          onClick={() => handleAttributeChange(attrName, 1)}
                          disabled={remainingPoints <= 0 || creatingGame}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-full text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{attrDesc}</p>
                    {/* 显示包含自定义加成的最终属性值，但仅用于显示，不保存这个计算值 */}
                    <p className="text-sm text-yellow-300 mt-2">
                      当前值:{" "}
                      {calculateFinalAttributes(
                        baseAttributeValues,
                        selectedCustomizations,
                        scenario
                      )[attrName] || BASE_ATTRIBUTE_VALUE}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 玩家自定义选项 */}
          {Object.entries(scenario.playerCustomizations).map(
            ([categoryKey, category]) => (
              <div
                key={categoryKey}
                className="mb-8 p-6 bg-gray-700 rounded-lg border border-gray-600"
              >
                <h3 className="text-2xl font-bold mb-4 text-cyan-300">
                  {category.description}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(category.content).map(
                    ([optionKey, option]) => (
                      <div
                        key={optionKey}
                        onClick={() =>
                          handleCustomizationChange(categoryKey, optionKey)
                        }
                        className={`
                          p-4 rounded-lg shadow-md cursor-pointer transition transform
                          ${
                            selectedCustomizations[categoryKey] === optionKey
                              ? "bg-blue-600 border-blue-400 scale-105 ring-2 ring-blue-300"
                              : "bg-gray-800 border-gray-600 hover:bg-gray-700 hover:scale-105"
                          }
                        `}
                      >
                        <h4 className="text-lg font-semibold text-white mb-2">
                          {optionKey}
                        </h4>
                        <p className="text-sm text-gray-300 mb-2">
                          {option.description}
                        </p>
                        <div className="text-xs text-green-300">
                          {Object.entries(option.attributeBonus).map(
                            ([attr, bonus]) => (
                              <span key={attr} className="mr-2">
                                +{bonus} {attr}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          )}

          {/* 技能选择区域 */}
          <div className="mb-8 p-6 bg-gray-700 rounded-lg border border-gray-600">
            <h3 className="text-2xl font-bold mb-4 text-purple-300">
              选择初始技能 (已选 {selectedSkills.length} / {MAX_STARTING_SKILLS}{" "}
              个)
            </h3>
            <p className="text-gray-400 mb-4 text-sm">
              点击技能进行选择或取消选择。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(scenario.baseSkills).map(
                ([skillName, skillDetails]) => (
                  <div
                    key={skillName}
                    onClick={() => handleSkillToggle(skillName)}
                    className={`
                    p-4 rounded-lg shadow-md cursor-pointer transition transform
                    ${
                      selectedSkills.some((s) => s.skillName === skillName)
                        ? "bg-emerald-600 border-emerald-400 scale-105 ring-2 ring-emerald-300"
                        : "bg-gray-800 border-gray-600 hover:bg-gray-700 hover:scale-105"
                    }
                    ${selectedSkills.length >= MAX_STARTING_SKILLS && !selectedSkills.some((s) => s.skillName === skillName) ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                  >
                    <h4 className="text-lg font-semibold text-white mb-2">
                      {skillName}
                    </h4>
                    <p className="text-sm text-gray-300">
                      {skillDetails.description}
                    </p>
                    <p className="text-xs text-yellow-300 mt-1">
                      关联属性: {skillDetails.attribute}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 开始游戏按钮 */}
          <div className="text-center mt-10">
            <button
              onClick={handleStartGame}
              disabled={
                creatingGame ||
                remainingPoints !== 0 ||
                selectedSkills.length === 0
              }
              className={`
                px-8 py-4 text-xl font-extrabold rounded-full shadow-xl transition transform
                ${
                  creatingGame ||
                  remainingPoints !== 0 ||
                  selectedSkills.length === 0
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 active:scale-95"
                }
                text-white uppercase tracking-wider
              `}
            >
              {creatingGame ? "创建游戏中..." : "开始游戏！"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
