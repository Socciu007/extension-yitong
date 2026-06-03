// Sync task every 30 minutes
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncTaskMain", {
    periodInMinutes: 20
  })
  chrome.alarms.create("syncTaskLoginEPB", {
    periodInMinutes: 15
  })
  chrome.alarms.create("syncTaskImportOrderToYitong", {
    periodInMinutes: 3
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
})