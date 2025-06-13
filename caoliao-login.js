// === 省略前面不变的部分 ===

    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 2000);

    // ✅ 改用更稳健的记录块选择器（卡片式记录）
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

    let processed = { morning: false, evening: false };

    for (const block of recordBlocks) {
      const text = await block.innerText();
      const matched = text.match(/(\d{2}):(\d{2})/);
      if (!matched) continue;

      const hour = parseInt(matched[1], 10);
      const isMorning = hour >= 5 && hour < 12;
      const isEvening = hour >= 17 && hour <= 23;
      const label = isMorning ? '早班' : isEvening ? '晚班' : '';
      if (!label || processed[label === '早班' ? 'morning' : 'evening']) continue;

      const commentMatch = text.match(/留言[：:]\s*(.*?)\s*([\n\r]|$)/);
      const comment = commentMatch ? commentMatch[1].trim() : '未填写';
      const filename = `${yyyy}-${mm}-${dd}-${label}.pdf`;
      const filepath = path.join(pdfDir, filename);

      if (fs.existsSync(filepath)) {
        console.log(`📄 已存在 ${filename}，跳过下载`);
      } else {
        const downloadBtn = await block.$('text=PDF下载');
        if (downloadBtn) {
          console.log(`🎯 找到下载按钮，准备截图并尝试点击：${filename}`);

          const beforeClickPath = path.join(screenshotDir, `${yyyy}-${mm}-${dd}-${label}-before-click.png`);
          await downloadBtn.screenshot({ path: beforeClickPath }).catch(() => {
            console.warn('⚠️ 截图前失败');
          });

          try {
            const [ download ] = await Promise.all([
              page.waitForEvent('download', { timeout: 10000 }).catch(e => {
                console.error(`❌ 等待下载事件失败：${e.message}`);
                throw e;
              }),
              downloadBtn.click().then(() => console.log('✅ 下载按钮已点击'))
            ]);

            const afterClickPath = path.join(screenshotDir, `${yyyy}-${mm}-${dd}-${label}-after-click.png`);
            await page.screenshot({ path: afterClickPath });

            console.log('🔔 下载事件已触发，开始保存文件...');
            await download.saveAs(filepath);

            if (fs.existsSync(filepath)) {
              console.log(`✅ 成功保存 PDF 文件：${filepath}`);
            } else {
              console.error(`❌ 保存失败，文件不存在：${filepath}`);
            }

          } catch (e) {
            const errorClickPath = path.join(screenshotDir, `${yyyy}-${mm}-${dd}-${label}-error.png`);
            await page.screenshot({ path: errorClickPath });
            console.error(`❌ 下载流程出错：${filename}，错误信息：${e.message}`);
          }

        } else {
          console.log(`⚠️ 未找到下载按钮 ${filename}`);
        }
      }

      fs.appendFileSync(recordLogPath, `[${yyyy}-${mm}-${dd} ${label}] 交接班留言：${comment}\n`);
      if (label === '早班') processed.morning = true;
      if (label === '晚班') processed.evening = true;
    }

    const logText = fs.readFileSync(recordLogPath, 'utf8');
    await axios.post(webhookUrl, {
      msgtype: 'markdown',
      markdown: {
        content: `**📋 今日交接班留言摘要（${yyyy}-${mm}-${dd}）**\n` + logText.replace(/\n/g, '\n')
      }
    }).catch(err => {
      console.error('❌ 微信机器人消息发送失败:', err.message);
    });
