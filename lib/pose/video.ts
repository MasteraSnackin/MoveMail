type VideoStreamTarget = Pick<
  HTMLVideoElement,
  "autoplay" | "muted" | "pause" | "play" | "playsInline" | "srcObject"
>;

export async function connectVideoStream(
  video: VideoStreamTarget,
  stream: MediaStream,
): Promise<void> {
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  await video.play();
}

export function disconnectVideoStream(video: VideoStreamTarget): void {
  video.pause();
  video.srcObject = null;
}
