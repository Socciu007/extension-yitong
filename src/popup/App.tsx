import "./App.css"
import ButtonComponent from "@/components/ButtonComponent"
import InputComponent from "@/components/InputComponent"
import { loadTab, delay, decodeCapcha, showToast } from "./scripts"
import axios from "axios"
import { Buffer } from "buffer"
import { useState } from "react"

export default function App() {
  const [blNo, setBlNo] = useState("")
  const [truck, setTruck] = useState("")
  // Handle scrape button click
  const handleStart = async () => {
    if (!blNo || !truck) {
      showToast("Please enter blNo and truck!", "warning")
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

      await chrome.scripting.executeScript({
        target: { tabId: tab.id as number },
        func: async (capchaCode: string) => {
          const capchaCodeInput = document.querySelector("#login2 > table > tbody > tr:nth-child(3) > td:nth-child(1) > input") as HTMLInputElement
          if (capchaCodeInput) capchaCodeInput.value = capchaCode

          const loginBtn = document.querySelector("#btnLogin") as HTMLButtonElement
          if (loginBtn) loginBtn.click()
        },
        args: [capchaCode],
      })
    }

    await delay(1000)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      func: async (blNo: string, truck: string) => {
        const waitFor = <T extends Element>(
          selector: string,
          root: Document | Element = document,
          timeout: number = 10000
        ): Promise<T> => {
          return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
              const el = root.querySelector(selector) as T;
              if (el) {
                clearInterval(timer);
                resolve(el);
              } else if (Date.now() - start > timeout) {
                clearInterval(timer);
                reject(new Error(`Timeout: ${selector}`));
              }
            }, 200);
          });
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
          await delay(1500)

          // 2. Get the iframe
          const iframe = await waitFor<HTMLIFrameElement>("#tabs > div.tabs-panels.tabs-panels-noborder > div:nth-child(2) > div > iframe")
          const doc = iframe.contentDocument as Document | null

          if (!doc) throw new Error("iframe not loaded");

          // 3. input BL
          const blInput = await waitFor<HTMLInputElement>('input[name="param.like.ebw2Booking.bookingNo"]', doc)

          blInput.value = blNo.includes("ONEY")
            ? blNo.replace("ONEY", "")
            : blNo
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

          // 7. choose CA
          const yn = await waitFor<HTMLInputElement>("#chooseCa", doc)
          yn.click()

          // 8. input truck
          const truckInput = await waitFor<HTMLInputElement>("#zdca > div > div > div > div:nth-child(1) > span > input.combo-text.validatebox-text", doc)
          truckInput.value = truck.trim()
          truckInput.dispatchEvent(new Event("input", { bubbles: true }))
          truckInput.dispatchEvent(new Event("change", { bubbles: true }))
          await delay(1000)

          // 9. search truck
          const searchTruck = await waitFor<HTMLInputElement>('input[onclick="queryCarrier()"]', doc)
          searchTruck.click()
          await delay(3000)

          return true
        } catch (err) {
          console.error("ERROR:", err);
          return false;
        }
      },
      args: [blNo, truck],
    })

    await chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      func: async () => {
        try {
          const iframe = document.querySelectorAll(
            "body iframe"
          )[1] as HTMLIFrameElement
          const chooseTruckBtn = iframe.contentDocument?.querySelector(
            "#zdca > div > div > div > div.panel.datagrid > div > div.datagrid-view > div.datagrid-view2 > div.datagrid-body > table > tbody > tr:nth-child(2) > td:nth-child(1) > div > input[type=checkbox]"
          ) as HTMLButtonElement
          if (chooseTruckBtn) chooseTruckBtn.click()

          const nominateBtn = iframe.contentDocument?.querySelector(
            "div.datagrid-toolbar > a > span > span.icon-save"
          ) as HTMLInputElement
          if (nominateBtn) nominateBtn.click()

          const saveBtn = iframe.contentDocument?.querySelector("#bkgCarrierSave") as HTMLInputElement
          console.log("saveBtn", saveBtn)
          // if (saveBtn) saveBtn.click()
        } catch (error) {
          console.error("Error click on the tab info", error)
        }
      }
    })
  }
  return (
    <div className="mb-2">
      <div
        id="notification"
        className="absolute top-[1rem] right-[2rem] p-1 rounded-md shadow-lg"
      ></div>
      <div className="flex gap-2 items-center justify-center">
        <InputComponent
          label="blNo:"
          id="blNo"
          value={blNo}
          onChange={(e) => setBlNo(e.target.value)}
          type="text"
        />
        <InputComponent
          label="Truck:"
          id="truck"
          value={truck}
          onChange={(e) => setTruck(e.target.value)}
          type="text"
        />
        <ButtonComponent
          onClick={handleStart}
          text="Start"
          id="start"
          className=""
        />
      </div>
    </div>
  )
}