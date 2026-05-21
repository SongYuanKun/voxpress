import { ref } from 'vue';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function useSpeech() {
  const supported = Boolean(window.webkitSpeechRecognition || window.SpeechRecognition);
  const listening = ref(false);
  let recognition: SpeechRecognitionLike | null = null;

  function start(onText: (text: string) => void) {
    const Ctor = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!Ctor) return false;

    recognition = new Ctor();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript || '';
      if (text) onText(text);
    };
    recognition.onerror = () => {
      listening.value = false;
    };
    recognition.onend = () => {
      listening.value = false;
    };
    recognition.start();
    listening.value = true;
    return true;
  }

  function stop() {
    recognition?.stop();
    listening.value = false;
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  }

  return { supported, listening, start, stop, speak };
}

