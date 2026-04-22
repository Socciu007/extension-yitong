import axios from 'axios'

// Fetch truck data
const fetchTruckData = async () => {
  const url = 'http://localhost:3001/vn/yitong/truckCompany'
  // const url2 = 'https://www.dadaex.cn/api/vn/yitong/truckCompany'
  try {
    const res = await axios.get(url)
    return res.data
  } catch (error) {
    return error
  }
}

// Fetch order data for ONE company
const fetchOrderData = async ({page, pageSize}: {page: number, pageSize: number}) => {
  const url = `http://localhost:3001/vn/eir/order?page=${page}&pageSize=${pageSize}&shipCompany=30`
  // const url2 = 'https://www.dadaex.cn/api/vn/eir/order'
  try {
    const res = await axios.get(url)
    return res.data
  } catch (error) {
    return error
  }
}

// Update order data
const updateOrderData = async ({blNo, trailerCompany}: {blNo: string, trailerCompany: number}) => {
  const url = 'http://localhost:3001/vn/yitong/truckCompany'
  try {
    const data = {
      blNo,
      trailerCompany,
    }
    const res = await axios.patch(url, data)
    return res.data
  } catch (error) {
    return error
  }
}

export { fetchTruckData, fetchOrderData, updateOrderData }