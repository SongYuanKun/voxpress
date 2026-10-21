<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';
import { Button, Cell, CellGroup, Field, NavBar, Tabbar, TabbarItem, Tag, showConfirmDialog, showDialog, showToast } from 'vant';
import { v4 as uuidv4 } from './utils/uuid';
import { createRecord, deleteRecord, exportCsv, listRecords, parseText, parseVideo, resetRecord, updateRecord, type ExpressItem, type ExpressRecord, type VideoParsedRecord, type VideoParseResult } from './api/express';
import ItemEditor from './components/ItemEditor.vue';
import { useSpeech } from './composables/useSpeech';
import { validateRawText } from './utils/rawText';
import { savePendingVideoRecords, type VideoSaveOutcome } from './utils/videoBatch';

const activeTab = ref('home');
const trackingNumber = ref('');
const rawText = ref('');
const parsedItems = ref<ExpressItem[]>([]);
const records = ref<ExpressRecord[]>([]);
const selected = ref<ExpressRecord | null>(null);
const loading = ref(false);
const ttsEnabled = ref(true);
const keyword = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const accessToken = ref(localStorage.getItem('voxpress_token') || '');
const videoFile = ref<File | null>(null);
const videoResult = ref<VideoParseResult | null>(null);
const videoLoading = ref(false);
const scannerOpen = ref(false);
const { supported, listening, start, stop, speak } = useSpeech();
const scannerElementId = 'tracking-scanner';
let scanner: Html5Qrcode | null = null;
let scannerGeneration = 0;
let savedVideoRecords = new WeakSet<VideoParsedRecord>();

const validItems = computed(() => parsedItems.value.filter(item => item.name.trim()));
const canSave = computed(() => trackingNumber.value.trim() && validateRawText(rawText.value).valid && validItems.value.length > 0);

function notify(text: string) {
  if (ttsEnabled.value) speak(text);
}

async function parseCurrentText() {
  const sourceText = validRawText(rawText.value, '物品内容');
  if (!sourceText) return;

  loading.value = true;
  try {
    const result = await parseText(sourceText);
    parsedItems.value = result.items.length ? result.items : [{ name: '', quantity: 1, unit: '' }];
    notify('解析完成，请确认物品清单');
  } finally {
    loading.value = false;
  }
}

async function saveRecord(duplicateConfirmed = false) {
  const sourceText = validRawText(rawText.value, '物品内容');
  if (!trackingNumber.value.trim() || !sourceText || !validItems.value.length) {
    showToast('请补全单号、原文和物品清单');
    return;
  }

  loading.value = true;
  try {
    await createRecord({
      client_request_id: uuidv4(),
      tracking_number: trackingNumber.value.trim(),
      raw_text: sourceText,
      items: validItems.value,
      duplicate_confirmed: duplicateConfirmed
    });

    showToast('入库成功');
    notify('入库成功');
    trackingNumber.value = '';
    rawText.value = '';
    parsedItems.value = [];
    await refreshRecords();
  } catch (error: any) {
    if (error?.code === 1008) {
      await showConfirmDialog({
        title: '重复单号',
        message: '该单号已有记录，是否仍然保存为新记录？'
      });
      await saveRecord(true);
    }
  } finally {
    loading.value = false;
  }
}

async function refreshRecords() {
  if (!accessToken.value) return;
  const data = await listRecords({
    keyword: keyword.value || undefined,
    date_from: dateFrom.value || undefined,
    date_to: dateTo.value || undefined
  });
  records.value = data.list;
}

function saveToken() {
  const token = accessToken.value.trim();
  if (!token) {
    showToast('请输入访问 Token');
    return;
  }
  localStorage.setItem('voxpress_token', token);
  showToast('Token 已保存');
  refreshRecords();
}

async function downloadCsv() {
  const blob = await exportCsv({
    keyword: keyword.value || undefined,
    date_from: dateFrom.value || undefined,
    date_to: dateTo.value || undefined
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `voxpress-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function openRecord(record: ExpressRecord) {
  selected.value = JSON.parse(JSON.stringify(record));
  activeTab.value = 'detail';
}

async function saveSelected() {
  if (!selected.value) return;
  selected.value = await updateRecord(selected.value.id, selected.value.custom_json);
  await refreshRecords();
  showToast('已保存修改');
}

async function resetSelected() {
  if (!selected.value) return;
  await showConfirmDialog({ title: '恢复初始数据', message: '确认用首次 AI 解析结果覆盖当前清单？' });
  selected.value = await resetRecord(selected.value.id);
  await refreshRecords();
}

async function removeSelected() {
  if (!selected.value) return;
  await showConfirmDialog({ title: '删除记录', message: '记录会被软删除，确认继续？' });
  await deleteRecord(selected.value.id);
  selected.value = null;
  activeTab.value = 'list';
  await refreshRecords();
}

function startSpeech() {
  const ok = start((text) => {
    rawText.value = text;
  });
  if (!ok) showToast('当前浏览器不支持语音识别，请使用文字输入');
}

async function disposeScanner(current: Html5Qrcode) {
  await current.stop().catch(() => undefined);
  try {
    current.clear();
  } catch {
    // clear() is synchronous and can throw for an already-cleared view.
  }
}

async function stopScanner() {
  scannerGeneration += 1;
  const current = scanner;
  scanner = null;
  scannerOpen.value = false;
  if (current) await disposeScanner(current);
}

async function startScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('当前浏览器无法使用摄像头，请手动输入单号');
    return;
  }
  const generation = ++scannerGeneration;
  scannerOpen.value = true;
  await nextTick();
  if (generation !== scannerGeneration || activeTab.value !== 'home') return;
  const current = new Html5Qrcode(scannerElementId);
  scanner = current;
  try {
    await current.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      async (decodedText) => {
        if (scanner !== current) return;
        trackingNumber.value = decodedText.trim();
        await stopScanner();
        showToast('单号已识别，请确认后继续录入');
        notify('单号已识别');
      },
      () => undefined
    );
    if (scanner !== current || generation !== scannerGeneration || activeTab.value !== 'home') {
      await disposeScanner(current);
    }
  } catch {
    if (scanner === current) {
      scanner = null;
      scannerOpen.value = false;
    }
    await disposeScanner(current);
    showToast('无法打开摄像头，请允许权限后重试或手动输入');
  }
}

function validRawText(value: string, fieldName: string) {
  const result = validateRawText(value);
  if (!result.valid) {
    showToast(`${fieldName}${result.message}`);
    return null;
  }
  return result.value;
}

function videoRecordProblem(record: VideoParsedRecord) {
  if (!record.tracking_number.trim()) return '未填写快递单号';
  if (!validateRawText(record.raw_text).valid) return '原文为空或超过 1000 字';
  if (!record.items.some(item => item.name.trim())) return '未填写物品清单';
  return null;
}

function onVideoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  videoFile.value = input.files?.[0] || null;
  videoResult.value = null;
  savedVideoRecords = new WeakSet<VideoParsedRecord>();
}

async function submitVideo() {
  if (!videoFile.value) return;
  videoLoading.value = true;
  try {
    videoResult.value = await parseVideo(videoFile.value);
    savedVideoRecords = new WeakSet<VideoParsedRecord>();
    if (!videoResult.value.records.length) {
      videoResult.value.records = [{ tracking_number: '', tracking_confidence: 0, tracking_evidence: '', raw_text: videoResult.value.raw_text || '', items: [{ name: '', quantity: 1, unit: '' }] }];
    }
    for (const record of videoResult.value.records) {
      if (!record.items.length) {
        record.items = [{ name: '', quantity: 1, unit: '' }];
      }
    }
    showToast('视频解析完成');
    notify('视频解析完成，请确认结果');
  } finally {
    videoLoading.value = false;
  }
}

async function parseVideoRawText() {
  if (!videoResult.value || !validRawText(videoResult.value.raw_text, '完整口述')) return;
  videoLoading.value = true;
  try {
    if (videoResult.value.records.length === 1) {
      await parseVideoRecordRawText(videoResult.value.records[0]);
    } else {
      const records = videoResult.value.records.map((record, index) => ({
        record,
        rawText: validRawText(record.raw_text, `第 ${index + 1} 单口述`)
      }));
      if (records.some(({ rawText }) => !rawText)) return;
      for (const { record, rawText } of records) {
        const parsed = await parseText(rawText!);
        record.items = parsed.items.length ? parsed.items : [{ name: '', quantity: 1, unit: '' }];
      }
    }
    showToast('物品解析完成');
  } finally {
    videoLoading.value = false;
  }
}

async function parseVideoRecordRawText(record: VideoParsedRecord) {
  const rawText = validRawText(record.raw_text, '本单口述');
  if (!rawText) return;
  const parsed = await parseText(rawText);
  record.items = parsed.items.length ? parsed.items : [{ name: '', quantity: 1, unit: '' }];
}

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadVideoCsv() {
  if (!videoResult.value) return;
  const rows = [
    ['快递单号', '口述内容', '物品名', '数量', '单位'],
    ...videoResult.value.records.flatMap(record =>
      record.items.map(item => [
        record.tracking_number,
        record.raw_text,
        item.name,
        item.quantity,
        item.unit
      ])
    )
  ];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `voxpress-video-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveVideoRecord(record: VideoParsedRecord, duplicateConfirmed = false): Promise<VideoSaveOutcome> {
  const items = record.items.filter(item => item.name.trim());
  const rawText = validRawText(record.raw_text, '本单口述');
  if (!record.tracking_number || !items.length || !rawText) {
    showToast('请先补全单号、原文和物品清单');
    return 'cancelled';
  }

  videoLoading.value = true;
  try {
    await createRecord({
      client_request_id: uuidv4(),
      tracking_number: record.tracking_number,
      raw_text: rawText,
      items,
      duplicate_confirmed: duplicateConfirmed
    });
    savedVideoRecords.add(record);
    showToast('视频入库成功');
    notify('视频入库成功');
    await refreshRecords().catch(() => undefined);
    return 'saved';
  } catch (error: any) {
    if (error?.code === 1008) {
      try {
        await showConfirmDialog({
          title: '重复单号',
          message: '该单号已有记录，是否仍然保存为新记录？'
        });
      } catch {
        return 'cancelled';
      }
      return saveVideoRecord(record, true);
    }
    throw error;
  } finally {
    videoLoading.value = false;
  }
}

async function saveAllVideoRecords() {
  if (!videoResult.value) return;
  const invalidIndex = videoResult.value.records.findIndex((record) => videoRecordProblem(record));
  if (invalidIndex !== -1) {
    showToast(`第 ${invalidIndex + 1} 单${videoRecordProblem(videoResult.value.records[invalidIndex])}，请修正后再批量入库`);
    return;
  }

  const summary = await savePendingVideoRecords(
    videoResult.value.records,
    savedVideoRecords,
    (record) => saveVideoRecord(record, false)
  );
  const message = `批量入库：成功 ${summary.saved}，失败 ${summary.failed}，取消 ${summary.cancelled}，已跳过 ${summary.skipped}`;
  showToast(message);
  if (summary.saved) {
    notify(`已入库 ${summary.saved} 条`);
  }
}

onMounted(() => {
  if (accessToken.value) {
    refreshRecords();
  } else {
    showDialog({
      title: '需要访问 Token',
      message: '请输入部署时配置的 APP_AUTH_TOKEN 后再使用。'
    });
  }
});

watch(activeTab, (tab) => {
  if (tab !== 'home') void stopScanner();
});

onUnmounted(() => { void stopScanner(); });
</script>

<template>
  <div class="app-shell">
    <NavBar title="VoxPress" />

    <main class="content">
      <section v-if="activeTab === 'home'" class="panel">
        <div class="token-bar">
          <Field v-model="accessToken" type="password" placeholder="访问 Token" clearable />
          <Button size="small" type="primary" @click="saveToken">保存</Button>
        </div>

        <div class="status-line">
          <Tag type="success">文字主链路</Tag>
          <Tag :type="supported ? 'primary' : 'warning'">语音{{ supported ? '可用' : '不可用' }}</Tag>
          <label class="tts-toggle">
            <input v-model="ttsEnabled" type="checkbox" />
            TTS
          </label>
        </div>

        <Field v-model="trackingNumber" label="快递单号" placeholder="扫码或手动输入快递单号" clearable />
        <div class="scanner-actions">
          <Button plain type="primary" @click="scannerOpen ? stopScanner() : startScanner()">
            {{ scannerOpen ? '关闭扫码' : '开始扫码' }}
          </Button>
        </div>
        <div v-if="scannerOpen" :id="scannerElementId" class="scanner-view" />
        <Field
          v-model="rawText"
          label="物品描述"
          type="textarea"
          rows="3"
          autosize
          placeholder="例如：5张相纸，2个手机壳，一盒胶带"
        />

        <div class="actions">
          <Button type="primary" plain @click="startSpeech" @touchend="stop">
            {{ listening ? '录音中...' : '语音录入' }}
          </Button>
          <Button type="primary" :loading="loading" @click="parseCurrentText">AI 解析</Button>
        </div>

        <ItemEditor v-if="parsedItems.length" v-model="parsedItems" />

        <Button block type="success" :disabled="!canSave" :loading="loading" @click="saveRecord(false)">确认入库</Button>

        <h3>最近入库</h3>
        <CellGroup inset>
          <Cell
            v-for="record in records.slice(0, 3)"
            :key="record.id"
            :title="record.tracking_number"
            :label="record.custom_json.items.map(item => item.name + item.quantity + item.unit).join('，')"
            is-link
            @click="openRecord(record)"
          />
        </CellGroup>
      </section>

      <section v-if="activeTab === 'list'" class="panel">
        <div class="token-bar">
          <Field v-model="accessToken" type="password" placeholder="访问 Token" clearable />
          <Button size="small" type="primary" @click="saveToken">保存</Button>
        </div>

        <Field v-model="keyword" placeholder="搜索单号或物品名" clearable @keyup.enter="refreshRecords">
          <template #button>
            <Button size="small" type="primary" @click="refreshRecords">搜索</Button>
          </template>
        </Field>
        <div class="date-filters">
          <Field v-model="dateFrom" label="开始日期" type="date" />
          <Field v-model="dateTo" label="结束日期" type="date" />
        </div>
        <Button block plain type="primary" @click="downloadCsv">导出 Excel/CSV</Button>

        <CellGroup inset>
          <Cell
            v-for="record in records"
            :key="record.id"
            :title="record.tracking_number"
            :label="record.custom_json.items.map(item => item.name + item.quantity + item.unit).join('，')"
            is-link
            @click="openRecord(record)"
          >
            <template #value>
              <Tag v-if="record.is_modified" type="warning">已修改</Tag>
            </template>
          </Cell>
        </CellGroup>
      </section>

      <section v-if="activeTab === 'detail'" class="panel">
        <template v-if="selected">
          <h3>{{ selected.tracking_number }}</h3>
          <p class="muted">原文：{{ selected.raw_text }}</p>
          <ItemEditor v-model="selected.custom_json.items" />
          <div class="actions vertical">
            <Button type="primary" block @click="saveSelected">保存修改</Button>
            <Button plain block @click="resetSelected">恢复初始数据</Button>
            <Button danger plain block @click="removeSelected">删除记录</Button>
          </div>
        </template>
        <div v-else class="empty">请选择一条记录</div>
      </section>

      <section v-if="activeTab === 'video'" class="panel">
        <div class="token-bar">
          <Field v-model="accessToken" type="password" placeholder="访问 Token" clearable />
          <Button size="small" type="primary" @click="saveToken">保存</Button>
        </div>

        <div class="video-card">
          <h3>上传视频解析 Excel</h3>
          <p class="muted">上传或录制一段视频：画面拍清快递面单，语音说清里面有什么。</p>
          <label class="video-input">
            <span>从图库选择视频</span>
            <input type="file" accept="video/*" @change="onVideoSelected" />
          </label>
          <label class="video-input">
            <span>直接录制视频</span>
            <input type="file" accept="video/*" capture="environment" @change="onVideoSelected" />
          </label>
          <p v-if="videoFile" class="muted">已选择：{{ videoFile.name }}</p>
          <Button block type="primary" :disabled="!videoFile" :loading="videoLoading" @click="submitVideo">上传并解析</Button>
        </div>

        <div v-if="videoResult" class="video-card">
          <h3>解析结果</h3>
          <Tag type="primary">识别到 {{ videoResult.records.length }} 条待确认记录</Tag>
          <p v-if="videoResult.tracking_numbers.length" class="muted">候选单号：{{ videoResult.tracking_numbers.join('，') }}</p>
          <p v-if="videoResult.tracking_evidence" class="muted">OCR：{{ videoResult.tracking_evidence }}</p>
          <p v-for="warning in videoResult.warnings" :key="warning" class="warning-text">{{ warning }}</p>
          <Field
            v-model="videoResult.raw_text"
            label="完整口述"
            type="textarea"
            rows="3"
            autosize
            placeholder="如果音频识别失败，可在这里粘贴完整口述；多单建议在下方逐条拆分"
          />
          <Button block plain type="primary" :loading="videoLoading" @click="parseVideoRawText">按记录重新解析口述内容</Button>

          <div v-for="(record, index) in videoResult.records" :key="index" class="video-record-card">
            <div class="video-record-title">
              <h3>第 {{ index + 1 }} 单</h3>
              <Tag :type="record.tracking_number ? 'success' : 'warning'">
                {{ record.tracking_number ? '已识别单号' : '待补单号' }}
              </Tag>
            </div>
            <Field v-model="record.tracking_number" label="快递单号" placeholder="未识别时可手动补充" clearable />
            <p class="muted">
              置信度：{{ Math.round(record.tracking_confidence * 100) }}%
              <span v-if="record.tracking_evidence">；{{ record.tracking_evidence }}</span>
            </p>
            <Field
              v-model="record.raw_text"
              label="本单口述"
              type="textarea"
              rows="2"
              autosize
              placeholder="例如：这个单号里面是 5 张相纸，2 个手机壳"
            />
            <Button size="small" plain type="primary" :loading="videoLoading" @click="parseVideoRecordRawText(record)">解析本单口述</Button>
            <ItemEditor v-model="record.items" />
            <Button block type="success" :loading="videoLoading" @click="saveVideoRecord(record, false)">保存这一单</Button>
          </div>

          <div class="actions vertical">
            <Button block type="success" :loading="videoLoading" @click="saveAllVideoRecords">批量确认入库</Button>
            <Button block plain type="primary" @click="downloadVideoCsv">下载全部结果 CSV</Button>
          </div>
        </div>

        <CellGroup inset>
          <Cell title="画面" label="抽帧识别快递单号；失败时可手动修正" />
          <Cell title="音频" label="抽音频后 ASR 识别口述内容，再结构化物品" />
          <Cell title="结果" label="多条记录逐条确认后入库或导出 Excel/CSV" />
        </CellGroup>
      </section>
    </main>

    <Tabbar v-model="activeTab">
      <TabbarItem name="home">入库</TabbarItem>
      <TabbarItem name="list">记录</TabbarItem>
      <TabbarItem name="video">视频</TabbarItem>
      <TabbarItem name="detail">详情</TabbarItem>
    </Tabbar>
  </div>
</template>
