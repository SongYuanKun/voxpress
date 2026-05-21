<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Button, Cell, CellGroup, Field, NavBar, Tabbar, TabbarItem, Tag, showConfirmDialog, showDialog, showToast } from 'vant';
import { v4 as uuidv4 } from './utils/uuid';
import { createRecord, deleteRecord, exportCsv, listRecords, parseText, parseVideo, resetRecord, updateRecord, type ExpressItem, type ExpressRecord, type VideoParseResult } from './api/express';
import ItemEditor from './components/ItemEditor.vue';
import { useSpeech } from './composables/useSpeech';

const activeTab = ref('home');
const trackingNumber = ref('');
const rawText = ref('');
const parsedItems = ref<ExpressItem[]>([]);
const records = ref<ExpressRecord[]>([]);
const selected = ref<ExpressRecord | null>(null);
const loading = ref(false);
const ttsEnabled = ref(true);
const keyword = ref('');
const accessToken = ref(localStorage.getItem('voxpress_token') || '');
const videoFile = ref<File | null>(null);
const videoResult = ref<VideoParseResult | null>(null);
const videoLoading = ref(false);
const { supported, listening, start, stop, speak } = useSpeech();

const validItems = computed(() => parsedItems.value.filter(item => item.name.trim()));
const canSave = computed(() => trackingNumber.value.trim() && rawText.value.trim() && validItems.value.length > 0);

function notify(text: string) {
  if (ttsEnabled.value) speak(text);
}

async function parseCurrentText() {
  if (!rawText.value.trim()) {
    showToast('请先输入物品内容');
    return;
  }

  loading.value = true;
  try {
    const result = await parseText(rawText.value);
    parsedItems.value = result.items.length ? result.items : [{ name: '', quantity: 1, unit: '' }];
    notify('解析完成，请确认物品清单');
  } finally {
    loading.value = false;
  }
}

async function saveRecord(duplicateConfirmed = false) {
  if (!canSave.value) {
    showToast('请补全单号和物品清单');
    return;
  }

  loading.value = true;
  try {
    await createRecord({
      client_request_id: uuidv4(),
      tracking_number: trackingNumber.value.trim(),
      raw_text: rawText.value.trim(),
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
  const data = await listRecords({ keyword: keyword.value || undefined });
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
  const blob = await exportCsv({ keyword: keyword.value || undefined });
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

function onVideoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  videoFile.value = input.files?.[0] || null;
  videoResult.value = null;
}

async function submitVideo() {
  if (!videoFile.value) return;
  videoLoading.value = true;
  try {
    videoResult.value = await parseVideo(videoFile.value);
    if (!videoResult.value.items.length) {
      videoResult.value.items = [{ name: '', quantity: 1, unit: '' }];
    }
    showToast('视频解析完成');
    notify('视频解析完成，请确认结果');
  } finally {
    videoLoading.value = false;
  }
}

async function parseVideoRawText() {
  if (!videoResult.value?.raw_text.trim()) {
    showToast('请先补充口述内容');
    return;
  }
  videoLoading.value = true;
  try {
    const parsed = await parseText(videoResult.value.raw_text);
    videoResult.value.items = parsed.items.length ? parsed.items : [{ name: '', quantity: 1, unit: '' }];
    showToast('物品解析完成');
  } finally {
    videoLoading.value = false;
  }
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
    ...videoResult.value.items.map(item => [
      videoResult.value?.tracking_number || '',
      videoResult.value?.raw_text || '',
      item.name,
      item.quantity,
      item.unit
    ])
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

async function saveVideoRecord(duplicateConfirmed = false) {
  if (!videoResult.value) return;
  const items = videoResult.value.items.filter(item => item.name.trim());
  if (!videoResult.value.tracking_number || !items.length) {
    showToast('请先补全单号和物品清单');
    return;
  }

  videoLoading.value = true;
  try {
    await createRecord({
      client_request_id: uuidv4(),
      tracking_number: videoResult.value.tracking_number,
      raw_text: videoResult.value.raw_text,
      items,
      duplicate_confirmed: duplicateConfirmed
    });
    showToast('视频入库成功');
    notify('视频入库成功');
    await refreshRecords();
  } catch (error: any) {
    if (error?.code === 1008) {
      await showConfirmDialog({
        title: '重复单号',
        message: '该单号已有记录，是否仍然保存为新记录？'
      });
      await saveVideoRecord(true);
    }
  } finally {
    videoLoading.value = false;
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
          <Field v-model="videoResult.tracking_number" label="快递单号" placeholder="未识别时可手动补充" clearable />
          <p class="muted">
            置信度：{{ Math.round(videoResult.tracking_confidence * 100) }}%
            <span v-if="videoResult.tracking_evidence">；{{ videoResult.tracking_evidence }}</span>
          </p>
          <p v-for="warning in videoResult.warnings" :key="warning" class="warning-text">{{ warning }}</p>
          <Field
            v-model="videoResult.raw_text"
            label="口述内容"
            type="textarea"
            rows="3"
            autosize
            placeholder="如果音频识别失败，可在这里手动补充口述内容"
          />
          <Button block plain type="primary" :loading="videoLoading" @click="parseVideoRawText">解析口述内容</Button>
          <ItemEditor v-model="videoResult.items" />
          <div class="actions vertical">
            <Button block type="success" :loading="videoLoading" @click="saveVideoRecord(false)">确认入库</Button>
            <Button block plain type="primary" @click="downloadVideoCsv">下载当前结果 CSV</Button>
          </div>
        </div>

        <CellGroup inset>
          <Cell title="画面" label="抽帧识别快递单号；失败时可手动修正" />
          <Cell title="音频" label="抽音频后 ASR 识别口述内容，再结构化物品" />
          <Cell title="结果" label="人工确认后入库或导出 Excel/CSV" />
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
