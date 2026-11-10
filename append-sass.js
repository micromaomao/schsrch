const fs = require('fs')
const path = require('path')
let content = fs.readFileSync(path.join(__dirname, 'view', 'layout.sass'), 'utf8')
content += `

.indexcontent
  margin-top: 5px
  font-size: 0.9em
  color: #555
  line-height: 1.4
  padding: 4px
  background-color: #fcfcfc
  border-left: 3px solid #ccc

  .highlight
    background-color: #ffeeb2
    color: #000
    font-weight: bold
    padding: 0px 2px
    border-radius: 2px
`
fs.writeFileSync(path.join(__dirname, 'view', 'layout.sass'), content)
console.log('Appended styles')
