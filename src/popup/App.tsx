import "./App.css"
import ButtonComponent from "@/components/ButtonComponent"
import TableComponent from "@/components/TableComponent"
import { loadTab, delay, decodeCapcha, showToast } from "./scripts"
import axios from "axios"
import { Buffer } from "buffer"
import { useState, useEffect } from "react"
import { fetchOrderData, fetchTruckData, getYitongOrderData, saveYitongOrderData, getYitongOrderDataDb } from "@/utils/services"

export default function App() {
  const [orders, setOrders] = useState<{ data: any[], total: number, pageCurrent: number }>({ data: [], total: 0, pageCurrent: 1 })
  const [trucks, setTrucks] = useState<{ id: string, name: string, code?: string, address?: string }[]>([])
  const [loading, setLoading] = useState(0)
  const [selectedOrders, setSelectedOrders] = useState<any[]>([])
  const columns = [
    {
      key: "id",
      title: "",
      render: (row: any) => {
        return (
          <div className="text-center py-1 px-2">
            <input
              disabled={!row.truck}
              type="checkbox"
              onChange={() => {
                setSelectedOrders(selectedOrders.map((o: any) => ({ ...o, selected: o.blNo === row.blNo ? !o.selected : o.selected })))
              }}
            />
          </div>
        )
      },
    },
    {
      key: "blNo",
      title: "B/L No.",
      render: (row: any) => <span className="py-1 px-2">{row.blNo}</span>,
    },
    {
      key: "truck",
      title: "Truck",
      render: (row: any) => {
        return (
          <div className="text-center py-1 px-2">
            <select
              className="border-1 border-gray-300 rounded-md p-1"
              disabled
              value={selectedOrders?.find((o: any) => o.blNo === row.blNo)?.truck}
              onChange={(e) => setSelectedOrders(selectedOrders.map((o: any) => ({...o, truck: o.blNo === row.blNo ? e.target.value : o.truck })))}
            >
              {trucks.map((t: any) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )
      },
    },
  ]

  // Fetch order and truck data
  // useEffect(() => {
  //   fetchOrderData({ page: 1, pageSize: 10 }).then((data) => {
  //     const orders = data.data.map((o: any) => ({
  //       blNo: o.order.blNo,
  //       id: o.id,
  //       truck: o?.order?.trailerCom?.name || "",
  //     }))
  //     setOrders({
  //       data: orders,
  //       total: data.total,
  //       pageCurrent: 1,
  //     })
  //     setSelectedOrders(orders.map((o: any) => ({ ...o, selected: false })))
  //   }).catch((error) => {
  //     console.error("Error fetching order data", error)
  //   })
  //   fetchTruckData().then((data) => {
  //     setTrucks([{ id: "0", name: "-" }, ...data.data])
  //   }).catch((error) => {
  //     console.error("Error fetching truck data", error)
  //   })
  // }, [])
  // Handle scrape button click
  const handleStart = async () => {
    // Handle data
    setLoading(1)
    // const dataFilter = selectedOrders.filter(
    //   (o: any) => o.selected && o.truck
    // )
    // const data = dataFilter.map((o: any) => ({
    //     blNo: o.blNo?.includes("ONEY")
    //       ? o.blNo?.replace("ONEY", "")
    //       : o.blNo?.trim(),
    //     truck: o.truck,
    //     trailerCompany: trucks.find((t: any) => t.name.includes(o.truck))?.id
    //   }))
    // console.log("data", data)
    // if (!data || data.length === 0) {
    //   showToast("Please select at least one sea order!", "warning")
    //   setLoading(0)
    //   return
    // }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    const url1 = "https://www.eptrade.cn/epb/login/scno_direct_bk.html"
    const url = "https://www.eptrade.cn/epb/index.jsp"

    // Load URL
    await chrome.tabs.update(tab.id, { url })
    // Wait for tab to load
    // await loadTab(tab)
    // Check url 
    const currentUrl = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (currentUrl[0]?.url?.includes('login')) {
      await chrome.tabs.update(tab.id, { url: url1 })
      await loadTab(tab)
      // Action Login
      const urlImg = await chrome.scripting.executeScript({
        target: { tabId: tab.id as number },
        func: async () => {
          try {
            console.log("Start action login....")
            const tabLogin = document.querySelectorAll(".tabs-title") as NodeListOf<Element>
            if (tabLogin) (tabLogin[1] as HTMLAnchorElement).click()
            
            const username = document.querySelector("#user_id") as HTMLInputElement
            if (username) username.value = "CN122887"
            const password = document.querySelector("#user_pwd" ) as HTMLInputElement
            if (password) password.value = "imND3I26"
            const capchaCodeImg = document.querySelector("#safecode") as HTMLButtonElement
            if (capchaCodeImg) {
              const urlImg = capchaCodeImg.getAttribute("src")
              return urlImg
            }
          } catch (error) {
            console.error("Error login in the page", error)
          }
        },
      })
      await delay(1000)
  
      // Decode capcha code
      const toBase64 = await axios.get(`https://www.eptrade.cn/epb/login/${urlImg[0].result}`, { responseType: "arraybuffer" })
      const capchaCode = await decodeCapcha(
        Buffer.from(toBase64.data, "binary").toString("base64")
      )
      if (!capchaCode) {
        showToast("Please login to the system!", "warning")
        return
      }

      const resultLogin = await chrome.scripting.executeScript({
        target: { tabId: tab.id as number },
        func: async (capchaCode: string) => {
          try {
            const capchaCodeInput = document.querySelector("#login2 > table > tbody > tr:nth-child(3) > td:nth-child(1) > input") as HTMLInputElement
            if (capchaCodeInput) capchaCodeInput.value = capchaCode

            const loginBtn = document.querySelector("#btnLogin") as HTMLButtonElement
            if (loginBtn) loginBtn.click()
            return true
          } catch (error) {
            console.error("Error login in the page", error)
            return false
          }
        },
        args: [capchaCode],
      })
      console.log("resultLogin", resultLogin)
      if (!resultLogin[0].result) {
        showToast("Please start again or login to the system!", "warning")
        return
      }
    }

    // Wait for tab to load
    await loadTab(tab)

    // Get header cookie from website
    const headerCookie = await chrome.cookies.getAll({
      url: "https://www.eptrade.cn/epb",
    })

    // Get yitong order data
    const cookies = headerCookie.map((c: any) => `${c.name}=${c.value}`).join('; ')
    let rowsData = []
    const { rows, total } = await getYitongOrderData(cookies, { page: 1, rows: 100 })
    rowsData.push(...rows)
    const totalPage = Math.ceil(total / 100)
    // for (let i = 2; i <= totalPage; i++) {
    //   const { rows: rowsTemp } = await getYitongOrderData(cookies, { page: i, rows: 20 })
    //   if (rowsTemp && rowsTemp.length > 0) rowsData.push(...rowsTemp)
    // }

    // Save yitong order data to database
    const resultSave = await saveYitongOrderData(rows.map((o: any) => ({...o, statusTruck: 0})))
    console.log("resultSave", resultSave)

    showToast("Finish all sea orders", "success")
    setLoading(0)
  }

  // Handle onchange page of orders
  // const handleChangePage = (page: number) => {
  //   fetchOrderData({ page: page, pageSize: 10 }).then((data) => {
  //     const orders = data.data.map((o: any) => ({
  //       blNo: o.order.blNo,
  //       id: o.id,
  //       truck: o?.order?.trailerCom?.name || "",
  //     }))
  //     setOrders({ data: orders, total: data.total, pageCurrent: page })
  //     setSelectedOrders(orders.map((o: any) => ({ ...o, selected: false })))
  //   }).catch((error) => {
  //     console.error("Error fetching order data", error)
  //   })
  // }
  return (
    <div className="mb-2">
      <div
        id="notification"
        className="absolute top-[1rem] right-[2rem] p-1 rounded-md shadow-lg"
      ></div>
      <div className="text-center text-2xl font-bold mb-2 text-[#99BBE8]">
        YITONG EPB
      </div>
      <div className="flex flex-col">
        {/* {!!orders?.data?.length && loading === 0 ? (
          <TableComponent
            columns={columns}
            data={orders?.data}
            page={orders?.pageCurrent}
            pageSize={10}
            total={orders?.total}
            onPageChange={(page) => handleChangePage(page)}
          />
        ) : (
          `Loading(${loading}/10)...`
        )} */}
        <ButtonComponent
          onClick={handleStart}
          text="Start"
          id="start"
          classNameProps="mt-2 bg-[#277fbc] px-4 py-2"
        />
      </div>
    </div>
  )
}