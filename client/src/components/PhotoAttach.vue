<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { Button, showToast } from 'vant';
import { deleteRecordPhoto, fetchRecordPhotoBlob, uploadRecordPhotos, type ExpressRecord, type PhotoKind } from '../api/express';

const props = defineProps<{
  record: ExpressRecord | null;
  /** Local files chosen before the record exists (entry form). */
  pendingWeighing?: File | null;
  pendingPacking?: File | null;
}>();

const emit = defineEmits<{
  'update:pendingWeighing': [file: File | null];
  'update:pendingPacking': [file: File | null];
  updated: [record: ExpressRecord];
}>();

const weighingPreview = ref('');
const packingPreview = ref('');
const uploading = ref(false);

function revoke(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

async function loadServerPreview(kind: PhotoKind) {
  if (!props.record) return '';
  const hasPhoto = kind === 'weighing' ? props.record.weighing_photo : props.record.packing_photo;
  if (!hasPhoto) return '';
  try {
    const blob = await fetchRecordPhotoBlob(props.record.id, kind);
    return URL.createObjectURL(blob);
  } catch {
    return '';
  }
}

async function refreshPreviews() {
  revoke(weighingPreview.value);
  revoke(packingPreview.value);
  weighingPreview.value = '';
  packingPreview.value = '';

  if (props.pendingWeighing) {
    weighingPreview.value = URL.createObjectURL(props.pendingWeighing);
  } else {
    weighingPreview.value = await loadServerPreview('weighing');
  }

  if (props.pendingPacking) {
    packingPreview.value = URL.createObjectURL(props.pendingPacking);
  } else {
    packingPreview.value = await loadServerPreview('packing');
  }
}

watch(
  () => [
    props.record?.id,
    props.record?.weighing_photo,
    props.record?.packing_photo,
    props.pendingWeighing,
    props.pendingPacking
  ],
  () => { void refreshPreviews(); },
  { immediate: true }
);

onBeforeUnmount(() => {
  revoke(weighingPreview.value);
  revoke(packingPreview.value);
});

function onFileChange(kind: PhotoKind, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件');
    return;
  }

  if (!props.record) {
    if (kind === 'weighing') emit('update:pendingWeighing', file);
    else emit('update:pendingPacking', file);
    return;
  }

  void uploadOne(kind, file);
}

async function uploadOne(kind: PhotoKind, file: File) {
  if (!props.record) return;
  uploading.value = true;
  try {
    const updated = await uploadRecordPhotos(props.record.id, {
      weighing: kind === 'weighing' ? file : null,
      packing: kind === 'packing' ? file : null
    });
    emit('updated', updated);
    showToast(kind === 'weighing' ? '称重照已上传' : '装箱照已上传');
  } finally {
    uploading.value = false;
  }
}

async function clearPhoto(kind: PhotoKind) {
  if (!props.record) {
    if (kind === 'weighing') emit('update:pendingWeighing', null);
    else emit('update:pendingPacking', null);
    return;
  }
  uploading.value = true;
  try {
    const updated = await deleteRecordPhoto(props.record.id, kind);
    emit('updated', updated);
    showToast('已清除图片');
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="photo-attach">
    <div class="photo-card">
      <div class="photo-title">称重照（可选）</div>
      <img v-if="weighingPreview" :src="weighingPreview" alt="称重照预览" class="photo-preview" />
      <p v-else class="muted">未添加</p>
      <label class="photo-input">
        <span>{{ record ? '拍照/上传称重照' : '选择称重照' }}</span>
        <input type="file" accept="image/*" capture="environment" :disabled="uploading" @change="onFileChange('weighing', $event)" />
      </label>
      <Button v-if="weighingPreview" size="small" plain type="danger" :loading="uploading" @click="clearPhoto('weighing')">清除</Button>
    </div>

    <div class="photo-card">
      <div class="photo-title">装箱照（可选）</div>
      <img v-if="packingPreview" :src="packingPreview" alt="装箱照预览" class="photo-preview" />
      <p v-else class="muted">未添加</p>
      <label class="photo-input">
        <span>{{ record ? '拍照/上传装箱照' : '选择装箱照' }}</span>
        <input type="file" accept="image/*" capture="environment" :disabled="uploading" @change="onFileChange('packing', $event)" />
      </label>
      <Button v-if="packingPreview" size="small" plain type="danger" :loading="uploading" @click="clearPhoto('packing')">清除</Button>
    </div>
  </div>
</template>
