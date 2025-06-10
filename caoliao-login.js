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

    const possibleDialogXPath = [
      '//a[contains(text(),"我知道了")]',
      '//a[contains(text(),"知道")]',
      '//button/span/i/svg[contains(@class,"el-icon-close")]',
      '//div[contains(@class,"el-dialog")]//button[contains(@class,"close")]'
    ];

    let dialogClosed = false;
    for (const xpath of possibleDialogXPath) {
      const element = await page.$(`xpath=${xpath}`);
      if (element) {
        await element.click();
        console.log(`✅ 成功点击弹窗元素: ${xpath}`);
        dialogClosed = true;
        await page.waitForTimeout(3000);
        break;
      }
    }

    if (!dialogClosed) {
      console.log('✅ 未检测到需关闭的弹窗');
    }

    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log('最终页面地址：', finalUrl);

    if (!finalUrl.includes('/center')) {
      throw new Error('未成功跳转后台页面，当前地址：' + finalUrl);
    }

    console.log('[6/7] 搜索“全部记录”按钮...');
    const allButtons = await page.$$('xpath=//*[@id="recentUpdateBlock"]//span');
    let found = false;
    for (const btn of allButtons) {
      const text = await btn.innerText();
      if (/^全部\d+条$/.test(text.trim())) {
        console.log(`✅ 找到按钮: ${text}`);
        await btn.click();
        found = true;
        await page.waitForTimeout(3000);
        break;
      }
    }

    if (!found) {
      const errPath = path.join(screenshotDir, 'click-full-error.png');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: errPath });
      console.error('❌ 未能识别“全部记录”按钮，截图保存在：', errPath);
      await axios.post(webhookUrl, {
        msgtype: "markdown",
        markdown: {
          content: `**草料二维码识别失败**\n原因：无法识别“全部记录”按钮，请检查页面是否变动。`
        }
      });
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
