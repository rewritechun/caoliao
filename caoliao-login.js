const { chromium } = require('playwright');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  try {
    console.log(`[1/6] 登录草料二维码...`);
    await page.goto('https://user.cli.im/login');
    await page.fill('input[placeholder="请输入手机号"]', process.env.CAOLIAO_USERNAME);
    await page.fill('input[placeholder="请输入密码"]', process.env.CAOLIAO_PASSWORD);
    await page.click('xpath=//*[@id="login-btn"]');
    await page.waitForURL('**/dashboard');

    // 关闭弹窗（可选）
    try {
      const knowBtn = await page.waitForSelector('//button[contains(text(),"我知道了")]', { timeout: 3000 });
      await knowBtn.click({ force: true });
    } catch {}

    console.log(`[2/6] 点击交接班登记的全部数据链接...`);
    await page.click('xpath=//*[@id="recentUpdateBlock"]/div/div[2]/div[1]/div[2]/div[1]/div[2]/div[2]/div[2]/div[2]/div[2]/div[2]/div/span[8]');
    await page.waitForSelector('text=交接班留言');

    console.log(`[3/6] 提取早班与晚班留言...`);
    const records = await page.$$('div:has-text("交接班留言")');
    let early = null, late = null;

    for (const record of records) {
      const textContent = await record.innerText();
      if (!textContent.includes(dateStr)) continue;
      if (!textContent.includes('交接班留言')) continue;

      const matchTime = textContent.match(/\d{2}:\d{2}/);
      const matchComment = textContent.match(/交接班留言[:：]\s*(.*)/);
      const matchShift = textContent.match(/接班班次[:：]\s*(.*)/);

      if (!matchTime || !matchComment || !matchShift) continue;

      const time = matchTime[0];
      const comment = matchComment[1].trim();
      const shift = matchShift[1];

      if (shift.includes('早班') && !early) early = `${dateStr} 早班留言：${comment}`;
      if (shift.includes('晚班') && !late) late = `${dateStr} 晚班留言：${comment}`;

      if (early && late) break;
    }

    console.log('-----------------------------');
    console.log(early ? `✅ ${early}` : `⚠️ 未找到早班留言`);
    console.log(late ? `✅ ${late}` : `⚠️ 未找到晚班留言`);
    console.log('-----------------------------');

  } catch (err) {
    console.error('❌ 提取失败:', err);
  } finally {
    await browser.close();
  }
})();
