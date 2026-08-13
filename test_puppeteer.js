const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/search?query=concentration')
  await page.waitForSelector('.chip')
  const chipStyles = await page.evaluate(() => {
    const chip = document.querySelector('.chips-row .chip')
    if (!chip) return null
    const styles = window.getComputedStyle(chip)
    return {
      background: styles.background,
      backgroundColor: styles.backgroundColor,
      border: styles.border,
      height: styles.height,
      overflow: styles.overflow,
      padding: styles.padding,
      fontSize: styles.fontSize,
      color: styles.color,
      lineHeight: styles.lineHeight
    }
  })
  console.log('CHIP STYLES:', chipStyles)
  const setStyles = await page.evaluate(() => {
    const set = document.querySelector('.set')
    const styles = window.getComputedStyle(set)
    return {
      border: styles.border,
      borderRadius: styles.borderRadius,
      padding: styles.padding,
      backgroundColor: styles.backgroundColor
    }
  })
  console.log('SET STYLES:', setStyles)
  await browser.close()
})()
