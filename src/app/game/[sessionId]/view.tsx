// app/game/[sessionId]/view.tsx
"use client"; // 客户端组件标记

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { allScenarios } from "@/../data/scenarios"; // 修正导入路径
import { calculateFinalAttributes } from "@/lib/utils";
import { GameTableRow, DndScenario, DialogueEntry } from "@/app/types/types";
import TextareaAutosize from "react-textarea-autosize";

/**
 * 游戏会话视图 (客户端组件)
 * 负责渲染游戏界面，包括对话历史、属性、库存、技能显示和用户输入。
 * 初始游戏数据和场景模板的获取以及用户认证将在此组件内部处理。
 *
 * @param sessionId 从路由参数获取的会话ID
 * @param handleUserAction 服务器动作，用于处理用户输入和DM回应
 */
export default function GameSessionView({
  sessionId,
  handleUserAction,
}: {
  sessionId: string;
  handleUserAction: (sessionId: string, userAction: string) => Promise<any>;
}) {
  const router = useRouter();
  const [gameData, setGameData] = useState<GameTableRow | null>(null);
  const [scenarioTemplate, setScenarioTemplate] = useState<DndScenario | null>(
    null
  );
  const [finalAttributes, setFinalAttributes] = useState<{
    [key: string]: number;
  }>({});
  const [userActionInput, setUserActionInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(true); // 初始设置为true表示加载中
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null); // 在客户端获取用户
  const [dmThinking, setDmThinking] = useState<boolean>(false); // DM思考状态
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到最新消息
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // 监听认证状态变化并获取用户
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        // 如果用户登出，重定向到登录页面
        router.push("/login?redirected_from=/game/" + sessionId);
      }
    });

    // 首次加载时尝试获取用户
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) {
        router.push("/login?redirected_from=/game/" + sessionId);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, sessionId]);

  // 获取游戏数据和场景模板
  useEffect(() => {
    const fetchGameAndScenario = async () => {
      if (!sessionId || !user) {
        // 只有sessionId和user都存在才开始加载
        if (user === null) {
          // 如果user明确为null，则已经重定向
          setIsProcessing(false);
        }
        return;
      }

      setIsProcessing(true); // 开始加载时设置处理中
      setError(null);

      try {
        // 1. 获取游戏记录
        const { data: game, error: gameError } = await supabase
          .from("games")
          .select(
            "id, user_id, scenario_id, name, state, created_at, updated_at, is_active"
          )
          .eq("id", sessionId)
          .single();

        if (gameError || !game) {
          console.error(
            "Error fetching game session:",
            gameError?.message || "Game session not found."
          );
          setError(
            "无法加载游戏会话。请检查会话ID是否正确或您是否有权限访问。"
          );
          setIsProcessing(false);
          // 如果游戏不存在或无权访问，重定向到主页或仪表板
          router.push("/dashboard?error=game_not_found_or_unauthorized");
          return;
        }

        // 验证用户权限 (客户端再次验证，以防万一)
        if (game.user_id !== user.id) {
          setError("Unauthorized: 您无权访问此游戏会话。");
          setIsProcessing(false);
          router.push("/dashboard?error=unauthorized_game_access");
          return;
        }

        setGameData(game);

        // 2. 获取对应的场景模板数据
        const scenario: DndScenario | undefined = allScenarios.find(
          (s) => s.id === game.scenario_id
        );

        if (!scenario) {
          console.error(
            "Scenario template not found for game:",
            game.scenario_id
          );
          setError("无法找到对应的场景模板。");
          setIsProcessing(false);
          return;
        }

        setScenarioTemplate(scenario);

        // 3. 计算最终属性值（用于显示）
        const calculatedFinalAttributes = calculateFinalAttributes(
          game.state.baseAttributes,
          game.state.selectedCustomizations,
          scenario
        );
        setFinalAttributes(calculatedFinalAttributes);
      } catch (err: any) {
        console.error("Error in fetchGameAndScenario:", err);
        setError(`加载游戏数据失败: ${err.message || "未知错误"}`);
      } finally {
        setIsProcessing(false); // 结束加载
      }
    };

    fetchGameAndScenario();
  }, [sessionId, user, router]); // 依赖 sessionId 和 user

  // 在对话历史更新后滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [gameData?.state.dialogueHistory, dmThinking, scrollToBottom]); // 依赖 gameData, dmThinking 和 scrollToBottom

  // 处理用户提交行动
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userActionInput.trim() || isProcessing || dmThinking) return;

    // 1. 立即显示用户消息并清空输入框
    const currentUserMessage: DialogueEntry = {
      role: "user",
      text: userActionInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setGameData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        state: {
          ...prev.state,
          dialogueHistory: [...prev.state.dialogueHistory, currentUserMessage],
        },
      };
    });
    setUserActionInput(""); // 清空输入框

    setIsProcessing(true); // 开始处理
    setDmThinking(true); // DM开始思考
    setError(null);

    try {
      if (!gameData || !scenarioTemplate) {
        setError("游戏数据或场景模板未加载，请稍后再试。");
        setIsProcessing(false);
        setDmThinking(false);
        return;
      }

      // 调用服务器动作来处理用户行动和DM回应
      // 服务器动作会返回包含DM回应在内的最新游戏状态
      const updatedGameState = await handleUserAction(
        gameData.id,
        currentUserMessage.text // 传递用户实际输入的消息
      );

      // 2. 更新客户端的游戏状态（此时DM回应已包含在内）
      setGameData((prev) => {
        if (!prev) return null; // Should not happen if gameData is valid above
        return {
          ...prev,
          state: updatedGameState,
          updated_at: new Date().toISOString(),
        };
      });

      // 3. 重新计算最终属性以更新显示
      const calculatedFinalAttributes = calculateFinalAttributes(
        updatedGameState.baseAttributes,
        updatedGameState.selectedCustomizations,
        scenarioTemplate
      );
      setFinalAttributes(calculatedFinalAttributes);
    } catch (err: any) {
      console.error("Failed to process user action:", err);
      setError(`处理行动失败: ${err.message || "未知错误"}`);
      // 如果出现错误，将DM的思考状态也清除
      setGameData((prev) => {
        // 错误时也把用户消息加进去，但DM思考可能就没有了
        if (!prev) return null;
        // 确保即使出错，用户消息也留在历史中
        const lastEntry =
          prev.state.dialogueHistory[prev.state.dialogueHistory.length - 1];
        if (
          lastEntry &&
          lastEntry.role === "user" &&
          lastEntry.text === currentUserMessage.text
        ) {
          // 如果用户消息已经在最后了，不再重复添加
          return prev;
        }
        return {
          ...prev,
          state: {
            ...prev.state,
            dialogueHistory: [
              ...prev.state.dialogueHistory,
              currentUserMessage,
            ],
          },
        };
      });
    } finally {
      setIsProcessing(false); // 结束处理
      setDmThinking(false); // DM停止思考
    }
  };

  // 处理键盘事件，实现Ctrl+Enter提交
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault(); // 阻止默认的换行行为
      handleSubmitAction(e as any); // 触发提交
    }
  };

  // 格式化日期显示
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  if (isProcessing && !gameData) {
    // 初始加载状态
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        加载游戏数据中...
      </div>
    );
  }

  if (error && !gameData) {
    // 如果有错误且游戏数据未加载成功
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="bg-red-600 text-white p-4 rounded-lg text-center text-xl">
          {error}
        </div>
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition duration-300"
        >
          返回主页
        </button>
      </div>
    );
  }

  // 确保 gameData 和 scenarioTemplate 存在后才渲染主内容
  if (!gameData || !scenarioTemplate) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        发生未知错误或数据加载不完整。
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-gray-900 text-white font-inter">
      {/* Header (可以考虑将其移到全局 layout.tsx 中) */}
      <header className="flex-shrink-0 bg-gray-800 p-4 shadow-lg border-b border-gray-700">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            {gameData.name || "我的冒险"}
          </h1>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition"
          >
            返回主页
          </button>
        </div>
      </header>

      <div className="flex flex-grow max-w-4xl mx-auto w-full p-4 space-x-4 overflow-hidden">
        {/* 左侧：对话历史 */}
        <div className="flex-grow bg-gray-800 rounded-xl shadow-inner p-4 flex flex-col border border-gray-700">
          <h2 className="text-xl font-semibold mb-3 text-teal-300">游戏日志</h2>
          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar-thin">
            <style jsx>{`
              .custom-scrollbar-thin::-webkit-scrollbar {
                width: 6px;
              }
              .custom-scrollbar-thin::-webkit-scrollbar-track {
                background: #4a5568; /* Tailwind gray-700 */
                border-radius: 10px;
              }
              .custom-scrollbar-thin::-webkit-scrollbar-thumb {
                background: #6b46c1; /* Tailwind purple-700 */
                border-radius: 10px;
              }
              .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
                background: #805ad5; /* Tailwind purple-600 */
              }
              .dm-message-text {
                white-space: pre-wrap; /* 保留空白和换行符 */
              }
            `}</style>
            <div className="space-y-4">
              {gameData.state.dialogueHistory.map((entry, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg shadow-sm ${
                    entry.role === "user"
                      ? "bg-blue-900/30 text-blue-200 self-end text-right"
                      : "bg-gray-700 text-gray-300 self-start text-left"
                  }`}
                >
                  <span className="font-bold text-sm">
                    [{entry.role === "user" ? "玩家行动" : "DM "} -{" "}
                    {formatDate(entry.timestamp)}]:
                  </span>
                  {/* 使用 dm-message-text 类来应用 white-space: pre-wrap */}
                  <p className="mt-1 dm-message-text">{entry.text}</p>
                </div>
              ))}
              {dmThinking && ( // DM 思考时的占位符消息
                <div className="p-3 rounded-lg shadow-sm bg-gray-700 text-gray-300 self-start text-left animate-pulse">
                  <span className="font-bold text-sm">[DM 正在思考...]</span>
                  <p className="mt-1">...</p>
                </div>
              )}
              <div ref={messagesEndRef} /> {/* 滚动目标 */}
            </div>
          </div>

          {/* 错误显示 (针对用户行动处理时的错误) */}
          {error &&
            gameData && ( // 只有在游戏数据已加载后，才显示此处的错误，避免与初始加载错误混淆
              <div className="bg-red-600 text-white p-3 rounded-lg text-center mt-4">
                {error}
              </div>
            )}

          {/* 用户输入区 */}
          <form
            onSubmit={handleSubmitAction}
            className="flex-shrink-0 flex flex-col mt-4 space-y-2" // Changed to flex-col and space-y-2 for better layout with hint
          >
            <TextareaAutosize
              value={userActionInput}
              onChange={(e) => setUserActionInput(e.target.value)}
              onKeyDown={handleKeyDown} // Add onKeyDown handler
              placeholder="你的行动..."
              className="flex-grow p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 transition"
              disabled={isProcessing || dmThinking}
              minRows={1}
              maxRows={5}
            />
            {/* Hint for Ctrl+Enter submission */}
            <p className="text-right text-gray-500 text-xs mr-2">
              按下 `Ctrl + Enter` (或 `Cmd + Enter`) 提交
            </p>
            <button
              type="submit"
              disabled={isProcessing || dmThinking || !userActionInput.trim()}
              className={`
                px-6 py-3 rounded-lg shadow-md transition transform
                ${
                  isProcessing || dmThinking || !userActionInput.trim()
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 active:scale-95"
                }
                text-white font-bold
              `}
            >
              {dmThinking ? "思考中..." : "发送"}
            </button>
          </form>
        </div>

        {/* 右侧：属性和信息面板 */}
        <div className="flex-shrink-0 w-80 bg-gray-800 rounded-xl shadow-inner p-4 border border-gray-700 flex flex-col space-y-6 overflow-y-auto custom-scrollbar-thin">
          <h2 className="text-xl font-semibold mb-3 text-pink-300">角色面板</h2>

          {/* 当前状态 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-orange-300">
              当前状态
            </h3>
            <p className="text-gray-300 text-md">
              <span className="font-medium">场景:</span>{" "}
              {scenarioTemplate["Dnd-Scenario"]}
            </p>
            <p className="text-gray-300 text-md">
              <span className="font-medium">地点:</span>{" "}
              {gameData.state.currentLocation}
            </p>
            <p className="text-gray-300 text-md">
              <span className="font-medium">角色名称:</span>{" "}
              {gameData.state.playerCharacterName || "未命名"}
            </p>
            <p className="text-gray-300 text-md">
              <span className="font-medium">游戏ID:</span> {gameData.id}
            </p>
          </div>

          {/* 属性列表 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-cyan-300">属性</h3>
            <ul className="space-y-1">
              {Object.entries(finalAttributes).map(([attrName, attrValue]) => (
                <li
                  key={attrName}
                  className="flex justify-between items-center text-gray-300"
                >
                  <span className="font-medium">{attrName}:</span>
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-blue-300 font-bold">
                    {attrValue}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 库存列表 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-lime-300">
              物品清单
            </h3>
            {gameData.state.inventory && gameData.state.inventory.length > 0 ? (
              <ul className="space-y-1">
                {gameData.state.inventory.map((item, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center text-gray-300"
                  >
                    <span>{item.item}</span>
                    <span className="px-2 py-0.5 bg-gray-700 rounded-full text-yellow-300 text-sm">
                      x{item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">背包空空如也。</p>
            )}
          </div>

          {/* 技能列表 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-indigo-300">技能</h3>
            {gameData.state.playerSkills &&
            gameData.state.playerSkills.length > 0 ? (
              <ul className="space-y-1">
                {gameData.state.playerSkills.map((skill, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center text-gray-300"
                  >
                    <span>{skill.skillName}</span>
                    {skill.level !== undefined && (
                      <span className="px-2 py-0.5 bg-gray-700 rounded-full text-green-300 text-sm">
                        Lv.{skill.level}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">
                你似乎还没有掌握任何特殊技能。
              </p>
            )}
          </div>

          {/* 故事进度/标志 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-red-300">
              故事进度
            </h3>
            {gameData.state.gameProgression &&
            Object.keys(gameData.state.gameProgression).length > 0 ? (
              <ul className="space-y-1">
                {Object.entries(gameData.state.gameProgression).map(
                  ([flag, value]) => (
                    <li
                      key={flag}
                      className="flex justify-between items-center text-gray-300"
                    >
                      <span>{flag}:</span>
                      <span className="px-2 py-0.5 bg-gray-700 rounded-full text-purple-300 text-sm">
                        {String(value)}
                      </span>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">目前没有特殊的故事标志。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
