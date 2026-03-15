"use client";

import { useEffect, useRef } from "react";

import type { AgentState, ThoughtCue } from "@/lib/agent-presence";

type AgentPresenceProps = {
  state: AgentState;
  thoughtCue: ThoughtCue | null;
  messageCount: number;
  hasWarning: boolean;
};

const ASCII_RAMP = " .'`^,:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const BACKGROUND_RAMP = " .:-";

type PresenceTone = "base" | "active" | "response";

const TONE_TINT: Record<PresenceTone, [number, number, number]> = {
  base: [86, 90, 98],
  active: [102, 255, 158],
  response: [255, 96, 96],
};

const PRESENCE_PROFILE = { focusX: 0.52, focusY: 0.4, zoom: 1.28 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mixChannel(base: number, tint: number, amount: number) {
  return Math.round(base + (tint - base) * amount);
}

function renderAsciiFrame(
  ctx: CanvasRenderingContext2D,
  bufferCtx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  tone: PresenceTone,
  time: number,
) {
  const cell = 5.2;
  const lineHeight = cell * 1.01;
  const columns = Math.max(28, Math.floor(width / cell));
  const rows = Math.max(34, Math.floor(height / lineHeight));
  const tint = TONE_TINT[tone];
  const profile = PRESENCE_PROFILE;
  const phase = time * 0.001;

  if (bufferCtx.canvas.width !== columns || bufferCtx.canvas.height !== rows) {
    bufferCtx.canvas.width = columns;
    bufferCtx.canvas.height = rows;
  }

  const imageAspect = image.naturalWidth / image.naturalHeight;
  const targetAspect = columns / rows;
  let drawWidth = columns;
  let drawHeight = rows;

  if (imageAspect > targetAspect) {
    drawHeight = rows;
    drawWidth = drawHeight * imageAspect;
  } else {
    drawWidth = columns;
    drawHeight = drawWidth / imageAspect;
  }

  drawWidth *= profile.zoom;
  drawHeight *= profile.zoom;

  const offsetX = columns * 0.5 - drawWidth * profile.focusX;
  const offsetY = rows * 0.48 - drawHeight * profile.focusY;
  const driftX = 0;
  const driftY = 0;
  const visibleDriftX = (driftX / Math.max(1, columns)) * width;
  const visibleDriftY = (driftY / Math.max(1, rows)) * height;

  bufferCtx.clearRect(0, 0, columns, rows);
  bufferCtx.drawImage(image, offsetX + driftX, offsetY + driftY, drawWidth, drawHeight);

  const frame = bufferCtx.getImageData(0, 0, columns, rows).data;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#04070d";
  ctx.fillRect(0, 0, width, height);

  let visibleDrawWidth = width;
  let visibleDrawHeight = height;

  if (imageAspect > width / height) {
    visibleDrawHeight = height;
    visibleDrawWidth = visibleDrawHeight * imageAspect;
  } else {
    visibleDrawWidth = width;
    visibleDrawHeight = visibleDrawWidth / imageAspect;
  }

  visibleDrawWidth *= profile.zoom;
  visibleDrawHeight *= profile.zoom;

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.drawImage(
    image,
    width * 0.5 - visibleDrawWidth * profile.focusX + visibleDriftX,
    height * 0.48 - visibleDrawHeight * profile.focusY + visibleDriftY,
    visibleDrawWidth,
    visibleDrawHeight,
  );
  ctx.restore();
  ctx.fillStyle = tone === "base" ? "rgba(4, 7, 13, 0.52)" : "rgba(4, 7, 13, 0.34)";
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${cell}px "JetBrains Mono", monospace`;
  ctx.textBaseline = "top";

  for (let row = 0; row < rows; row += 1) {
    const scanShift = 0;
    const waveShift = 0;
    const scanFade = 0.92 + Math.sin(phase * 6 + row * 0.42) * 0.08;

    for (let column = 0; column < columns; column += 1) {
      const pixelIndex = (row * columns + column) * 4;
      const red = frame[pixelIndex];
      const green = frame[pixelIndex + 1];
      const blue = frame[pixelIndex + 2];
      const alpha = frame[pixelIndex + 3] / 255;

      if (alpha < 0.02) {
        continue;
      }

      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      const rightIndex = pixelIndex + 4 < frame.length ? pixelIndex + 4 : pixelIndex;
      const bottomIndex =
        pixelIndex + columns * 4 < frame.length ? pixelIndex + columns * 4 : pixelIndex;
      const rightLuminance =
        (0.2126 * frame[rightIndex] +
          0.7152 * frame[rightIndex + 1] +
          0.0722 * frame[rightIndex + 2]) /
        255;
      const bottomLuminance =
        (0.2126 * frame[bottomIndex] +
          0.7152 * frame[bottomIndex + 1] +
          0.0722 * frame[bottomIndex + 2]) /
        255;
      const saturation = (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
      const edge = clamp(
        Math.abs(luminance - rightLuminance) + Math.abs(luminance - bottomLuminance),
        0,
        1,
      );
      const signal = clamp(luminance * 0.34 + saturation * 0.72 + edge * 1.12, 0, 1);
      const normX = column / Math.max(1, columns - 1);
      const normY = row / Math.max(1, rows - 1);
      const focusDistance = Math.hypot(
        (normX - 0.5) / 0.56,
        (normY - 0.44) / 0.72,
      );
      const focusGain = clamp(1.18 - focusDistance * 0.82, 0.26, 1);
      const weightedSignal = clamp(signal * (0.48 + focusGain * 0.82), 0, 1);
      const backgroundGate = clamp((focusGain - 0.24) / 0.76, 0, 1);

      if (weightedSignal < 0.09) {
        continue;
      }

      const density = clamp((weightedSignal - 0.09) / 0.91, 0, 1);
      const ramp = backgroundGate > 0.62 ? ASCII_RAMP : BACKGROUND_RAMP;
      const rampIndex = Math.floor(density * (ramp.length - 1));
      const glyph = ramp[rampIndex];

      if (glyph === " ") {
        continue;
      }

      const tintMix = tone === "base" ? 0.08 : tone === "active" ? 0.2 : 0.3;

      const neutralTone = Math.round(38 + weightedSignal * 176);
      const paletteMix =
        tone === "base" ? 0.28 : tone === "active" ? 0.44 : 0.56;
      const outRed = mixChannel(neutralTone, tint[0], paletteMix + tintMix * 0.2);
      const outGreen = mixChannel(neutralTone, tint[1], paletteMix + tintMix * 0.2);
      const outBlue = mixChannel(neutralTone, tint[2], paletteMix + tintMix * 0.2);
      const opacity =
        clamp(0.1 + density * 0.94, 0.1, 1) *
        scanFade *
        (0.18 + backgroundGate * 0.88);

      ctx.fillStyle = `rgba(${outRed}, ${outGreen}, ${outBlue}, ${opacity})`;
      ctx.fillText(glyph, column * cell + scanShift + waveShift, row * lineHeight);
    }
  }

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    width * 0.12,
    width * 0.5,
    height * 0.5,
    width * 0.78,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(4, 7, 13, 0.36)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const sweepPosition = (Math.sin(phase * 1.6) * 0.5 + 0.5) * height;
  const sweepAlpha =
    tone === "base" ? 0.01 : tone === "active" ? 0.03 : 0.06;

  ctx.fillStyle = `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${sweepAlpha})`;
  ctx.fillRect(0, sweepPosition, width, Math.max(8, height * 0.035));

  if (tone === "response") {
    ctx.fillStyle = "rgba(255, 120, 120, 0.08)";
    for (let index = 0; index < 4; index += 1) {
      const y = ((phase * 120 + index * 56) % height);
      ctx.fillRect(0, y, width, 1);
    }
  }
}

function loadPresenceImage() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load presence image."));
    image.src = "/api/character-image?state=idle";

    if (image.complete && image.naturalWidth > 0) {
      resolve(image);
    }
  });
}

function HolographicMuse({
  state,
  messageCount,
  hasWarning,
}: {
  state: AgentState;
  messageCount: number;
  hasWarning: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const toneRef = useRef<PresenceTone>("base");

  useEffect(() => {
    let cancelled = false;

    void loadPresenceImage()
      .then((image) => {
        if (cancelled) {
          return;
        }
        imageRef.current = image;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    toneRef.current =
      hasWarning || state === "responding" || state === "thinking" || state === "listening"
        ? "response"
        : messageCount > 0
          ? "active"
          : "base";
  }, [hasWarning, messageCount, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const layerA = document.createElement("canvas");
    const layerContextA = layerA.getContext("2d");
    const bufferA = document.createElement("canvas");
    const bufferContextA = bufferA.getContext("2d", { willReadFrequently: true });

    if (!context || !layerContextA || !bufferContextA) {
      return;
    }

    let frameId = 0;
    let disposed = false;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;

      layerA.width = width;
      layerA.height = height;
    };

    const draw = (time: number) => {
      if (disposed) {
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      const image = imageRef.current;
      const tone = toneRef.current;

      context.clearRect(0, 0, width, height);
      context.fillStyle = "#04070d";
      context.fillRect(0, 0, width, height);

      if (image) {
        renderAsciiFrame(layerContextA, bufferContextA, image, width, height, tone, time);
        context.save();
        context.globalAlpha = 1;
        context.drawImage(layerA, 0, 0, width, height);
        context.restore();
      }

      frameId = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frameId = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}

export function AgentPresence({ state, messageCount, hasWarning }: AgentPresenceProps) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-[22rem] items-end justify-center px-6 pb-6">
      <div className="relative h-[30rem] w-full">
        <div className="absolute inset-x-0 bottom-0 top-12">
          <HolographicMuse state={state} messageCount={messageCount} hasWarning={hasWarning} />
        </div>
      </div>
    </div>
  );
}
