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

  // 构建截图存储路径
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
    console.log('[1/6] 打开草料二维码用户登录页...');
    await page.goto('https://user.cli.im/login');
    await page.waitForTimeout(3000);

    console.log('[2/6] 等待手机号密码输入框...');
    await page.waitForSelector('input[placeholder="请输入手机号"]', { timeout: 10000 });
    await page.waitForTimeout(3000);

    console.log('[3/6] 输入账号密码...');
    await page.fill('input[placeholder="请输入手机号"]', process.env.CAOLIAO_USERNAME);
    await page.fill('input[placeholder="请输入密码"]', process.env.CAOLIAO_PASSWORD);
    await page.waitForTimeout(3000);

    console.log('[4/6] 点击登录按钮...');
    await page.click('xpath=//*[@id="login-btn"]');
    await page.waitForTimeout(3000);

    console.log('[5/6] 等待后台跳转...');
    await page.waitForURL((url) => typeof url === 'string' && url.includes('/center'), { timeout: 15000 });
    console.log('✅ 登录成功，已进入后台页面！');

    // ✅ 检查是否有弹窗提醒...
    console.log('[6/6] 检查是否有弹窗提醒...');
    try {
      const knowBtn = await page.waitForSelector('//button[contains(text(),"我知道了")]', { timeout: 5000 });
      await knowBtn.click({ force: true });
      console.log('🔘 已点击“我知道了”关闭弹窗');
    } catch {
      try {
        const closeBtn = await page.waitForSelector('//div[contains(@class,"modal")]//i[contains(@class,"close")]', { timeout: 3000 });
        await closeBtn.click({ force: true });
        console.log('❌ 已点击右上角关闭弹窗');
      } catch {
        console.log('✅ 无弹窗或弹窗已自动消失，继续执行');
      }
    }

  } catch (err) {
    const errPath = path.join(screenshotDir, 'login-error.png');
    await page.screenshot({ path: errPath });
    console.error(`❌ 登录失败，错误截图保存在：${errPath}`);
    console.error(err);
  } finally {
    await browser.close();
  }
})();
