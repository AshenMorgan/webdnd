module.exports = {
  // 指定运行环境，这里包含了浏览器、Node.js，并支持 ES2021 特性
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  // 扩展配置：
  // 1. 'eslint:recommended': ESLint 推荐的基础规则集
  // 2. 'plugin:@typescript-eslint/recommended': TypeScript 推荐规则
  // 3. 'next/core-web-vitals': Next.js 推荐的核心规则
  // 4. 'prettier': 禁用所有与 Prettier 冲突的 ESLint 规则，确保不冲突！
  //    注意：'prettier' 必须是 extends 数组中的最后一个，以确保它能覆盖所有其他规则。
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "next/core-web-vitals",
    "prettier", // 必须是最后一个
  ],
  // 指定解析器：使用 TypeScript 解析器来处理 TS/TSX 文件
  parser: "@typescript-eslint/parser",
  // 解析器选项：
  // 'ecmaVersion': 语言版本，这里是最新版
  // 'sourceType': 模块类型，'module' 用于 ES 模块
  // 'ecmaFeatures': 启用 JSX 特性
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  // 插件：
  // '@typescript-eslint': TypeScript 相关的规则
  // 'prettier': 将 Prettier 格式化问题作为 ESLint 错误报告
  plugins: ["@typescript-eslint", "prettier"],
  // 自定义规则：
  // 可以根据需要添加或覆盖规则
  rules: {
    // 强制 'prettier/prettier' 规则，将 Prettier 格式化不一致视为错误
    "prettier/prettier": "error",
    // 允许在开发环境中打印 console.log
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    // 允许未使用的变量 (特别是在 Next.js 中，函数组件通常不直接使用所有 props)
    // 生产环境为 error，开发环境为 warn
    "@typescript-eslint/no-unused-vars":
      process.env.NODE_ENV === "production" ? "error" : "warn",
  },
  // 忽略特定文件或目录的 linting
  ignorePatterns: ["node_modules/", ".next/", "build/", "dist/"],
};
