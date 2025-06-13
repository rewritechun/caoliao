// ==== 引入模块 ====
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { chromium } = require('playwright');

// ==== 时间处理 ====
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const dateDir = `${yyyy}-${mm}-${dd}`;

// ==== 路径定义 ====
const screenshotDir = `/root/caoliao/screenshots`;
const pdfDir = `/root/caoliao/pdf/${dateDir}`;
const recordLogPath = `/root/caoliao/logs/${dateDir}/extract.log`;
const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=bc1fd31b-18ef-454b-a946-65f48392bd98';

// ==== XPath 选择器定义 ====
const titleXPath = '//*[@id="recentUpdateBlock"]//div[contains(text(), "交接班登记")]';
const dynamicDataXPath = '//*[contains(text(), "动态数据")]';

// ==== 启动浏览器任务 ====
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 登录部分请按你原有逻辑补充，假设此时 page 已登录

    // 确保目录存在
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });
    fs.mkdirSync(path.dirname(recordLogPath), { recursive: true });

    // 点击交接班登记标题
    const titleElement = await page.waitForSelector(`xpath=${titleXPath}`, { timeout: 5000 });
    await titleElement.click();
    console.log('✅ 已点击“交接班登记”标题，准备进入详情页');

    const dynamicElement = await page.waitForSelector(`xpath=${dynamicDataXPath}`, { timeout: 5000 });
    await dynamicElement.click();
    console.log('✅ 已点击“动态数据”');

    await page.waitForTimeout(4000);
    await page.mouse.wheel(0, 1500);

    const recordBlocks = await page.$$('div[data-v-clipboard-text]');
    const previewShot = path.join(screenshotDir, `${dateDir}-record-area.png`);
    await page.screenshot({ path: previewShot });

    console.log(`📷 已截图交接班区域，记录块数量：${recordBlocks.length}`);

    if (recordBlocks.length === 0) {
      await axios.post(webhookUrl, {
        msgtype: 'markdown',
        markdown: {
          content: `⚠️ **未发现任何交接班记录**\n请检查是否当天无数据，或页面结构发生变化。截图见：${previewShot}`
        }
      });
      return;
    }

    for (const block of recordBlocks) {
      const text = await block.innerText();
      const matched = text.match(/(\d{2}):(\d{2})/);
      if (!matched) continue;

      const hour = parseInt(matched[1], 10);
      const label = hour >= 5 && hour < 12 ? '早班' : hour >= 17 ? '晚班' : '';
      if (!label) continue;

      const commentMatch = text.match(/留言[：:]\s*(.*?)\s*([\n\r]|$)/);
      const comment = commentMatch ? commentMatch[1].trim() : '未填写';
      const filename = `${yyyy}-${mm}-${dd}-${label}.pdf`;
      const filepath = path.join(pdfDir, filename);

      if (fs.existsSync(filepath)) {
        console.log(`📄 已存在 ${filename}，跳过下载`);
      } else {
        const downloadBtn = await block.$('text=PDF下载');
        if (downloadBtn) {
          try {
            const [ download ] = await Promise.all([
              page.waitForEvent('download', { timeout: 10000 }),
              downloadBtn.click()
            ]);
            await download.saveAs(filepath);
            console.log(`✅ 成功保存 PDF 文件：${filepath}`);
          } catch (e) {
            console.error(`❌ 下载失败：${e.message}`);
          }
        } else {
          console.warn(`⚠️ 未找到 PDF 下载按钮：${filename}`);
        }
      }

      fs.appendFileSync(recordLogPath, `[${yyyy}-${mm}-${dd} ${label}] 交接班留言：${comment}\n`);
    }

    const logText = fs.readFileSync(recordLogPath, 'utf8');
    await axios.post(webhookUrl, {
      msgtype: 'markdown',
      markdown: {
        content: `**📋 今日交接班留言摘要（${yyyy}-${mm}-${dd}）**\n` + logText.replace(/\n/g, '\n')
      }
    });

  } catch (e) {
    const failShot = path.join(screenshotDir, `${dateDir}-click-fail.png`);
    await page.screenshot({ path: failShot });
    await axios.post(webhookUrl, {
      msgtype: "markdown",
      markdown: { content: `**草料二维码操作失败**\n错误信息：${e.message}` }
    });
  } finally {
    await browser.close();
  }
})();
