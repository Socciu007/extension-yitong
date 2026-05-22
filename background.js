// Sync task every 30 minutes
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncTaskMain", {
    periodInMinutes: 20
  })
  chrome.alarms.create("syncTaskLoginEPB", {
    periodInMinutes: 15
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
})