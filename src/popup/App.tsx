import "./App.css"
import truckData from "@/mockdata/truckData.json"
import ButtonComponent from "@/components/ButtonComponent"
import { showToast, getCookiesEPB } from "./scripts"
import { useState, useEffect } from "react"
import { updateOrderData, fetchOrderData, getYitongOrderData, saveYitongOrderData, getYitongOrderDataDb, fillTruckForYitongOrder, updateYitongOrderDataDb, sendMessageToQQ } from "@/utils/services"

export default function App() {
  const [loading, setLoading] = useState({count: 0, total: 0})
  const [truckLoading, setTruckLoading] = useState({ count: 0, total: 0, successOrders: [] as string[] })
  const [cookiesEPB, setCookiesEPB] = useState<string | null>(null)

  const mainTask = async () => {
    const cookies = await getCookiesEPB()
    if (!cookies) return false;
    setCookiesEPB(cookies)

    console.log("Scrape yitong orders...")
    const { rows } = await getYitongOrderData(cookiesEPB, {
      page: 1,
      rows: 100,
    })
    // Save yitong order data to database
    if (rows && rows.length > 0) {
      await saveYitongOrderData(
        rows.map((o: any) => ({ ...o, statusTruck: 0, statusTruckEb: 0 }))
      )
    }

    console.log("Fill truck for yitong orders...")
    // Fill truck for yitong orders
    let truckFilled: string[] = []
    const getOrderData = await getYitongOrderDataDb("2")
    console.log("getOrderData", getOrderData.orders)
    if (getOrderData && getOrderData.orders && getOrderData.orders.length > 0) {
      for (let i = 0; i < getOrderData.orders.length; i++) {
        const order = getOrderData.orders[i];
        if (!order.bookingNo) continue;
        // Fetch order data
        const { data } = await fetchOrderData({ page: 1, pageSize: 10, blNo: order.bookingNo })
        console.log("data", data[0]?.order)
        if (data.length === 0 || !data[0]?.order?.trailerCompany) {
          await updateYitongOrderDataDb({
            bookingNo: order?.bookingNo,
            statusTruck: 0,
            statusTruckEb: 2,
          }) // 2: No truck found
          continue
        }

        // Find truck code
        const truckCode = truckData?.find((o: any) => o.id === data[0]?.order?.trailerCompany)
        if (truckCode && truckCode?.value) {
          // Fill truck for yitong order on website
          const resultFill = await fillTruckForYitongOrder(cookiesEPB, {
            truckCode: truckCode?.value,
            bookingNo: order?.bookingNo,
          });
          console.log("resultFill", resultFill);
          if (resultFill?.success === "Y") {
            truckFilled.push(order?.bookingNo);
            const res = await updateOrderData({ blNo: order?.bookingNo });
            await updateYitongOrderDataDb({
              bookingNo: order?.bookingNo,
              statusTruck: 1,
              statusTruckEb: 1,
            })
            console.log("resUpdate", res)
            const message = `${order?.bookingNo}---指定放箱成功`
            const resultSendMessage = await sendMessageToQQ({
              sobids: res?.data?.sBind?.sobids || [],
              message,
            });
            console.log("resultSendMessage", resultSendMessage)
          }
        }
      }
    }

    // Show result on popup and noification
    const resultElement: HTMLElement | null = document.getElementById("result")
    if (resultElement) {
      resultElement.textContent = ""
      resultElement.textContent = `Filled truck for ${truckFilled.length} yitong orders: ${truckFilled.join(", ")}`
    }
    return truckFilled
  }
  useEffect(() => {
    chrome.runtime.onMessage.addListener(async (msg) => {
      if (msg.type === "UPDATE_RESULT") {
        const result = await mainTask()
        console.log("UPDATE_RESULT", result);
      }
      if (msg.type === "LOGIN_AGAIN_EPB") {
        const cookies = await getCookiesEPB()
        if (cookies) setCookiesEPB(cookies)
      }
    })
  }, [])

  useEffect(() => {
    getCookiesEPB().then((cookies) => {
      if (cookies) setCookiesEPB(cookies)
    })
  }, [])

  // Handle scrape button click
  const handleStart = async () => {
    // Get yitong order data
    if (!cookiesEPB) {
      showToast("Please login to the system!", "warning")
      return
    }

    let count = 0
    const getOrderData = await getYitongOrderDataDb('0')
    const { rows, total } = await getYitongOrderData(cookiesEPB, { page: 1, rows: 100 })
    const totalRows = total - (getOrderData?.orders?.length || 0)
    setLoading({ count: 0, total: totalRows })
    if (rows && rows.length > 0) {
      // Save yitong order data to database
      const resultSave = await saveYitongOrderData(
        rows.map((o: any) => ({ ...o, statusTruck: 0, statusTruckEb: 0 }))
      )
      console.log("resultSave", resultSave)
      count += resultSave?.result?.added || 0
      setLoading((prev) => ({
        ...prev,
        count: prev.count + (resultSave?.result?.added || 0),
      }))
    }
    const totalPage = Math.ceil(totalRows / 100)
    for (let i = 2; i <= totalPage; i++) {
      const { rows: rowsTemp } = await getYitongOrderData(cookiesEPB, { page: i, rows: 100 })
      if (rowsTemp && rowsTemp.length > 0) {
        // Save yitong order data to database
        const resultSave = await saveYitongOrderData(
          rowsTemp.map((o: any) => ({ ...o, statusTruck: 0, statusTruckEb: 0 }))
        )
        console.log(`resultSave${i}`, resultSave)
        count += resultSave?.result?.added || 0
        setLoading((prev) => ({ ...prev, count: prev.count + (resultSave?.result?.added || 0) }))
      }
    }
    showToast(`Finish scraped yitong orders`, "success")
    const resultElement: HTMLElement | null = document.getElementById("result")
    if (resultElement) {
      resultElement.textContent = ""
      resultElement.textContent = `Scraped ${count} new orders from yitong!`
    }
    setLoading({ count: 0, total: 0 })
  }

  // Handle truck select for yitong orders on website
  const handleTruck = async () => {
    // const cookies = await getCookiesEPB()
    if (!cookiesEPB) {
      showToast("Please again click button!", "warning")
      return
    }

    let truckFilled: string[] = []
    const getOrderData = await getYitongOrderDataDb('2')
    setTruckLoading({ count: 0, total: getOrderData?.orders?.length || 0, successOrders: [] })
    for (let i = 0; i < getOrderData?.orders?.splice(0, 5)?.length; i++) {
      const order = getOrderData?.orders[i]
      if (!order.bookingNo) {
        setTruckLoading((prev) => ({ ...prev, count: prev.count + 1 }))
        continue
      }
      // Fetch order data
      const { data } = await fetchOrderData({ page: 1, pageSize: 10, blNo: order.bookingNo })
      console.log("data", data[0]?.order)
      if (data.length === 0 || !data[0]?.order?.trailerCompany) {
        setTruckLoading((prev) => ({ ...prev, count: prev.count + 1, successOrders: [] }))
        await updateYitongOrderDataDb({ bookingNo: order?.bookingNo, statusTruck: 0, statusTruckEb: 2 }) // 2: No truck found
        continue
      }

      // Find truck code
      const truckCode = truckData?.find((o: any) => o.id === data[0]?.order?.trailerCompany)
      if (truckCode && truckCode?.value) {
        // Fill truck for yitong order on website
        const resultFill = await fillTruckForYitongOrder(cookiesEPB, { truckCode: truckCode?.value, bookingNo: order?.bookingNo })
        console.log("resultFill", resultFill)
        if (resultFill?.success === 'Y') {
          truckFilled.push(order?.bookingNo)
          const res = await updateOrderData({ blNo: order?.bookingNo?.includes('ONEY') ? order?.bookingNo : 'ONEY' + order?.bookingNo })
          await updateYitongOrderDataDb({ bookingNo: order?.bookingNo, statusTruck: 1, statusTruckEb: 1 }) // 1: Truck filled
          console.log("resUpdate", res)
          const message = `${order?.bookingNo}---指定放箱成功`
          const resultSendMessage = await sendMessageToQQ({ sobids: res?.data?.map((o: any) => o.id.toString()) || [], message })
          console.log("resultSendMessage", resultSendMessage)
          setTruckLoading((prev) => ({ ...prev, count: prev.count + 1, successOrders: [...prev.successOrders, order?.bookingNo] }))
        } else {
          setTruckLoading((prev) => ({ ...prev, count: prev.count + 1, successOrders: prev.successOrders }))
        }
      }
    }

    // Show result on popup and noification
    const resultElement: HTMLElement | null = document.getElementById("result")
    if (resultElement) {
      resultElement.textContent = ""
      resultElement.textContent = `Filled truck for ${truckFilled.length} yitong orders: ${truckFilled.join(", ")}`
    }
    showToast(`Finish fill truck for yitong orders!`, "success")
    setTruckLoading({ count: 0, total: 0, successOrders: [] })
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
          disabled={loading.total > 0}
          text={loading.total > 0 ? `Processing(${loading.count}/${loading.total})...` : "Scrape order"}
          id="start"
          classNameProps={`mt-2 ${loading.total > 0 ? "bg-[#ccc]" : "bg-[#277fbc]"} px-4 py-2`}
        />
        <ButtonComponent
          onClick={handleTruck}
          disabled={truckLoading.total > 0}
          text={truckLoading.total > 0 ? `Processing(${truckLoading.count}/${truckLoading.total})...` : "Truck order"}
          id="truck"
          classNameProps={`mt-2 ${truckLoading.total > 0 ? "bg-[#ccc]" : "bg-[#277fbc]"} px-4 py-2`}
        />
      </div>
      <div className="mt-2">
        {truckLoading.successOrders.length > 0 && `Success orders: ${truckLoading.successOrders.join(", ")}`}
      </div>
      <div id="result" className="mt-1"></div>
    </div>
  )
}