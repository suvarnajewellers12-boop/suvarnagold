import { useRef } from "react";
import { useAccessibility } from "../components/context/AccessibilityContext";

type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
};

export const useSpeech = () => {
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { isEnabled } = useAccessibility();

  // 🔊 STOP CURRENT SPEECH
  const stop = () => {
    if (window.speechSynthesis.speaking) {
      console.log("🛑 Stopping current speech");
      window.speechSynthesis.cancel();
    }
    currentUtteranceRef.current = null;
  };

  // 🔊 SPEAK FUNCTION
  const speak = (text: string, options?: SpeakOptions) => {
    if (!isEnabled) {
      console.log("🚫 Accessibility OFF → skipping speech");
      return;
    }

    if (!text) return;

    console.log("🗣️ Speaking:", text);

    // ✅ Always stop previous speech
    stop();

    const utterance = new SpeechSynthesisUtterance(text);

    // 🎚️ Consistent config
    utterance.rate = options?.rate ?? 0.9;
    utterance.pitch = options?.pitch ?? 1;
    utterance.volume = options?.volume ?? 1;

    // 🎤 Select stable voice
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      utterance.voice = voices[0];
    }

    utterance.onstart = () => console.log("🎤 Speech started");
    utterance.onend = () => console.log("✅ Speech finished");
    utterance.onerror = (e) =>
      console.log("❌ Speech error:", e.error);

    currentUtteranceRef.current = utterance;

    window.speechSynthesis.speak(utterance);
  };

  return {
    speak,
    stop,
  };
};