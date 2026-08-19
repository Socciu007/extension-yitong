import "./App.css"
import truckData from "@/mockdata/truckData.json"
import ButtonComponent from "@/components/ButtonComponent"
import { showToast, getCookiesEPB } from "./scripts"
import { useState, useEffect } from "react"
import {
  updateOrderData,
  getYitongOrderData,
  saveYitongOrderData,
  getYitongOrderDataDb,
  fillTruckForYitongOrder,
  updateYitongOrderDataDb,
  sendMessageToQQ,
  getOrderInEb,
  importOrderToYitong,
  sendMail,
  getInformationTruckFromEb,
} from "@/utils/services"

export default function App() {
  const [loading, setLoading] = useState({count: 0, total: 0})
  const [truckLoading, setTruckLoading] = useState({ count: 0, total: 0, successOrders: [] as string[] })
  const [cookiesEPB, setCookiesEPB] = useState<string | null>(null)

  const mainTask = async () => {
    const cookies = await getCookiesEPB()
    if (!cookies) return false;
    setCookiesEPB(cookies)

    const { rows } = await getYitongOrderData(cookiesEPB, {
      page: 1,
      rows: 100,
    })
    // Save yitong order data to database
    if (rows && rows.length > 0) {
      const resultSave = await saveYitongOrderData(
        rows.map((o: any) => ({ ...o, statusTruck: 0, statusTruckEb: 0 }))
      )
      console.log("Save yitong order data to vn2", resultSave);
    }

    // Fill truck for yitong orders
    let truckFilled: string[] = []
    const getOrderData = await getYitongOrderDataDb("2")
    if (getOrderData && getOrderData.orders && getOrderData.orders.length > 0) {
      const ordersYitong = getOrderData.orders.map((o: any) => o.bookingNo)
      const ordersEb = JSON.stringify(ordersYitong)

      const resInfoTruck = await getInformationTruckFromEb(ordersEb)
      console.log("resInfoTruck", resInfoTruck);
      if (resInfoTruck.status !== 1 || resInfoTruck.data.length === 0) return truckFilled;

      for (let i = 0; i < resInfoTruck.data.length; i++) {
        const truckInfo = resInfoTruck.data[i];
        const idTruck = truckInfo?.trailerCom?.id || truckInfo?.trailerCompany;

        // Find truck code
        const truckCode = truckData?.find((o: any) => o.id === idTruck);
        if (truckCode && truckCode?.value) {
          // Fill truck for yitong order on website
          const resultFill = await fillTruckForYitongOrder(cookiesEPB, {
            truckCode: truckCode?.value,
            bookingNo: truckInfo?.blNo?.includes('ONEY') ? truckInfo?.blNo?.slice(4) : truckInfo?.blNo,
          });
          console.log("resultFillWhenAutoTruck", resultFill);
          if (resultFill?.success === "Y") {
            truckFilled.push(truckInfo?.blNo);
            const res = await updateOrderData({ blNo: truckInfo?.blNo });
            await updateYitongOrderDataDb({
              bookingNo: truckInfo?.blNo?.includes('ONEY') ? truckInfo?.blNo?.slice(4) : truckInfo?.blNo,
              statusTruck: 1,
              statusTruckEb: 1,
            });
            // Send mail to admin
            await sendMail({
              subject: `[${truckInfo?.blNo}]-填写进亿通系统`,
              text: "填写进亿通系统-成功.",
              to: "904288354@qq.com",
            });
            // Send message to QQ
            console.log("Result update yitong order main task", res);
            const message = `${truckInfo?.blNo}---指定放箱成功`;
            await sendMessageToQQ({
              sobids: res?.data?.sBind?.sobids || [],
              message,
            });
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

  const syncOrderEbWithYitong = async () => {
    if (!cookiesEPB) {
      const cookies = await getCookiesEPB()
      if (!cookies) return false;
      setCookiesEPB(cookies)
    }

    const result = await getOrderInEb()
    console.log("result", result);

    if (result?.data && result?.data?.length > 0) {
      for (let i = 0; i < result?.data?.length; i++) {
        const { blNo, appointNub } = result?.data[i];
        // Import order to yitong
        const resultImport = await importOrderToYitong(cookiesEPB, {
          blNo: blNo,
          appointNub: appointNub,
        })

        if (resultImport?.success === "Y") {
          await updateOrderData({
            blNo: blNo.includes("ONEY")
              ? blNo
              : "ONEY" + blNo,
            yitongOrder: 1,
          });
        }
      }
    }

    // Get yitong order data
    const { rows } = await getYitongOrderData(cookiesEPB, {
      page: 1,
      rows: 100,
    });
    if (rows && rows.length > 0) {
      // Save yitong order data to database
      const resultSave = await saveYitongOrderData(rows.map((o: any) => ({ ...o, statusTruck: 0, statusTruckEb: 0 })));
      return resultSave;
    }
    return false;
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
      if (msg.type === "SYNC_ORDER_EB_WITH_YITONG") {
        const result = await syncOrderEbWithYitong()
        console.log("SYNC_ORDER_EB_WITH_YITONG", result);
      }
      if (msg.type === "FETCH_VN_EIR_ORDER_1_MONTH" && msg.data && msg.data.length > 0) {
        // Read filled blNos once before the loop to skip already-processed orders
        const stored = await chrome.storage.local.get("filledTruckBlNos");
        const storedMailFailed = await chrome.storage.local.get("mailFailedBlNos");
        const mailFailedBlNoSet = new Set<string>(Array.isArray(storedMailFailed.mailFailedBlNos) ? storedMailFailed.mailFailedBlNos : []);
        const filledBlNoSet = new Set<string>(
          Array.isArray(stored.filledTruckBlNos) ? stored.filledTruckBlNos : []
        );
        for (let i = 0; i < msg.data.length; i++) {
          const order = msg.data[i];
          if (!order.blNo || !order.trailerCompany) continue;
          // Skip if this blNo has already been filled successfully
          if (filledBlNoSet.has(order.blNo)) continue;

          // Find truck code
          const truckCode = truckData?.find((o: any) => o.id === order.trailerCompany);
          if (!truckCode || !truckCode?.value) continue;

          // Fill truck for yitong order on website
          const resultFill = await fillTruckForYitongOrder(cookiesEPB, {
            truckCode: truckCode?.value,
            bookingNo: order.blNo.includes("ONEY") ? order.blNo.slice(4) : order.blNo,
          });
          console.log("Fill yitong order", resultFill);
          if (resultFill?.success === "Y") {
            const res = await updateOrderData({
              blNo: order?.blNo?.includes("ONEY")
                ? order?.blNo
                : "ONEY" + order?.blNo,
            });
            await updateYitongOrderDataDb({
              bookingNo: order?.blNo,
              statusTruck: 1,
              statusTruckEb: 1,
            });

            // Save blNo of successfully filled truck to local storage
            if (!filledBlNoSet.has(order.blNo)) {
              filledBlNoSet.add(order.blNo);
              await chrome.storage.local.set({
                filledTruckBlNos: Array.from(filledBlNoSet),
              });
            }
            console.log("Result update yitong order", res);

            // Send mail to admin
            await sendMail({
              subject: `[${order?.blNo}]-填写进亿通系统`,
              text: "填写进亿通系统-成功.",
              to: "904288354@qq.com",
            });

            // Send message to QQ
            const message = `${order?.blNo}---指定放箱成功`;
            await sendMessageToQQ({
              sobids: res?.data?.map((o: any) => o.id.toString()) || [],
              message,
            });
          } else {
            // Send mail
            if (!mailFailedBlNoSet.has(order.blNo)) {
              mailFailedBlNoSet.add(order.blNo);
              await sendMail({
                subject: `[${order?.blNo}]-填写进亿通系统`,
                text: "填写进亿通系统-失败",
                to: "904288354@qq.com",
              });
              await chrome.storage.local.set({
                mailFailedBlNos: Array.from(mailFailedBlNoSet),
              });
            }
          }
        }
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
      console.log("Save yitong order data to vn2", resultSave);
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
        console.log("Save yitong order data to vn2", resultSave);
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
    const ordersYitong: string[] = getOrderData.orders.map((o: any) => o.bookingNo)
    const ordersEb = JSON.stringify(ordersYitong)
    const resInfoTruck = await getInformationTruckFromEb(ordersEb)
    console.log("resInfoTruck", resInfoTruck);
    if (resInfoTruck.status !== 1 || resInfoTruck.data.length === 0) return truckFilled;

    for (let i = 0; i < resInfoTruck.data.length; i++) {
      const truckInfo = resInfoTruck.data[i];
      const idTruck = truckInfo?.trailerCom?.id || truckInfo?.trailerCompany;

      // Find truck code
      const truckCode = truckData?.find((o: any) => o.id === idTruck);
      if (truckCode && truckCode?.value) {
        // Fill truck for yitong order on website
        const resultFill = await fillTruckForYitongOrder(cookiesEPB, {
          truckCode: truckCode?.value,
          bookingNo: truckInfo?.blNo?.includes("ONEY")
            ? truckInfo?.blNo?.slice(4)
            : truckInfo?.blNo,
        });
        console.log("resultFillWhenActionTruck", resultFill)
        if (resultFill?.success === 'Y') {
          truckFilled.push(truckInfo?.blNo)
          const res = await updateOrderData({ blNo: truckInfo?.blNo })
          await updateYitongOrderDataDb({ bookingNo: truckInfo?.blNo?.includes('ONEY') ? truckInfo?.blNo?.slice(4) : truckInfo?.blNo, statusTruck: 1, statusTruckEb: 1 }) // 1: Truck filled
          const message = `${truckInfo?.blNo}---指定放箱成功`
          await sendMessageToQQ({ sobids: res?.data?.map((o: any) => o.id.toString()) || [], message })
          setTruckLoading((prev) => ({ ...prev, count: prev.count + 1, successOrders: [...prev.successOrders, truckInfo?.blNo] }))
        } else {
          setTruckLoading((prev) => ({ ...prev, count: prev.count + 1 }))
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