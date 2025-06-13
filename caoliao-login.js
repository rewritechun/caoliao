const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const archiver = require('archiver');
require('dotenv').config();

const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=bc1fd31b-18ef-454b-a946-65f48392bd98';
const mode = process.argv[2] || 'daily';

if (mode === 'zip') {
  (async () => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const yyyy = lastMonth.getFullYear();
    const mm = String(lastMonth.getMonth() + 1).padStart(2, '0');

    const baseDir = '/root/caoliao';
    const targetDir = path.join(baseDir, 'pdf', `${yyyy}-${mm}`);
    const zipPath = path.join(targetDir, `${yyyy}-${mm}.zip`);

    if (!fs.existsSync(targetDir)) {
      console.error(`❌ 上月目录不存在：${targetDir}`);
      process.exit(1);
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      const summary = `📦 草料二维码：${yyyy}年${mm}月PDF打包完成，共${archive.pointer()}字节。`;
      console.log(summary);
      await axios.post(webhookUrl, {
        msgtype: "markdown",
        markdown: { content: `**${summary}**` }
      });
      process.exit(0);
    });

    archive.on('error', err => { throw err; });
    archive.pipe(output);
    archive.directory(targetDir, false);
    await archive.finalize();
  })();

  return;
}

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
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const recordLogPath = path.join(logDir, 'extract.log');
  if (!fs.existsSync(recordLogPath)) fs.writeFileSync(recordLogPath, '');

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

    const possibleDialogXPath = [
      '//a[contains(text(),"我知道了")]',
      '//a[contains(text(),"知道")]',
      '//button/span/i/svg[contains(@class,"el-icon-close")]',
      '//div[contains(@class,"el-dialog")]//button[contains(@class,"close")]',
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

    if (!dialogClosed) console.log('✅ 未检测到需关闭的弹窗');

    console.log('[6/7] 点击“交接班登记”卡片标题...');
    const titleXPath = '//*[@id="recentUpdateBlock"]/div/div[2]/div[1]/div[2]/div[1]/div[2]/div[2]/div[1]/div[1]/div/p';
    const dynamicDataXPath = '//span[contains(text(),"动态数据")]';

    try {
      const titleElement = await page.waitForSelector(`xpath=${titleXPath}`, { timeout: 5000 });
      await titleElement.click();
      console.log('✅ 已点击“交接班登记”标题，准备进入详情页');

      const dynamicElement = await page.waitForSelector(`xpath=${dynamicDataXPath}`, { timeout: 5000 });
      await dynamicElement.click();
      console.log('✅ 已点击“动态数据”');
    } catch (e) {
      const failShot = path.join(screenshotDir, `${dateDir}-click-fail.png`);
      await page.screenshot({ path: failShot });
      await axios.post(webhookUrl, {
        msgtype: "markdown",
        markdown: { content: `**草料二维码操作失败**\n点击交接班登记失败：${e.message}` }
      });
      return;
    }

    // 后续部分如之前逻辑继续执行...

  } catch (err) {
    const errorShot = path.join(screenshotDir, `${yyyy}-${mm}-${dd}-login-error.png`);
    try { await page.screenshot({ path: errorShot }); } catch {}
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
