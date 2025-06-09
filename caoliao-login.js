const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  // 构建日期文件夹路径
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateDir = `${yyyy}-${mm}-${dd}`;
  const screenshotDir = `/root/caoliao/screenshots/${dateDir}`;

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    console.log('[1/5] 打开草料二维码登录首页...');
    await page.goto('https://user.cli.im/login');

    console.log('[2/5] 等待登录表单加载...');
    await page.waitForSelector('input[placeholder="请输入手机号"]', { timeout: 10000 });

    console.log('[3/5] 输入账号和密码...');
    await page.fill('input[placeholder="请输入手机号"]', process.env.CAOLIAO_USERNAME);
    await page.fill('input[placeholder="请输入密码"]', process.env.CAOLIAO_PASSWORD);

    console.log('[4/5] 点击登录按钮...');
    await page.click('xpath=//*[@id="login-btn"]');

    console.log('[5/5] 等待跳转至后台页面...');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    console.log('✅ 登录成功，已进入草料后台！');

  } catch (err) {
    const errorPath = path.join(screenshotDir, 'login-error.png');
    await page.screenshot({ path: errorPath });
    console.error(`❌ 登录失败，错误截图保存至：${errorPath}`);
    console.error(err);
  } finally {
    await browser.close();
  }
})();
