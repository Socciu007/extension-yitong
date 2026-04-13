import axios from 'axios'

// Handle save EIR data
const saveEirData = async (eirData: { event: string, yard: string, location: string, mode: string, time: string, notes: string }) => {
  const url = 'https://www.dadaex.cn/api/vn/eir/save'
  try {
    const res = await axios.post(url, eirData)
    return res.data
  } catch (error) {
    return error
  }
}

export { saveEirData }