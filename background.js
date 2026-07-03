// Sync task every 30 minutes
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncTaskMain", {
    periodInMinutes: 13
  })
  chrome.alarms.create("syncTaskLoginEPB", {
    periodInMinutes: 15
  })
  chrome.alarms.create("syncTaskImportOrderToYitong", {
    periodInMinutes: 4
  })
  chrome.alarms.create("syncTaskFetchVnEirOrder1Month", {
    periodInMinutes: 2
  })
})
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "syncTaskMain") {
    // Show result on popup and noification
    chrome.runtime.sendMessage({ type: "UPDATE_RESULT" })
  }
  if (alarm.name === "syncTaskLoginEPB") {
    console.log("Login again EPB")
    chrome.runtime.sendMessage({ type: "LOGIN_AGAIN_EPB" })
  }
  if (alarm.name === "syncTaskImportOrderToYitong") {
    console.log("Sync order's eb with yitong")
    chrome.runtime.sendMessage({ type: "SYNC_ORDER_EB_WITH_YITONG" })
  }
  if (alarm.name === "syncTaskFetchVnEirOrder1Month") {
    console.log("Fetch VN EIR order 1 month")
    try {
      // http://localhost:3001 https://www.dadaex.cn/api/vn/eir/order/1month
      const response = await fetch("https://www.dadaex.cn/api/vn/eir/order/1month")
      if (!response.ok) {
        console.error(`Fetch failed: ${response.status} ${response.statusText}`)
        return
      }
      const data = await response.json()
      chrome.runtime.sendMessage({ type: "FETCH_VN_EIR_ORDER_1_MONTH", data: data?.data?.filter((item) => (item?.shipCompany === 30) && (item?.yitongOrder !== 2)) })
    } catch (error) {
      console.error("Error fetching VN EIR order 1 month:", error)
    }
  }
})