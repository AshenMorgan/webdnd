// components/AuthHeader.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * 认证状态头部组件
 * 在页面顶部显示用户的登录状态，并提供登录/登出按钮。
 * 当用户登录时，显示其邮箱和登出按钮；未登录时，显示登录按钮。
 */
export default function AuthHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    // 异步获取当前用户会话
    const fetchUser = async () => {
      setLoading(true);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error.message);
      }
      setUser(user);
      setLoading(false);
    };

    fetchUser();

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe(); // 清理订阅
  }, []); // 仅在组件挂载时运行一次

  // 处理登出逻辑
  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
      alert("登出失败：" + error.message); // 使用 alert 模拟消息框，因为这里没有完整的消息框组件
    } else {
      setUser(null);
      router.push("/login"); // 登出后重定向到登录页
    }
    setLoading(false);
  };

  return (
    <header className="bg-gray-800 p-4 shadow-lg border-b border-gray-700">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* 网站标题/Logo */}
        <h1
          className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 cursor-pointer"
          onClick={() => router.push("/")} // 点击标题返回首页
        >
          D&D AI DM
        </h1>

        {/* 用户信息或登录/登出按钮 */}
        <div className="flex items-center space-x-4">
          {loading ? (
            <span className="text-gray-400">加载中...</span>
          ) : user ? (
            <>
              <span className="text-gray-300 text-sm md:text-base">
                你好,{" "}
                <span className="font-semibold text-purple-300">
                  {user.email || "用户"}
                </span>
                !
              </span>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                登出
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              登录
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
