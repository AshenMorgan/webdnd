// app/game/[sessionId]/page.tsx
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import GameSessionView from "./view";
import { allScenarios } from "@/../data/scenarios";
import {
  DndScenario,
  GameState,
  DialogueEntry,
  ParsedUserAction,
  DMResponseContent,
} from "@/app/types/types";
import { supabaseServer } from "@/lib/supabase/server";
import { calculateFinalAttributes } from "@/lib/utils";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 掷一个 d20 骰子。
 * @returns 1 到 20 之间的随机整数。
 */
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * 封装游戏状态更新逻辑，避免重复代码。
 */
function applyGameStateChanges(
  gameState: GameState,
  changes: Partial<ParsedUserAction | DMResponseContent>, // 可以是用户解析结果或DM回应
  finalAttributes: { [key: string]: number } // 需要最新属性来处理掷骰上下文
) {
  let narrativeContextPart = ""; // 用于DM提示的上下文总结

  // 道具更新
  if (changes.itemChanges && changes.itemChanges.length > 0) {
    for (const change of changes.itemChanges) {
      const existingItemIndex = gameState.inventory.findIndex(
        (item) => item.item === change.item
      );
      if (existingItemIndex !== -1) {
        gameState.inventory[existingItemIndex].quantity +=
          change.quantityChange;
        if (gameState.inventory[existingItemIndex].quantity <= 0) {
          gameState.inventory.splice(existingItemIndex, 1);
        }
      } else if (change.quantityChange > 0) {
        gameState.inventory.push({
          item: change.item,
          quantity: change.quantityChange,
        });
      }
    }
    narrativeContextPart += `\n物品变动：${JSON.stringify(changes.itemChanges)}。`;
  }

  // 属性更新 (直接修改 baseAttributes)
  if (changes.attributeChanges && changes.attributeChanges.length > 0) {
    for (const change of changes.attributeChanges) {
      if (gameState.baseAttributes[change.attribute] !== undefined) {
        gameState.baseAttributes[change.attribute] += change.valueChange;
      } else {
        console.warn(
          `Attempted to change non-existent attribute: ${change.attribute}`
        );
        gameState.baseAttributes[change.attribute] = change.valueChange;
      }
    }
    narrativeContextPart += `\n属性变动：${JSON.stringify(changes.attributeChanges)}。`;
  }

  // 技能更新
  if (changes.skillChanges && changes.skillChanges.length > 0) {
    for (const change of changes.skillChanges) {
      const existingSkillIndex = gameState.playerSkills.findIndex(
        (s) => s.skillName === change.skillName
      );
      if (existingSkillIndex !== -1) {
        if (change.type === "improve" && change.value !== undefined) {
          gameState.playerSkills[existingSkillIndex].level =
            (gameState.playerSkills[existingSkillIndex].level || 0) +
            change.value;
        } else if (
          change.type === "deteriorate" &&
          change.value !== undefined
        ) {
          gameState.playerSkills[existingSkillIndex].level = Math.max(
            0,
            (gameState.playerSkills[existingSkillIndex].level || 0) -
              change.value
          );
        } else if (change.type === "forget") {
          gameState.playerSkills.splice(existingSkillIndex, 1);
        }
      } else if (change.type === "learn") {
        gameState.playerSkills.push({
          skillName: change.skillName,
          level: change.value || 1,
        });
      }
    }
    narrativeContextPart += `\n技能变动：${JSON.stringify(changes.skillChanges)}。`;
  }

  // 地点更新
  if (changes.locationUpdate) {
    gameState.currentLocation = changes.locationUpdate;
    narrativeContextPart += `\n地点更新：玩家现在位于 ${changes.locationUpdate}。`;
  }

  // 故事标志更新
  if (changes.storyFlags && changes.storyFlags.length > 0) {
    for (const flag of changes.storyFlags) {
      gameState.gameProgression[flag.flag] = flag.value;
    }
    narrativeContextPart += `\n故事标志更新：${JSON.stringify(changes.storyFlags)}。`;
  }

  // 判定掷骰 (只在用户解析中可能触发，DM回应中不包含此逻辑)
  if (
    "requiresDiceRoll" in changes &&
    changes.requiresDiceRoll &&
    changes.relevantAttribute &&
    changes.difficultyClass !== undefined
  ) {
    const diceRollResult = rollD20();
    const skillCheckAttribute = changes.relevantAttribute;
    const skillCheckDC = changes.difficultyClass;
    const playerAttrValue = finalAttributes[skillCheckAttribute] || 0;
    let skillCheckSuccess = diceRollResult + playerAttrValue >= skillCheckDC;

    if (diceRollResult === 1) {
      skillCheckSuccess = false;
    } else if (diceRollResult === 20) {
      skillCheckSuccess = true;
    }
    narrativeContextPart += `\n进行了 ${skillCheckAttribute} 检定 (DC ${skillCheckDC})。掷骰结果: ${diceRollResult} (d20) + ${playerAttrValue} (属性加成) = ${diceRollResult + playerAttrValue}。结果：${skillCheckSuccess ? "成功" : "失败"}。`;
  }

  return narrativeContextPart;
}

/**
 * 处理用户在游戏中的行动并生成DM回应的Server Action。
 * 这个函数将在客户端被调用。
 *
 * @param sessionId 当前游戏会话ID
 * @param userAction 用户的文本行动描述
 * @returns 更新后的游戏状态或错误信息
 */
export async function handleUserAction(sessionId: string, userAction: string) {
  "use server"; // 明确标记为 Server Action
  const supabase = await supabaseServer(); // Server Action 中可以使用 supabaseServer

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: User not logged in or session expired.");
  }

  // 1. 从Supabase获取当前游戏状态
  const { data: gameData, error: gameError } = await supabase
    .from("games")
    .select("id, user_id, scenario_id, name, state")
    .eq("id", sessionId)
    .single();

  if (gameError || !gameData) {
    console.error(
      "Error fetching game data in Server Action:",
      gameError?.message || "Game not found."
    );
    throw new Error("游戏会话不存在或无法加载。");
  }

  // 验证用户是否拥有此游戏会话
  if (gameData.user_id !== user.id) {
    throw new Error(
      "Unauthorized: You do not have access to this game session."
    );
  }

  const currentGameState: GameState = gameData.state;
  const scenario: DndScenario | undefined = allScenarios.find(
    (s) => s.id === gameData.scenario_id
  );

  if (!scenario) {
    throw new Error("关联的场景模板未找到。");
  }

  // 计算玩家当前属性（用于给LLM提供上下文）
  let finalAttributes = calculateFinalAttributes(
    // 注意这里现在是 let，因为属性可能被更新
    currentGameState.baseAttributes,
    currentGameState.selectedCustomizations,
    scenario
  );

  // 2. 将用户行动添加到对话历史（先行添加，即使解析或DM回应失败，也能保留用户输入）
  const newUserDialogue: DialogueEntry = {
    role: "user",
    text: userAction,
    timestamp: new Date().toISOString(),
  };
  currentGameState.dialogueHistory.push(newUserDialogue);

  let dmNarrative = "";
  let userActionNarrativeContext = "";

  try {
    // === LLM Call 1: 解析用户意图并获取结构化操作 (Player Action Parser) ===
    const parsedActionSchema = {
      type: "object",
      properties: {
        requestedAction: { type: "string", description: "玩家意图的简要总结" },
        actionType: {
          type: "string",
          enum: [
            "movement",
            "interaction",
            "combat",
            "skill_check",
            "item_use",
            "query",
            "other",
          ],
          description: "行动的类型",
        },
        target: {
          type: "string",
          nullable: true,
          description: "目标对象或地点或人物",
        },
        relevantAttribute: {
          type: "string",
          nullable: true,
          description: "如果是 skill_check，相关的属性名称",
        },
        difficultyClass: {
          type: "number",
          nullable: true,
          description: "如果是 skill_check，建议的难度等级（通常是10-20）",
        },
        itemChanges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string", description: "物品名称" },
              quantityChange: {
                type: "number",
                description: "数量变动（正数增加，负数减少）",
              },
            },
            required: ["item", "quantityChange"],
          },
          nullable: true,
          description: "物品增减列表",
        },
        attributeChanges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              attribute: { type: "string", description: "属性名称" },
              valueChange: { type: "number", description: "属性值变动" },
            },
            required: ["attribute", "valueChange"],
          },
          nullable: true,
          description: "属性增减列表",
        },
        skillChanges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              skillName: { type: "string", description: "技能名称" },
              type: {
                type: "string",
                enum: ["learn", "forget", "improve", "deteriorate"],
                description: "技能变动类型",
              },
              value: {
                type: "number",
                nullable: true,
                description: "如果是学习或提升，技能等级或熟练度",
              },
            },
            required: ["skillName", "type"],
          },
          nullable: true,
          description: "技能学习/遗忘/提升/退化列表",
        },
        locationUpdate: {
          type: "string",
          nullable: true,
          description: "如果行动导致地点改变，新的地点名称",
        },
        storyFlags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              flag: { type: "string" },
              value: { type: "string" },
            },
            required: ["flag", "value"],
          },
          nullable: true,
          description: "故事进度标志更新列表",
        },
        requiresDiceRoll: { type: "boolean", description: "是否需要掷骰子" },
      },
      required: ["requestedAction", "actionType", "requiresDiceRoll"],
    };

    const parseActionPrompt: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `你是一个分析助手，专门解析玩家在D&D游戏中的行动。你的任务是识别玩家的意图、行动类型、目标、相关属性和可能的状态变化，并将其结构化为JSON格式。
        当玩家尝试进行某些行动时，你需要判断是否需要掷骰子，并提供相关的属性和难度等级。
        你将接收玩家的行动描述和当前游戏状态，并**严格按照提供的JSON Schema输出一个JSON对象**，不要包含任何额外文本或Markdown格式。

        当前游戏状态：
        场景: ${scenario["Dnd-Scenario"]}
        地点: ${currentGameState.currentLocation}
        玩家名称: ${currentGameState.playerCharacterName || "玩家"}
        玩家当前属性: ${JSON.stringify(finalAttributes)}
        玩家库存: ${JSON.stringify(currentGameState.inventory)}
        玩家技能: ${JSON.stringify(currentGameState.playerSkills)}
        故事进度: ${JSON.stringify(currentGameState.gameProgression)}

        JSON Schema:
        ${JSON.stringify(parsedActionSchema, null, 2)}

        如果无法识别具体的变化，请省略该字段或使用空数组。
        如果行动类型是 'skill_check'，请务必提供 relevantAttribute 和 difficultyClass。`,
      },
      {
        role: "user",
        content: userAction,
      },
    ];

    const parsedActionResponse = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: parseActionPrompt,
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const parsedAction: ParsedUserAction = JSON.parse(
      parsedActionResponse.choices[0].message?.content || "{}"
    );

    // 应用玩家行动导致的直接状态变化
    userActionNarrativeContext = applyGameStateChanges(
      currentGameState,
      parsedAction,
      finalAttributes
    );
    // 重新计算最终属性，因为 baseAttributes 可能已更新
    finalAttributes = calculateFinalAttributes(
      currentGameState.baseAttributes,
      currentGameState.selectedCustomizations,
      scenario
    );

    // === LLM Call 2: 生成DM回应的叙述 (DM Narrative Generator) ===
    // 专门用于生成创意叙述
    const creativeDMPrompt: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `你是一个经验丰富，幽默风趣且富有创意的D&D地下城主（DM）。
        你的任务是根据玩家的行动、游戏世界的当前状态以及已经发生的逻辑更新来生成生动、引人入胜的叙述。
        当前场景是："${scenario["Dnd-Scenario"]}"。
        游戏背景：${scenario.startingPoint}。
        你的回应应该推动故事发展，描述环境，引入挑战，并暗示可能的选择。
        
        **请将以下游戏机制和状态变化添加你的叙述中。：**
        -   **属性检定/技能使用**: 描述玩家如何运用他们的属性和技能来尝试行动，以及这些尝试的成功或失败如何影响结果。
        -   **物品**: 提及玩家使用或发现的物品，以及它们在当前情境中的作用。
        -   **地点**: 生动描述当前位置，以及玩家行动可能导致的地点变化。
        -   **故事进度**: 如果有关键的故事标志更新，请在叙述中反映出来。
        例如：你发现了物品A，物品A已经添加到了你的物品栏；你来到了地点B；现在的关键目标是“目标X”；你成功使用了技能Y，你的技能Y等级提升了1。
        **绝对不要要求玩家掷骰或进行任何显式的游戏机制操作。你的叙述应该直接报告这些机制的 *结果* 或 *后果*。**

        结合玩家的最新行动，以及以下已发生的逻辑更新和可能的掷骰结果：
        玩家行动解析和初步状态影响: ${userActionNarrativeContext}
        
        当前游戏状态：
        玩家名称: ${currentGameState.playerCharacterName || "玩家"}
        玩家当前位置: ${currentGameState.currentLocation}
        玩家当前属性: ${JSON.stringify(finalAttributes)}
        玩家库存: ${JSON.stringify(currentGameState.inventory)}
        玩家技能: ${JSON.stringify(currentGameState.playerSkills)}
        故事进度: ${JSON.stringify(currentGameState.gameProgression)}

        **输出要求：**
        1.  **纯叙述**: 你的输出只能是DM的叙述文本，不能包含任何JSON或其他结构化数据。
        2.  **叙述完整性**: 你的回应应当是一个简短而完整的、自洽的叙事片段。即使篇幅有限，也要力求在当前回合结束时，提供一个清晰的场景描述、行动后果，并自然地引出玩家的下一个决策点。
        3.  **长度控制**: 你的叙述文本应尽量保持在 **600 token** 以内，专注于描述性叙述和情境推进，去除无谓的修辞。
        4.  **引导而非命令**: 避免直接给出选项，而是通过描述引导玩家下一步行动。
        5.  **掷骰结果**: 如果之前进行了掷骰，请在你的叙述中清晰地提及掷骰结果（例如，"你成功地通过了力量检定..." 或 "你的敏捷检定失败了..."）。
        6.  **幽默感**: 适当加入幽默与讽刺元素，保持叙述轻松有趣。`,
      },
      // 历史对话消息，用于提供上下文
      // 注意：这里包含了玩家最近的行动，以便DM理解上下文
      ...currentGameState.dialogueHistory.map((entry) => ({
        role: (entry.role === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: entry.text,
      })),
      // 玩家的最新行动，作为DM生成回应的直接输入
      {
        role: "user",
        content: userAction,
      },
    ];

    const creativeDMPromptResponse = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: creativeDMPrompt,
      temperature: 0.8, // 提高温度以增加创意性
      max_tokens: 700, // 略高于期望叙述长度，允许模型完成思路
      // 不设置 response_format 为 json_object，因为我们想要纯文本
    });

    dmNarrative =
      creativeDMPromptResponse.choices[0].message?.content ||
      "DM无语了。故事继续...";

    // === LLM Call 3: 从DM叙述中解析状态变化 (DM State Change Parser) ===
    // 定义 DMResponseContent (不含 narrative) 的 JSON Schema
    const dmStateChangeSchema = {
      type: "object",
      properties: {
        itemChanges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              quantityChange: { type: "number" },
            },
            required: ["item", "quantityChange"],
          },
          nullable: true,
          description: "DM叙述中暗示的物品增减",
        },
        attributeChanges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              attribute: { type: "string" },
              valueChange: { type: "number" },
            },
            required: ["attribute", "valueChange"],
          },
          nullable: true,
          description: "DM叙述中暗示的属性增减",
        },
        skillChanges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              skillName: { type: "string" },
              type: {
                type: "string",
                enum: ["learn", "forget", "improve", "deteriorate"],
              },
              value: { type: "number", nullable: true },
            },
            required: ["skillName", "type"],
          },
          nullable: true,
          description: "DM叙述中暗示的技能学习/遗忘/提升/退化",
        },
        locationUpdate: {
          type: "string",
          nullable: true,
          description: "DM叙述中暗示的地点改变",
        },
        storyFlags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              flag: { type: "string" },
              value: { type: "string" },
            },
            required: ["flag", "value"],
          },
          nullable: true,
          description: "DM叙述中暗示的故事进度标志更新",
        },
      },
      // required: [],
      nullable: true, // 整个对象可以是空的，如果没有检测到变化
    };

    const dmStateChangePrompt: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `你是一个精确的状态解析器。你的任务是从一段DM的叙述中，识别并提取出明确的游戏状态变化（例如：物品获取/丢失，属性增减，技能学习/遗忘/提升，地点变化，故事标志更新）。
        你将接收DM的叙述和当前的游戏状态作为参考。
        **严格按照提供的JSON Schema输出一个JSON对象，不要包含任何额外文本或Markdown格式。**
        如果叙述中没有明确的状态变化，则输出一个空JSON对象 '{}'。

        DM叙述文本："${dmNarrative}"

        当前游戏状态（仅供参考，请根据DM叙述来判断变化）：
        玩家库存: ${JSON.stringify(currentGameState.inventory)}
        玩家技能: ${JSON.stringify(currentGameState.playerSkills)}
        玩家属性: ${JSON.stringify(finalAttributes)}
        当前位置: ${currentGameState.currentLocation}
        故事进度: ${JSON.stringify(currentGameState.gameProgression)}

        JSON Schema:
        ${JSON.stringify(dmStateChangeSchema, null, 2)}
        `,
      },
    ];

    const dmStateChangeResponse = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: dmStateChangePrompt,
      temperature: 0.0, // 极低的温度，确保结构化和准确性
      max_tokens: 300,
      response_format: { type: "json_object" }, // 强制JSON输出
    });

    const dmChanges: Partial<DMResponseContent> = JSON.parse(
      dmStateChangeResponse.choices[0].message?.content || "{}"
    );
    console.log(549, "DM Changes:", dmChanges);

    // 应用DM回应触发的游戏状态变化
    applyGameStateChanges(currentGameState, dmChanges, finalAttributes); // finalAttributes 在这里仅用于类型兼容性，实际不用于掷骰
  } catch (openaiError: any) {
    console.error(
      "Error with OpenAI API during action parsing or DM response:",
      openaiError
    );
    dmNarrative = `DM暂时无法回应，似乎遇到了次元裂缝。错误: ${openaiError.message || String(openaiError)}`;
    // 如果DM状态解析失败，我们仍然希望将DM叙述添加到历史中
  }

  // 4. 将DM回应的叙述文本添加到对话历史
  const newDmDialogue: DialogueEntry = {
    role: "dm",
    text: dmNarrative,
    timestamp: new Date().toISOString(),
  };
  currentGameState.dialogueHistory.push(newDmDialogue);

  // 5. 更新游戏状态到Supabase
  const { error: updateError } = await supabase
    .from("games")
    .update({ state: currentGameState, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (updateError) {
    console.error("Error updating game state:", updateError.message);
    throw new Error("保存游戏状态失败。");
  }

  // 返回更新后的游戏状态，以便客户端更新UI
  return currentGameState;
}

/**
 * 游戏会话页面 (服务器组件)
 * 仅负责传递 sessionId 和 Server Action 给客户端视图组件。
 * 所有的初始数据获取和验证将移到客户端组件中处理。
 */
export default async function GameSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const sessionId = (await params).sessionId;

  return (
    <GameSessionView
      sessionId={sessionId}
      handleUserAction={handleUserAction}
    />
  );
}
