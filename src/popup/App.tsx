import "./App.css"
import ButtonComponent from "@/components/ButtonComponent"
import { loadTab, delay, decodeCapcha } from "./scripts"
import axios from "axios"
import { Buffer } from "buffer"

export default function App() {
  // Handle scrape button click
  const handleStart = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    const url = "https://www.eptrade.cn/epb/login/scno_direct_bk.html"

    // Load URL
    await chrome.tabs.update(tab.id, { url })
    // Wait for tab to load
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
          // const loginBtn = document.querySelector("#btnLogin") as HTMLButtonElement
          // if (loginBtn) loginBtn.click()
        } catch (error) {
          console.error("Error login in the page", error)
        }
      },
    })
    await delay(1000)

    const toBase64 = await axios.get(`https://www.eptrade.cn/epb/login/${urlImg}`, { responseType: "arraybuffer" })
    console.log("toBase64", toBase64)
    console.log(
      "toBase64",
      Buffer.from(toBase64.data, "binary").toString("base64")
    );
    const capchaCode = await decodeCapcha(Buffer.from(toBase64.data, "binary").toString("base64"))
    console.log("capchaCode", capchaCode)
    //   if (capchaCode) {
    //     const capchaCodeInput = document.querySelectorAll(
    //       'input[name="ck"]'
    //     )[1] as HTMLInputElement
    //     if (capchaCodeInput) capchaCodeInput.value = capchaCode
    //   }
    // }


    await delay(5000)
  }
  return (
    <div className="mb-2">
      <div id='notification' className="absolute top-[1rem] right-[2rem] p-1 rounded-md shadow-lg"></div>
      <h3 className="text-2xl leading-10">Hello world!</h3>
      <div className="flex gap-2 items-center justify-center">
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
