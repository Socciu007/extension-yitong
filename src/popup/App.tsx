import "./App.css"
import truckData from "@/mockdata/truckData.json"
import ButtonComponent from "@/components/ButtonComponent"
import { showToast, getCookiesEPB } from "./scripts"
import { useState } from "react"
import { fetchOrderData, getYitongOrderData, saveYitongOrderData, getYitongOrderDataDb, fillTruckForYitongOrder, updateYitongOrderDataDb } from "@/utils/services"

export default function App() {
  const [loading, setLoading] = useState({count: 0, total: 0})
  const [truckLoading, setTruckLoading] = useState({count: 0, total: 0})

  // Handle scrape button click
  const handleStart = async () => {
    // const [tab] = await chrome.tabs.query({
    //   active: true,
    //   currentWindow: true,
    // })
    // const url1 = "https://www.eptrade.cn/epb/login/scno_direct_bk.html"
    // const url = "https://www.eptrade.cn/epb/index.jsp"

    // // Load URL
    // await chrome.tabs.update(tab.id, { url })
    // // Wait for tab to load
    // // await loadTab(tab)
    // // Check url 
    // const currentUrl = await chrome.tabs.query({
    //   active: true,
    //   currentWindow: true,
    // })
    // if (currentUrl[0]?.url?.includes('login')) {
    //   await chrome.tabs.update(tab.id, { url: url1 })
    //   await loadTab(tab)
    //   // Action Login
    //   const urlImg = await chrome.scripting.executeScript({
    //     target: { tabId: tab.id as number },
    //     func: async () => {
    //       try {
    //         console.log("Start action login....")
    //         const tabLogin = document.querySelectorAll(".tabs-title") as NodeListOf<Element>
    //         if (tabLogin) (tabLogin[1] as HTMLAnchorElement).click()
            
    //         const username = document.querySelector("#user_id") as HTMLInputElement
    //         if (username) username.value = "CN122887"
    //         const password = document.querySelector("#user_pwd" ) as HTMLInputElement
    //         if (password) password.value = "imND3I26"
    //         const capchaCodeImg = document.querySelector("#safecode") as HTMLButtonElement
    //         if (capchaCodeImg) {
    //           const urlImg = capchaCodeImg.getAttribute("src")
    //           return urlImg
    //         }
    //       } catch (error) {
    //         console.error("Error login in the page", error)
    //       }
    //     },
    //   })
    //   await delay(1000)
  
    //   // Decode capcha code
    //   const toBase64 = await axios.get(`https://www.eptrade.cn/epb/login/${urlImg[0].result}`, { responseType: "arraybuffer" })
    //   const capchaCode = await decodeCapcha(
    //     Buffer.from(toBase64.data, "binary").toString("base64")
    //   )
    //   if (!capchaCode) {
    //     showToast("Please login to the system!", "warning")
    //     return
    //   }

    //   const resultLogin = await chrome.scripting.executeScript({
    //     target: { tabId: tab.id as number },
    //     func: async (capchaCode: string) => {
    //       try {
    //         const capchaCodeInput = document.querySelector("#login2 > table > tbody > tr:nth-child(3) > td:nth-child(1) > input") as HTMLInputElement
    //         if (capchaCodeInput) capchaCodeInput.value = capchaCode

    //         const loginBtn = document.querySelector("#btnLogin") as HTMLButtonElement
    //         if (loginBtn) loginBtn.click()
    //         return true
    //       } catch (error) {
    //         console.error("Error login in the page", error)
    //         return false
    //       }
    //     },
    //     args: [capchaCode],
    //   })
    //   console.log("resultLogin", resultLogin)
    //   if (!resultLogin[0].result) {
    //     showToast("Please start again or login to the system!", "warning")
    //     return
    //   }
    // }

    // // Wait for tab to load
    // await loadTab(tab)

    // // Get header cookie from website
    // const headerCookie = await chrome.cookies.getAll({
    //   url: "https://www.eptrade.cn/epb",
    // })

    // Get yitong order data
    const cookies = await getCookiesEPB()
    if (!cookies) {
      showToast("Please login to the system!", "warning")
      setLoading(0)
      return
    }

    const getOrderData = await getYitongOrderDataDb()
    const { rows, total } = await getYitongOrderData(cookies, { page: 1, rows: 100 })
    const totalRows = total - (getOrderData?.orders?.length || 0)
    setLoading({ count: 0, total: totalRows })
    if (rows && rows.length > 0) {
      // Save yitong order data to database
      const resultSave = await saveYitongOrderData(
        rows.map((o: any) => ({ ...o, statusTruck: 0, statusTruckEb: 0 }))
      )
      console.log("resultSave", resultSave)
      setLoading((prev) => ({
        ...prev,
        count: prev.count + (resultSave?.result?.added || 0),
      }))
    }
    const totalPage = Math.ceil(totalRows / 100);
    for (let i = 2; i <= totalPage; i++) {
      const { rows: rowsTemp } = await getYitongOrderData(cookies, { page: i, rows: 100 })
      if (rowsTemp && rowsTemp.length > 0) {
        // Save yitong order data to database
        const resultSave = await saveYitongOrderData(
          rowsTemp.map((o: any) => ({ ...o, statusTruck: 0, statusTruckEb: 0 }))
        )
        console.log(`resultSave${i}`, resultSave)
        setLoading((prev) => ({ ...prev, count: prev.count + (resultSave?.result?.added || 0) }))
      }
    }
    showToast(`Finish scraped yitong orders`, "success")
    setLoading({ count: 0, total: 0 })
  }

  // Handle truck select for yitong orders on website
  const handleTruck = async () => {
    const cookies = await getCookiesEPB()
    if (!cookies) {
      showToast("Please login to the system!", "warning")
      return
    }
    const getOrderData = await getYitongOrderDataDb()
    setTruckLoading({ count: 0, total: getOrderData?.orders?.length || 0 })
    for (let i = 0; i < getOrderData?.orders?.length; i++) {
      const order = getOrderData?.orders[i]
      if (!order.bookingNo) {
        setTruckLoading((prev) => ({ ...prev, count: prev.count + 1 }))
        continue
      }
      // Fetch order data
      const { data } = await fetchOrderData({ page: 1, pageSize: 10, blNo: order.bookingNo })
      console.log("data", data[0]?.order)
      if (data.length === 0 || !data[0]?.order?.trailerCompany) {
        setTruckLoading((prev) => ({ ...prev, count: prev.count + 1 }))
        await updateYitongOrderDataDb({ bookingNo: order?.bookingNo, statusTruck: 0, statusTruckEb: 2 }) // 2: No truck found
        continue
      }

      // Find truck code
      const truckCode = truckData?.find((o: any) => o.id === data[0]?.order?.trailerCompany)
      if (truckCode && truckCode?.value) {
        // Fill truck for yitong order on website
        const resultFill = await fillTruckForYitongOrder(cookies, { truckCode: truckCode?.value, bookingNo: order?.bookingNo })
        console.log("resultFill", resultFill)
        if (resultFill?.success === 'Y') await updateYitongOrderDataDb({ bookingNo: order?.bookingNo, statusTruck: 1, statusTruckEb: 1 }) // 1: Truck filled
      }
      setTruckLoading((prev) => ({ ...prev, count: prev.count + 1 }))
    }
    showToast(`Finish fill truck for yitong orders!`, "success")
    setTruckLoading({ count: 0, total: 0 })
  }
  return (
    <div className="mb-2">
      <div
        id="notification"
        className="absolute top-[1rem] right-[2rem] p-1 rounded-md shadow-lg"
      ></div>
      <div className="text-center text-2xl font-bold mb-2 text-[#99BBE8]">
        YITONG EPB
      </div>
      <div className="flex gap-2 justify-center">
        <ButtonComponent
          onClick={handleStart}
          text={loading.total > 0 ? `Processing(${loading.count}/${loading.total})...` : "Scrape order"}
          id="start"
          classNameProps="mt-2 bg-[#277fbc] px-4 py-2"
        />
        <ButtonComponent
          onClick={handleTruck}
          text={truckLoading.total > 0 ? `Processing(${truckLoading.count}/${truckLoading.total})...` : "Truck order"}
          id="truck"
          classNameProps="mt-2 bg-[#277fbc] px-4 py-2"
        />
      </div>
    </div>
  );
}