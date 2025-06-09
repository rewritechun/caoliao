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

    console.log('[2/6] 等待手机号密码输入框加载...');
    await page.waitForSelector('input[placeholder="请输入手机号"]', { timeout: 10000 });

    console.log('[3/6] 输入账号和密码...');
    await page.fill('input[placeholder="请输入手机号"]', process.env.CAOLIAO_USERNAME);
    await page.fill('input[placeholder="请输入密码"]', process.env.CAOLIAO_PASSWORD);

    console.log('[4/6] 点击登录按钮...');
    await page.click('xpath=//*[@id="login-btn"]');

    console.log('[5/6] 等待跳转到后台页面...');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✅ 登录成功！');

    // ✅ 检测并关闭弹窗
    console.log('[6/6] 检查是否有弹窗...');
    const knowButton = await page.$('//button[contains(text(),"我知道了")]');
    if (knowButton) {
      await knowButton.click();
      console.log('🔘 已点击“我知道了”按钮关闭弹窗');
    } else {
      const closeBtn = await page.$('//div[contains(@class,"modal")]//i[contains(@class,"close")]');
      if (closeBtn) {
        await closeBtn.click();
        console.log('❌ 已点击右上角关闭弹窗');
      } else {
        console.log('✅ 未检测到弹窗，继续后续操作');
      }
    }

  } catch (err) {
    const errorPath = path.join(screenshotDir, 'login-error.png');
    await page.screenshot({ path: errorPath });
    console.error(`❌ 登录失败，错误截图保存在：${errorPath}`);
    console.error(err);
  } finally {
    await browser.close();
  }
})();
