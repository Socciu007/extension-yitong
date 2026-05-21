import { getCookiesEPB } from "@/popup/scripts"
import { getYitongOrderDataDb, fetchOrderData, updateOrderData, updateYitongOrderDataDb, fillTruckForYitongOrder } from "@/utils/services"
import truckData from "@/mockdata/truckData.json"

const autoLogin = async () => {
  console.log('auto login start 🚀')
}

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
    autoLogin()
  }
})

// Sync task every 30 minutes
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncTask", {
    periodInMinutes: 15
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "syncTask") {
    console.log("Run task");
    const cookies = await getCookiesEPB()
    if (!cookies) {
      console.log("No cookies found")
      return
    }

    let truckFilled: string[] = [];
    const getOrderData = await getYitongOrderDataDb('2')
    for (let i = 0; i < getOrderData?.orders?.length; i++) {
      const order = getOrderData?.orders[i]
      if (!order.bookingNo) continue
      // Fetch order data
      const { data } = await fetchOrderData({ page: 1, pageSize: 10, blNo: order.bookingNo })
      if (data.length === 0 || !data[0]?.order?.trailerCompany) {
        await updateYitongOrderDataDb({ bookingNo: order?.bookingNo, statusTruck: 0, statusTruckEb: 2 }) // 2: No truck found
        continue
      }

      // Find truck code
      const truckCode = truckData?.find((o: any) => o.id === data[0]?.order?.trailerCompany)
      if (truckCode && truckCode?.value) {
        // Fill truck for yitong order on website
        const resultFill = await fillTruckForYitongOrder(cookies, { truckCode: truckCode?.value, bookingNo: order?.bookingNo })
        if (resultFill?.success === 'Y') {
          truckFilled.push(order?.bookingNo)
          await updateOrderData({ blNo: order?.bookingNo })
          await updateYitongOrderDataDb({ bookingNo: order?.bookingNo, statusTruck: 1, statusTruckEb: 1 }) // 1: Truck filled
        }
      }
    }

    // Show result on popup and noification
    const resultElement: HTMLElement | null = document.getElementById("result")
    if (resultElement) {
      resultElement.textContent = ""
      resultElement.textContent = `Filled truck for ${truckFilled.length} yitong orders: ${truckFilled.join(", ")}`
    }
  }
});