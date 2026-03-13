"use client";

import { useEffect, useRef } from "react";

import type { AgentState, ThoughtCue } from "@/lib/agent-presence";

type AgentPresenceProps = {
  state: AgentState;
  thoughtCue: ThoughtCue | null;
  messageCount: number;
  hasWarning: boolean;
};

const ASCII_RAMP = " .,:-~=+*#%@";

const STATE_TINT: Record<AgentState, [number, number, number]> = {
  idle: [214, 224, 255],
  listening: [255, 213, 102],
  thinking: [222, 182, 255],
  responding: [164, 255, 219],
  warning: [255, 130, 130],
};

const PRESENCE_MOTION: Record<AgentState, string> = {
  idle: "agent-state-idle",
  listening: "agent-state-listening",
  thinking: "agent-state-thinking",
  responding: "agent-state-responding",
  warning: "agent-state-warning",
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
    state === "thinking" ? 5.8 : state === "warning" ? 6 : state === "responding" ? 6.1 : 6.3;
  const lineHeight = cell * 1.06;
  const columns = Math.max(28, Math.floor(width / cell));
  const rows = Math.max(34, Math.floor(height / lineHeight));
  const tint = STATE_TINT[state];
  const phase = time * 0.001;

  if (bufferCtx.canvas.width !== columns || bufferCtx.canvas.height !== rows) {
    bufferCtx.canvas.width = columns;
    bufferCtx.canvas.height = rows;
  }

  const imageAspect = image.naturalWidth / image.naturalHeight;
  const targetAspect = columns / rows;
  const focusX = 0.52;
  const focusY = 0.4;
  const zoom = 1.28;
  let drawWidth = columns;
  let drawHeight = rows;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > targetAspect) {
    drawHeight = rows;
    drawWidth = drawHeight * imageAspect;
    offsetX = columns * 0.5 - drawWidth * focusX;
  } else {
    drawWidth = columns;
    drawHeight = drawWidth / imageAspect;
    offsetY = rows * 0.48 - drawHeight * focusY;
  }

  drawWidth *= zoom;
  drawHeight *= zoom;
  offsetX = columns * 0.5 - drawWidth * focusX;
  offsetY = rows * 0.48 - drawHeight * focusY;

  const driftX =
    state === "warning"
      ? Math.sin(phase * 9) * 0.9
      : state === "thinking"
        ? Math.sin(phase * 2.4) * 0.45
        : Math.sin(phase * 1.4) * 0.24;
  const driftY =
    state === "responding"
      ? Math.sin(phase * 2) * 0.35
      : state === "idle"
        ? Math.sin(phase * 1.1) * 0.18
        : Math.cos(phase * 1.7) * 0.24;
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

  visibleDrawWidth *= zoom;
  visibleDrawHeight *= zoom;

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.drawImage(
    image,
    width * 0.5 - visibleDrawWidth * focusX + visibleDriftX,
    height * 0.48 - visibleDrawHeight * focusY + visibleDriftY,
    visibleDrawWidth,
    visibleDrawHeight,
  );
  ctx.restore();
  ctx.font = `${cell}px "JetBrains Mono", monospace`;
  ctx.textBaseline = "top";

  for (let row = 0; row < rows; row += 1) {
    const scanShift =
      state === "warning" && row % 6 === 0 ? Math.sin(phase * 32 + row) * 2.2 : 0;
    const waveShift =
      state === "responding" ? Math.sin(phase * 4 + row * 0.38) * 1.2 : 0;
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
      const bottomIndex = pixelIndex + columns * 4 < frame.length ? pixelIndex + columns * 4 : pixelIndex;
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
      const signal = clamp(
        luminance * 0.34 + saturation * 0.72 + edge * 1.12,
        0,
        1,
      );
      const normX = column / Math.max(1, columns - 1);
      const normY = row / Math.max(1, rows - 1);
      const focusDistance = Math.hypot((normX - 0.5) / 0.56, (normY - 0.44) / 0.72);
      const focusGain = clamp(1.18 - focusDistance * 0.82, 0.26, 1);
      const weightedSignal = clamp(signal * (0.58 + focusGain * 0.66), 0, 1);

      if (weightedSignal < 0.09) {
        continue;
      }

      const density = clamp((weightedSignal - 0.09) / 0.91, 0, 1);
      const rampIndex = Math.floor(density * (ASCII_RAMP.length - 1));
      const glyph = ASCII_RAMP[rampIndex];

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

      const outRed = mixChannel(red, tint[0], tintMix);
      const outGreen = mixChannel(green, tint[1], tintMix);
      const outBlue = mixChannel(blue, tint[2], tintMix);
      const opacity =
        clamp(0.1 + density * 0.94, 0.1, 1) *
        scanFade *
        (0.34 + focusGain * 0.72);

      ctx.fillStyle = `rgba(${outRed}, ${outGreen}, ${outBlue}, ${opacity})`;
      ctx.fillText(glyph, column * cell + scanShift + waveShift, row * lineHeight);
    }
  }

  const sweepPosition = (Math.sin(phase * 1.6) * 0.5 + 0.5) * height;
  const sweepAlpha =
    state === "idle" ? 0.04 : state === "thinking" ? 0.08 : state === "warning" ? 0.12 : 0.06;

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

function HolographicMuse({ state }: { state: AgentState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const buffer = document.createElement("canvas");
    const bufferContext = buffer.getContext("2d", { willReadFrequently: true });

    if (!context || !bufferContext) {
      return;
    }

    const image = new window.Image();
    image.decoding = "async";
    image.src = "/api/character-image";

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
    };

    const draw = (time: number) => {
      if (disposed) {
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));

      if (image.complete && image.naturalWidth > 0) {
        renderAsciiFrame(context, bufferContext, image, width, height, state, time);
      }

      frameId = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    image.onload = () => {
      resize();
      frameId = window.requestAnimationFrame(draw);
    };

    if (image.complete && image.naturalWidth > 0) {
      frameId = window.requestAnimationFrame(draw);
    }

    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [state]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${PRESENCE_MOTION[state]}`}>
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
