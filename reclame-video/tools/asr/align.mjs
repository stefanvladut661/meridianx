// Timpii cuvintelor din fișierele de voce, cu Whisper prin transformers.js
// (ONNX Runtime; merge și pe procesoare fără AVX2). Cuvintele auzite se
// aliniază apoi la textul știut. Ieșire: JSON brut cu cuvintele auzite.
// Folosire: node align.mjs <wav 16 kHz mono> <ieșire.json> [de la s] [până la s]
// Fișierele peste 30 s se transcriu pe bucăți tăiate în pauze: pe fereastră
// glisantă, transformers.js pierde cuvinte când cere și timpi pe cuvânt.

import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync } from "node:fs";

const [wavPath, outPath, fromS = "0", toS = "", modelId = "Xenova/whisper-small"] = process.argv.slice(2);

function readWav16(path) {
  const b = readFileSync(path);
  let o = 12;
  let fmt = null;
  let data = null;
  while (o < b.length) {
    const id = b.toString("ascii", o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { channels: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === "data") data = b.subarray(o + 8, o + 8 + size);
    o += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16 || fmt.channels !== 1 || fmt.rate !== 16000) throw new Error("Aștept WAV PCM 16-bit mono 16 kHz");
  const out = new Float32Array(data.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2) / 32768;
  return out;
}

const full = readWav16(wavPath);
const a0 = Math.round(Number(fromS) * 16000);
const a1 = toS ? Math.round(Number(toS) * 16000) : full.length;
const audio = full.subarray(a0, a1);
const off = a0 / 16000;
const asr = await pipeline("automatic-speech-recognition", modelId, { dtype: "fp32" });
const t0 = Date.now();
const res = await asr(audio, {
  language: "romanian",
  task: "transcribe",
  return_timestamps: "word",
});
const words = (res.chunks ?? []).map((c) => ({ text: c.text.trim(), start: c.timestamp[0] + off, end: c.timestamp[1] + off }));
writeFileSync(outPath, JSON.stringify({ text: res.text, words }, null, 1));
console.log(`${wavPath}: ${words.length} cuvinte în ${((Date.now() - t0) / 1000).toFixed(1)} s — ${res.text.slice(0, 100)}`);
