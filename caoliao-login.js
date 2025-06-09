const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 获取今天日期字符串
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateDir = `${yyyy}-${mm}-${dd}`;

  // 定义截图目录
  const baseDir = '/root/caoliao/screenshots';  // 改为你的服务器路径
  const fullDir = path.join(baseDir, dateDir);

  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }

  try {
    // 1. 打开登录页
    await page.goto('https://cli.im/login');
    await page.waitForSelector('input[placeholder="请输入手机号"]');
    await page.screenshot({ path: `${fullDir}/1-login-page.png` });

    // 2. 输入账号密码
    await page.fill('input[placeholder="请输入手机号"]', process.env.CAOLIAO_USERNAME);
    await page.fill('input[placeholder="请输入密码"]', process.env.CAOLIAO_PASSWORD);
    await page.screenshot({ path: `${fullDir}/2-filled-credentials.png` });

    // 3. 点击登录按钮
    await page.click('button:has-text("登录")');
    await page.waitForTimeout(2000); // 等页面响应
    await page.screenshot({ path: `${fullDir}/3-after-submit.png` });

    // 4. 等待跳转后台首页
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${fullDir}/4-dashboard.png` });

    console.log(`✅ 登录成功，截图已保存至 ${fullDir}`);

  } catch (error) {
    const errPath = `${fullDir}/error.png`;
    await page.screenshot({ path: errPath });
    console.error(`❌ 登录失败，错误截图保存在：${errPath}`);
  } finally {
    await browser.close();
  }
})();
