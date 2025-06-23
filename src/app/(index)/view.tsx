// app/view.tsx
"use client"; // 客户端组件标记

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { GameTableRow } from "../types/types";

/**
 * HomeView 组件 (客户端组件)
 * 负责渲染主页界面，包括继续游戏、存档列表和开始新游戏的选项。
 * 现在负责在客户端获取用户会话和存档。
 */
export default function HomeView() {
  const [saves, setSaves] = useState<Partial<GameTableRow>[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // 初始设置为 true，因为会立即开始加载
  const [error, setError] = useState<string | null>(null); // 错误状态
  const router = useRouter();

  // 加载用户会话和存档的函数
  const loadUserAndSaves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. 获取用户会话
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError) {
        throw new Error(authError.message);
      }

      const currentUser = session?.user || null;
      setUser(currentUser);

      // 如果用户未登录，重定向到登录页面
      if (!currentUser) {
        router.push("/login");
        return; // 提前返回，不进行后续的存档加载
      }

      // 2. 如果用户已登录，则获取其所有游戏存档
      const { data, error: dbError } = await supabase
        .from("games")
        .select("id, user_id, scenario_id, name, is_active, updated_at")
        .eq("user_id", currentUser.id) // 确保只获取当前用户的存档
        .order("updated_at", { ascending: false }); // 按更新时间降序排列

      if (dbError) {
        throw new Error(dbError.message);
      }
      setSaves(data || []);
      if (data?.length === 0) {
        setError("您还没有任何游戏存档。");
      }
    } catch (err: any) {
      console.error("Error loading user session or saves:", err.message);
      setError(`加载数据失败: ${err.message}`);
      setSaves([]); // 清空存档
    } finally {
      setLoading(false);
    }
  }, [router]); // 依赖 router

  // 组件挂载时或认证状态变化时加载数据
  useEffect(() => {
    loadUserAndSaves();

    // 监听认证状态变化
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // 当认证状态变化时，重新加载用户和存档数据
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          loadUserAndSaves();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadUserAndSaves]); // 依赖 loadUserAndSaves

  // continue the latest active save or the first one
  function continueLatest() {
    if (!user) {
      setError("请登录后才能继续游戏。");
      return;
    }
    if (saves.length === 0) {
      setError("没有可继续的存档。请创建新游戏。");
      return;
    }
    setLoading(true);
    const activeSave = saves.find((s) => s.is_active) || saves[0];
    if (activeSave) {
      loadSave(activeSave.id!); // 使用 loadSave 函数来确保 active 状态设置
    } else {
      setError("没有找到任何存档可继续。");
      setLoading(false);
    }
  }

  // load a specific save by ID
  async function loadSave(id: string) {
    setLoading(true);
    setError(null);
    try {
      if (!user) {
        setError("请登录后才能加载存档。");
        return;
      }
      // set all is_active to false for the current user
      const { error: resetError } = await supabase
        .from("games")
        .update({ is_active: false })
        .eq("user_id", user.id); // 只更新当前用户的存档

      if (resetError) {
        throw new Error(resetError.message);
      }

      // set specific game to active
      const { error: updateError } = await supabase
        .from("games")
        .update({ is_active: true })
        .eq("id", id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // 重新获取存档列表以反映 active 状态变化
      await loadUserAndSaves(); // 调用总的加载函数来刷新数据

      router.push(`/game/${id}`);
    } catch (err: any) {
      console.error("Error loading save:", err.message);
      setError(`加载存档失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // 删除存档
  const deleteSave = async (id: string) => {
    if (!user) {
      setError("请登录后才能删除存档。");
      return;
    }
    if (!confirm("你确定要删除这个存档吗？此操作不可撤销。")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("games")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id); // 确保只删除当前用户的存档

      if (deleteError) {
        throw new Error(deleteError.message);
      }
      setSaves((prevSaves) => prevSaves.filter((s) => s.id !== id)); // 从状态中移除
      setError("存档已删除。"); // 简单的提示
    } catch (err: any) {
      console.error("Error deleting save:", err.message);
      setError(`删除存档失败: ${err.message}`);
    } finally {
      setLoading(false);
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
      hour12: false,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-inter">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 space-y-6">
        <h1 className="text-4xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          欢迎回来！
        </h1>

        {loading && <div className="text-center text-blue-400">加载中...</div>}
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-lg text-center mb-4">
            {error}
          </div>
        )}

        {/* 继续游戏按钮 */}
        <button
          onClick={continueLatest}
          disabled={loading || saves.length === 0 || !user}
          className={`
            w-full py-4 text-xl font-extrabold rounded-lg shadow-lg transition transform
            ${
              loading || saves.length === 0 || !user
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 active:scale-95"
            }
            text-white uppercase tracking-wider
          `}
        >
          {loading ? "加载中..." : "继续上次游戏"}
        </button>

        {/* 存档列表 */}
        <h2 className="text-2xl font-bold text-center mt-8 mb-4 text-teal-300">
          我的游戏存档
        </h2>
        {user ? (
          saves.length > 0 ? (
            <div className="max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {" "}
              {/* 滚动条和内边距 */}
              <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: #4a5568; /* Tailwind gray-700 */
                  border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #6b46c1; /* Tailwind purple-700 */
                  border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #805ad5; /* Tailwind purple-600 */
                }
              `}</style>
              <div className="space-y-4">
                {saves.map((s) => (
                  <div
                    key={s.id}
                    className={`
                      flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border
                      ${
                        s.is_active
                          ? "border-blue-400 bg-blue-900/30"
                          : "border-gray-600 bg-gray-700"
                      }
                      shadow-md transition duration-200
                    `}
                  >
                    <div className="flex-grow mb-2 sm:mb-0">
                      <span className="block text-lg font-semibold text-white">
                        {s.name || "无标题游戏"}
                        {s.is_active && (
                          <span className="ml-2 px-2 py-1 text-xs font-bold bg-blue-500 rounded-full">
                            活跃
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-gray-400 mt-1">
                        上次游戏: {formatDate(s.updated_at!)}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadSave(s.id!)}
                        disabled={loading}
                        className={`
                          px-4 py-2 text-sm rounded-lg transition transform
                          ${
                            loading
                              ? "bg-gray-600 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700 active:scale-95"
                          }
                          text-white font-semibold
                        `}
                      >
                        加载
                      </button>
                      <button
                        onClick={() => deleteSave(s.id!)}
                        disabled={loading}
                        className={`
                          px-4 py-2 text-sm rounded-lg transition transform
                          ${
                            loading
                              ? "bg-gray-600 cursor-not-allowed"
                              : "bg-red-600 hover:bg-red-700 active:scale-95"
                          }
                          text-white font-semibold
                        `}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !loading && (
              <p className="text-center text-gray-400">
                暂无存档。开始一个新游戏吧！
              </p>
            )
          )
        ) : (
          <p className="text-center text-gray-400">
            请登录以查看您的游戏存档。
          </p>
        )}

        {/* 开始新游戏按钮 */}
        <button
          onClick={() => router.push("/scenarios")}
          disabled={loading}
          className={`
            w-full py-4 text-xl font-extrabold rounded-lg shadow-lg mt-6 transition transform
            ${
              loading
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 active:scale-95"
            }
            text-white uppercase tracking-wider
          `}
        >
          开始新游戏
        </button>
      </div>
    </div>
  );
}
