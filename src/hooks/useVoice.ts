'use client';

import { useState, useCallback, useRef } from 'react';

export function useVoice() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!isSupported) return;

    // Already listening → stop
    if (recognitionRef.current) {
      stop();
      return;
    }

    setError('');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.interimResults = true;
    rec.continuous = false; // false = auto-stop after silence, more reliable
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalText + interim);
    };

    rec.onerror = (event: any) => {
      // Only show meaningful errors to user
      if (event.error === 'not-allowed') {
        setError('麦克风权限未授权');
      } else if (event.error === 'no-speech') {
        setError('未检测到语音');
      } else if (event.error === 'audio-capture') {
        setError('未找到麦克风设备');
      }
      // 'aborted' is normal when stopping, ignore
      stop();
    };

    rec.onend = () => {
      stop();
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setTranscript('');
    } catch (e: any) {
      setError(e.message || '语音启动失败');
      recognitionRef.current = null;
    }
  }, [isSupported, stop]);

  const clearError = useCallback(() => setError(''), []);

  return { listening, transcript, error, start, stop, clearError, isSupported };
}
