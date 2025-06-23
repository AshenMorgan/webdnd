import { DndScenario } from "@/app/types/types";

/**
 * 计算最终属性值（包括用户分配和自定义加成）。
 * 这个函数与之前的 NewGamePage 中的 calculateFinalAttributes 相同。
 */
export const calculateFinalAttributes = (
  baseAttrs: { [key: string]: number },
  customs: { [key: string]: string },
  currentScenario: DndScenario
) => {
  const finalAttrs = { ...baseAttrs };

  for (const categoryKey in customs) {
    const selectedOptionKey = customs[categoryKey];
    const category = currentScenario.playerCustomizations[categoryKey];
    if (category && category.content[selectedOptionKey]) {
      const bonus = category.content[selectedOptionKey].attributeBonus;
      for (const attr in bonus) {
        if (finalAttrs[attr] !== undefined) {
          finalAttrs[attr] += bonus[attr];
        } else {
          // 如果自定义加成中有一个属性不在原始属性列表中，则将其添加到最终属性中
          finalAttrs[attr] = bonus[attr];
        }
      }
    }
  }
  return finalAttrs;
};
