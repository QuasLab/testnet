export function getJson(res: Response) {
  if (res.status != 200)
    return res.text().then((text) => {
      throw new Error(`<b>Server returns ${res.status}</b><br/> ${text}`)
    })
  return res.json()
}
