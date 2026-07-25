export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type PoseCameraStatus =
  | "idle"
  | "requesting-permission"
  | "initialising"
  | "ready"
  | "tracking"
  | "no-pose"
  | "demo"
  | "error";

export interface PoseWorkerInitMessage {
  type: "init";
  wasmBaseUrl: string;
  modelUrl: string;
}

export interface PoseWorkerFrameMessage {
  type: "frame";
  frame: ImageBitmap;
  timestampMs: number;
}

export interface PoseWorkerDisposeMessage {
  type: "dispose";
}

export type PoseWorkerRequest =
  | PoseWorkerInitMessage
  | PoseWorkerFrameMessage
  | PoseWorkerDisposeMessage;

export interface PoseWorkerReadyMessage {
  type: "ready";
}

export interface PoseWorkerResultMessage {
  type: "result";
  landmarks: PoseLandmark[] | null;
  confidence: number;
}

export interface PoseWorkerErrorMessage {
  type: "error";
  message: string;
  fatal: boolean;
}

export type PoseWorkerResponse =
  | PoseWorkerReadyMessage
  | PoseWorkerResultMessage
  | PoseWorkerErrorMessage;
