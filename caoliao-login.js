const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const archiver = require('archiver');
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
  const baseDir = '/root/caoliao';
  const logDir = path.join(baseDir, 'logs', dateDir);
  const pdfDir = path.join(baseDir, 'pdf', dateDir);
  const screenshotDir = path.join(baseDir, 'screenshots');

  [logDir, pdfDir, screenshotDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const recordLogPath = path.join(logDir, 'extract.log');
  if (!fs.existsSync(recordLogPath)) {
    fs.writeFileSync(recordLogPath, '');
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
  '//div[contains(@class,"el-dialog")]//button[contains(@class,"close")]',
  '/html/body/div[19]/div/div[2]/div/div[2]/div/button/span/i/svg',
  '/html/body/div[19]/div/div[2]/div/div[2]/div/div[4]/a[2]',
  '/html/body/div[contains(@class,"el-dialog")]//a[contains(text(),"我知道了")]',
  '/html/body//a[contains(text(),"我知道了")]',
  '//div[contains(text(),"多设备登录提醒")]/following::a[contains(text(),"我知道了")]'
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

    console.log('[6/7] 点击“交接班登记”卡片标题...');
    try {
      const titleXPath = '//*[@id="recentUpdateBlock"]/div/div[2]/div[1]/div[2]/div[1]/div[2]/div[2]/div[1]/div[1]/div/p';
      const titleElement = await page.waitForSelector(`xpath=${titleXPath}`, { timeout: 5000 });
      await titleElement.click();
      console.log('✅ 已点击“交接班登记”标题，准备进入详情页');

      const dynamicDataXPath = '/html/body/div[22]/div/div[2]/div/div[2]/div/div/div/div/div/div[1]/div[2]/div/div/div/div/div[1]/div[4]/span/span/span/span';
      const dynamicElement = await page.waitForSelector(`xpath=${dynamicDataXPath}`, { timeout: 5000 });
      await dynamicElement.click();
      console.log('✅ 已点击“动态数据”');
    } catch (e) {
      console.error('❌ 点击“交接班登记”标题或“动态数据”失败');
      const screenshotPath = path.join(screenshotDir, `${yyyy}-${mm}-${dd}-click-record-fail.png`);
      try {
        await page.screenshot({ path: screenshotPath });
        await axios.post(webhookUrl, {
          msgtype: "markdown",
          markdown: {
            content: `**草料二维码操作失败**\n点击交接班登记失败，错误信息：${e.message}`
          }
        });
      } catch (sErr) {
        console.warn('⚠️ 页面截图失败或推送失败');
      }
      return;
    }

    if (dd === '01') {
      const lastMonth = new Date(yyyy, parseInt(mm) - 2, 1);
      const lastMM = String(lastMonth.getMonth() + 1).padStart(2, '0');
      const lastYYYY = lastMonth.getFullYear();
      const targetDir = path.join(baseDir, 'pdf', `${lastYYYY}-${lastMM}`);

      if (fs.existsSync(targetDir)) {
        const zipPath = path.join(targetDir, `${lastYYYY}-${lastMM}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
          const summary = `📦 草料二维码：${lastYYYY}年${lastMM}月PDF打包完成，共${archive.pointer()}字节。`;
          console.log(summary);
          await axios.post(webhookUrl, {
            msgtype: "markdown",
            markdown: { content: `**${summary}**` }
          });
        });

        archive.on('error', err => { throw err; });
        archive.pipe(output);
        archive.directory(targetDir, false);
        await archive.finalize();
      }
    }

    // 留言与PDF提取逻辑将在后续模块补充

  } catch (err) {
    const errorShot = path.join(screenshotDir, `${yyyy}-${mm}-${dd}-login-error.png`);
    try {
      await page.screenshot({ path: errorShot });
    } catch (e) {
      console.warn('⚠️ 页面截图失败，可能页面已关闭或加载异常');
    }
    await axios.post(webhookUrl, {
      msgtype: "markdown",
      markdown: {
        content: `**草料二维码登录失败**\n当前页面：${page.url()}\n错误信息：${err.message}`
      }
    });
  } finally {
    await browser.close();
  }
})();
