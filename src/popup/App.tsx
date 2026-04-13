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
    const url = "https://www.eptrade.cn/epb/login/scno_direct_bk.html"

    // Load URL
    // await chrome.tabs.update(tab.id, { url })
    // Wait for tab to load
    // await loadTab(tab)

    // Action Login
    // const urlImg = await chrome.scripting.executeScript({
    //   target: { tabId: tab.id as number },
    //   func: async () => {
    //     try {
    //       console.log("Start action login....")
    //       const tabLogin = document.querySelectorAll(".tabs-title") as NodeListOf<Element>
    //       if (tabLogin) (tabLogin[1] as HTMLAnchorElement).click()
          
    //       const username = document.querySelector("#user_id") as HTMLInputElement
    //       if (username) username.value = "CN122887"
    //       const password = document.querySelector("#user_pwd" ) as HTMLInputElement
    //       if (password) password.value = "imND3I26"
    //       const capchaCodeImg = document.querySelector("#safecode") as HTMLButtonElement
    //       if (capchaCodeImg) {
    //         const urlImg = capchaCodeImg.getAttribute("src")
    //         return urlImg
    //       }
    //       // const loginBtn = document.querySelector("#btnLogin") as HTMLButtonElement
    //       // if (loginBtn) loginBtn.click()
    //     } catch (error) {
    //       console.error("Error login in the page", error)
    //     }
    //   },
    // })
    // await delay(1000)

    // const toBase64 = await axios.get(`https://www.eptrade.cn/epb/login/${urlImg}`, { responseType: "arraybuffer" })
    // console.log(
    //   "toBase64",
    //   Buffer.from(toBase64.data, "binary").toString()
    // )
    // const capchaCode = await decodeCapcha(
    //   Buffer.from(toBase64.data, "binary").toString("base64")
    // )
    // console.log("capchaCode", capchaCode)
    await delay(1000)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      func: async (blNo, truck) => {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        try {
          const tabInfo = document.querySelectorAll('a[target="mainFrame"]')[1] as HTMLAnchorElement
          if (tabInfo) tabInfo.click()
          await delay(2000)
          
          const iframe = document.querySelectorAll("body iframe")[1] as HTMLIFrameElement
          if (iframe) {
            const blNoInput = iframe.contentDocument?.querySelector('input[name="param.like.ebw2Booking.bookingNo"]') as HTMLInputElement
            if (blNoInput) {
              blNoInput.value = blNo.includes('ONEY') ? blNo.replace('ONEY', '') : blNo
              blNoInput.dispatchEvent(new Event("input", { bubbles: true }))
              blNoInput.dispatchEvent(new Event("change", { bubbles: true }))
            }
            
            const searchBtn = iframe.contentDocument?.querySelector("[onclick=\"query('cdusform','book_list')\"]") as HTMLButtonElement
            if (searchBtn) searchBtn.click()
            await delay(2000)
            
            const chooseBtn = iframe.contentDocument?.querySelector(
              "body > div.text > div > div.datagrid-wrap.panel-body > div.datagrid-view > div.datagrid-view2 > div.datagrid-body > table > tbody > tr > td:nth-child(1) > div > input[type=checkbox]"
            ) as HTMLButtonElement
            if (chooseBtn) chooseBtn.click()
            
            const editBtn =  iframe.contentDocument?.querySelector(
              "body > div.text > div > div.datagrid-wrap.panel-body > div.datagrid-toolbar > a:nth-child(9) > span > span"
            ) as HTMLButtonElement
            if (editBtn) editBtn.click()
            
            const yn = iframe.contentDocument?.querySelector("#chooseCa") as HTMLInputElement
            if (yn) yn.click()
            
            const truckInput = iframe.contentDocument?.querySelector("div:nth-child(1) > span > input.combo-text.validatebox-text") as HTMLInputElement
            if (truckInput) truckInput.value = truck.trim() as string
            if (truckInput) truckInput.dispatchEvent(new Event("input", { bubbles: true }))
            if (truckInput) truckInput.dispatchEvent(new Event("change", { bubbles: true }))
            const searchTruck = iframe.contentDocument?.querySelector(
              'input[onclick="queryCarrier()"]'
            ) as HTMLInputElement
            if (searchTruck) searchTruck.click()
          }
        } catch (error) {
          console.error("Error click on the tab info", error)
        }
      },
      args: [blNo, truck]
    })

    await delay(3000)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      func: async () => {
        try {
          const iframe = document.querySelectorAll(
            "body iframe"
          )[1] as HTMLIFrameElement
          const chooseTruckBtn = iframe.contentDocument?.querySelector(
            "div.datagrid-body > table > tbody > tr:nth-child(2) > td:nth-child(1) > div > input[type=checkbox]"
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
