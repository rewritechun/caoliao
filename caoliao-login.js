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

  // 获取当前日期用于截图目录
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
    console.log('[1/4] 打开草料用户登录页...');
    await page.goto('https://user.cli.im/login');

    console.log('[2/4] 等待手机号输入框加载...');
    await page.waitForSelector('input[placeholder="请输入手机号"]', { timeout: 10000 });

    console.log('[3/4] 输入手机号与密码...');
    await page.fill('input[placeholder="请输入手机号"]', process.env.CAOLIAO_USERNAME);
    await page.fill('input[placeholder="请输入密码"]', process.env.CAOLIAO_PASSWORD);

    console.log('[4/4] 点击登录按钮...');
    await page.click('button:has-text("登录")');

    console.log('⏳ 等待跳转到后台首页...');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    console.log('✅ 登录成功，已进入后台页面。');

  } catch (err) {
    const errPath = path.join(screenshotDir, 'login-error.png');
    await page.screenshot({ path: errPath });
    console.error(`❌ 登录失败，错误截图保存在：${errPath}`);
    console.error(err);
  } finally {
    await browser.close();
  }
})();
