## 提示词总览 (03-07-2026)

| #  | 时间(约) | 提示词(中文)                                                                                                  | 关键操作摘要                                          |
| -- | -------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1  | 14:00    | 新增一个每 2 分钟从 `http://localhost:3001/vn/eir/order/1month` 加载数据的定时任务                              | 新增 alarm `syncTaskFetchVnEirOrder1Month` (2 min)    |
| 2  | 14:05    | （提供 Postman JSON 响应，并将 URL 切换为生产域名）                                                            | `host_permissions` 改为 `*://*.dadaex.cn/*`           |
| 3  | 14:10    | 新增将每个成功 fill truck 的订单 blNo 写入 local storage                                                        | 将成功 `blNo` 写入 `chrome.storage.local`             |
| 4  | 14:15    | 新增判断 blNo 是否已存在于 localstorage                                                                         | 循环前用 `Set` 跳过已处理 `blNo`                      |
| 5  | 14:20    | 在 add 之前判断存储中是否已存在                                                                                  | `add()` 前再加一层 `has()` 守卫                       |
| 6  | 14:25    | `add .` 然后 commit                                                                                              | commit `42b8984`                                     |
| 7  | 14:30    | `git add .` 然后 commit                                                                                          | commit `41fcfa9` (bump 1.1.1 + 切换生产端点)          |
| 8  | 14:35    | 用中文按时间线统计本次会话所有 prompt 到 `docs.md`                                                              | 生成 `docs.md`                                       |
| 9  | 14:40    | 新增一个包含时间和 prompt 的表格                                                                                  | 重排为表格形式 (本文件当前版本)                        |
| 10 | 14:45    | 将 prompt 翻译成英文或中文                                                                                        | 把表格里的 prompt 翻译为中文（本版本）                 |

---

## 详细说明

### 1. 添加定时任务：每 2 分钟从指定接口拉取数据
**原文**：`thêm một nhiệm vụ thời gian cứ 2 phút nạp dữ liệu từ http://localhost:3001/vn/eir/order/1month`

**操作**：
- 在 `background.js` 中新增 alarm `syncTaskFetchVnEirOrder1Month`（每 2 分钟触发）
- 在 `chrome.alarms.onAlarm` 监听器中添加分支，调用 `fetch` 拉取数据并存入 `chrome.storage.local`
- 在 `manifest.config.ts` 中将 `http://localhost:3001/*` 加入 `host_permissions`

---

### 2. 确认接口响应结构 + 切换到生产域名
**原文**：提供了 Postman 的 JSON 响应 `{ "status": "success", "data": [...] }`，同时 `background.js` 中 URL 已被改为 `https://www.dadaex.cn/api/vn/eir/order/1month`

**操作**：
- 同步将 `manifest.config.ts` 的 `host_permissions` 从 `http://localhost:3001/*` 改为 `*://*.dadaex.cn/*`

---

### 3. 将成功 fill truck 的 blNo 写入 localStorage
**原文**：`có thể thêm lưu vào local storage số blNo mỗi đơn hàng fill truck thành công`

**操作**：
- 在 `src/popup/App.tsx` 的 `FETCH_VN_EIR_ORDER_1_MONTH` 处理分支中，`resultFill.success === "Y"` 时把 `order.blNo` 追加到 `chrome.storage.local` 的 `filledTruckBlNos` 数组
- 修复 TypeScript 报错：用 `Array.isArray` 守卫并显式声明 `existingBlNos: string[]`

---

### 4. 处理前检查 blNo 是否已存在于 localStorage
**原文**：`thêm check if blNo tồn tại trong localstorage`

**操作**：
- 在循环外一次性读取 `filledTruckBlNos` 并转为 `Set<string>`
- 循环内通过 `Set.has()` 跳过已处理的 `blNo`
- 成功 fill 后同步更新 `Set` 和 `chrome.storage.local`

---

### 5. 在 add 之前再次检查存储中是否已存在
**原文**：`check đã tồn tại trong storage trước khi add`

**操作**：
- 在 `filledBlNoSet.add(order.blNo)` 之前加一层 `if (!filledBlNoSet.has(order.blNo))` 守卫
- 避免并发或重复流程造成冗余写入

---

### 6. 第一次提交
**原文**：`add . và commit`

**操作**：
- 提交 commit `42b8984`：`add fetch VN EIR order 1 month task and save filled blNos`
- 包含 `background.js`、`src/popup/App.tsx`、`src/utils/services.ts`

---

### 7. 第二次提交
**原文**：`git add . và commit`

**操作**：
- 提交 commit `41fcfa9`：`bump to 1.1.1 and switch endpoints to production`
- 包含 `package.json`（版本 1.1.0 → 1.1.1）、`background.js`、`src/popup/App.tsx`、`src/utils/services.ts`（端点切换到 `www.dadaex.cn`、QQ 消息改用 `order.blNo`、`yitongOrder` 改为 1）

---

### 8. 整理本次会话提示词到 docs.md
**原文**：`hãy thống kê tất cả các prompt của phiên này bằng tiếng trung theo dòng thời gian vào docs.md`

**操作**：
- 生成 `docs.md`，按时间顺序记录全部历史提示词及对应操作

---

### 9. 改为表格形式
**原文**：`thêm theo bảng gồm thời gian và prompt`

**操作**：
- 在 `docs.md` 顶部新增「提示词总览」表格，列出 # / 时间 / 提示词原文 / 关键操作摘要
- 下方保留按编号对应的详细说明

---

### 10. 将 prompt 翻译为英文或中文
**原文**：`hãy chuyển prompt thành tiếng anh hoặc tiếng trung`

**操作**：
- 表格列名 `提示词(原文)` 改为 `提示词(中文)`
- 表格中所有越南语 prompt 翻译为中文，与文档其他部分保持一致
- 详细说明区块的「原文」字段同时保留越南语原文 + 中文译文，方便对照
