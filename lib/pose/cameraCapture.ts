import {
  connectVideoStream,
  disconnectVideoStream,
} from "./video.ts";

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1_280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
};

type CameraCaptureDependencies = {
  createVideo?: () => HTMLVideoElement;
  getUserMedia?: (
    constraints: MediaStreamConstraints,
  ) => Promise<MediaStream>;
};

export type LocalCameraCapture = {
  stream: MediaStream;
  video: HTMLVideoElement;
};

export async function acquireLocalCameraCapture(
  dependencies: CameraCaptureDependencies = {},
): Promise<LocalCameraCapture> {
  const getUserMedia =
    dependencies.getUserMedia ??
    ((constraints) => navigator.mediaDevices.getUserMedia(constraints));
  const createVideo =
    dependencies.createVideo ?? (() => document.createElement("video"));

  const stream = await getUserMedia(CAMERA_CONSTRAINTS);
  const video = createVideo();

  try {
    await connectVideoStream(video, stream);
  } catch (error) {
    disconnectVideoStream(video);
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  return { stream, video };
}
