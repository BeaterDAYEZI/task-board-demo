// 用法：node parse-xlsx.cjs <源文件.xlsx> <输出.json>
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const file = process.argv[2]
const outFile = process.argv[3] || path.join(__dirname, 'parsed.json')

if (!file) {
  console.error('请提供要解析的 xlsx 文件路径')
  process.exit(1)
}

const wb = XLSX.readFile(file)
const data = {}
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
  data[name] = rows
}
fs.writeFileSync(outFile, JSON.stringify(data, null, 1), 'utf8')
console.log('OK ->', outFile)
console.log('sheets:', Object.keys(data).map(k => `${k}(${data[k].length} rows)`).join(', '))
