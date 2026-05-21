<script setup lang="ts">
import { computed } from 'vue';
import { Button, Field, Stepper } from 'vant';
import type { ExpressItem } from '../api/express';

const props = defineProps<{
  modelValue: ExpressItem[];
}>();

const emit = defineEmits<{
  'update:modelValue': [items: ExpressItem[]];
}>();

const items = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function update(index: number, patch: Partial<ExpressItem>) {
  items.value = items.value.map((item, current) => current === index ? { ...item, ...patch } : item);
}

function remove(index: number) {
  items.value = items.value.filter((_, current) => current !== index);
}

function add() {
  items.value = [...items.value, { name: '', quantity: 1, unit: '' }];
}
</script>

<template>
  <div class="item-editor">
    <div v-for="(item, index) in items" :key="index" class="item-row">
      <Field
        class="item-name"
        :model-value="item.name"
        placeholder="物品名"
        @update:model-value="value => update(index, { name: String(value) })"
      />
      <Stepper
        :model-value="item.quantity"
        integer
        min="1"
        @update:model-value="value => update(index, { quantity: Number(value) })"
      />
      <Field
        class="item-unit"
        :model-value="item.unit"
        placeholder="单位"
        @update:model-value="value => update(index, { unit: String(value) })"
      />
      <Button size="small" type="danger" plain @click="remove(index)">删除</Button>
    </div>
    <Button block plain type="primary" @click="add">添加物品</Button>
  </div>
</template>

