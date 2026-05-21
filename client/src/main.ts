import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Vant from 'vant';
import 'vant/lib/index.css';
import './styles/main.css';
import App from './App.vue';

createApp(App).use(createPinia()).use(Vant).mount('#app');

