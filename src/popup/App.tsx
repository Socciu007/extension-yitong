import "./App.css"
import ButtonComponent from "@/components/ButtonComponent"
import TableComponent from "@/components/TableComponent"
import { loadTab, delay, decodeCapcha, showToast } from "./scripts"
import axios from "axios"
import { Buffer } from "buffer"
import { useState, useEffect } from "react"
import { fetchOrderData, fetchTruckData } from "@/utils/services"

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
  useEffect(() => {
    fetchOrderData({ page: 1, pageSize: 10 }).then((data) => {
      const orders = data.data.map((o: any) => ({
        blNo: o.order.blNo,
        id: o.id,
        truck: o?.order?.trailerCom?.name || "",
      }))
      setOrders({
        data: orders,
        total: data.total,
        pageCurrent: 1,
      })
      setSelectedOrders(orders.map((o: any) => ({ ...o, selected: false })))
    }).catch((error) => {
      console.error("Error fetching order data", error)
    })
    fetchTruckData().then((data) => {
      setTrucks([{ id: "0", name: "-" }, ...data.data])
    }).catch((error) => {
      console.error("Error fetching truck data", error)
    })
  }, [])
  // Handle scrape button click
  const handleStart = async () => {
    // Handle data
    setLoading(1)
    const dataFilter = selectedOrders.filter(
      (o: any) => o.selected && o.truck
    )
    const data = dataFilter.map((o: any) => ({
        blNo: o.blNo?.includes("ONEY")
          ? o.blNo?.replace("ONEY", "")
          : o.blNo?.trim(),
        truck: o.truck,
        trailerCompany: trucks.find((t: any) => t.name.includes(o.truck))?.id
      }))
    console.log("data", data)
    if (!data || data.length === 0) {
      showToast("Please select at least one sea order!", "warning")
      setLoading(0)
      return
    }

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

    for (let i = 0; i < data.length; i++) {
      setLoading(i + 1)
      const item = data[i]
      await delay(1000)
      // Choose order
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id as number },
        func: async (blNo: string, truck: string) => {
          const waitFor = <T extends Element>(
            selector: string,
            root: Document | Element = document,
            timeout: number = 10000
          ): Promise<T> => {
            return new Promise((resolve, reject) => {
              const start = Date.now()
              const timer = setInterval(() => {
                const el = root.querySelector(selector) as T
                if (el) {
                  clearInterval(timer)
                  resolve(el)
                } else if (Date.now() - start > timeout) {
                  clearInterval(timer)
                  reject(new Error(`Timeout: ${selector}`))
                }
              }, 200)
            })
          }
          const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  
          try {
            // 1. click tab
            console.clear()
            console.log("Start click tab...")
            const tabInfo = await waitFor<HTMLAnchorElement>(
              'div > div.panel-body.accordion-body > ul > li:nth-child(2) > div > a[target="mainFrame"]'
            )
            tabInfo.click()
            await delay(2000)
  
            // 2. Get the iframe
            const iframe = await waitFor<HTMLIFrameElement>("#tabs > div.tabs-panels.tabs-panels-noborder > div:nth-child(2) > div > iframe")
            const doc = iframe.contentDocument as Document | null
  
            if (!doc) throw new Error("iframe not loaded")
  
            // 3. input BL
            const blInput = await waitFor<HTMLInputElement>('input[name="param.like.ebw2Booking.bookingNo"]', doc)
  
            blInput.value = blNo
            blInput.dispatchEvent(new Event("input", { bubbles: true }))
            blInput.dispatchEvent(new Event("change", { bubbles: true }))
  
            // 4. search
            const searchBtn = await waitFor<HTMLInputElement>('input[onclick="query(\'cdusform\',\'book_list\')"]', doc)
            searchBtn.click()
            await delay(4000)
  
            // 5. checkbox
            const checkbox = await waitFor<HTMLInputElement>(
              "body > div.text > div > div.datagrid-wrap.panel-body > div.datagrid-view > div.datagrid-view2 > div.datagrid-body > table > tbody > tr > td:nth-child(1) input",
              doc
            )
            checkbox.click()
  
            // 6. edit
            const editBtn = await waitFor<HTMLElement>(".datagrid-toolbar a:nth-child(9)", doc)
            editBtn.click()
            await delay(1000)

            // 7. if orrder not edit
            const notEdit = await doc.querySelector(
              "div.messager-body.panel-body.panel-body-noborder.window-body > div.messager-button > a > span > span",
            ) as HTMLAnchorElement
            if (notEdit) {
              notEdit.click()
              return false
            }
  
            // 7. choose CA
            const yn = await waitFor<HTMLInputElement>("#chooseCa", doc)
            yn.click()
            await delay(1000)
  
            // 8. input truck
            const truckInput = await waitFor<HTMLInputElement>("#zdca > div > div > div > div:nth-child(1) > span > input.combo-text.validatebox-text", doc)
            truckInput.value = truck.trim()
            truckInput.dispatchEvent(new Event("input", { bubbles: true }))
            truckInput.dispatchEvent(new Event("change", { bubbles: true }))
            await delay(1000)
  
            // 9. search truck
            const searchTruck = await waitFor<HTMLInputElement>('input[onclick="queryCarrier()"]', doc)
            console.log("searchTruck", searchTruck)
            searchTruck.click()
            await delay(3000)
  
            return true
          } catch (err) {
            console.error("ERROR:", err)
            return false
          }
        },
        args: [item.blNo, item.truck],
      })
      await delay(1000)
  
      // Choose truck for order
      if (result[0].result) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id as number },
          func: async () => {
            const waitFor = <T extends Element>(
              selector: string,
              root: Document | Element = document,
              timeout: number = 10000
            ): Promise<T> => {
              return new Promise((resolve, reject) => {
                const start = Date.now()
                const timer = setInterval(() => {
                  const el = root.querySelector(selector) as T
                  if (el) {
                    clearInterval(timer)
                    resolve(el)
                  } else if (Date.now() - start > timeout) {
                    clearInterval(timer)
                    reject(new Error(`Timeout: ${selector}`))
                  }
                }, 200)
              })
            }
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
            try {
              const iframe = await waitFor<HTMLIFrameElement>('body iframe[name="mainFrame"]')
              const doc = iframe.contentDocument as Document | null
              if (!doc) throw new Error("iframe not loaded")
              const chooseTruckBtn = await waitFor<HTMLInputElement>(
                "#zdca > div > div > div > div.panel.datagrid > div > div.datagrid-view > div.datagrid-view2 > div.datagrid-body > table > tbody > tr:nth-child(2) > td:nth-child(1) > div > input[type=checkbox]",
                doc
              )
              console.log("chooseTruckBtn", chooseTruckBtn)
              if (chooseTruckBtn) chooseTruckBtn.click()

              const nominateBtn = await waitFor<HTMLButtonElement>(
                "div.datagrid-toolbar > a > span > span.icon-save",
                doc
              )
              console.log("nominateBtn", nominateBtn)
              if (nominateBtn) nominateBtn.click()
              await delay(2000)

              // 7. if orrder not edit
              const notEdit = doc.querySelector(
                "div.messager-body.panel-body.panel-body-noborder.window-body > div.messager-button > a > span > span",
              ) as HTMLAnchorElement
              console.log("notEdit", notEdit)
              if (notEdit) notEdit.click()

              const saveBtn = doc.querySelector("#bkgCarrierSave") as HTMLInputElement
              const closeBtn = doc.querySelector("#tabClose") as HTMLInputElement
              if (closeBtn) closeBtn.click()
              console.log("saveBtn", saveBtn)
              console.log("closeBtn", closeBtn)
              // if (saveBtn) saveBtn.click()
              return true
            } catch (error) {
              console.error("Error click on the tab info", error)
              return false
            }
          }
        })
        await delay(1000)
        // Reset the form
        await chrome.scripting.executeScript({
          target: { tabId: tab.id as number },
          func: async () => {
            try {
              const iframe = document.querySelector(
                "#tabs > div.tabs-panels.tabs-panels-noborder > div:nth-child(2) > div > iframe"
              ) as HTMLIFrameElement
              const doc = iframe.contentDocument as Document | null
              if (!doc) throw new Error("iframe not loaded")

              const resetBtn = doc.querySelector('[type="reset"]')
              console.log("resetBtn", resetBtn)
              if (resetBtn) (resetBtn as HTMLButtonElement).click()
              return true
            } catch (error) {
              console.error("Error reset the form", error)
              return false
            }
          }
        })
      }
      console.log("Finish one order / truck", item.blNo)
    }

    await fetchOrderData({ page: orders.pageCurrent, pageSize: 10 }).then((data) => {
      const orders = data.data.map((o: any) => ({
        blNo: o.order.blNo,
        id: o.id,
        truck: o?.order?.trailerCom?.name || "",
      }))
      setOrders({ data: orders, total: data.total, pageCurrent: orders.pageCurrent })
      setSelectedOrders(orders.map((o: any) => ({ ...o, selected: false })))
    }).catch((error) => {
      console.error("Error fetching order data", error)
    })
    showToast("Finish all sea orders", "success")
    setLoading(0)
  }

  // Handle onchange page of orders
  const handleChangePage = (page: number) => {
    fetchOrderData({ page: page, pageSize: 10 }).then((data) => {
      const orders = data.data.map((o: any) => ({
        blNo: o.order.blNo,
        id: o.id,
        truck: o?.order?.trailerCom?.name || "",
      }))
      setOrders({ data: orders, total: data.total, pageCurrent: page })
      setSelectedOrders(orders.map((o: any) => ({ ...o, selected: false })))
    }).catch((error) => {
      console.error("Error fetching order data", error)
    })
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
      <div className="flex flex-col">
        {!!orders?.data?.length && loading === 0 ? (
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
        )}
        <ButtonComponent
          onClick={handleStart}
          text="Start"
          id="start"
          classNameProps="mt-2 bg-[#277fbc] px-4 py-2"
        />
      </div>
    </div>
  );
}