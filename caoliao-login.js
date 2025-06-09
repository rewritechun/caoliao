const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=bc1fd31b-18ef-454b-a946-65f48392bd98';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

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
    console.log('[1/7] 打开草料二维码用户登录页...');
    await page.goto('https://user.cli.im/login');
    await page.waitForTimeout(3000);

    console.log('[2/7] 等待手机号密码输入框...');
    await page.waitForSelector('input[placeholder="请输入手机号"]', { timeout: 10000 });
    await page.waitForTimeout(3000);

    console.log('[3/7] 输入账号密码...');
    await page.fill('input[placeholder="请输入手机号"]', process.env.CAOLIAO_USERNAME);
    await page.fill('input[placeholder="请输入密码"]', process.env.CAOLIAO_PASSWORD);
    await page.waitForTimeout(3000);

    console.log('[4/7] 点击登录按钮...');
    await page.click('xpath=//*[@id="login-btn"]');
    await page.waitForTimeout(3000);

    console.log('[5/7] 等待后台跳转...');
    try {
      await page.waitForNavigation({ url: /center/, waitUntil: 'load', timeout: 15000 });
    } catch (e) {
      console.warn('⚠️ 未检测到页面跳转，继续尝试识别弹窗...');
    }
    console.log('当前页面地址：', page.url());

    // 新弹窗关闭逻辑
    const dialogs = await page.$$('xpath=//*[contains(@class,"dialog")]');
    if (dialogs.length > 0) {
      console.log(`⚠️ 检测到 ${dialogs.length} 个疑似弹窗，尝试关闭...`);
      const iknowBtn = await page.$('xpath=//a[contains(text(),"我知道了") or contains(text(),"知道")]');
      if (iknowBtn) {
        await iknowBtn.click();
        console.log('✅ 成功点击“我知道了”按钮');
        await page.waitForTimeout(3000);
      } else {
        const closeBtn = await page.$('xpath=//button[contains(@class,"close") or contains(@class,"headerbtn")]');
        if (closeBtn) {
          await closeBtn.click();
          console.log('✅ 成功点击弹窗关闭按钮');
          await page.waitForTimeout(3000);
        }
      }
    } else {
      console.log('✅ 未检测到弹窗提醒，继续执行');
    }

    // 再次确认是否进入后台
    if (!page.url().includes('/center')) {
      throw new Error('未成功跳转后台页面');
    }

    console.log('[6/7] 点击“交接班登记”卡片的“全部记录”链接...');
    try {
      const fullLink = await page.waitForSelector('xpath=//*[@id="recentUpdateBlock"]//span[contains(text(),"全部") and contains(text(),"条")]', { timeout: 5000 });
      await fullLink.click();
      console.log('✅ 已点击“全部记录”链接');
    } catch (e) {
      const errPath = path.join(screenshotDir, 'click-full-error.png');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: errPath });
      console.error('❌ 点击“全部记录”失败，截图保存在：', errPath);
    }

  } catch (err) {
    console.error('当前页面地址：', page.url());
    const errPath = path.join(screenshotDir, 'login-error.png');
    try {
      await page.waitForTimeout(3000);
      await page.screenshot({ path: errPath, timeout: 5000 });
      console.error(`❌ 登录失败，错误截图保存在：${errPath}`);
      await axios.post(webhookUrl, {
        msgtype: "markdown",
        markdown: {
          content: `**草料二维码登录失败**\n当前页面：${page.url()}\n错误信息：${err.message}`
        }
      });
    } catch (screenshotError) {
      console.error('⚠️ 页面截图失败，可能页面已关闭或加载异常');
      await axios.post(webhookUrl, {
        msgtype: "markdown",
        markdown: {
          content: `**草料二维码登录失败**\n截图失败，错误信息：${err.message}`
        }
      });
    }
  } finally {
    await browser.close();
  }
})();
