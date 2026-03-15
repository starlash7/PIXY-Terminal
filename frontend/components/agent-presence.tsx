"use client";

import { useEffect, useRef } from "react";

import type { AgentState, ThoughtCue } from "@/lib/agent-presence";

type AgentPresenceProps = {
  state: AgentState;
  thoughtCue: ThoughtCue | null;
  messageCount: number;
  hasWarning: boolean;
};

type PresenceAsset = {
  image: HTMLImageElement;
  state: AgentState;
};

type PresenceProfile = {
  focusX: number;
  focusY: number;
  zoom: number;
};

const ASCII_RAMP = " .'`^,:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const BACKGROUND_RAMP = " .:-";

const STATE_TINT: Record<AgentState, [number, number, number]> = {
  idle: [214, 224, 255],
  listening: [255, 213, 102],
  thinking: [222, 182, 255],
  responding: [164, 255, 219],
  warning: [255, 130, 130],
};

const STATE_PROFILE: Record<AgentState, PresenceProfile> = {
  idle: { focusX: 0.52, focusY: 0.4, zoom: 1.28 },
  listening: { focusX: 0.52, focusY: 0.4, zoom: 1.3 },
  thinking: { focusX: 0.515, focusY: 0.39, zoom: 1.32 },
  responding: { focusX: 0.525, focusY: 0.41, zoom: 1.26 },
  warning: { focusX: 0.515, focusY: 0.39, zoom: 1.34 },
};

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
  state: AgentState,
  time: number,
) {
  const cell =
    state === "thinking" ? 5.05 : state === "warning" ? 5.2 : state === "responding" ? 5.25 : 5.35;
  const lineHeight = cell * 1.01;
  const columns = Math.max(28, Math.floor(width / cell));
  const rows = Math.max(34, Math.floor(height / lineHeight));
  const tint = STATE_TINT[state];
  const profile = STATE_PROFILE[state];
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
  const driftX = state === "warning" ? Math.sin(phase * 9) * 0.42 : 0;
  const driftY = state === "warning" ? Math.cos(phase * 8) * 0.18 : 0;
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
  ctx.fillStyle = "rgba(4, 7, 13, 0.28)";
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${cell}px "JetBrains Mono", monospace`;
  ctx.textBaseline = "top";

  for (let row = 0; row < rows; row += 1) {
    const scanShift =
      state === "warning" && row % 6 === 0 ? Math.sin(phase * 32 + row) * 2.2 : 0;
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

      const tintMix =
        state === "idle"
          ? 0.16
          : state === "responding"
            ? 0.24
            : state === "thinking"
              ? 0.22
              : state === "listening"
                ? 0.18
                : 0.34;

      const neutralTone = Math.round(38 + weightedSignal * 176);
      const paletteMix =
        state === "warning"
          ? 0.58
          : state === "responding"
            ? 0.52
            : state === "thinking"
              ? 0.5
              : 0.46;
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
    state === "idle" ? 0.02 : state === "thinking" ? 0.04 : state === "warning" ? 0.08 : 0.03;

  ctx.fillStyle = `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${sweepAlpha})`;
  ctx.fillRect(0, sweepPosition, width, Math.max(8, height * 0.035));

  if (state === "warning") {
    ctx.fillStyle = "rgba(255, 120, 120, 0.08)";
    for (let index = 0; index < 4; index += 1) {
      const y = ((phase * 120 + index * 56) % height);
      ctx.fillRect(0, y, width, 1);
    }
  }
}

function loadPresenceImage(state: AgentState) {
  return new Promise<PresenceAsset>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve({ image, state });
    image.onerror = () => reject(new Error(`Failed to load presence image for ${state}`));
    image.src = `/api/character-image?state=${state}`;

    if (image.complete && image.naturalWidth > 0) {
      resolve({ image, state });
    }
  });
}

function HolographicMuse({ state }: { state: AgentState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentAssetRef = useRef<PresenceAsset | null>(null);
  const previousAssetRef = useRef<PresenceAsset | null>(null);
  const transitionStartRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadPresenceImage(state)
      .then((asset) => {
        if (cancelled) {
          return;
        }

        if (!currentAssetRef.current) {
          currentAssetRef.current = asset;
          previousAssetRef.current = null;
          transitionStartRef.current = null;
          return;
        }

        previousAssetRef.current = currentAssetRef.current;
        currentAssetRef.current = asset;
        transitionStartRef.current = performance.now();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const layerA = document.createElement("canvas");
    const layerB = document.createElement("canvas");
    const layerContextA = layerA.getContext("2d");
    const layerContextB = layerB.getContext("2d");
    const bufferA = document.createElement("canvas");
    const bufferB = document.createElement("canvas");
    const bufferContextA = bufferA.getContext("2d", { willReadFrequently: true });
    const bufferContextB = bufferB.getContext("2d", { willReadFrequently: true });

    if (!context || !layerContextA || !layerContextB || !bufferContextA || !bufferContextB) {
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
      layerB.width = width;
      layerB.height = height;
    };

    const draw = (time: number) => {
      if (disposed) {
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      const currentAsset = currentAssetRef.current;

      context.clearRect(0, 0, width, height);
      context.fillStyle = "#04070d";
      context.fillRect(0, 0, width, height);

      if (currentAsset) {
        const previousAsset = previousAssetRef.current;
        const transitionStart = transitionStartRef.current;
        const progress =
          previousAsset && transitionStart !== null
            ? clamp((time - transitionStart) / 320, 0, 1)
            : 1;

        renderAsciiFrame(
          layerContextA,
          bufferContextA,
          currentAsset.image,
          width,
          height,
          currentAsset.state,
          time,
        );

        if (previousAsset && progress < 1) {
          renderAsciiFrame(
            layerContextB,
            bufferContextB,
            previousAsset.image,
            width,
            height,
            previousAsset.state,
            time,
          );
          context.save();
          context.globalAlpha = 1 - progress;
          context.drawImage(layerB, 0, 0, width, height);
          context.restore();
        }

        context.save();
        context.globalAlpha = previousAsset ? progress : 1;
        context.drawImage(layerA, 0, 0, width, height);
        context.restore();

        if (previousAsset && progress >= 1) {
          previousAssetRef.current = null;
          transitionStartRef.current = null;
        }
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

export function AgentPresence({ state }: AgentPresenceProps) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-[22rem] items-end justify-center px-6 pb-6">
      <div className="relative h-[30rem] w-full">
        <div className="absolute inset-x-0 bottom-0 top-12">
          <HolographicMuse state={state} />
        </div>
      </div>
    </div>
  );
}
