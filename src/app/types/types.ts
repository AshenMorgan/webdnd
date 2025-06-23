export interface AttributeBonus {
  [key: string]: number; // The key will be the attribute name, value is the bonus amount
}

export interface PlayerCustomizationContentItem {
  description: string;
  attributeBonus: AttributeBonus;
}

export interface PlayerCustomizationCategory {
  description: string;
  content: {
    [key: string]: PlayerCustomizationContentItem; // Key is the customization option name
  };
}

export interface BaseSkill {
  attribute: string; // Refers to an attribute name
  description: string;
}

export interface DndScenario {
  id: string; // Unique identifier for the scenario
  "Dnd-Scenario": string;
  attributes: {
    [key: string]: string; // Key is the attribute name, value is its description
  };
  baseSkills: {
    [key: string]: BaseSkill; // Key is the skill name
  };
  startingPoint: string;
  playerCustomizations: {
    [key: string]: PlayerCustomizationCategory; // Key is the customization category name (e.g., "parentingStyle", "role")
  };
}

// 库存物品类型
export interface InventoryItem {
  item: string; // 物品名称
  quantity: number; // 数量
}

// 玩家技能类型
export interface PlayerSkill {
  skillName: string; // 技能名称
  level?: number; // 技能等级或熟练度，可选
  description?: string; // 技能描述，可选
}

export interface DialogueEntry {
  role: "user" | "dm"; // 角色：用户或DM
  text: string; // 对话内容
  timestamp: string; // 时间戳，ISO 字符串格式
}

//game state in supabase
export interface GameState {
  scenarioId: string;
  scenarioName: string;
  baseAttributes: {
    [key: string]: number;
  };
  selectedCustomizations: {
    [key: string]: string;
  };
  currentLocation: string;
  playerCharacterName?: string;
  inventory: InventoryItem[]; // 新增：玩家库存
  playerSkills: PlayerSkill[]; // 新增：玩家技能
  gameProgression: {
    // 更详细的游戏进度，用于存储故事相关标志
    [key: string]: any; // 例如: { "quest_status": "started", "door_unlocked": true }
  };
  dialogueHistory: DialogueEntry[];
}

export interface GameTableRow {
  id: string;
  user_id: string;
  scenario_id: string;
  name: string;
  state: GameState; // state 是 jsonb 类型，对应 GameState 接口
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// LLM用于解析用户行动的结构化输出类型
export interface ParsedUserAction {
  requestedAction: string; // 用户意图的简要总结
  actionType:
    | "movement"
    | "interaction"
    | "combat"
    | "skill_check"
    | "item_use"
    | "query"
    | "other";
  target?: string; // 目标对象或地点，可选
  relevantAttribute?: string; // 如果是 skill_check，相关的属性名称
  difficultyClass?: number; // 如果是 skill_check，建议的难度等级
  itemChanges?: { item: string; quantityChange: number }[]; // 物品增减
  attributeChanges?: { attribute: string; valueChange: number }[]; // 属性增减
  skillChanges?: {
    skillName: string;
    type: "learn" | "forget" | "improve" | "deteriorate";
    value?: number;
  }[]; // 技能学习/遗忘/提升/退化
  locationUpdate?: string; // 如果行动导致地点改变
  storyFlags?: { flag: string; value: any }[]; // 故事进度标志更新
  requiresDiceRoll: boolean; // 是否需要掷骰子
}

export interface DMResponseContent {
  narrative: string; // DM 的叙述文本
  itemChanges?: { item: string; quantityChange: number }[]; // DM触发的物品增减
  attributeChanges?: { attribute: string; valueChange: number }[]; // DM触发的属性增减
  skillChanges?: {
    skillName: string;
    type: "learn" | "forget" | "improve" | "deteriorate";
    value?: number;
  }[]; // DM触发的技能学习/遗忘/提升/退化
  locationUpdate?: string; // DM触发的地点改变
  storyFlags?: { flag: string; value: any }[]; // DM触发的故事进度标志更新
}
