<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Button, Cell, CellGroup, Field, NavBar, Tabbar, TabbarItem, Tag, showConfirmDialog, showDialog, showToast } from 'vant';
import { v4 as uuidv4 } from './utils/uuid';
import { createRecord, deleteRecord, exportCsv, listRecords, parseText, resetRecord, updateRecord, type ExpressItem, type ExpressRecord } from './api/express';
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
}

function submitVideoSpike() {
  showDialog({
    title: '视频解析 Spike',
    message: '当前入口已开放，但自动解析还未接入。下一步会实现：抽帧识别单号、抽音频 ASR、LLM 解析物品、人工确认后入库或导出。'
  });
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
          <p class="muted">
            P1 Spike：视频画面识别快递单号，音频识别你口述的物品内容，再生成可确认的入库清单和 Excel/CSV。
          </p>
          <input class="video-input" type="file" accept="video/*" capture="environment" @change="onVideoSelected" />
          <p v-if="videoFile" class="muted">已选择：{{ videoFile.name }}</p>
          <Button block type="primary" :disabled="!videoFile" @click="submitVideoSpike">上传并解析</Button>
        </div>

        <CellGroup inset>
          <Cell title="画面" label="抽帧识别条码/二维码；失败时 OCR 面单文本" />
          <Cell title="音频" label="抽音频后 ASR 识别口述内容" />
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
