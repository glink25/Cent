import { TypeText } from "./type-code";

export const toSmartImport = () => {
    const prompt = `你是一个专业的JavaScript开发者，你的任务是编写一个数据转换函数。

**任务:**
编写一个名为 \`transform\` 的JavaScript函数，该函数接收一个“输入数据字符串”，并将其转换为“目标格式”数组。

**重要提示:**
输入参数 \`file\` 是一个 **文件对象**，代表用户上传的完整文件内容。
你需要自己解析这个文件（例如，如果它是CSV，你需要使用ctx.Papa进行文件解析；如果它是excel，你需要 \`ctx.XLSX进行解析\`；如果它是JSON，你需要 \`JSON.parse\`）。

---

**1. 输入数据:**
\`\`\`
用户在对话中所携带的文件（json,csv或者excel格式）
\`\`\`

---

**2. 目标格式 (必须严格遵守):**
输出必须是一个对象数组，每个对象都符合这个TypeScript接口：
\`\`\`typescript
/**
 * 我的记账App标准交易结构
 */
${TypeText}
\`\`\`

---

**3. 转换逻辑 (请仔细推理):**
- **解析:** 首先判断输入文件是CSV、JSON还是其他格式，并通过ctx中的对应工具将其解析为JavaScript对象数组。
- **映射:** 遍历解析后的数组，并根据标准交易结构中的提示，将文件中的数据尽可能转换到标准的交易结构数据

---

**4. 你的输出:**
**只**输出 \`transform\` 函数的JavaScript代码。不要包含任何解释、Markdown标记 (如 \`\`\`js) 或其他文本。

**函数模板:**
function transform(file:File, ctx:{Papa:any /** 专门用于解析CSV文件的第三方JS库，你应该遵循该库最新的使用方法来使用 */ ,XLSX:any /** 专门用于解析Excel文件的第三方JS库，你应该遵循该库最新的使用方法来使用 */}) {
  // 'data' 是一个包含文件所有内容的字符串。
  
  // 步骤1: 解析字符串 (例如: CSV 或 JSON)
  let parsedData = [];
  try {
    // 在这里添加你的解析逻辑
    // 例如，如果是JSON:
    // parsedData = JSON.parse(data);
    
    // 例如，如果是CSV (简易解析):
    // const lines = Papa.parse(file, {
                //     header: true,
                //     preview: 3, // 只解析前3行数据
                //     dynamicTyping: false, // 全部读为字符串，让LLM处理
                //     skipEmptyLines: true,
                //     complete: (summaryResult) => {
                //         if (summaryResult.errors.length) {
                //             return reject(new Error(summaryResult.errors[0].message));
                //         }
                //         inputSummaryData = summaryResult.data;
                //         document.getElementById('inputSummary').textContent = JSON.stringify(inputSummaryData, null, 2);
                        
                //         // 2. 解析完整数据
                //         Papa.parse(file, {
                //             header: true,
                //             dynamicTyping: false,
                //             skipEmptyLines: true,
                //             complete: (fullResult) => {
                //                 if (fullResult.errors.length) {
                //                     return reject(new Error(fullResult.errors[0].message));
                //                 }
                //                 fullParsedData = fullResult.data;
                //                 resolve();
                //             },
                //             error: (err) => reject(err)
                //         });
                //     },
                //     error: (err) => reject(err)
                // });

  } catch (e) {
    console.error("解析原始字符串失败:", e);
    return []; // 解析失败返回空数组
  }

  // 步骤2: 映射数据
  const transformedData = parsedData.map(item => {
    try {
      return {
        // ... 在这里映射字段 ...
      };
    } catch (e) {
      console.error("处理单项数据失败:", item, e);
      return null; // 转换失败则返回 null
    }
  }).filter(Boolean); // 过滤掉转换失败的项
  
  return transformedData;
}`;
    navigator.clipboard.writeText(prompt);
};
