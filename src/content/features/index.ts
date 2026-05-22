// Listen to the message from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📩 received:", msg)
  console.log("📩 sender:", sender)
  console.log("📩 sendResponse:", sendResponse)
  if (
    msg.type === "AUTO_LOGIN" &&
    sender.tab?.id === msg.tabId &&
    window.location.href.includes("oocl.com")
  ) {
    console.log("auto login start 🚀")
  }
})