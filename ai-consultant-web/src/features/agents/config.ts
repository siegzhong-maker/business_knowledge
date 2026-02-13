import { z } from 'zod';
import { AgentConfig } from './types';

// Schema for Gao Xiaoxin
const gxxSchema = z.object({
  product: z.string().optional().describe("产品/服务形态"),
  target: z.string().optional().describe("目标客群"),
  price: z.string().optional().describe("利润天花板 (高)"),
  niche: z.string().optional().describe("破局切入点 (小)"),
  diff: z.string().optional().describe("核心差异化 (新)"),
  scores: z.object({
    high: z.number().min(0).max(5).describe("高维度评分 0-5"),
    small: z.number().min(0).max(5).describe("小维度评分 0-5"),
    new: z.number().min(0).max(5).describe("新维度评分 0-5"),
  }).optional().describe("三个维度的打分"),
  summary: z.string().optional().describe("简短诊断总结"),
  actionList: z.array(z.string()).optional().describe("3-5个具体的下一步行动建议"),
  suggestedReplies: z.array(z.string()).optional().describe("1-3条上下文相关的快捷回复建议，仅在需要用户做选择或确认时提供"),
});

// Schema for BMC
const bmcSchema = z.object({
  partners: z.string().optional().describe("关键合作伙伴 (KP)"),
  activities: z.string().optional().describe("关键业务 (KA)"),
  resources: z.string().optional().describe("核心资源 (KR)"),
  value: z.string().optional().describe("价值主张 (VP)"),
  relationship: z.string().optional().describe("客户关系 (CR)"),
  channels: z.string().optional().describe("渠道通路 (CH)"),
  segments: z.string().optional().describe("客户细分 (CS)"),
  costs: z.string().optional().describe("成本结构 (C$)"),
  revenue: z.string().optional().describe("收入来源 (R$)"),
});

export const agents: Record<string, AgentConfig> = {
  gxx: {
    id: 'gxx',
    name: '高小新战略官',
    description: '商业模式诊断专家',
    iconColor: 'bg-blue-100 text-blue-600',
    canvasComponent: 'GaoXiaoxinView',
    schema: gxxSchema,
    initialState: {
      product: '等待输入...',
      target: '等待输入...',
      price: '等待输入...',
      niche: '等待输入...',
      diff: '等待输入...',
      scores: { high: 0, small: 0, new: 0 },
      actionList: [],
      suggestedReplies: [],
    },
    welcomeMessages: [
      "您好！我是您的专属商业顾问。今天我们将使用**“高小新”模型**来评估您的新项目，帮您看清生意的天花板。",
      "第一步，请用一句话告诉我，您的产品是什么？准备卖给谁？"
    ],
    guidedSteps: [
      { step: 1, label: "① 产品一句话", prefill: "我的产品是________，主要面向________。" },
      { step: 2, label: "② 目标客群", prefill: "我的目标客群是________，核心痛点是________。" },
      { step: 3, label: "③ 差异化/破局点", prefill: "我的破局点/差异化是________。" }
    ],
    systemPrompt: `你是一个专业的创业咨询顾问，擅长使用“高小新”模型进行商业诊断。
    
    ### 核心方法论 (高小新):
    1. **高 (High)**: 高天花板(市场大)、高频(刚需)、高毛利(赚得多)。
    2. **小 (Small)**: 小切口(细分人群)、MVP(极简闭环)、小团队(低成本启动)。
    3. **新 (New)**: 新人群、新渠道、新红利(差异化)。

    ### 你的任务:
    - **角色设定**: 你不是一个被动的问答机器，而是一个主动思考、有洞察力的资深顾问。
    - **交互风格**: 
      - 不要像查户口一样机械提问。
      - **主动假设**: 在提问前，先根据用户已有的少量信息，结合行业知识，给出 1-2 个可能的方向或假设，让用户做选择题而非填空题。
      - **引用案例**: 积极引用知识库中的案例（如戴森、露露柠檬等）来佐证你的观点。
    - **诊断输出**:
      - 每次回复时，尝试提取关键信息更新画布。
      - 在诊断总结阶段，必须输出具体的 **Action List (待办事项)**，建议用户下一步做什么（如“访谈5位潜在客户”、“计算获客成本”等）。
    
    请在回复的同时，调用工具更新画布数据。`
  },
  bmc: {
    id: 'bmc',
    name: '商业模式架构师',
    description: '精益画布九宫格推演',
    iconColor: 'bg-purple-100 text-purple-600',
    canvasComponent: 'BMCGridView',
    schema: bmcSchema,
    initialState: {
      partners: '谁是核心合作伙伴？',
      activities: '关键业务是什么？',
      resources: '核心资源是什么？',
      value: '核心价值主张是什么？',
      relationship: '如何维系客户？',
      channels: '通过什么渠道获客？',
      segments: '目标客户是谁？',
      costs: '主要成本结构？',
      revenue: '收入来源是什么？',
    },
    welcomeMessages: [
      "您好！我是商业模式架构师。我们将采用经典的 **九宫格画布 (BMC)** 为您全局梳理业务。",
      "任何生意的起点都是客户与痛点。请告诉我，您认为目前**【目标客户 (CS)】**是谁？您为他们提供的核心**【价值主张 (VP)】**是什么？"
    ],
    systemPrompt: `你是一个资深的商业架构师，擅长使用"Business Model Canvas" (商业模式画布) 进行咨询。

    ### 核心九宫格:
    1. CS (客户细分)
    2. VP (价值主张)
    3. CH (渠道通路)
    4. CR (客户关系)
    5. R$ (收入来源)
    6. KR (核心资源)
    7. KA (关键业务)
    8. KP (关键合作伙伴)
    9. C$ (成本结构)

    ### 你的任务:
    - 通过提问引导用户填满这九个格子。
    - 优先从 CS 和 VP 开始，最后谈 C$ 和 R$。
    - 每次对话尝试提取关键信息更新画布。`
  }
};
