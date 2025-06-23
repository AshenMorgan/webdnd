// app/login/view.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import type { Session } from "@supabase/supabase-js";

/**
 * 登录/账户管理视图 (客户端组件)
 * 处理用户的登录、登出以及会话状态。
 * 当用户登录时，显示账户信息和登出选项。
 * 当用户未登录时，显示 Supabase Auth UI 进行登录。
 */
export default function LoginView() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // 添加加载状态
  const router = useRouter();

  useEffect(() => {
    // 异步获取当前会话
    const fetchSession = async () => {
      setLoading(true);
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        console.error("Error fetching session:", error.message);
      }
      setSession(session);
      setLoading(false);
    };

    fetchSession();

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false); // 状态变化后，无论如何都结束加载
    });

    return () => subscription.unsubscribe(); // 清理订阅
  }, []); // 仅在组件挂载时运行一次

  // 处理登出
  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
    } else {
      // 登出成功，清空会话并重定向到登录页
      setSession(null);
      router.push("/login");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-lg">加载中...</p>
      </div>
    );
  }

  // 用户未登录时，显示 Supabase Auth UI
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 p-10 bg-gray-800 rounded-xl shadow-lg z-10 border border-gray-700">
          <h2 className="text-3xl font-extrabold text-center text-white mb-6">
            登录 / 注册
          </h2>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "rgb(79 70 229)", // indigo-600
                    brandAccent: "rgb(99 102 241)", // indigo-500
                    inputBackground: "rgb(55 65 81)", // gray-700
                    inputBorder: "rgb(75 85 99)", // gray-600
                    inputPlaceholder: "rgb(156 163 175)", // gray-400
                    inputText: "rgb(249 250 251)", // gray-50
                    messageText: "rgb(254 243 199)", // yellow-100
                    messageBackground: "rgb(75 85 99)", // gray-600
                    // 可以根据需要添加更多颜色，以完全匹配你的深色主题
                  },
                },
              },
            }}
            providers={[]} // 保持空，如果你不使用第三方提供商
            magicLink={true} // 启用 Magic Link 登录
            socialLayout="horizontal" // 社交登录按钮布局
            // theme="dark" // 主题可以设为 dark
          />
        </div>
      </div>
    );
  }

  // 用户已登录时，显示账户信息和登出按钮
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-inter">
      <div className="max-w-md w-full space-y-6 p-10 bg-gray-800 rounded-xl shadow-lg z-10 border border-gray-700 text-center">
        <h2 className="text-3xl font-extrabold text-white mb-4">欢迎回来！</h2>
        {session.user?.email && (
          <p className="text-lg text-gray-300">
            你已登录为:{" "}
            <span className="font-semibold text-purple-300">
              {session.user.email}
            </span>
          </p>
        )}
        {/* 如果有其他用户数据，可以显示在这里，例如用户名或ID */}
        {session.user?.id && (
          <p className="text-sm text-gray-400 break-words">
            用户ID:{" "}
            <span className="font-mono text-gray-500">{session.user.id}</span>
          </p>
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-300"
            disabled={loading}
          >
            前往游戏主页
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-300"
            disabled={loading}
          >
            {loading ? "登出中..." : "登出"}
          </button>
        </div>
      </div>
    </div>
  );
}
