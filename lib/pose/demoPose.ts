import type { PoseLandmark } from "./types";

const LANDMARK_COUNT = 33;

function point(
  x: number,
  y: number,
  z = 0,
  visibility = 1,
): PoseLandmark {
  return { x, y, z, visibility };
}

/**
 * Produces an explicitly labelled, synthetic pose for the UI demo fallback.
 * It is never presented as camera-derived tracking data.
 */
export function createDemoPose(timestampMs: number): PoseLandmark[] {
  const pose = Array.from({ length: LANDMARK_COUNT }, () =>
    point(0.5, 0.5, 0, 0.95),
  );
  const phase = (timestampMs / 1_800) * Math.PI * 2;
  const leftLift = (Math.sin(phase) + 1) / 2;
  const rightLift = (Math.sin(phase + Math.PI) + 1) / 2;

  // Face.
  pose[0] = point(0.5, 0.18);
  pose[1] = point(0.48, 0.17);
  pose[2] = point(0.47, 0.17);
  pose[3] = point(0.46, 0.18);
  pose[4] = point(0.52, 0.17);
  pose[5] = point(0.53, 0.17);
  pose[6] = point(0.54, 0.18);
  pose[7] = point(0.43, 0.2);
  pose[8] = point(0.57, 0.2);
  pose[9] = point(0.48, 0.22);
  pose[10] = point(0.52, 0.22);

  // Upper body and alternating arm reaches.
  pose[11] = point(0.4, 0.34);
  pose[12] = point(0.6, 0.34);
  pose[13] = point(0.33, 0.45 - leftLift * 0.16);
  pose[14] = point(0.67, 0.45 - rightLift * 0.16);
  pose[15] = point(0.25, 0.56 - leftLift * 0.34);
  pose[16] = point(0.75, 0.56 - rightLift * 0.34);
  pose[17] = point(0.23, 0.57 - leftLift * 0.34);
  pose[18] = point(0.77, 0.57 - rightLift * 0.34);
  pose[19] = point(0.24, 0.55 - leftLift * 0.34);
  pose[20] = point(0.76, 0.55 - rightLift * 0.34);
  pose[21] = point(0.27, 0.54 - leftLift * 0.33);
  pose[22] = point(0.73, 0.54 - rightLift * 0.33);

  // Seated lower body.
  pose[23] = point(0.44, 0.64);
  pose[24] = point(0.56, 0.64);
  pose[25] = point(0.42, 0.82);
  pose[26] = point(0.58, 0.82);
  pose[27] = point(0.4, 0.95);
  pose[28] = point(0.6, 0.95);
  pose[29] = point(0.39, 0.97);
  pose[30] = point(0.61, 0.97);
  pose[31] = point(0.43, 0.98);
  pose[32] = point(0.57, 0.98);

  return pose;
}
